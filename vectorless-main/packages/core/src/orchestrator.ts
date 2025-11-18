interface ClarifierOptions {
  title: string;
  brief: string;
  clarifications?: string[];
  maxQuestions?: number;
}

interface RewriteOptions {
  title: string;
  brief: string;
  clarifications: string[];
}

interface DeepResearchOptions {
  title: string;
  rewrittenPrompt: string;
  citationRules?: string;
}

export function buildClarifierPrompt(options: ClarifierOptions): string {
  const maxQuestions = options.maxQuestions ?? 4;
  return [
    `You are a research lead preparing to scope a deep research task titled "${options.title}".`,
    "Ask concise clarifying questions to fully understand the user's goal before research begins.",
    "Constraints:",
    `- Ask at most ${maxQuestions} questions`,
    "- Prefer bullet formatting",
    "- Do not perform any research yet",
    "",
    "User brief:",
    options.brief.trim()
  ].join("\n");
}

export function buildRewritePrompt(options: RewriteOptions): string {
  return [
    `User brief: ${options.brief.trim()}`,
    "",
    "Clarifications collected:",
    options.clarifications.map((c, idx) => `${idx + 1}. ${c}`).join("\n"),
    "",
    "Rewrite the request as a detailed research instruction set in first person.",
    "Explicitly mention: scope, metrics, regions, citations, tables required.",
    "Respond ONLY with the rewritten prompt."
  ].join("\n");
}

export function buildDeepResearchSystemPrompt(
  options: DeepResearchOptions
): string {
  const citationRules =
    options.citationRules ??
    "Every factual statement must include an inline citation referencing the source title and page.";

  return [
    "You are an investment analyst producing commercial due diligence reports.",
    citationRules,
    "Prioritize reputable sources, include numeric evidence, and structure output per the requested outline.",
    "",
    "Research instructions:",
    options.rewrittenPrompt.trim()
  ].join("\n");
}

