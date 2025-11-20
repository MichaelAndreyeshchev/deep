/**
 * API route that proxies SSE streams from the Python deep research service
 * to the Next.js frontend, integrating with the existing chat streaming architecture.
 */

import { NextRequest } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${PYTHON_SERVICE_URL}/research/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Python service request failed' }),
        { status: response.status }
      );
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Error proxying to Python service:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to connect to research service' }),
      { status: 500 }
    );
  }
}
