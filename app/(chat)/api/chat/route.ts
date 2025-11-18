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

const webSearchTools: AllowedTools[] = ['search', 'extract', 'scrape'];

const allTools: AllowedTools[] = [...webSearchTools, 'askClarifyingQuestions', 'deepResearch'];

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
    const allowedUrls = urls.filter(url => !isBlockedDomain(url));
    
    if (allowedUrls.length === 0) {
      return {
        success: false,
        error: 'All provided URLs are from blocked domains',
        data: [],
      };
    }
    
    const urlList = allowedUrls.join(', ');
    const response = await openai.responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: `Visit these URLs: ${urlList}. ${prompt}. Return the extracted data in a structured format.`,
    });

    const extractedData = response.output_text || '';
    
    return {
      success: true,
      data: allowedUrls.map((url) => ({
        data: extractedData,
        url: url,
      })),
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

  // Apply rate limiting
  const identifier = session.user.id;
  const { success, limit, reset, remaining } =
    await rateLimiter.limit(identifier);

  if (!success) {
    return new Response(`Too many requests`, { status: 429 });
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
        experimental_activeTools: experimental_deepResearch ? allTools : webSearchTools,
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
              'Perform deep research on a topic using an AI agent that coordinates search, extract, and analysis tools with reasoning steps. Should be used after askClarifyingQuestions.',
            parameters: z.object({
              topic: z.string().describe('The topic or question to research'),
            }),
            execute: async ({ topic, maxDepth = 7 }) => {
              const startTime = Date.now();
              const timeLimit = 4.5 * 60 * 1000; // 4 minutes 30 seconds in milliseconds

              const researchState = {
                findings: [] as Array<{ text: string; source: string }>,
                summaries: [] as Array<string>,
                nextSearchTopic: '',
                urlToSearch: '',
                currentDepth: 0,
                failedAttempts: 0,
                maxFailedAttempts: 3,
                completedSteps: 0,
                totalExpectedSteps: maxDepth * 5,
              };

              // Initialize progress tracking
              dataStream.writeData({
                type: 'progress-init',
                content: {
                  maxDepth,
                  totalSteps: researchState.totalExpectedSteps,
                },
              });

              const addSource = (source: {
                url: string;
                title: string;
                description: string;
              }) => {
                dataStream.writeData({
                  type: 'source-delta',
                  content: source,
                });
              };

              const addActivity = (activity: {
                type:
                | 'search'
                | 'extract'
                | 'analyze'
                | 'reasoning'
                | 'synthesis'
                | 'thought';
                status: 'pending' | 'complete' | 'error';
                message: string;
                timestamp: string;
                depth: number;
              }) => {
                if (activity.status === 'complete') {
                  researchState.completedSteps++;
                }

                dataStream.writeData({
                  type: 'activity-delta',
                  content: {
                    ...activity,
                    depth: researchState.currentDepth,
                    completedSteps: researchState.completedSteps,
                    totalSteps: researchState.totalExpectedSteps,
                  },
                });
              };

              const analyzeAndPlan = async (
                findings: Array<{ text: string; source: string }>,
              ) => {
                try {
                  const timeElapsed = Date.now() - startTime;
                  const timeRemaining = timeLimit - timeElapsed;
                  const timeRemainingMinutes =
                    Math.round((timeRemaining / 1000 / 60) * 10) / 10;

                  // Reasoning model
                  const result = await generateText({
                    model: customModel(reasoningModel.apiIdentifier, true),
                    prompt: `You are a research agent analyzing findings about: ${topic}
                            You have ${timeRemainingMinutes} minutes remaining to complete the research but you don't need to use all of it.
                            Current findings: ${findings
                        .map((f) => `[From ${f.source}]: ${f.text}`)
                        .join('\n')}
                            What has been learned? What gaps remain? What specific aspects should be investigated next if any?
                            If you need to search for more information, include a nextSearchTopic.
                            If you need to search for more information in a specific URL, include a urlToSearch.
                            Important: If less than 1 minute remains, set shouldContinue to false to allow time for final synthesis.
                            If I have enough information, set shouldContinue to false.
                            
                            Respond in this exact JSON format:
                            {
                              "analysis": {
                                "summary": "summary of findings",
                                "gaps": ["gap1", "gap2"],
                                "nextSteps": ["step1", "step2"],
                                "shouldContinue": true/false,
                                "nextSearchTopic": "optional topic",
                                "urlToSearch": "optional url"
                              }
                            }`,
                  });

                  try {
                    const parsed = JSON.parse(result.text);
                    return parsed.analysis;
                  } catch (error) {
                    console.error('Failed to parse JSON response:', error);
                    return null;
                  }
                } catch (error) {
                  console.error('Analysis error:', error);
                  return null;
                }
              };

              const extractFromUrlsDeep = async (urls: string[]) => {
                const extractPromises = urls.map(async (url) => {
                  try {
                    addActivity({
                      type: 'extract',
                      status: 'pending',
                      message: `Analyzing ${new URL(url).hostname}`,
                      timestamp: new Date().toISOString(),
                      depth: researchState.currentDepth,
                    });

                    const result = await extractFromUrls([url], `Extract key information about ${topic}. Focus on facts, data, and expert opinions. Analysis should be full of details and very comprehensive.`);

                    if (result.success) {
                      addActivity({
                        type: 'extract',
                        status: 'complete',
                        message: `Extracted from ${new URL(url).hostname}`,
                        timestamp: new Date().toISOString(),
                        depth: researchState.currentDepth,
                      });

                      if (Array.isArray(result.data)) {
                        return result.data.map((item) => ({
                          text: item.data,
                          source: url,
                        }));
                      }
                      return [{ text: result.data, source: url }];
                    }
                    return [];
                  } catch {
                    // console.warn(`Extraction failed for ${url}:`);
                    return [];
                  }
                });

                const results = await Promise.all(extractPromises);
                return results.flat();
              };

              try {
                while (researchState.currentDepth < maxDepth) {
                  const timeElapsed = Date.now() - startTime;
                  if (timeElapsed >= timeLimit) {
                    break;
                  }

                  researchState.currentDepth++;

                  dataStream.writeData({
                    type: 'depth-delta',
                    content: {
                      current: researchState.currentDepth,
                      max: maxDepth,
                      completedSteps: researchState.completedSteps,
                      totalSteps: researchState.totalExpectedSteps,
                    },
                  });

                  // Search phase
                  addActivity({
                    type: 'search',
                    status: 'pending',
                    message: `Searching for "${topic}"`,
                    timestamp: new Date().toISOString(),
                    depth: researchState.currentDepth,
                  });

                  let searchTopic = researchState.nextSearchTopic || topic;
                  const searchResult = await performWebSearch(searchTopic);

                  if (!searchResult.success) {
                    addActivity({
                      type: 'search',
                      status: 'error',
                      message: `Search failed for "${searchTopic}"`,
                      timestamp: new Date().toISOString(),
                      depth: researchState.currentDepth,
                    });

                    researchState.failedAttempts++;
                    if (
                      researchState.failedAttempts >=
                      researchState.maxFailedAttempts
                    ) {
                      break;
                    }
                    continue;
                  }

                  addActivity({
                    type: 'search',
                    status: 'complete',
                    message: `Found ${searchResult.data.length} relevant results`,
                    timestamp: new Date().toISOString(),
                    depth: researchState.currentDepth,
                  });

                  // Add sources from search results
                  searchResult.data.forEach((result: any) => {
                    addSource({
                      url: result.url,
                      title: result.title,
                      description: result.description,
                    });
                  });

                  // Extract phase
                  const topUrls = searchResult.data
                    .slice(0, 3)
                    .map((result: any) => result.url);

                  const newFindings = await extractFromUrlsDeep([
                    researchState.urlToSearch,
                    ...topUrls,
                  ]);
                  researchState.findings.push(...newFindings);

                  // Analysis phase
                  addActivity({
                    type: 'analyze',
                    status: 'pending',
                    message: 'Analyzing findings',
                    timestamp: new Date().toISOString(),
                    depth: researchState.currentDepth,
                  });

                  const analysis = await analyzeAndPlan(researchState.findings);
                  researchState.nextSearchTopic =
                    analysis?.nextSearchTopic || '';
                  researchState.urlToSearch = analysis?.urlToSearch || '';
                  researchState.summaries.push(analysis?.summary || '');

                  console.log(analysis);
                  if (!analysis) {
                    addActivity({
                      type: 'analyze',
                      status: 'error',
                      message: 'Failed to analyze findings',
                      timestamp: new Date().toISOString(),
                      depth: researchState.currentDepth,
                    });

                    researchState.failedAttempts++;
                    if (
                      researchState.failedAttempts >=
                      researchState.maxFailedAttempts
                    ) {
                      break;
                    }
                    continue;
                  }

                  addActivity({
                    type: 'analyze',
                    status: 'complete',
                    message: analysis.summary,
                    timestamp: new Date().toISOString(),
                    depth: researchState.currentDepth,
                  });

                  if (!analysis.shouldContinue || analysis.gaps.length === 0) {
                    break;
                  }

                  topic = analysis.gaps.shift() || topic;
                }

                // Final synthesis - Generate structured report with citations
                addActivity({
                  type: 'synthesis',
                  status: 'pending',
                  message: 'Preparing final research report',
                  timestamp: new Date().toISOString(),
                  depth: researchState.currentDepth,
                });

                // Create citation map
                const citationMap = new Map<string, number>();
                const sources: Array<{ id: number; url: string; title: string }> = [];
                let citationCounter = 1;

                researchState.findings.forEach((finding) => {
                  if (!citationMap.has(finding.source)) {
                    citationMap.set(finding.source, citationCounter);
                    try {
                      const url = new URL(finding.source);
                      sources.push({
                        id: citationCounter,
                        url: finding.source,
                        title: url.hostname,
                      });
                    } catch {
                      sources.push({
                        id: citationCounter,
                        url: finding.source,
                        title: finding.source,
                      });
                    }
                    citationCounter++;
                  }
                });

                const finalReport = await generateText({
                  model: customModel(reasoningModel.apiIdentifier, true),
                  maxTokens: 16000,
                  prompt: `You are an investment analyst with decades of experience understanding Private Equity strategies and producing commercial due diligence like a McKinsey and Bain consultant. Your goal is to advise private equity investors with commercial due diligence reports.

RESEARCH TOPIC: "${topic}"

WORKING STYLE:
- Source traceability: For EVERY evidence point, provide inline citation [N] and link to the source
- Source quality: Prioritize reputable sources (McKinsey, BCG, Bain, SEC filings, Gartner) over less reputable market research
- Confidence heat-bar: Traffic-light score each data point:
  * 🟢 Green = reported figure from reliable source
  * 🟡 Amber = extrapolated from partial data / questionable source  
  * 🔴 Red = assumption
- Benchmark sanity checks: Ensure all figures reconcile (e.g., company revenue < TAM)

APPROACH:
- Think step-by-step before concluding
- Highly structured, logical sections where all facts reconcile
- Avoid fluff or buzzwords, focus on critical insights
- Be concise and professional

IMPORTANT CITATION REQUIREMENTS:
- After EVERY factual claim, you MUST add an inline citation with the actual source link
- Use this EXACT format: (Source: [Source Name] - [Full URL])
- For example: "Market reached $4.2B in 2024 (Source: Gartner 2024 - https://gartner.com/report)"
- You can also use numbered format [N] but ALWAYS include the actual source link inline as well
- Include confidence indicators (🟢🟡🔴) where appropriate

Available Sources with FULL URLs:
${researchState.findings
  .map((f, idx) => {
    const citNum = citationMap.get(f.source);
    try {
      const url = new URL(f.source);
      return `[${citNum}] ${url.hostname}\nFull URL: ${f.source}\nContent: ${f.text}\n`;
    } catch {
      return `[${citNum}] ${f.source}\nContent: ${f.text}\n`;
    }
  })
  .join('\n')}

CRITICAL: Every factual claim must include BOTH:
1. The inline source link: (Source: Gartner - https://gartner.com/report)
2. Optional numbered citation [N] for cross-reference

Previous Analysis Summaries:
${researchState.summaries.join('\n\n')}

Generate a COMMERCIAL DUE DILIGENCE REPORT following this structure:

# ${topic}

## 0. Front Matter
- Research topic and scope [N]
- Methodology: Sources used, data cutoff date [N]
- Number of sources consulted: ${sources.length}

## 1. Executive Summary (3-4 paragraphs)
- Market snapshot: size, growth, profitability [N]
- Key drivers: 2-3 headline catalysts [N]
- Top investment theses [N]
- Risks & red flags [N]

## 2. Market 101
### A. Problem Space & Workflow
[Describe where pain exists and who experiences it [N]]

### B. Value Chain & Revenue Pools
[Map suppliers → products → end-users [N]]

### C. Market Segmentation
[Segment by vertical, customer size, geography [N]]

### D. TAM/SAM/SOM Sizing
[Triangulated market sizing with confidence indicators 🟢🟡🔴 [N]]

### E. Growth Drivers & Inhibitors
[Rank-ordered drivers with evidence [N]]

### F. Unit Economics
[Gross margins, retention, payback periods [N]]

## 3. Competitive Landscape
### A. Market Structure
[Fragmentation vs concentration analysis [N]]

### B. Top Vendors
[Key players, market share, positioning [N]]

### C. M&A Activity
[Recent deals, multiples, trends [N]]

### D. White Space Analysis
[Unmet needs, opportunities [N]]

## 4. Customer Voice
[Decision-maker personas, buying criteria, pain points [N]]

## 5. Investment Theses
[3-5 specific theses with sizing of prize, PE value-add, and risks [N]]

## 6. Target Universe (if applicable)
[Potential acquisition targets or market participants [N]]

## 7. Value Creation Playbook
[100-day plan, tech modernization, GTM acceleration [N]]

## 8. Risks & Sensitivities
[Macro, technological, execution risks [N]]

## 9. References & Bibliography
${sources.map((s) => `[${s.id}] ${s.title} - ${s.url}`).join('\n')}

CRITICAL REQUIREMENTS:
- Every factual statement must have inline citation [N]  
- Add confidence indicators (🟢🟡🔴) to quantitative claims
- Ensure all figures reconcile and make sense together
- Focus on actionable insights for PE investors
- Be comprehensive, detailed, and professionally formatted`,
                });

                addActivity({
                  type: 'synthesis',
                  status: 'complete',
                  message: 'Research report completed',
                  timestamp: new Date().toISOString(),
                  depth: researchState.currentDepth,
                });

                // Send the structured report with findings
                dataStream.writeData({
                  type: 'research-report',
                  content: {
                    report: finalReport.text,
                    citations: sources,
                    findings: researchState.findings,
                    metadata: {
                      topic,
                      completedSteps: researchState.completedSteps,
                      totalSteps: researchState.totalExpectedSteps,
                      duration: Date.now() - startTime,
                      sourcesCount: sources.length,
                    },
                  },
                });

                return {
                  success: true,
                  data: {
                    findings: researchState.findings,
                    analysis: finalReport.text,
                    citations: sources,
                    completedSteps: researchState.completedSteps,
                    totalSteps: researchState.totalExpectedSteps,
                  },
                };
              } catch (error: any) {
                console.error('Deep research error:', error);

                addActivity({
                  type: 'thought',
                  status: 'error',
                  message: `Research failed: ${error.message}`,
                  timestamp: new Date().toISOString(),
                  depth: researchState.currentDepth,
                });

                return {
                  success: false,
                  error: error.message,
                  data: {
                    findings: researchState.findings,
                    completedSteps: researchState.completedSteps,
                    totalSteps: researchState.totalExpectedSteps,
                  },
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
