# Four-Agent Deep Research Pipeline Implementation

## Summary

This implementation replaces the existing deepResearch tool with a four-agent pipeline that automatically handles:

1. **Triage Agent** - Analyzes the query to determine if clarification is needed
2. **Clarifying Agent** - Generates targeted questions when context is missing  
3. **Instruction Builder Agent** - Converts the enriched input into a precise research brief
4. **Research Agent** - Uses o3-deep-research-2025-06-26 via the Responses API

## How It Works

When a user sends a message in chat:

1. The deepResearch tool is automatically invoked by the AI
2. The Triage Agent examines the query and decides whether to:
   - Route to Clarifying Agent (if context missing)
   - Route to Instruction Agent (if sufficient detail)
3. If clarifications are needed:
   - Clarifying Agent generates 3-6 targeted questions
   - Questions are shown to the user in the chat
   - User provides answers
   - System re-invokes deepResearch with the answers
4. Instruction Agent builds a detailed research brief
5. Research Agent executes via o3-deep-research model with web_search_preview tool
6. Final report is displayed with citations

## Key Features

- **Automatic clarification flow** - No manual button clicks needed
- **Agent interaction tracking** - See which agents are working and their decisions
- **Streaming progress updates** - Real-time visibility into research progress
- **Full citation support** - Every claim linked to sources
- **Seamless chat integration** - Works within existing chat interface

## File Changes

### 1. `app/(chat)/api/chat/route.ts`
- Add import: `import { runAgentPipeline } from '@/lib/ai/deep-research-pipeline';`
- Replace the entire deepResearch tool definition

### 2. New Files Created
- `lib/ai/agents.ts` - Agent definitions and prompts
- `lib/ai/deep-research-pipeline.ts` - Pipeline orchestration
- `app/api/deep-research/route.ts` - o3-deep-research API endpoint

### 3. Components Updated
- The chat interface automatically displays agent progress
- Citations and findings are rendered in the existing UI

## Usage

Simply type your research query in the chat. The system will:
- Automatically determine if clarifications are needed
- Ask questions if necessary
- Perform comprehensive research
- Return a detailed report with citations

Example:
```
User: "I want to research the foundation repair market"
AI: [Triage Agent routes to Clarifying Agent]
AI: "I need some additional context to provide the best research:
    - What geographic region are you interested in?
    - What timeframe should I focus on?
    - Are you looking at residential, commercial, or both?
    - What specific aspects interest you most?"
User: [Provides answers]
AI: [Executes full research pipeline and returns comprehensive report]
```

## Benefits

1. **No manual steps** - Everything flows automatically
2. **Better research quality** - Clarifications ensure comprehensive coverage
3. **Full transparency** - See agent decisions and reasoning
4. **Scalable** - Easy to add new agents or modify behavior
5. **Production ready** - Error handling and progress tracking built-in
