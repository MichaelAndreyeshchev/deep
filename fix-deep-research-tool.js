const fs = require('fs');

// Read the file
let content = fs.readFileSync('app/(chat)/api/chat/route.ts', 'utf8');

// Find the start of deepResearch tool
const deepResearchStart = content.indexOf('deepResearch: {');
if (deepResearchStart === -1) {
  console.error('Could not find deepResearch tool');
  process.exit(1);
}

// Find the end of the deepResearch tool by counting braces
let braceCount = 0;
let inString = false;
let escapeNext = false;
let i = deepResearchStart;

for (; i < content.length; i++) {
  const char = content[i];
  
  if (escapeNext) {
    escapeNext = false;
    continue;
  }
  
  if (char === '\\') {
    escapeNext = true;
    continue;
  }
  
  if (char === '"' || char === "'" || char === '`') {
    // Simple string detection (doesn't handle all cases but good enough)
    if (!inString) {
      inString = char;
    } else if (inString === char) {
      inString = false;
    }
    continue;
  }
  
  if (!inString) {
    if (char === '{') braceCount++;
    if (char === '}') {
      braceCount--;
      if (braceCount === 0) {
        // Found the end of deepResearch tool
        break;
      }
    }
  }
}

const deepResearchEnd = i + 1;

// The new deepResearch implementation
const newDeepResearch = `deepResearch: {
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

              } catch (error) {
                console.error('Deep research error:', error);
                return {
                  success: false,
                  error: error.message || 'Deep research failed',
                };
              }
            },
          }`;

// Replace the old implementation with the new one
const newContent = content.substring(0, deepResearchStart) + 
                  newDeepResearch + 
                  content.substring(deepResearchEnd);

// Write the updated content
fs.writeFileSync('app/(chat)/api/chat/route.ts', newContent);

console.log('✅ Successfully updated deepResearch tool implementation!');
console.log('📍 Tool starts at position:', deepResearchStart);
console.log('📍 Tool ends at position:', deepResearchEnd);
console.log('📝 Replaced', deepResearchEnd - deepResearchStart, 'characters');
