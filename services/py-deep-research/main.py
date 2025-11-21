"""
FastAPI service that wraps qx-labs/agents-deep-research with SSE streaming.
Streams intermediate research events to the Next.js frontend.
"""
import asyncio
import json
import os
from typing import AsyncGenerator, Literal, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv

from deep_researcher import IterativeResearcher, DeepResearcher, LLMConfig

load_dotenv()

if not os.getenv("OPENAI_API_KEY"):
    raise RuntimeError("OPENAI_API_KEY environment variable is required")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    print("🚀 Deep Research Service starting up...")
    print(f"   OpenAI API Key: {'✓ Set' if os.getenv('OPENAI_API_KEY') else '✗ Missing'}")
    print(f"   Search Provider: OpenAI (web_search_preview)")
    yield
    print("👋 Deep Research Service shutting down...")


app = FastAPI(
    title="Deep Research Service",
    description="Streaming deep research service using qx-labs/agents-deep-research",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ResearchRequest(BaseModel):
    """Request model for starting a research task."""
    query: str = Field(..., description="The research question or topic")
    mode: Literal["iterative", "deep"] = Field(
        default="iterative",
        description="Research mode: 'iterative' for faster 5-page reports, 'deep' for thorough 20+ page reports"
    )
    max_iterations: int = Field(default=5, ge=1, le=20, description="Maximum research iterations")
    max_time_minutes: int = Field(default=10, ge=1, le=60, description="Maximum time in minutes")
    output_length: str = Field(default="5 pages", description="Desired output length (for iterative mode)")
    background_context: str = Field(default="", description="Background context from uploaded documents")


class ResearchEvent(BaseModel):
    """Model for SSE events sent to the frontend."""
    type: str = Field(..., description="Event type")
    data: dict = Field(default_factory=dict, description="Event data")


class StreamingResearchWrapper:
    """Wrapper that captures events from the research process and streams them via SSE."""
    
    def __init__(self):
        self.events: list[ResearchEvent] = []
        
    async def stream_iterative_research(
        self,
        query: str,
        max_iterations: int,
        max_time_minutes: int,
        output_length: str,
        background_context: str,
    ) -> AsyncGenerator[str, None]:
        """Stream events from IterativeResearcher."""
        try:
            yield self._format_event("started", {
                "mode": "iterative",
                "query": query,
                "max_iterations": max_iterations,
                "max_time_minutes": max_time_minutes,
            })
            
            llm_config = LLMConfig(
                search_provider="openai",
                reasoning_model_provider="openai",
                reasoning_model="o3-mini",
                main_model_provider="openai",
                main_model="gpt-4o",
                fast_model_provider="openai",
                fast_model="gpt-4o-mini"
            )
            
            researcher = IterativeResearcher(
                max_iterations=max_iterations,
                max_time_minutes=max_time_minutes,
                verbose=False,  # We'll handle our own logging via events
                tracing=False,
                config=llm_config
            )
            
            original_log = researcher._log_message
            iteration_count = [0]  # Use list to allow modification in closure
            
            def custom_log(message: str):
                """Custom logging that emits SSE events."""
                if "Starting Iteration" in message:
                    iteration_count[0] += 1
                    asyncio.create_task(self._emit_event("iteration_start", {
                        "iteration": iteration_count[0],
                        "message": message
                    }))
                elif "<thought>" in message:
                    asyncio.create_task(self._emit_event("observations", {
                        "content": message.replace("<thought>", "").replace("</thought>", "").strip()
                    }))
                elif "<task>" in message:
                    asyncio.create_task(self._emit_event("gap_detected", {
                        "gap": message.replace("<task>", "").replace("</task>", "").strip()
                    }))
                elif "<action>" in message:
                    asyncio.create_task(self._emit_event("tool_selection", {
                        "tools": message.replace("<action>", "").replace("</action>", "").strip()
                    }))
                elif "Tool execution progress" in message:
                    asyncio.create_task(self._emit_event("tool_progress", {
                        "message": message
                    }))
                elif "<findings>" in message:
                    asyncio.create_task(self._emit_event("findings_update", {
                        "findings": message.replace("<findings>", "").replace("</findings>", "").strip()
                    }))
                elif "Drafting Final Response" in message:
                    asyncio.create_task(self._emit_event("finalizing", {
                        "message": "Creating final report..."
                    }))
                
                original_log(message)
            
            researcher._log_message = custom_log
            
            report = await researcher.run(
                query=query,
                output_length=output_length,
                background_context=background_context
            )
            
            citations = self._extract_citations_from_findings(researcher.conversation.get_all_findings())
            
            for citation in citations:
                yield self._format_event("citation", citation)
            
            yield self._format_event("final_report", {
                "report": report,
                "citations": citations,
                "iterations": iteration_count[0]
            })
            
            yield self._format_event("completed", {
                "message": "Research completed successfully"
            })
            
        except Exception as e:
            yield self._format_event("error", {
                "error": str(e),
                "type": type(e).__name__
            })
    
    async def stream_deep_research(
        self,
        query: str,
        max_iterations: int,
        max_time_minutes: int,
    ) -> AsyncGenerator[str, None]:
        """Stream events from DeepResearcher."""
        try:
            yield self._format_event("started", {
                "mode": "deep",
                "query": query,
                "max_iterations": max_iterations,
                "max_time_minutes": max_time_minutes,
            })
            
            llm_config = LLMConfig(
                search_provider="openai",
                reasoning_model_provider="openai",
                reasoning_model="o3-mini",
                main_model_provider="openai",
                main_model="gpt-4o",
                fast_model_provider="openai",
                fast_model="gpt-4o-mini"
            )
            
            researcher = DeepResearcher(
                max_iterations=max_iterations,
                max_time_minutes=max_time_minutes,
                verbose=False,
                tracing=False,
                config=llm_config
            )
            
            original_log = researcher._log_message
            section_count = [0]
            
            def custom_log(message: str):
                """Custom logging that emits SSE events."""
                if "Building Report Plan" in message:
                    asyncio.create_task(self._emit_event("planning", {
                        "message": "Creating report outline..."
                    }))
                elif "Report plan created with" in message:
                    asyncio.create_task(self._emit_event("plan_created", {
                        "message": message
                    }))
                elif "Initializing Research Loops" in message:
                    asyncio.create_task(self._emit_event("research_start", {
                        "message": "Starting parallel section research..."
                    }))
                elif "Building Final Report" in message:
                    asyncio.create_task(self._emit_event("finalizing", {
                        "message": "Compiling final report..."
                    }))
                elif "completed in" in message:
                    asyncio.create_task(self._emit_event("progress", {
                        "message": message
                    }))
                
                original_log(message)
            
            researcher._log_message = custom_log
            
            report = await researcher.run(query=query)
            
            citations = self._extract_citations_from_report(report)
            
            for citation in citations:
                yield self._format_event("citation", citation)
            
            yield self._format_event("final_report", {
                "report": report,
                "citations": citations
            })
            
            yield self._format_event("completed", {
                "message": "Deep research completed successfully"
            })
            
        except Exception as e:
            yield self._format_event("error", {
                "error": str(e),
                "type": type(e).__name__
            })
    
    async def _emit_event(self, event_type: str, data: dict):
        """Emit an event (for internal tracking)."""
        self.events.append(ResearchEvent(type=event_type, data=data))
    
    def _format_event(self, event_type: str, data: dict) -> str:
        """Format an event as SSE."""
        event_json = json.dumps({"type": event_type, "data": data})
        return f"data: {event_json}\n\n"
    
    def _extract_citations_from_findings(self, findings: list[str]) -> list[dict]:
        """Extract citations from research findings."""
        citations = []
        citation_id = 1
        
        for finding in findings:
            import re
            urls = re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', finding)
            
            for url in urls:
                title = self._extract_title_near_url(finding, url)
                
                citations.append({
                    "id": citation_id,
                    "url": url,
                    "title": title or url,
                    "sourceType": "web",
                    "snippet": finding[:200] + "..." if len(finding) > 200 else finding
                })
                citation_id += 1
        
        return citations
    
    def _extract_citations_from_report(self, report: str) -> list[dict]:
        """Extract citations from the final report."""
        citations = []
        citation_id = 1
        
        import re
        markdown_links = re.findall(r'\[([^\]]+)\]\((https?://[^\)]+)\)', report)
        
        for title, url in markdown_links:
            citations.append({
                "id": citation_id,
                "url": url,
                "title": title,
                "sourceType": "web",
                "snippet": ""
            })
            citation_id += 1
        
        plain_urls = re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', report)
        for url in plain_urls:
            if not any(c["url"] == url for c in citations):
                citations.append({
                    "id": citation_id,
                    "url": url,
                    "title": url,
                    "sourceType": "web",
                    "snippet": ""
                })
                citation_id += 1
        
        return citations
    
    def _extract_title_near_url(self, text: str, url: str) -> Optional[str]:
        """Try to extract a title near a URL in text."""
        url_pos = text.find(url)
        if url_pos > 0:
            before_text = text[max(0, url_pos - 100):url_pos].strip()
            sentences = before_text.split('.')
            if sentences:
                return sentences[-1].strip()
        return None


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "Deep Research Service",
        "status": "running",
        "version": "1.0.0",
        "modes": ["iterative", "deep"]
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.post("/research/stream")
async def stream_research(request: ResearchRequest):
    """
    Start a research task and stream progress events via SSE.
    
    Returns an SSE stream with events:
    - started: Research has begun
    - iteration_start: New iteration starting
    - observations: Agent observations/thinking
    - gap_detected: Knowledge gap identified
    - tool_selection: Tools selected for research
    - tool_progress: Tool execution progress
    - findings_update: New findings discovered
    - citation: Citation discovered
    - section_draft: Section completed (deep mode only)
    - final_report: Complete report ready
    - completed: Research finished
    - error: Error occurred
    """
    wrapper = StreamingResearchWrapper()
    
    if request.mode == "iterative":
        return EventSourceResponse(
            wrapper.stream_iterative_research(
                query=request.query,
                max_iterations=request.max_iterations,
                max_time_minutes=request.max_time_minutes,
                output_length=request.output_length,
                background_context=request.background_context,
            )
        )
    elif request.mode == "deep":
        return EventSourceResponse(
            wrapper.stream_deep_research(
                query=request.query,
                max_iterations=request.max_iterations,
                max_time_minutes=request.max_time_minutes,
            )
        )
    else:
        raise HTTPException(status_code=400, detail=f"Invalid mode: {request.mode}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
