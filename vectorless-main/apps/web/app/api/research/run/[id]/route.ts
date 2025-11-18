import { NextResponse } from "next/server";

import { prisma } from "@vectorless/db";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const run = await prisma.researchRun.findUnique({
    where: { id: params.id },
    include: {
      documents: true,
      conversationTurns: {
        orderBy: { createdAt: "asc" }
      },
      progressEvents: {
        orderBy: { createdAt: "desc" },
        take: 50
      },
      reportSections: {
        orderBy: { position: "asc" }
      }
    }
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({ run });
}

