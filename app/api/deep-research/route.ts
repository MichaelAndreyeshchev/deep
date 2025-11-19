import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Simple Deep Research pipeline using Responses API:
// 1) Clarifying questions with gpt-4.1-style model (we'll use gpt-4o for compatibility)
// 2) Rewrite into detailed research instructions
// 3) Call o3-deep-research-2025-06-26 with web_search_preview
//
// This route is intentionally decoupled from /api/chat and your existing tools.

// Prompts adapted from the Python cookbook
const CLARIFYING_AGENT_PROMPT = `
You will be given a research task by a user. Your job is NOT to complete the task yet, but instead to ask clarifying questions that would help you or another researcher produce a more specific, efficient, and relevant answer.

GUIDELINES:
1. Maximize Relevance
- Ask questions that are directly necessary to scope the research output.
- Consider what information would change the structure, depth, or direction of the answer.

2. Surface Missing but Critical Dimensions
- Identify essential attributes that were not specified in the user’s request (e.g., preferences, time frame, budget, audience).
- Ask about each one explicitly, even if it feels obvious or typical.

3. Do Not Invent Preferences
- If the user did not mention a preference, do not assume it. Ask about it clearly and neutrally.

4. Use the First Person
- Phrase your questions from the perspective of the assistant or researcher talking to the user (e.g., “Could you clarify...” or “Do you have a preference for...”)

5. Use a Bulleted List if Multiple Questions
- If there are multiple open questions, list them clearly in bullet format for readability.

6. Avoid Overasking
- Prioritize the 3–6 questions that would most reduce ambiguity or scope creep.

7. Include Examples Where Helpful
- If asking about preferences (e.g., report format), briefly list examples to help the user answer.

8. Format for Conversational Use
- The output should sound helpful and conversational—not like a form.

Return ONLY the clarifying questions as plain text (no JSON).
`;

const RESEARCH_INSTRUCTION_AGENT_PROMPT = `
You will be given a user query and, optionally, their answers to clarifying questions.
Your job is to rewrite this into detailed research instructions.

OUTPUT ONLY THE RESEARCH INSTRUCTIONS, NOTHING ELSE.

GUIDELINES:
1. Maximize Specificity and Detail
- Include all known user preferences and explicitly list key attributes or dimensions to consider.
- It is of utmost importance that all details from the user are included in the expanded prompt.

2. Fill in Unstated But Necessary Dimensions as Open-Ended
- If certain attributes are essential for a meaningful output but the user has not provided them, explicitly state that they are open-ended or default to “no specific constraint.”

3. Avoid Unwarranted Assumptions
- If the user has not provided a particular detail, do not invent one.
- Instead, state the lack of specification and guide the deep research model to treat it as flexible.

4. Use the First Person
- Phrase the request from the perspective of the user (“I want to understand... ”).

5. Tables
- If tables will help, explicitly request them in the instructions (e.g., “Include a table comparing X across Y”).

6. Headers and Formatting
- Ask the Deep Research model to format as a structured report with clear headers and subheaders.

7. Language
- If the user input is in a language other than English, tell the model to respond in that language.

8. Sources
- If specific sources or types of sources should be prioritized, list them.

IMPORTANT: Your response must be valid, plain-text instructions that can be passed directly to the deep research model.
`;

const SYSTEM_MESSAGE_O3 = `
You are a professional researcher preparing a structured, data-driven report on behalf of an investment and strategy team.

Do:
- Focus on data-rich insights: include specific figures, trends, statistics, and measurable outcomes.
- When appropriate, summarize data in a way that could be turned into charts or tables.
- Prioritize reliable, up-to-date sources: regulators, industry reports, filings, and reputable news.
- Include inline citations and return all source metadata.

Be analytical, avoid generalities, and ensure that each section supports data-backed reasoning that could inform investment decisions and commercial strategy.
`;

function getFirstOutputText(response: any): string {
  const first = response?.output?.[0];
  const content = (first as any)?.content?.[0];
  if (!content || content.type !== 'output_text') return '';
  return content.text || '';
}

function extractFinalReportAndCitations(response: any) {
  const last = response?.output?.[response.output.length - 1];
  let report = '';
  const citations: Array<{
    index: number;
    title: string;
    url: string;
    start_index: number;
    end_index: number;
  }> = [];

  if (last?.type === 'message') {
    const content = (last as any).content?.[0];
    if (content?.type === 'output_text') {
      report = content.text || '';
      const annotations = content.annotations || [];
      let idx = 1;
      for (const ann of annotations) {
        if (ann.type === 'url_citation') {
          citations.push({
            index: idx++,
            title: ann.title,
            url: ann.url,
            start_index: ann.start_index,
            end_index: ann.end_index,
          });
        }
      }
    }
  }

  return { report, citations };
}

type DeepResearchRequest = {
  query: string;
  clarifications?: Record<string, string>;
};

export async function POST(request: Request) {
  try {
    // Initialize the OpenAI client inside the handler to avoid build-time errors
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const body = (await request.json()) as DeepResearchRequest;
    const { query, clarifications } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "query" in request body' },
        { status: 400 },
      );
    }

    // If no clarifications provided, first step: ask clarifying questions
    if (!clarifications || Object.keys(clarifications).length === 0) {
      const clarifyResponse = await client.responses.create({
        // Use a lightweight model for clarifications (cookbook uses gpt-4.1; we use gpt-4o)
        model: 'gpt-4o',
        instructions: CLARIFYING_AGENT_PROMPT,
        input: query,
      });

      const questionsText = getFirstOutputText(clarifyResponse);

      return NextResponse.json({
        status: 'needs-clarification',
        query,
        questionsText,
      });
    }

    // Step 2: rewrite query into detailed research instructions
    const clarificationsText = Object.entries(clarifications)
      .map(([q, a]) => `Q: ${q}\nA: ${a}`)
      .join('\n\n');

    const rewritingInput = `Original query:\n${query}\n\nUser clarifications:\n${clarificationsText}`;

    const instructionsResponse = await client.responses.create({
      // Cookbook uses gpt-4.1-2025-04-14 here; we mirror logic with a modern model id.
      model: 'gpt-4o',
      instructions: RESEARCH_INSTRUCTION_AGENT_PROMPT,
      input: rewritingInput,
    });

    const researchInstructions = getFirstOutputText(instructionsResponse);

    // Step 3: call o3-deep-research-2025-06-26 via Responses API
    const deepResponse = await client.responses.create({
      model: 'o3-deep-research-2025-06-26',
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: SYSTEM_MESSAGE_O3,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: researchInstructions,
            },
          ],
        },
      ],
      reasoning: {
        summary: 'auto',
      },
      tools: [
        {
          type: 'web_search_preview',
        },
      ],
    });

    const { report, citations } = extractFinalReportAndCitations(deepResponse);

    return NextResponse.json({
      status: 'complete',
      query,
      researchInstructions,
      report,
      citations,
      // You can include deepResponse if you want full trace, but it's large:
      // raw: deepResponse,
    });
  } catch (error: any) {
    console.error('Deep research API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Deep research request failed' },
      { status: 500 },
    );
  }
}


