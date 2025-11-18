import { NextResponse } from "next/server";

import { prisma } from "@vectorless/db";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const sources = await prisma.source.findMany({
    where: {
      document: {
        runId: params.id
      }
    },
    include: {
      document: {
        select: {
          filename: true
        }
      },
      _count: {
        select: {
          citations: true
        }
      }
    }
  });

  return NextResponse.json({ sources });
}

