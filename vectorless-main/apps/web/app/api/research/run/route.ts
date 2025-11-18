import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@vectorless/db";

const schema = z.object({
  title: z.string().min(3),
  brief: z.string().min(20)
});

export async function GET() {
  const runs = await prisma.researchRun.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      orchestratorPhase: true,
      createdAt: true,
      updatedAt: true,
      backgroundJobId: true
    }
  });

  return NextResponse.json({ runs });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const run = await prisma.researchRun.create({
    data: {
      title: parsed.data.title,
      status: "CLARIFYING",
      orchestratorPhase: "clarify",
      prompt: {
        brief: parsed.data.brief
      }
    }
  });

  await prisma.conversationTurn.create({
    data: {
      runId: run.id,
      role: "user",
      content: {
        text: parsed.data.brief
      }
    }
  });

  await prisma.progressEvent.create({
    data: {
      runId: run.id,
      phase: "clarify",
      message: "Research run created",
      progress: 10
    }
  });

  await prisma.methodologyEntry.create({
    data: {
      runId: run.id,
      action: "run_created",
      details: { brief: parsed.data.brief }
    }
  });

  return NextResponse.json({ run });
}

