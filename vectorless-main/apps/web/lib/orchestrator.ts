import { Prisma, prisma } from "@vectorless/db";
import {
  buildClarifierPrompt,
  buildRewritePrompt,
  buildDeepResearchSystemPrompt
} from "@vectorless/core";

import { openai } from "./openai";

const CLARIFIER_MODEL =
  process.env.OPENAI_CLARIFIER_MODEL ?? "gpt-4.1-mini-2024-09-12";
const REWRITE_MODEL =
  process.env.OPENAI_REWRITE_MODEL ?? "gpt-4.1-2024-09-12";
const DEEP_RESEARCH_MODEL =
  process.env.OPENAI_DEEP_RESEARCH_MODEL ?? "o3-deep-research";

async function recordMethodologyEntry(
  runId: string,
  action: string,
  details?: Prisma.InputJsonValue
) {
  await prisma.methodologyEntry.create({
    data: {
      runId,
      action,
      details
    }
  });
}

export function extractOutputText(
  response: Awaited<ReturnType<typeof openai.responses.create>>
) {
  if (Array.isArray(response.output_text) && response.output_text.length) {
    return response.output_text.join("\n").trim();
  }
  const message = response.output?.find(
    (item) => item.type === "message" && "content" in item
  );
  if (
    message &&
    "content" in message &&
    Array.isArray(message.content) &&
    message.content.length
  ) {
    const first = message.content[0];
    if (first.type === "output_text") {
      return first.text ?? "";
    }
  }
  return "";
}

async function recordTurn(
  runId: string,
  role: Prisma.ConversationTurnCreateInput["role"],
  text: string
) {
  await prisma.conversationTurn.create({
    data: {
      runId,
      role,
      content: {
        text
      }
    }
  });
}

async function recordProgress(
  runId: string,
  phase: Prisma.ProgressEventCreateInput["phase"],
  message: string,
  progress: number,
  payload?: Prisma.InputJsonValue
) {
  await prisma.progressEvent.create({
    data: {
      runId,
      phase,
      message,
      progress,
      payload
    }
  });
}

export async function askClarifyingQuestions(runId: string) {
  const run = await prisma.researchRun.findUnique({
    where: { id: runId }
  });
  if (!run) throw new Error("Run not found");

  const brief = (run.prompt as Record<string, unknown> | null)?.brief as
    | string
    | undefined;

  if (!brief) {
    throw new Error("Run is missing a brief");
  }

  const prompt = buildClarifierPrompt({
    title: run.title,
    brief,
    maxQuestions: 4
  });

  const response = await openai.responses.create({
    model: CLARIFIER_MODEL,
    input: prompt
  });

  const text = extractOutputText(response);

  await recordTurn(run.id, "assistant", text);
  await prisma.researchRun.update({
    where: { id: run.id },
    data: {
      status: "CLARIFYING",
      orchestratorPhase: "clarify"
    }
  });
  await recordProgress(run.id, "clarify", "Clarifying questions generated", 30, {
    text
  });
  await recordMethodologyEntry(run.id, "clarify", { prompt });

  return { text };
}

export async function rewriteResearchPrompt(runId: string) {
  const run = await prisma.researchRun.findUnique({
    where: { id: runId },
    include: {
      conversationTurns: {
        orderBy: { createdAt: "asc" }
      }
    }
  });
  if (!run) throw new Error("Run not found");

  const brief = (run.prompt as Record<string, unknown> | null)?.brief as
    | string
    | undefined;
  if (!brief) {
    throw new Error("Run is missing a brief");
  }

  const clarifications = run.conversationTurns
    .filter((turn) => turn.role === "assistant")
    .map((turn) => (turn.content as Record<string, string>).text ?? "");

  const prompt = buildRewritePrompt({
    title: run.title,
    brief,
    clarifications
  });

  const response = await openai.responses.create({
    model: REWRITE_MODEL,
    input: prompt
  });

  const rewrittenPrompt = extractOutputText(response);

  const newPromptPayload = {
    ...(typeof run.prompt === "object" ? run.prompt : {}),
    rewrittenPrompt
  };

  await prisma.researchRun.update({
    where: { id: run.id },
    data: {
      prompt: newPromptPayload,
      status: "RUNNING",
      orchestratorPhase: "rewrite"
    }
  });

  await recordProgress(run.id, "rewrite", "Generated research plan", 50, {
    rewrittenPrompt
  });
  await recordMethodologyEntry(run.id, "rewrite", { rewrittenPrompt });

  return { rewrittenPrompt };
}

export async function launchDeepResearch(runId: string) {
  const run = await prisma.researchRun.findUnique({
    where: { id: runId }
  });
  if (!run) throw new Error("Run not found");

  const promptPayload = run.prompt as Record<string, string> | null;
  const rewrittenPrompt = promptPayload?.rewrittenPrompt;
  if (!rewrittenPrompt) {
    throw new Error("Run is missing a rewritten prompt");
  }

  const systemPrompt = buildDeepResearchSystemPrompt({
    title: run.title,
    rewrittenPrompt
  });

  const response = await openai.responses.create({
    model: DEEP_RESEARCH_MODEL,
    background: true,
    input: [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text: systemPrompt
          }
        ]
      }
    ],
    tools: [
      { type: "web_search_preview" },
      { type: "code_interpreter", container: { type: "auto" } }
    ],
    metadata: {
      runId
    }
  });

  await prisma.researchRun.update({
    where: { id: run.id },
    data: {
      status: "RUNNING",
      backgroundJobId: response.id,
      orchestratorPhase: "research"
    }
  });

  await recordProgress(run.id, "research", "Deep Research job launched", 60, {
    responseId: response.id
  });
  await recordMethodologyEntry(run.id, "research_launch", {
    responseId: response.id,
    model: DEEP_RESEARCH_MODEL
  });

  return { responseId: response.id };
}

