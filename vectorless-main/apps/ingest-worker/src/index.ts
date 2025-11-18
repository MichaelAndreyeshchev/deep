import "dotenv/config";
import path from "node:path";

import PQueue from "p-queue";

import { prisma, Prisma } from "@vectorless/db";
import {
  chunkPages,
  readStoredFile,
  ChunkDescriptor,
  extractPdfPages
} from "@vectorless/core";

const CONCURRENCY = Number(process.env.INGEST_CONCURRENCY ?? 3);
const POLL_INTERVAL_MS = Number(process.env.INGEST_POLL_INTERVAL ?? 3000);
const POLL_BATCH_SIZE = Number(process.env.INGEST_BATCH_SIZE ?? 5);

type DocumentRecord = Awaited<
  ReturnType<typeof prisma.document.findMany>
>[number];

async function emitProgress(
  runId: string | null | undefined,
  message: string,
  progress: number,
  payload?: Prisma.InputJsonValue
) {
  if (!runId) {
    return;
  }

  await prisma.progressEvent.create({
    data: {
      runId,
      phase: "ingest",
      message,
      progress,
      payload
    }
  });
}

async function processDocument(document: DocumentRecord) {
  try {
    await emitProgress(
      document.runId,
      `Processing ${document.filename}`,
      15,
      { documentId: document.id }
    );

    const fileBuffer = await readStoredFile(document.storagePath);
    const pages = await extractPdfPages(fileBuffer);
    const chunks = chunkPages(pages, {
      maxCharsPerChunk: Number(process.env.CHUNK_MAX_CHARS ?? 1400),
      overlapRatio: 0.1
    });

    await persistChunks(document, chunks, pages.length);

    await emitProgress(
      document.runId,
      `Completed ingestion for ${document.filename}`,
      100,
      { documentId: document.id, chunks: chunks.length }
    );
  } catch (error) {
    console.error("[ingest-worker] Failed to process document", {
      documentId: document.id,
      error
    });

    await prisma.document.update({
      where: { id: document.id },
      data: { status: "failed" }
    });

    await emitProgress(
      document.runId,
      `Failed to process ${document.filename}`,
      100,
      { documentId: document.id, error: (error as Error).message }
    );
  }
}

async function persistChunks(
  document: DocumentRecord,
  chunks: ChunkDescriptor[],
  pageCount: number
) {
  await prisma.$transaction(async (tx) => {
    await tx.source.upsert({
      where: { documentId: document.id },
      update: {
        title: document.filename
      },
      create: {
        documentId: document.id,
        title: document.filename,
        type: "pdf",
        reliabilityScore: 0.85
      }
    });

    if (chunks.length) {
      await tx.chunk.createMany({
        data: chunks.map((chunk) => ({
          documentId: document.id,
          orderIndex: chunk.order,
          pageNumber: chunk.pageNumber,
          heading: chunk.heading,
          text: chunk.text,
          citationKey: `DOC-${document.id}-${chunk.order}`,
          metadata: {
            pageNumber: chunk.pageNumber
          }
        }))
      });
    }

    await tx.document.update({
      where: { id: document.id },
      data: {
        status: "ready",
        pageCount,
        updatedAt: new Date()
      }
    });
  });
}

async function claimPendingDocuments(): Promise<DocumentRecord[]> {
  const pending = await prisma.document.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: POLL_BATCH_SIZE
  });

  const claimed: DocumentRecord[] = [];

  for (const doc of pending) {
    const updateResult = await prisma.document.updateMany({
      where: { id: doc.id, status: "pending" },
      data: { status: "processing" }
    });

    if (updateResult.count === 1) {
      claimed.push({ ...doc, status: "processing" });
    }
  }

  return claimed;
}

async function poll(queue: PQueue) {
  const docs = await claimPendingDocuments();
  docs.forEach((doc) =>
    queue.add(async () => {
      console.log(
        `[ingest-worker] → processing ${doc.filename} (${doc.id.slice(0, 6)})`
      );
      await processDocument(doc);
    })
  );
}

async function main() {
  console.log(
    `[ingest-worker] starting (cwd=${path.basename(
      process.cwd()
    )}, concurrency=${CONCURRENCY})`
  );
  const queue = new PQueue({ concurrency: CONCURRENCY });

  await poll(queue);
  setInterval(() => {
    poll(queue).catch((error) =>
      console.error("[ingest-worker] poll error", error)
    );
  }, POLL_INTERVAL_MS);
}

main().catch((error) => {
  console.error("[ingest-worker] Unhandled error", error);
  process.exit(1);
});

