import { NextResponse } from "next/server";

import { prisma } from "@vectorless/db";

interface RouteParams {
  params: { id: string };
}

export async function POST(_request: Request, { params }: RouteParams) {
  const sources = await prisma.source.findMany({
    where: {
      document: {
        runId: params.id
      }
    },
    select: {
      id: true,
      documentId: true
    }
  });

  for (const source of sources) {
    const chunkCount = await prisma.chunk.count({
      where: { documentId: source.documentId }
    });

    const reliability = chunkCount > 10 ? 0.95 : chunkCount > 0 ? 0.75 : 0.4;
    await prisma.source.update({
      where: { id: source.id },
      data: { reliabilityScore: reliability }
    });
  }

  return NextResponse.json({ updated: sources.length });
}

