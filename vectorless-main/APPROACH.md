## Approach & Architecture

### Goals
- Showcase a weekend-scale but production-minded Deep Research system.
- Keep ingestion vectorless (chunk metadata + citations, no external vector DB).
- Mirror ChatGPT Deep Research UX: clarify → plan → execute → synthesize.
- Provide traceability (progress timeline, methodology CSV, source reliability).

### Architecture Snapshot
```
apps/web (Next.js 15)
 ├─ app/api/...         REST endpoints for runs, sections, exports, sources
 ├─ app/page.tsx        Research cockpit (client component)
 └─ lib/orchestrator.ts Clarify / rewrite / deep research helpers (OpenAI Responses)

apps/ingest-worker (Node)
 └─ src/index.ts        PDF / transcript ingestion with adaptive chunking

packages/core
 ├─ chunking.ts         Adaptive chunk slicer (token-agnostic, char budgets)
 ├─ storage.ts          Filesystem helper for uploads (.data/uploads)
 ├─ pdf.ts              pdf-parse wrapper that returns page slices
 ├─ transcript-parser.ts Speaker-turn parser for AlphaSense transcripts
 ├─ orchestrator.ts     Prompt builders for clarify / rewrite / research
 └─ duckdb.ts           Lightweight analytics entrypoint (future TAM charts)

packages/db
 └─ prisma/schema.prisma  SQLite schema (ResearchRun, Document, Chunk, Source, Citation,
                          InterviewTranscript, TranscriptSegment, ProgressEvent,
                          ReportSection, ReportSectionComment, MethodologyEntry, AuditLog)
```

### Data Flow
1. **Run creation** stores the brief + creates baseline conversation turn + entries.
2. **Upload PDF** -> `/api/ingest/upload` writes file to `.data/uploads` and inserts `Document` (status `pending`). Ingestion worker polls, chunkifies, and updates `Chunk` + `Source` + `ProgressEvent` rows.
3. **Upload transcript** -> `/api/transcripts/upload` parses speaker turns immediately (no worker needed), creating `TranscriptSegment` + `Chunk` rows tied to `Source` type `transcript`.
4. **Clarify** -> orchestrator builds prompts via `buildClarifierPrompt`, calls `gpt-4.1-mini`, stores answers as `ConversationTurn`, and logs `ProgressEvent` + `MethodologyEntry`.
5. **Rewrite** -> same pattern with `buildRewritePrompt` (`gpt-4.1`).
6. **Deep Research** -> `o3-deep-research` background request, metadata stores `responseId`. Status polling fetches result, updates `ReportSection` if not already present, and changes `ResearchRun.status` to `COMPLETED`.
7. **Report editing** -> client UI binds to `reportSections`, `PUT /api/research/run/[id]/sections` upserts Markdown blocks and preserves ordering. Export endpoints stream Markdown and render PDF via `pdf-lib`.
8. **Citations & sources** -> ingestion populates `Source.reliabilityScore` heuristic; UI exposes `/sources` route to show bibliographies. The verify endpoint recomputes reliability based on chunk counts to simulate a QA pass.
9. **Methodology** -> every major step records a `MethodologyEntry` (action + JSON payload). `/methodology/export` emits CSV for compliance review.

### Key Decisions
- **Monorepo** to co-locate worker + Next.js + shared packages without over-optimising build tooling.
- **SQLite** fits the weekend scope and keeps local setup trivial; Prisma generates the client used by both apps.
- **No vector store / MCP** per hard requirement—context is injected via chunk metadata when needed, and Deep Research uses `web_search_preview` + `code_interpreter` only.
- **Asynchronous Deep Research** handled via background mode + polling endpoint (webhook wiring omitted but structure ready).
- **UI** intentionally desktop-only, using Tailwind for speed while keeping Mantine-ready scaffolding inside `packages/ui`.

### Citations & Quality
- Worker assigns a `citationKey` to every chunk (`DOC-<id>-<order>`).
- Bibliography view shows each `Source` plus heuristic reliability badge (green/amber/red).
- Verification button recalculates reliability from chunk density to simulate a quick QA pass.
- Final export includes bibliography implicitly by referencing `Source` metadata; future work could auto-insert inline citation tokens during report generation.

### Methodology / Audit Trail
- `ProgressEvent` is optimised for UI streaming (phase, message, progress percent).
- `MethodologyEntry` adds structured JSON snapshots (e.g., prompts, response IDs).
- Export route turns the log into CSV so engagement managers can attach it to diligence deliverables.

### Future Enhancements
- Move ingestion queue to BullMQ + Redis for durability.
- Feed internal chunks into Deep Research input (top-N summary) so citations tie back automatically.
- Replace heuristic citation verification with LLM judge comparing section claims vs. chunk text.
- Surface DuckDB-derived TAM / scoring matrix charts inside the report editor.
- Add comments + collaborative notifications per report section.

