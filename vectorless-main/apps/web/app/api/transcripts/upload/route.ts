import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import { prisma } from "@vectorless/db";
import {
  parseTranscriptText,
  persistFile,
  extractPdfPages
} from "@vectorless/core";

export const runtime = "nodejs";

const metadataSchema = z.object({
  runId: z.string().cuid().optional(),
  company: z.string().optional(),
  interviewer: z.string().optional(),
  interviewee: z.string().optional(),
  recordedAt: z.string().datetime().optional()
});

async function fileToText(file: File): Promise<{ buffer: Buffer; text: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    const pages = await extractPdfPages(buffer);
    return {
      buffer,
      text: pages.map((page) => page.text).join("\n\n")
    };
  }

  return {
    buffer,
    text: buffer.toString("utf-8")
  };
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const parsed = metadataSchema.safeParse({
    runId: formData.get("runId") || undefined,
    company: formData.get("company") || undefined,
    interviewer: formData.get("interviewer") || undefined,
    interviewee: formData.get("interviewee") || undefined,
    recordedAt: formData.get("recordedAt") || undefined
  });

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing transcript file" },
      { status: 400 }
    );
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { buffer, text } = await fileToText(file);
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

  const segments = parseTranscriptText(text);
  if (!segments.length) {
    return NextResponse.json(
      { error: "Could not detect speaker turns in transcript" },
      { status: 400 }
    );
  }

  const { relativePath } = await persistFile(buffer, file.name);

  const result = await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        filename: file.name,
        mimetype: file.type || "text/plain",
        storagePath: relativePath,
        checksum,
        status: "ready",
        pageCount: segments.length,
        runId: parsed.data.runId
      }
    });

    const source = await tx.source.create({
      data: {
        documentId: document.id,
        type: "transcript",
        title: parsed.data.company ?? file.name,
        reliabilityScore: 0.7
      }
    });

    const transcript = await tx.interviewTranscript.create({
      data: {
        sourceId: source.id,
        company: parsed.data.company,
        interviewer: parsed.data.interviewer,
        interviewee: parsed.data.interviewee,
        recordedAt: parsed.data.recordedAt
          ? new Date(parsed.data.recordedAt)
          : undefined
      }
    });

    for (const segment of segments) {
      const segmentRecord = await tx.transcriptSegment.create({
        data: {
          transcriptId: transcript.id,
          speaker: segment.speaker,
          text: segment.text,
          orderIndex: segment.order,
          startsAtMs: segment.order * 1000
        }
      });

      await tx.chunk.create({
        data: {
          documentId: document.id,
          transcriptSegmentId: segmentRecord.id,
          orderIndex: segment.order,
          heading: segment.speaker,
          text: segment.text,
          citationKey: `TRANS-${transcript.id}-${segment.order}`,
          metadata: {
            speaker: segment.speaker
          }
        }
      });
    }

    return {
      documentId: document.id,
      transcriptId: transcript.id,
      segments: segments.length
    };
  });

  if (parsed.data.runId) {
    await prisma.progressEvent.create({
      data: {
        runId: parsed.data.runId,
        phase: "ingest",
        message: `Imported transcript ${file.name}`,
        progress: 40,
        payload: result
      }
    });
  }

  return NextResponse.json(result);
}

