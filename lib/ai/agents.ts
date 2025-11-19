/**
 * Four-Agent Deep Research Pipeline
 * 
 * 1. Triage Agent - Inspects query and routes to clarifier or instruction agent
 * 2. Clarifier Agent - Asks follow-up questions if context is missing
 * 3. Instruction Builder Agent - Converts enriched input into precise research brief
 * 4. Research Agent (o3-deep-research) - Performs web-scale empirical research
 */

import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { customModel } from '@/lib/ai';

export interface AgentEvent {
  agentName: string;
  type: 'handoff' | 'tool_call' | 'message_output' | 'reasoning' | 'clarifications';
  content?: any;
  timestamp?: string; // Optional since it's added by addEvent
}

export interface ClarificationQuestions {
  questions: string[];
}

export interface AgentHandoff {
  from: string;
  to: string;
  reason?: string;
}

// Agent prompts
export const TRIAGE_AGENT_PROMPT = `
You are a Triage Agent. Your job is to inspect the user's query and decide:
- If the query lacks important context or specificity → route to Clarifying Questions Agent
- If the query has sufficient detail → route to Research Instruction Agent

Analyze the query for:
1. Specificity of the research topic
2. Clear scope and boundaries
3. Defined objectives or outcomes
4. Time frames, geography, or other constraints
5. Target audience or use case

Output your decision as JSON:
{
  "decision": "clarify" | "instruct",
  "reason": "brief explanation"
}
`;

export const CLARIFYING_AGENT_PROMPT_V2 = `
You are a Clarifying Questions Agent. Based on the user's research query, ask 3-6 targeted questions that would help produce a more specific and valuable research report.

Focus on:
- Missing dimensions (time frame, geography, specific segments)
- Unclear objectives or use cases
- Depth and format preferences
- Data requirements or constraints
- Comparison needs

Output as JSON:
{
  "questions": ["question 1", "question 2", ...]
}

Keep questions concise and relevant.
`;

export const INSTRUCTION_BUILDER_PROMPT = `
You are a Research Instruction Agent. Convert the user's query (and any clarification answers) into a precise, detailed research brief for the Research Agent.

Include:
1. Clear research objectives
2. Specific areas to investigate
3. Required data types and metrics
4. Geographic/temporal scope
5. Output format expectations
6. Priority topics
7. Any constraints or special requirements

Write instructions in first person ("I want to understand...") and be as specific as possible.
`;

export const RESEARCH_AGENT_SYSTEM_PROMPT = `
You are a professional Research Agent preparing a comprehensive, data-driven report.

Do:
- Focus on empirical data: statistics, trends, specific figures
- Prioritize authoritative sources: industry reports, government data, academic research
- Structure findings with clear sections and subsections
- Include inline citations for every claim
- Highlight key insights and actionable findings
- Note confidence levels where appropriate
- Suggest visualizations where data supports them

Format as a professional research report with executive summary, detailed findings, and conclusions.
`;

// Agent event tracking
export class AgentEventTracker {
  private events: AgentEvent[] = [];

  addEvent(event: AgentEvent) {
    this.events.push({
      ...event,
      timestamp: new Date().toISOString()
    });
  }

  getEvents() {
    return this.events;
  }

  getAgentFlow() {
    return this.events.map((event, index) => {
      const prefix = `${index + 1}. [${event.agentName}]`;
      
      switch (event.type) {
        case 'handoff':
          return `${prefix} → Handoff to ${event.content.to}`;
        case 'tool_call':
          return `${prefix} → Tool Call: ${event.content.name}`;
        case 'clarifications':
          return `${prefix} → Generated ${event.content.questions.length} clarifying questions`;
        case 'message_output':
          return `${prefix} → Message Output`;
        case 'reasoning':
          return `${prefix} → Reasoning step`;
        default:
          return `${prefix} → ${event.type}`;
      }
    }).join('\n');
  }

  clear() {
    this.events = [];
  }
}

// Triage decision logic using LLM
export async function triageQuery(query: string, modelId: string = 'gpt-4o'): Promise<{ decision: 'clarify' | 'instruct'; reason: string }> {
  try {
    const result = await generateObject({
      model: customModel(modelId),
      system: TRIAGE_AGENT_PROMPT,
      prompt: query,
      schema: z.object({
        decision: z.enum(['clarify', 'instruct']),
        reason: z.string()
      })
    });
    
    return result.object;
  } catch (error) {
    console.error('Triage agent error:', error);
    // Fallback to heuristic
    return triageQueryHeuristic(query);
  }
}

// Heuristic fallback for triage
function triageQueryHeuristic(query: string): { decision: 'clarify' | 'instruct'; reason: string } {
  const hasSpecificMetrics = /\b(revenue|margin|market size|growth|profit|cost)\b/i.test(query);
  const hasGeography = /\b(US|USA|United States|state|region|location|city)\b/i.test(query);
  const hasTimeframe = /\b(202\d|year|month|quarter|annual|recent|forecast)\b/i.test(query);
  const hasSegments = /\b(segment|customer|commercial|residential|industrial)\b/i.test(query);
  const hasSpecificGoals = /\b(analyze|compare|evaluate|identify|assess)\b/i.test(query);
  
  const contextScore = [
    hasSpecificMetrics,
    hasGeography,
    hasTimeframe,
    hasSegments,
    hasSpecificGoals
  ].filter(Boolean).length;

  if (contextScore >= 3 && query.length > 100) {
    return {
      decision: 'instruct',
      reason: 'Query has sufficient context and specificity'
    };
  } else {
    return {
      decision: 'clarify',
      reason: 'Query would benefit from additional context'
    };
  }
}

// Generate clarifying questions using LLM
export async function generateClarifyingQuestions(query: string, modelId: string = 'gpt-4o'): Promise<ClarificationQuestions> {
  try {
    const result = await generateObject({
      model: customModel(modelId),
      system: CLARIFYING_AGENT_PROMPT_V2,
      prompt: query,
      schema: z.object({
        questions: z.array(z.string()).min(3).max(6)
      })
    });
    
    return result.object;
  } catch (error) {
    console.error('Clarifying agent error:', error);
    // Fallback questions
    return {
      questions: [
        'What specific timeframe would you like me to focus on?',
        'Are there particular geographic regions or markets of interest?',
        'What is the primary purpose or use case for this research?',
        'Are there specific metrics or data points you need?'
      ]
    };
  }
}

// Build research instructions using LLM
export async function buildResearchInstructions(
  query: string, 
  clarifications: Record<string, string> | null,
  modelId: string = 'gpt-4o'
): Promise<string> {
  try {
    let prompt = `Original query: ${query}`;
    
    if (clarifications && Object.keys(clarifications).length > 0) {
      prompt += '\n\nClarification answers:\n';
      for (const [q, a] of Object.entries(clarifications)) {
        prompt += `Q: ${q}\nA: ${a}\n\n`;
      }
    }
    
    const result = await generateText({
      model: customModel(modelId),
      system: INSTRUCTION_BUILDER_PROMPT,
      prompt
    });
    
    return result.text;
  } catch (error) {
    console.error('Instruction builder error:', error);
    // Fallback to original query
    return query;
  }
}

// Parse clarifications from freeform text into structured Q&A
export function parseClarificationAnswers(questionsText: string, answersText: string): Record<string, string> {
  const questions = questionsText.split('\n').filter(q => q.trim().startsWith('-') || q.trim().match(/^\d+\./));
  const answers = answersText.split('\n').filter(a => a.trim());
  
  const clarifications: Record<string, string> = {};
  
  // Simple matching - can be improved with better parsing
  questions.forEach((q, i) => {
    const cleanQ = q.replace(/^[-\d.]\s*/, '').trim();
    if (cleanQ && answers[i]) {
      clarifications[cleanQ] = answers[i].trim();
    }
  });
  
  // If no structured matching, use the full answer text
  if (Object.keys(clarifications).length === 0 && answersText.trim()) {
    clarifications['User Response'] = answersText.trim();
  }
  
  return clarifications;
}
