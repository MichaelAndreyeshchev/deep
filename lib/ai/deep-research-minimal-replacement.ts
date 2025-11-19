// Minimal replacement for deepResearch execute function
export const deepResearchExecuteReplacement = `
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
            },`;
