# Deep Research Python Service

FastAPI service that wraps [qx-labs/agents-deep-research](https://github.com/qx-labs/agents-deep-research) with Server-Sent Events (SSE) streaming for real-time progress updates.

## Features

- **Two Research Modes**:
  - `iterative`: Faster research for shorter reports (up to 5 pages)
  - `deep`: Thorough research for longer reports (20+ pages) with parallel section processing
  
- **Real-time Streaming**: SSE events for all research steps (observations, tool selection, findings, citations)
- **OpenAI Integration**: Uses OpenAI's native web search (no external search API needed)
- **Citation Tracking**: Automatically extracts and streams citations from research findings

## Setup

### Local Development

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file:
```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

3. Run the service:
```bash
python main.py
# Or with uvicorn:
uvicorn main:app --reload --port 8001
```

The service will be available at `http://localhost:8001`

### Docker

1. Build the image:
```bash
docker build -t deep-research-service .
```

2. Run the container:
```bash
docker run -p 8001:8001 \
  -e OPENAI_API_KEY=your_key_here \
  deep-research-service
```

## API Endpoints

### `GET /`
Health check and service info.

### `POST /research/stream`
Start a research task and stream progress via SSE.

**Request Body**:
```json
{
  "query": "What are the latest developments in quantum computing?",
  "mode": "iterative",
  "max_iterations": 5,
  "max_time_minutes": 10,
  "output_length": "5 pages",
  "background_context": ""
}
```

**SSE Events**:
- `started`: Research has begun
- `iteration_start`: New iteration starting
- `observations`: Agent observations/thinking
- `gap_detected`: Knowledge gap identified
- `tool_selection`: Tools selected for research
- `tool_progress`: Tool execution progress
- `findings_update`: New findings discovered
- `citation`: Citation discovered
- `final_report`: Complete report ready
- `completed`: Research finished
- `error`: Error occurred

## Integration with Next.js

The Next.js frontend proxies requests to this service and re-emits SSE events to the chat UI. See the main app's API routes for integration details.

## Environment Variables

- `OPENAI_API_KEY` (required): Your OpenAI API key
- `SEARCH_PROVIDER` (optional): Search provider to use (default: `openai`)

## Architecture

This service wraps the qx-labs deep-researcher library and adds:
1. FastAPI REST API with SSE streaming
2. Event emission at each research step
3. Citation extraction from findings
4. CORS support for frontend integration
