/**
 * Deep Research Pipeline Implementation
 * Handles the execution of the four-agent research workflow
 */

import { generateText } from 'ai';
import { customModel } from '@/lib/ai';
import {
  AgentEventTracker,
  triageQuery,
  generateClarifyingQuestions,
  buildResearchInstructions,
  RESEARCH_AGENT_SYSTEM_PROMPT,
  parseClarificationAnswers,
} from './agents';

export interface ResearchPipelineOptions {
  topic: string;
  clarificationAnswers?: Record<string, string>;
  modelId: string;
  reasoningModelId: string;
  maxDepth?: number;
  dataStream: any;
  onActivity: (activity: any) => void;
  onSource: (source: any) => void;
  onProgress?: (progress: any) => void;
}

export interface ResearchPipelineResult {
  success: boolean;
  needsClarification?: boolean;
  clarificationQuestions?: string[];
  report?: string;
  citations?: Array<{
    index: number;
    title: string;
    url: string;
    detail?: string;
  }>;
  findings?: any[];
  agentFlow?: string;
  error?: string;
}

export async function executeResearchPipeline(
  options: ResearchPipelineOptions
): Promise<ResearchPipelineResult> {
  const {
    topic,
    clarificationAnswers,
    modelId,
    reasoningModelId,
    maxDepth = 7,
    dataStream,
    onActivity,
    onSource,
    onProgress,
  } = options;

  const eventTracker = new AgentEventTracker();
  const startTime = Date.now();
  const timeLimit = 4.5 * 60 * 1000;

  try {
    // Step 1: Triage Agent
    onActivity({
      type: 'reasoning',
      status: 'pending',
      message: '🤖 Triage Agent analyzing query...',
      timestamp: new Date().toISOString(),
      depth: 0,
    });

    eventTracker.addEvent({
      agentName: 'Triage Agent',
      type: 'reasoning',
      content: { analyzing: topic },
    });

    const triageDecision = await triageQuery(topic, modelId);

    eventTracker.addEvent({
      agentName: 'Triage Agent',
      type: 'handoff',
      content: {
        to: triageDecision.decision === 'clarify' ? 'Clarifying Agent' : 'Instruction Agent',
        reason: triageDecision.reason,
      },
    });

    onActivity({
      type: 'reasoning',
      status: 'complete',
      message: `🤖 Triage decision: ${triageDecision.decision} - ${triageDecision.reason}`,
      timestamp: new Date().toISOString(),
      depth: 0,
    });

    // Step 2: Handle based on triage decision
    if (triageDecision.decision === 'clarify' && !clarificationAnswers) {
      // Route to Clarifying Agent
      onActivity({
        type: 'reasoning',
        status: 'pending',
        message: '💭 Clarifying Agent generating questions...',
        timestamp: new Date().toISOString(),
        depth: 0,
      });

      eventTracker.addEvent({
        agentName: 'Clarifying Agent',
        type: 'reasoning',
        content: { generating: 'clarification questions' },
      });

      const clarifications = await generateClarifyingQuestions(topic, modelId);

      eventTracker.addEvent({
        agentName: 'Clarifying Agent',
        type: 'clarifications',
        content: clarifications,
      });

      onActivity({
        type: 'reasoning',
        status: 'complete',
        message: `💭 Generated ${clarifications.questions.length} clarifying questions`,
        timestamp: new Date().toISOString(),
        depth: 0,
      });

      // Return early with clarification questions
      return {
        success: true,
        needsClarification: true,
        clarificationQuestions: clarifications.questions,
        agentFlow: eventTracker.getAgentFlow(),
      };
    }

    // Step 3: Instruction Builder Agent
    onActivity({
      type: 'reasoning',
      status: 'pending',
      message: '📝 Instruction Agent building research brief...',
      timestamp: new Date().toISOString(),
      depth: 0,
    });

    eventTracker.addEvent({
      agentName: 'Instruction Agent',
      type: 'reasoning',
      content: { building: 'research instructions' },
    });

    const researchInstructions = await buildResearchInstructions(
      topic,
      clarificationAnswers || null,
      modelId
    );

    eventTracker.addEvent({
      agentName: 'Instruction Agent',
      type: 'handoff',
      content: {
        to: 'Research Agent',
        instructions: researchInstructions.substring(0, 200) + '...',
      },
    });

    onActivity({
      type: 'reasoning',
      status: 'complete',
      message: '📝 Research instructions ready',
      timestamp: new Date().toISOString(),
      depth: 0,
    });

    // Step 4: Research Agent (o3-deep-research via API)
    onActivity({
      type: 'reasoning',
      status: 'pending',
      message: '🔍 Research Agent starting deep research with o3-deep-research...',
      timestamp: new Date().toISOString(),
      depth: 1,
    });

    eventTracker.addEvent({
      agentName: 'Research Agent (o3-deep-research)',
      type: 'tool_call',
      content: {
        name: 'web_search_preview',
        starting: true,
      },
    });

    // Initialize progress if callback provided
    if (onProgress) {
      onProgress({
        type: 'progress-init',
        content: {
          maxDepth,
          totalSteps: maxDepth * 5,
        },
      });
    }

    // Check if running on server or client
    const baseUrl = typeof window === 'undefined' 
      ? `http://localhost:${process.env.PORT || 3000}`
      : '';
      
    // Call the o3-deep-research API endpoint
    const deepResearchResponse = await fetch(`${baseUrl}/api/deep-research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: researchInstructions,
        // Skip clarifications since we already handled them
        clarifications: { 'Already handled': 'Research instructions include all context' },
      }),
    });

    if (!deepResearchResponse.ok) {
      throw new Error(`Deep research API error: ${deepResearchResponse.statusText}`);
    }

    const deepResearchResult = await deepResearchResponse.json();

    if (deepResearchResult.status !== 'complete') {
      throw new Error('Unexpected deep research response status');
    }

    eventTracker.addEvent({
      agentName: 'Research Agent (o3-deep-research)',
      type: 'message_output',
      content: {
        reportLength: deepResearchResult.report?.length || 0,
        citationCount: deepResearchResult.citations?.length || 0,
      },
    });

    // Process citations and sources
    if (deepResearchResult.citations && Array.isArray(deepResearchResult.citations)) {
      for (const citation of deepResearchResult.citations) {
        onSource({
          url: citation.url,
          title: citation.title,
          description: `Citation ${citation.index}`,
        });
      }
    }

    onActivity({
      type: 'synthesis',
      status: 'complete',
      message: `🔍 Research complete with ${deepResearchResult.citations?.length || 0} citations`,
      timestamp: new Date().toISOString(),
      depth: 1,
    });

    // Transform findings to match expected format
    const findings = deepResearchResult.citations?.map((citation: any, idx: number) => ({
      statement: `Reference [${citation.index}]`,
      source: citation.url,
      confidence: 'high',
      metricLabel: citation.title,
    })) || [];

    return {
      success: true,
      report: deepResearchResult.report,
      citations: deepResearchResult.citations,
      findings,
      agentFlow: eventTracker.getAgentFlow(),
    };

  } catch (error: any) {
    console.error('Research pipeline error:', error);
    
    eventTracker.addEvent({
      agentName: 'Pipeline',
      type: 'message_output',
      content: { error: error.message },
    });

    return {
      success: false,
      error: error.message || 'Research pipeline failed',
      agentFlow: eventTracker.getAgentFlow(),
    };
  }
}

// Export a simpler interface for the deepResearch tool
export async function runAgentPipeline(
  topic: string,
  clarificationAnswers: Record<string, string> | undefined,
  modelId: string,
  reasoningModelId: string,
  callbacks: {
    onActivity: (activity: any) => void;
    onSource: (source: any) => void;
    onProgress?: (progress: any) => void;
    dataStream?: any;
  }
): Promise<ResearchPipelineResult> {
  return executeResearchPipeline({
    topic,
    clarificationAnswers,
    modelId,
    reasoningModelId,
    dataStream: callbacks.dataStream,
    onActivity: callbacks.onActivity,
    onSource: callbacks.onSource,
    onProgress: callbacks.onProgress,
  });
}
