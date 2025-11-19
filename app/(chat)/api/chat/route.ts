import {
  type Message,
  convertToCoreMessages,
  createDataStreamResponse,
  generateObject,
  generateText,
  streamObject,
  streamText,
} from 'ai';
import { z } from 'zod';

import { auth, signIn } from '@/app/(auth)/auth';
import { customModel } from '@/lib/ai';
import { models, reasoningModels } from '@/lib/ai/models';
import { rateLimiter } from '@/lib/rate-limit';
import {
  codePrompt,
  systemPrompt,
  updateDocumentPrompt,
} from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  getDocumentById,
  getUser,
  saveChat,
  saveDocument,
  saveMessages,
  saveSuggestions,
} from '@/lib/db/queries';
import type { Suggestion } from '@/lib/db/schema';
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';

import { generateTitleFromUserMessage } from '../../actions';
import OpenAI from 'openai';
import { runAgentPipeline } from '@/lib/ai/deep-research-pipeline';

type AllowedTools =
  | 'deepResearch'
  | 'askClarifyingQuestions'
  | 'search'
  | 'extract'
  | 'scrape';

// Domain blocklist for low-quality sources
const BLOCKED_DOMAINS = [
  'fortunebusinessinsights.com',
  'grandviewresearch.com',
  'polarismarketresearch.com',
  'psmarketresearch.com',
  'insightaceanalytic.com',
  'globenewswire.com',
  'introspectivemarketresearch.com',
  'straitsresearch.com',
  'credenceresearch.com',
  'theinsightpartners.com',
  'marketsandmarkets.com',
  'transparencymarketresearch.com',
  'focusreports.store',
  'myconsultingcoach.com',
  'github.com',
  'precedenceresearch.com',
  'futuremarketinsights.com',
  'expertmarketresearch.com',
  'marketdataforecast.com',
];

// Helper function to check if a URL is from a blocked domain
function isBlockedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// Helper function to safely get hostname from URL
function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url || 'unknown';
  }
}

const webSearchTools: AllowedTools[] = ['search', 'extract', 'scrape'];

const allTools: AllowedTools[] = [
  ...webSearchTools,
  'askClarifyingQuestions',
  'deepResearch',
];

type StructuredClaim = {
  statement: string;
  section?: string | null;
  page?: string | null;
  confidence?: 'high' | 'medium' | 'low' | null;
  metricLabel?: string | null;
  metricValue?: number | null;
  unit?: string | null;
};

type ExtractResponse = {
  url: string;
  claims: StructuredClaim[];
  raw: string;
};

type ResearchFinding = {
  text: string;
  source: string;
  section?: string;
  page?: string;
  confidence?: 'high' | 'medium' | 'low' | null;
  metricLabel?: string | null;
  metricValue?: number | null;
  unit?: string | null;
};

const extractionSchema = {
  name: 'research_claims',
  schema: {
    type: 'object',
    properties: {
      claims: {
        type: 'array',
        description:
          'List of precise factual statements pulled from the source.',
        items: {
          type: 'object',
          properties: {
            statement: {
              type: 'string',
              description:
                'A single factual claim ready to cite verbatim. Include the exact number/value from the page.',
            },
            section: {
              type: 'string',
              description:
                'Name of the section, heading, or subsection where the fact appears. Use "n/a" if unknown.',
            },
            page: {
              type: 'string',
              description:
                'Page number or slide number where the fact appears. Use "n/a" if unknown.',
            },
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description:
                'Confidence level based on source quality and clarity.',
            },
            metricLabel: {
              type: 'string',
              description:
                'Short label for the metric (e.g., Revenue 2024, CAGR).',
            },
            metricValue: {
              type: 'number',
              description:
                'Numeric value associated with the fact, if applicable.',
            },
            unit: {
              type: 'string',
              description: 'Unit for the numeric value (%, $M, etc.).',
            },
          },
          required: ['statement'],
          additionalProperties: false,
        },
      },
    },
    required: ['claims'],
    additionalProperties: false,
  },
} as const;

// Initialize OpenAI client for web search
// Use a dummy key during build time to prevent build failures
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-dummy-key-for-build-time',
});

// Helper function to perform web search using OpenAI's native tool
async function performWebSearch(query: string, maxResults: number = 10) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    const response = await openai.responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: `Search for: ${query}. Return the top ${maxResults} most relevant results with titles, URLs, and descriptions.`,
    });

    // Extract search results from the response
    const searchResults: any[] = [];
    
    // Parse citations from the response and filter blocked domains
    if (response.output && Array.isArray(response.output)) {
      for (const item of response.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text' && content.annotations) {
              for (const annotation of content.annotations) {
                if (annotation.type === 'url_citation') {
                  // Skip blocked domains
                  if (isBlockedDomain(annotation.url)) {
                    continue;
                  }
                  
                  const url = new URL(annotation.url);
                  searchResults.push({
                    title: annotation.title || url.hostname,
                    url: annotation.url,
                    description: content.text.substring(
                      annotation.start_index,
                      Math.min(annotation.end_index, annotation.start_index + 200)
                    ),
                    favicon: `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`,
                  });
                }
              }
            }
          }
        }
      }
    }
    
    // Filter out any remaining blocked domains
    const filteredResults = searchResults.filter(result => !isBlockedDomain(result.url));
    
    return {
      success: true,
      data: filteredResults.slice(0, maxResults),
    };
  } catch (error: any) {
    console.error('Search error:', error);
    return {
      success: false,
      error: error.message,
      data: [],
    };
  }
}

// Helper function to scrape/extract content from a URL using OpenAI
async function scrapeUrl(url: string) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    // Check if domain is blocked
    if (isBlockedDomain(url)) {
      return {
        success: false,
        error: 'Domain is blocked due to low quality content',
      };
    }
    
    const response = await openai.responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: `Please visit ${url} and extract all the main content from this webpage in markdown format.`,
    });

    const text = response.output_text || '';
    
    return {
      success: true,
      markdown: text,
    };
  } catch (error: any) {
    console.error('Scraping error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Helper function to extract structured data from URLs using OpenAI
async function extractFromUrls(urls: string[], prompt: string) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Filter out blocked domains
    const allowedUrls = urls.filter((url) => !isBlockedDomain(url));

    if (allowedUrls.length === 0) {
      return {
        success: false,
        error: 'All provided URLs are from blocked domains',
        data: [],
      };
    }

    const structuredPromises = allowedUrls.map(async (url) => {
      const response = await openai.responses.create({
        model: 'gpt-4o-mini',
        tools: [{ type: 'web_search_preview' }],
        input: `Visit ${url} and extract verifiable PE-style research facts. ${prompt}.

Return your response as a JSON object with this structure:
{
  "claims": [
    {
      "statement": "factual claim here",
      "section": "section name or 'n/a'",
      "page": "page number or 'n/a'",
      "confidence": "high|medium|low",
      "metricLabel": "optional metric name",
      "metricValue": optional number,
      "unit": "optional unit like USD, % etc"
    }
  ]
}

If a section or page number is unavailable, use "n/a". Focus on extracting concrete facts with sources.`,
      });

      const outputText = response.output_text || '';
      let parsedClaims: StructuredClaim[] = [];

      try {
        // Try to extract JSON from the response
        const jsonMatch = outputText.match(/\{[\s\S]*"claims"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed?.claims)) {
            parsedClaims = parsed.claims;
          }
        } else {
          // Fallback: parse the whole response as JSON
          const parsed = JSON.parse(outputText);
          if (Array.isArray(parsed?.claims)) {
            parsedClaims = parsed.claims;
          }
        }
      } catch {
        // If JSON parsing fails, treat the whole response as a single claim
        parsedClaims = [
          {
            statement: outputText.trim(),
            section: null,
            page: null,
            confidence: 'medium',
          },
        ];
      }

      const normalizedClaims = parsedClaims
        .filter((claim) => claim?.statement)
        .map((claim) => ({
          statement: claim.statement,
          section:
            claim.section && claim.section.toLowerCase() !== 'n/a'
              ? claim.section
              : undefined,
          page:
            claim.page && claim.page.toLowerCase() !== 'n/a'
              ? claim.page
              : undefined,
          confidence: claim.confidence ?? null,
          metricLabel: claim.metricLabel ?? null,
          metricValue:
            typeof claim.metricValue === 'number' ? claim.metricValue : null,
          unit: claim.unit ?? null,
        }));

      return {
        url,
        claims: normalizedClaims,
        raw: outputText,
      } as ExtractResponse;
    });

    const structuredResults = await Promise.all(structuredPromises);

    return {
      success: true,
      data: structuredResults,
    };
  } catch (error: any) {
    console.error('Extraction error:', error);
    return {
      success: false,
      error: error.message,
      data: [],
    };
  }
}

// const reasoningModel = customModel(process.env.REASONING_MODEL || 'o1-mini', true);

export async function POST(request: Request) {
  const maxDuration = process.env.MAX_DURATION
    ? parseInt(process.env.MAX_DURATION)
    : 300; 
  
  const {
    id,
    messages,
    modelId,
    reasoningModelId,
    experimental_deepResearch = false,
  }: { 
    id: string; 
    messages: Array<Message>; 
    modelId: string; 
    reasoningModelId: string;
    experimental_deepResearch?: boolean;
  } = await request.json();

  let session = await auth();

  // If no session exists, create an anonymous session
  if (!session?.user) {
    try {
      const result = await signIn('credentials', {
        redirect: false,
      });

      if (result?.error) {
        console.error('Failed to create anonymous session:', result.error);
        return new Response('Failed to create anonymous session', {
          status: 500,
        });
      }

      // Wait for the session to be fully established
      let retries = 3;
      while (retries > 0) {
        session = await auth();
        
        if (session?.user?.id) {
          // Verify user exists in database
          const users = await getUser(session.user.email as string);
          if (users.length > 0) {
            break;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries--;
      }

      if (!session?.user) {
        console.error('Failed to get session after creation');
        return new Response('Failed to create session', { status: 500 });
      }
    } catch (error) {
      console.error('Error creating anonymous session:', error);
      return new Response('Failed to create anonymous session', {
        status: 500,
      });
    }
  }

  if (!session?.user?.id) {
    return new Response('Failed to create session', { status: 500 });
  }

  // Verify user exists in database before proceeding
  try {
    const users = await getUser(session.user.email as string);
    if (users.length === 0) {
      console.error('User not found in database:', session.user);
      return new Response('User not found', { status: 500 });
    }
  } catch (error) {
    console.error('Error verifying user:', error);
    return new Response('Failed to verify user', { status: 500 });
  }

  // Apply rate limiting (skip if Redis is not properly configured)
  try {
    const identifier = session.user.id;
    const { success, limit, reset, remaining } =
      await rateLimiter.limit(identifier);

    if (!success) {
      return new Response(`Too many requests`, { status: 429 });
    }
  } catch (error) {
    // Log rate limiting error but continue
    console.warn('Rate limiting failed, continuing without it:', error);
  }

  const model = models.find((model) => model.id === modelId);
  const reasoningModel = reasoningModels.find((model) => model.id === reasoningModelId);

  if (!model || !reasoningModel) {
    return new Response('Model not found', { status: 404 });
  }

  const coreMessages = convertToCoreMessages(messages);
  const userMessage = getMostRecentUserMessage(coreMessages);

  if (!userMessage) {
    return new Response('No user message found', { status: 400 });
  }

  const chat = await getChatById({ id });

  if (!chat) {
    const title = await generateTitleFromUserMessage({ message: userMessage });
    await saveChat({ id, userId: session.user.id, title });
  }

  const userMessageId = generateUUID();

  await saveMessages({
    messages: [
      { ...userMessage, id: userMessageId, createdAt: new Date(), chatId: id },
    ],
  });

  return createDataStreamResponse({
    execute: (dataStream) => {
      dataStream.writeData({
        type: 'user-message-id',
        content: userMessageId,
      });

      const result = streamText({
        // Router model
        model: customModel(model.apiIdentifier, false),
        system: systemPrompt,
        messages: coreMessages,
        maxSteps: 10,
        experimental_activeTools: allTools, // Always enable all tools including deepResearch
        tools: {
          search: {
            description:
              "Search for web pages. Normally you should call the extract tool after this one to get a spceific data point if search doesn't the exact data you need.",
            parameters: z.object({
              query: z
                .string()
                .describe('Search query to find relevant web pages'),
              maxResults: z
                .number()
                .optional()
                .describe('Maximum number of results to return (default 10)'),
            }),
            execute: async ({ query, maxResults = 5 }) => {
              try {
                const searchResult = await performWebSearch(query, maxResults);

                if (!searchResult.success) {
                  return {
                    error: `Search failed: ${searchResult.error}`,
                    success: false,
                  };
                }

                return {
                  data: searchResult.data,
                  success: true,
                };
              } catch (error: any) {
                return {
                  error: `Search failed: ${error.message}`,
                  success: false,
                };
              }
            },
          },
          extract: {
            description:
              'Extract structured data from web pages. Use this to get whatever data you need from a URL. Any time someone needs to gather data from something, use this tool.',
            parameters: z.object({
              urls: z.array(z.string()).describe(
                'Array of URLs to extract data from',
                // , include a /* at the end of each URL if you think you need to search for other pages insides that URL to extract the full data from',
              ),
              prompt: z
                .string()
                .describe('Description of what data to extract'),
            }),
            execute: async ({ urls, prompt }) => {
              try {
                const extractResult = await extractFromUrls(urls, prompt);

                if (!extractResult.success) {
                  return {
                    error: `Failed to extract data: ${extractResult.error}`,
                    success: false,
                  };
                }

                return {
                  data: extractResult.data,
                  success: true,
                };
              } catch (error: any) {
                console.error('Extraction error:', error);
                console.error(error.message);
                return {
                  error: `Extraction failed: ${error.message}`,
                  success: false,
                };
              }
            },
          },
          scrape: {
            description:
              'Scrape web pages. Use this to get from a page when you have the url.',
            parameters: z.object({
              url: z.string().describe('URL to scrape'),
            }),
            execute: async ({ url }: { url: string }) => {
              try {
                const scrapeResult = await scrapeUrl(url);

                if (!scrapeResult.success) {
                  return {
                    error: `Failed to scrape data: ${scrapeResult.error}`,
                    success: false,
                  };
                }

                return {
                  data:
                    scrapeResult.markdown ??
                    'Could not get the page content, try using search or extract',
                  success: true,
                };
              } catch (error: any) {
                console.error('Scraping error:', error);
                console.error(error.message);
                return {
                  error: `Scraping failed: ${error.message}`,
                  success: false,
                };
              }
            },
          },
          askClarifyingQuestions: {
            description:
              'Ask clarifying questions before starting deep research to ensure complete understanding of the research scope and requirements. Always use this before deepResearch.',
            parameters: z.object({
              topic: z.string().describe('The research topic or question'),
              maxQuestions: z.number().optional().default(4).describe('Maximum number of clarifying questions to ask (default 4)'),
            }),
            execute: async ({ topic, maxQuestions = 4 }) => {
              try {
                const clarifyingPrompt = `You are a research lead preparing to scope a commercial due diligence task on: "${topic}"

Your goal is to ask concise clarifying questions to fully understand the research scope before beginning.

Guidelines:
- Ask ${maxQuestions} focused questions maximum
- Focus on: market scope, geographic regions, specific metrics needed, target audience, time horizon
- Use bullet point formatting
- Be specific and actionable
- Examples: "Which geographic markets should I focus on?", "What specific metrics are most important?", "Are you looking at a specific company or the overall market?"

Return your clarifying questions in a clear, numbered format.`;

                const response = await generateText({
                  model: customModel(reasoningModel.apiIdentifier, true),
                  maxTokens: 1000,
                  prompt: clarifyingPrompt,
                });

                return {
                  success: true,
                  questions: response.text,
                  message: 'Please answer these questions, then I will proceed with comprehensive research.',
                };
              } catch (error: any) {
                return {
                  success: false,
                  error: error.message,
                };
              }
            },
          },
          deepResearch: {
            description:
              'Perform deep research using the four-agent pipeline: Triage → Clarifier/Instruction → Research. This automatically handles clarifications and research planning. Use this for any comprehensive research, market analysis, or report generation.',
            parameters: z.object({
              topic: z.string().describe('The topic or question to research'),
              clarificationAnswers: z.record(z.string()).optional().describe('Answers to clarification questions if already collected'),
            }),
            execute: async ({ topic, clarificationAnswers }) => {
              try {
                // Use the four-agent pipeline
                const result = await runAgentPipeline(
                  topic,
                  clarificationAnswers,
                  model.apiIdentifier,
                  reasoningModel.apiIdentifier,
                  {
                    onActivity: (activity) => {
                      dataStream.writeData({
                        type: 'activity-delta',
                        content: activity,
                      });
                    },
                    onSource: (source) => {
                      dataStream.writeData({
                        type: 'source-delta',
                        content: source,
                      });
                    },
                    onProgress: (progress) => {
                      dataStream.writeData(progress);
                    },
                    dataStream,
                  }
                );

                if (result.needsClarification) {
                  // Return clarification questions
                  dataStream.writeData({
                    type: 'clarification-needed',
                    content: {
                      questions: result.clarificationQuestions || [],
                      agentFlow: result.agentFlow || '',
                    },
                  });

                  return {
                    success: true,
                    needsClarification: true,
                    questions: result.clarificationQuestions,
                    message: 'Please answer these clarifying questions to proceed with the research.',
                  };
                }

                if (result.success && result.report) {
                  // Send the final research report
                  dataStream.writeData({
                    type: 'research-report',
                    content: {
                      report: result.report,
                      citations: result.citations || [],
                      findings: result.findings || [],
                      agentFlow: result.agentFlow || '',
                      metadata: {
                        topic,
                        citationCount: result.citations?.length || 0,
                      },
                    },
                  });

                  return {
                    success: true,
                    data: {
                      findings: result.findings || [],
                      analysis: result.report,
                      citations: result.citations || [],
                      agentFlow: result.agentFlow,
                    },
                  };
                }

                // Error case
                return {
                  success: false,
                  error: result.error || 'Research pipeline failed',
                  agentFlow: result.agentFlow,
                };

              } catch (error: any) {
                console.error('Deep research error:', error);
                return {
                  success: false,
                  error: error.message || 'Deep research failed',
                };
              }
            },
          },
        },
        onFinish: async ({ response }) => {
          if (session.user?.id) {
            try {
              const responseMessagesWithoutIncompleteToolCalls =
                sanitizeResponseMessages(response.messages);

              await saveMessages({
                messages: responseMessagesWithoutIncompleteToolCalls.map(
                  (message) => {
                    const messageId = generateUUID();

                    if (message.role === 'assistant') {
                      dataStream.writeMessageAnnotation({
                        messageIdFromServer: messageId,
                      });
                    }

                    return {
                      id: messageId,
                      chatId: id,
                      role: message.role,
                      content: message.content,
                      createdAt: new Date(),
                    };
                  },
                ),
              });
            } catch (error) {
              console.error('Failed to save chat');
            }
          }
        },
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'stream-text',
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  let session = await auth();

  // If no session exists, create an anonymous session
  if (!session?.user) {
    await signIn('credentials', {
      redirect: false,
    });
    session = await auth();
  }

  if (!session?.user?.id) {
    return new Response('Failed to create session', { status: 500 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
