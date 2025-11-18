import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import { prisma } from "@vectorless/db";
import { persistFile } from "@vectorless/core";

export const runtime = "nodejs";

const payloadSchema = z.object({
  runId: z.string().cuid().optional()
});

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const parsed = payloadSchema.safeParse({
    runId: formData.get("runId") || undefined
  });

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file upload" },
      { status: 400 }
    );
  }

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
  const { relativePath } = await persistFile(bytes, file.name);

  const document = await prisma.document.create({
    data: {
      runId: parsed.data.runId,
      filename: file.name,
      mimetype: file.type || "application/octet-stream",
      storagePath: relativePath,
      checksum,
      status: "pending"
    }
  });

  if (parsed.data.runId) {
    await prisma.progressEvent.create({
      data: {
        runId: parsed.data.runId,
        phase: "ingest",
        message: `Queued ${file.name}`,
        progress: 5,
        payload: {
          documentId: document.id
        }
      }
    });
  }

  return NextResponse.json({ document });
}

