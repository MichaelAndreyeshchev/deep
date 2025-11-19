// Complete replacement for the deepResearch tool in app/(chat)/api/chat/route.ts
// 
// Instructions:
// 1. Add import at top: import { runAgentPipeline } from '@/lib/ai/deep-research-pipeline';
// 2. Replace the entire deepResearch tool definition (from "deepResearch: {" to its closing "}," with the code below

export const deepResearchToolReplacement = `
          deepResearch: {
            description:
              'Perform deep research using the four-agent pipeline: Triage → Clarifier/Instruction → Research. This automatically handles clarifications and research planning.',
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
                      questions: result.clarificationQuestions,
                      agentFlow: result.agentFlow,
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
                      agentFlow: result.agentFlow,
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
          },`;

// Summary of changes:
// 1. Description updated to mention the four-agent pipeline
// 2. Parameters now include optional clarificationAnswers
// 3. Execute function signature changed from ({ topic, maxDepth = 7 }) to ({ topic, clarificationAnswers })
// 4. Complete body replaced with runAgentPipeline call
// 5. Handles three cases: needsClarification, success with report, and error
// 6. Integrates with existing dataStream for activity, source, and progress updates
