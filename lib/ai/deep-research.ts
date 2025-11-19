/**
 * OpenAI Deep Research API Integration
 * Based on: https://cookbook.openai.com/examples/deep_research_api/introduction_to_deep_research_api
 * 
 * This module implements the Deep Research workflow using OpenAI's Responses API with:
 * - o3-deep-research model for high-quality synthesis
 * - web_search_preview tool for web searches
 * - Inline citations and metadata
 * - Streaming progress updates
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-dummy-key',
});

export interface DeepResearchOptions {
  topic: string;
  systemMessage?: string;
  onProgress?: (update: ProgressUpdate) => void;
  onSource?: (source: SourceUpdate) => void;
  maxDuration?: number;
}

export interface ProgressUpdate {
  type: 'reasoning' | 'search' | 'extraction' | 'synthesis';
  message: string;
  step: number;
  totalSteps: number;
}

export interface SourceUpdate {
  title: string;
  url: string;
  snippet: string;
}

export interface ResearchResult {
  report: string;
  citations: Citation[];
  metadata: {
    duration: number;
    searchQueries: string[];
    sourcesUsed: number;
  };
}

export interface Citation {
  id: number;
  title: string;
  url: string;
  startIndex: number;
  endIndex: number;
  section?: string;
  page?: string;
}

const DEFAULT_SYSTEM_MESSAGE = `You are a professional researcher preparing structured, data-driven reports with decades of experience in Private Equity and commercial due diligence.

Your role:
- Produce McKinsey/Bain-quality analysis with specific figures, trends, and measurable outcomes
- Include inline citations [N] after EVERY factual claim
- When appropriate, suggest data visualizations (charts, tables)
- Prioritize peer-reviewed research, regulatory agencies, and official sources
- Include section/page numbers when available

Citation Format:
- Use ONLY [N] format for citations (e.g., "Market size is $4.2B [1]")
- You can use multiple citations: "Revenue grew 40% [1][2]"
- Include confidence indicators where appropriate: "Revenue of $100M [1] 🟢"
- Mention section/page inline before citation: "Section 3, p.12 [4]"

Be analytical, data-backed, and ensure every section supports rigorous reasoning.`;

/**
 * Perform deep research using OpenAI's o3-deep-research model
 */
export async function performDeepResearch(
  options: DeepResearchOptions
): Promise<ResearchResult> {
  const {
    topic,
    systemMessage = DEFAULT_SYSTEM_MESSAGE,
    onProgress,
    onSource,
    maxDuration = 270000, // 4.5 minutes
  } = options;

  const startTime = Date.now();
  const searchQueries: string[] = [];
  let step = 0;

  try {
    // Notify start
    onProgress?.({
      type: 'reasoning',
      message: `Starting deep research on: ${topic}`,
      step: 0,
      totalSteps: 20,
    });

    // Call OpenAI Responses API with o3-deep-research
    const response = await openai.responses.create({
      model: 'o3-deep-research',
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: systemMessage,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: topic,
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

    // Process intermediate steps
    let totalSteps = 20; // Default estimate
    if (response.output && Array.isArray(response.output)) {
      totalSteps = response.output.length;

      for (const item of response.output) {
        step++;

        // Reasoning steps
        if (item.type === 'reasoning') {
          const itemAny = item as any;
          if (itemAny.summary && Array.isArray(itemAny.summary)) {
            for (const summaryItem of itemAny.summary) {
              onProgress?.({
                type: 'reasoning',
                message: summaryItem.text || 'Analyzing findings...',
                step,
                totalSteps,
              });
            }
          }
        }

        // Web search calls
        if (item.type === 'web_search_call') {
          // Extract query from item if available
          const itemAny = item as any;
          const query = itemAny.action?.query || itemAny.query || '';
          if (query) {
            searchQueries.push(query);
            onProgress?.({
              type: 'search',
              message: `Searching: ${query}`,
              step,
              totalSteps,
            });
          }
        }

        // Extract citations from message outputs
        if (item.type === 'message') {
          const itemContent = (item as any).content;
          if (itemContent && Array.isArray(itemContent)) {
            for (const content of itemContent) {
              if (content.type === 'output_text' && content.annotations) {
                for (const annotation of content.annotations) {
                  if (annotation.type === 'url_citation') {
                    try {
                      onSource?.({
                        title: annotation.title || new URL(annotation.url).hostname,
                        url: annotation.url,
                        snippet: (content.text || '').substring(
                          Math.max(0, (annotation.start_index || 0) - 50),
                          Math.min(
                            (content.text || '').length,
                            (annotation.end_index || 0) + 50
                          )
                        ),
                      });
                    } catch {
                      // Skip invalid URLs
                      continue;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // Extract final report
    const finalOutput = response.output?.[response.output.length - 1];
    let reportText = '';
    const citations: Citation[] = [];

    if (finalOutput && finalOutput.type === 'message') {
      const finalContent = (finalOutput as any).content;
      if (finalContent && Array.isArray(finalContent)) {
        for (const content of finalContent) {
          if (content.type === 'output_text') {
            reportText = content.text || '';

            // Extract citations
            if (content.annotations && Array.isArray(content.annotations)) {
              let citationId = 1;
              for (const annotation of content.annotations) {
                if (annotation.type === 'url_citation') {
                  try {
                    citations.push({
                      id: citationId++,
                      title: annotation.title || new URL(annotation.url).hostname,
                      url: annotation.url,
                      startIndex: annotation.start_index || 0,
                      endIndex: annotation.end_index || 0,
                    });
                  } catch {
                    // Skip invalid URLs
                    continue;
                  }
                }
              }
            }
          }
        }
      }
    }

    // Final progress update
    onProgress?.({
      type: 'synthesis',
      message: 'Research complete! Generating final report...',
      step: totalSteps,
      totalSteps,
    });

    const duration = Date.now() - startTime;

    return {
      report: reportText,
      citations,
      metadata: {
        duration,
        searchQueries,
        sourcesUsed: citations.length,
      },
    };
  } catch (error) {
    console.error('Deep research error:', error);
    throw new Error(
      `Failed to perform deep research: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Ask clarifying questions using a lighter model (gpt-4o)
 */
export async function generateClarifyingQuestions(
  topic: string
): Promise<string[]> {
  const CLARIFYING_PROMPT = `You will be given a research task by a user. Your job is NOT to complete the task yet, but instead to ask 3-5 clarifying questions that would help you or another researcher produce a more specific, efficient, and relevant answer.

GUIDELINES:
1. **Maximize Relevance** - Ask questions that would change the structure, depth, or direction of the answer
2. **Surface Missing Critical Dimensions** - Identify essential attributes (preferences, time frame, budget, audience)
3. **Do Not Invent Preferences** - If user didn't mention it, ask neutrally
4. **Use First Person** - "Could you clarify..." or "Do you have a preference for..."
5. **Use Bulleted List** - List questions clearly
6. **Avoid Overasking** - Prioritize 3-5 most pivotal questions
7. **Include Examples** - Help user answer with brief examples
8. **Conversational Tone** - Sound helpful, not like a form

Return ONLY a JSON array of questions. Example: ["Question 1?", "Question 2?", "Question 3?"]`;

  try {
    const response = await openai.responses.create({
      instructions: CLARIFYING_PROMPT,
      model: 'gpt-4o',
      input: topic,
    });

    const firstOutput = response.output?.[0];
    const firstContent = (firstOutput as any)?.content?.[0];
    const outputText =
      firstContent?.type === 'output_text' ? (firstContent.text || '') : '';

    // Try to parse as JSON array
    try {
      const questions = JSON.parse(outputText);
      if (Array.isArray(questions)) {
        return questions;
      }
    } catch {
      // If not JSON, split by newlines and filter
      return outputText
        .split('\n')
        .filter((line: string) => line.trim().length > 0 && line.includes('?'))
        .map((line: string) => line.replace(/^[-*•]\s*/, '').trim())
        .slice(0, 5);
    }

    return [];
  } catch (error) {
    console.error('Failed to generate clarifying questions:', error);
    return [];
  }
}

/**
 * Rewrite user query with additional context from clarifications
 */
export async function rewriteQueryWithContext(
  originalQuery: string,
  clarifications: Record<string, string>
): Promise<string> {
  const REWRITING_PROMPT = `You will be given a research task and user answers to clarifying questions. Your job is to produce detailed research instructions for a researcher. OUTPUT ONLY THE RESEARCH INSTRUCTIONS.

GUIDELINES:
1. **Maximize Specificity** - Include all known preferences and key attributes
2. **Fill in Unstated Dimensions as Open-Ended** - If essential but not provided, state as flexible
3. **Avoid Assumptions** - Don't invent details
4. **First Person** - Phrase from user's perspective
5. **Tables** - If helpful, explicitly request them with examples
6. **Headers and Formatting** - Request structured format (report, plan, etc.)
7. **Language** - Match user's language unless specified otherwise
8. **Sources** - Prioritize official/primary sources over aggregators`;

  const contextText = Object.entries(clarifications)
    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
    .join('\n\n');

  const input = `Original Query: ${originalQuery}\n\nClarifications:\n${contextText}`;

  try {
    const response = await openai.responses.create({
      instructions: REWRITING_PROMPT,
      model: 'gpt-4o',
      input,
    });

    const firstOutput = response.output?.[0];
    const firstContent = (firstOutput as any)?.content?.[0];
    const rewrittenQuery =
      firstContent?.type === 'output_text'
        ? (firstContent.text || originalQuery)
        : originalQuery;

    return rewrittenQuery;
  } catch (error) {
    console.error('Failed to rewrite query:', error);
    return originalQuery; // Fallback to original
  }
}

