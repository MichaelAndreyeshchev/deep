/**
 * Client for interacting with the Python deep research service.
 * Handles SSE streaming and event conversion to the existing dataStream format.
 */

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';

export type ResearchMode = 'iterative' | 'deep';

export interface ResearchRequest {
  query: string;
  mode: ResearchMode;
  max_iterations?: number;
  max_time_minutes?: number;
  output_length?: string;
  background_context?: string;
}

export interface ResearchEvent {
  type: string;
  data: any;
}

export interface ResearchCallbacks {
  onActivity?: (activity: string) => void;
  onSource?: (source: any) => void;
  onProgress?: (progress: any) => void;
  onCitation?: (citation: any) => void;
  onFinding?: (finding: any) => void;
  dataStream?: any;
}

/**
 * Start a research task and stream events via SSE.
 * Converts Python service events to the existing dataStream format.
 */
export async function startResearch(
  request: ResearchRequest,
  callbacks: ResearchCallbacks
): Promise<{
  success: boolean;
  report?: string;
  citations?: any[];
  findings?: any[];
  error?: string;
}> {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/research/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Python service returned ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body from Python service');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    const citations: any[] = [];
    const findings: any[] = [];
    let finalReport = '';
    let hasError = false;
    let errorMessage = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;
        
        try {
          const jsonStr = line.substring(6); // Remove 'data: ' prefix
          const event: ResearchEvent = JSON.parse(jsonStr);
          
          switch (event.type) {
            case 'started':
              callbacks.onActivity?.(`Starting ${event.data.mode} research...`);
              callbacks.dataStream?.writeData({
                type: 'activity-delta',
                content: `Research mode: ${event.data.mode}`,
              });
              break;
              
            case 'iteration_start':
              callbacks.onActivity?.(`Iteration ${event.data.iteration} starting...`);
              callbacks.dataStream?.writeData({
                type: 'activity-delta',
                content: `Starting iteration ${event.data.iteration}`,
              });
              break;
              
            case 'observations':
              callbacks.onActivity?.(event.data.content);
              callbacks.dataStream?.writeData({
                type: 'activity-delta',
                content: `Observations: ${event.data.content.substring(0, 200)}...`,
              });
              break;
              
            case 'gap_detected':
              callbacks.onActivity?.(`Knowledge gap: ${event.data.gap}`);
              callbacks.dataStream?.writeData({
                type: 'activity-delta',
                content: `Addressing: ${event.data.gap}`,
              });
              break;
              
            case 'tool_selection':
              callbacks.onActivity?.('Selecting research tools...');
              callbacks.dataStream?.writeData({
                type: 'activity-delta',
                content: 'Executing research tools',
              });
              break;
              
            case 'tool_progress':
              callbacks.onActivity?.(event.data.message);
              break;
              
            case 'findings_update':
              const finding = {
                text: event.data.findings,
                source: 'research',
              };
              findings.push(finding);
              callbacks.onFinding?.(finding);
              callbacks.dataStream?.writeData({
                type: 'activity-delta',
                content: 'New findings discovered',
              });
              break;
              
            case 'citation':
              const citation = {
                url: event.data.url,
                title: event.data.title || event.data.url,
                sourceType: event.data.sourceType || 'web',
                snippet: event.data.snippet || '',
              };
              citations.push(citation);
              callbacks.onCitation?.(citation);
              callbacks.onSource?.(citation);
              callbacks.dataStream?.writeData({
                type: 'source-delta',
                content: citation,
              });
              break;
              
            case 'section_draft':
              callbacks.onActivity?.('Section completed');
              callbacks.dataStream?.writeData({
                type: 'activity-delta',
                content: 'Section draft completed',
              });
              break;
              
            case 'planning':
            case 'plan_created':
            case 'research_start':
            case 'finalizing':
              callbacks.onActivity?.(event.data.message);
              callbacks.dataStream?.writeData({
                type: 'activity-delta',
                content: event.data.message,
              });
              break;
              
            case 'final_report':
              finalReport = event.data.report;
              if (event.data.citations && Array.isArray(event.data.citations)) {
                citations.push(...event.data.citations);
              }
              break;
              
            case 'completed':
              callbacks.onActivity?.('Research completed successfully');
              callbacks.dataStream?.writeData({
                type: 'activity-delta',
                content: 'Research completed',
              });
              break;
              
            case 'error':
              hasError = true;
              errorMessage = event.data.error || 'Unknown error';
              callbacks.dataStream?.writeData({
                type: 'activity-delta',
                content: `Error: ${errorMessage}`,
              });
              break;
              
            default:
              console.log('Unknown event type:', event.type);
          }
        } catch (parseError) {
          console.error('Error parsing SSE event:', parseError);
        }
      }
    }
    
    if (hasError) {
      return {
        success: false,
        error: errorMessage,
      };
    }
    
    return {
      success: true,
      report: finalReport,
      citations,
      findings,
    };
    
  } catch (error: any) {
    console.error('Error calling Python research service:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect to research service',
    };
  }
}

/**
 * Check if the Python service is available.
 */
export async function checkServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch (error) {
    console.error('Python service health check failed:', error);
    return false;
  }
}
