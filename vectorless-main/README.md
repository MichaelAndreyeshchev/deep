# Deep Research Workspace

Production-ready reference implementation of an internal “Deep Research Command Center”.  It ingests PDFs and transcripts, orchestrates OpenAI’s Deep Research models end-to-end, keeps citations + methodology trails, and exports diligence-ready reports (Markdown/PDF).

## Highlights

- **Monorepo** with `apps/web` (Next.js 15 App Router UI) and `apps/ingest-worker` (Node ingestion worker) plus shared packages (`@vectorless/core`, `@vectorless/db`, `@vectorless/ui`).
- **SQLite + Prisma** persistence for runs, documents, chunks, citations, transcripts, progress events, report sections, comments, and audit logs.
- **Vectorless ingestion**: adaptive chunking for PDFs and AlphaSense transcripts, stored with page + section metadata for downstream citations.
- **Clarify → Rewrite → Deep Research** pipeline that wraps OpenAI Responses API (`gpt-4.1-mini`, `gpt-4.1`, `o3-deep-research`) and records every step in `ProgressEvent` + `MethodologyEntry` tables.
- **Research cockpit UI**: run list, clarifying chat, progress timeline, source reliability badges, report editor, export (Markdown/PDF), and transcript/document upload drawers.
- **Citations & quality**: source registry with verification heuristics, bibliography view, and download buttons for methodology CSV + report bundles.
- **Sample assets** under `samples/` showing the exported Markdown/PDF pair used for validation.

## Getting Started

### Prerequisites

- Node.js 20+ and pnpm 9
- Python (optional, only if you keep the legacy FastAPI backend)
- OpenAI API key with Deep Research access (`o3-deep-research` or `o4-mini-deep-research`)
- Redis (optional) if you swap the in-memory ingestion queue for BullMQ

### Install

```bash
pnpm install
```

Copy the env template (create it manually if the file is blocked in your shell):

```bash
cp env.example .env.local  # populate OPENAI_API_KEY, DATABASE_URL, FILE_STORAGE_DIR
```

### Run everything

```bash
# launches Next.js + ingestion worker concurrently
pnpm dev
```

Or run each target separately:

```bash
pnpm dev:web         # Next.js interface on http://localhost:3000
pnpm dev:worker      # ingestion worker (PDF + transcript processing)
```

### Database

```bash
pnpm db:migrate      # run Prisma migrations
pnpm db:studio       # open Prisma Studio
```

SQLite lives under `.data/vectorless.db` by default—configure `DATABASE_URL` to move it elsewhere.

### Docker

Build the container from within `vectorless-main`:

```bash
cd vectorless-main
docker build -t deep-research .
```

Run it (port 3000) with the required env vars:

```bash
docker run --rm \
  -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  -e DATABASE_URL="file:./.data/vectorless.db" \
  -e FILE_STORAGE_DIR="./.data/uploads" \
  deep-research
```

The entrypoint runs migrations and starts the Next.js server. To run the ingestion worker inside Docker, override the command:

```bash
docker run --rm deep-research pnpm dev:worker
```

### Directory map

```
vectorless-main/
├─ apps/
│  ├─ web/                Next.js Deep Research cockpit
│  └─ ingest-worker/      Node worker for PDFs/transcripts
├─ packages/
│  ├─ core/               Shared utilities (chunking, storage, orchestrator prompts, DuckDB helper)
│  ├─ db/                 Prisma schema + generated client
│  └─ ui/                 Shared Mantine/Tiptap primitives (placeholder badge atm)
├─ backend/               Legacy FastAPI server (optional)
├─ .data/                 Uploaded binaries + SQLite/ DuckDB files
├─ samples/               Example Markdown/PDF export + sources
└─ README.md
```

## Workflow

1. **Create a run** – supply title + diligence brief.  We store it in `ResearchRun.prompt.brief`, create a `ConversationTurn`, `ProgressEvent`, and `MethodologyEntry`.
2. **Ingest sources** – upload PDFs (go through worker queue) and transcripts (processed immediately).  Each file becomes `Document` + `Source` + `Chunk` rows with `citationKey`s.
3. **Clarify & rewrite** – trigger clarifying questions (`gpt-4.1-mini`), then rewrite the research instructions (`gpt-4.1`).  All steps logged + surfaced in the UI.
4. **Deep Research** – launches `o3-deep-research` in background mode with `web_search_preview` + `code_interpreter`.  Status polling updates progress and, when complete, materialises a default `EXECUTIVE_SUMMARY` section.
5. **Report editing** – update Markdown blocks per section, add sections from the dropdown, and hit **Save** (API writes `ReportSection` records).  Export Markdown or PDF via built-in endpoints.
6. **Citations & methodology** – open the Sources panel to view reliability badges, run verification heuristics, and download the methodology log (CSV) from the Progress panel.

## Key API routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/research/run` | GET / POST | List runs / create new run |
| `/api/research/run/[id]` | GET | Fetch run with documents, conversation, sections |
| `/api/research/run/[id]/clarify` | POST | Ask clarifying questions |
| `/api/research/run/[id]/rewrite` | POST | Produce rewritten instructions |
| `/api/research/run/[id]/start` | POST | Launch Deep Research request |
| `/api/research/run/[id]/status` | GET | Poll Responses API + auto-finalise sections |
| `/api/ingest/upload` | POST | Upload PDF -> queue ingestion |
| `/api/transcripts/upload` | POST | Upload transcript (PDF/TXT) -> immediate chunking |
| `/api/research/run/[id]/sections` | PUT | Persist edited sections |
| `/api/research/run/[id]/export/[markdown\|pdf]` | GET | Download Markdown/PDF |
| `/api/research/run/[id]/sources` | GET | Bibliography data (source + reliability) |
| `/api/research/run/[id]/sources/verify` | POST | Heuristic verification for sources |
| `/api/research/run/[id]/methodology/export` | GET | Download methodology log (CSV) |

## Sample output

See `samples/foundation-repair-report.md` + `.pdf` for a captured export along with `samples/sources.json` describing the citations used in that run.

## Tests & linting

```bash
pnpm --filter web lint     # Next.js eslint (note: existing upstream warnings around quotes remain)
pnpm --filter @vectorless/core build
pnpm --filter @vectorless/db build
pnpm --filter ingest-worker build
```

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `OPENAI_API_KEY` missing | Fill `.env.local` with a key that has Deep Research access |
| Multiple `pnpm-lock` warnings | Repo sits inside a larger workspace. The inner lockfile (`vectorless-main/pnpm-lock.yaml`) is the canonical one. |
| Worker not processing uploads | Ensure `pnpm dev:worker` (or `pnpm dev`) is running before you upload PDFs. |
| PDF export text is truncated | Long reports need multiple pages; the current helper wraps at ~90 chars/line. Adjust `wrapText` in `export/[format]/route.ts` if needed. |

## License

MIT – see `LICENSE`.
