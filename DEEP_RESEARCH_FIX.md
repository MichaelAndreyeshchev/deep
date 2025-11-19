# Fix for Deep Research in Chat

## Problem
The deepResearch tool is not being invoked when typing research queries in the regular chat interface.

## Root Causes
1. The `experimental_deepResearch` flag defaults to `false` and is only true when "Deep Research" tab is selected
2. The deepResearch tool needs the four-agent pipeline implementation
3. The system prompt needs to instruct the AI to use deepResearch for research queries

## Solution

### Step 1: Update System Prompt
In `lib/ai/prompts.ts`, replace the systemPrompt to explicitly mention deepResearch:

```typescript
export const systemPrompt = `${regularPrompt}

You have access to a powerful deepResearch tool that uses a four-agent pipeline (Triage → Clarifier → Instruction Builder → Research Agent with o3-deep-research).

IMPORTANT: For any research-related queries, market analysis, due diligence, or comprehensive information requests, you MUST use the deepResearch tool. This includes:
- Market research and analysis
- Industry reports
- Competitive analysis
- Due diligence requests
- Any query requesting a "report" or comprehensive analysis

The deepResearch tool will:
1. Automatically determine if clarifications are needed
2. Ask targeted questions if context is missing
3. Build detailed research instructions
4. Execute comprehensive research with citations

When using deepResearch:
- Pass the user's query as the 'topic' parameter
- If the user has already answered clarifying questions, pass them as 'clarificationAnswers'
- The tool handles the entire pipeline automatically

Only use search/extract/scrape tools for quick, specific information lookups. For comprehensive research, ALWAYS use deepResearch.`;
```

### Step 2: Enable All Tools in Chat
In `app/(chat)/api/chat/route.ts`:

1. Add import:
```typescript
import { runAgentPipeline } from '@/lib/ai/deep-research-pipeline';
```

2. Change line ~539:
```typescript
// OLD:
experimental_activeTools: experimental_deepResearch ? allTools : webSearchTools,
// NEW:
experimental_activeTools: allTools, // Always enable all tools including deepResearch
```

3. Update deepResearch tool description (line ~688):
```typescript
description: 'Perform deep research using the four-agent pipeline: Triage → Clarifier/Instruction → Research. This automatically handles clarifications and research planning. Use this for any comprehensive research, market analysis, or report generation.',
```

4. Update deepResearch parameters:
```typescript
parameters: z.object({
  topic: z.string().describe('The topic or question to research'),
  clarificationAnswers: z.record(z.string()).optional().describe('Answers to clarification questions if already collected'),
}),
```

5. Replace the entire deepResearch execute function with the pipeline implementation:
```typescript
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
```

## Testing

After applying these changes:

1. Build and restart: `docker compose up -d --build`
2. Access http://localhost:13000
3. Type your research query in the regular chat (not the Deep Research tab)
4. The AI should automatically invoke the deepResearch tool
5. You'll see the four-agent pipeline in action:
   - Triage agent deciding if clarifications are needed
   - Clarifying agent asking questions (if needed)
   - Instruction builder creating research brief
   - Research agent executing with o3-deep-research

## Expected Behavior

When you type: "I want to develop a research report on the foundation repair and waterproofing services market in the US"

The system will:
1. Invoke deepResearch tool automatically
2. Show agent activities in the UI
3. May ask clarifying questions
4. Execute comprehensive research
5. Return report with inline citations that include:
   - start_index and end_index
   - title
   - url

## Verification

Check that the report includes proper citations by looking for:
- Inline citation markers like [1], [2], etc. in the text
- A citations section at the end
- Each citation having proper metadata
