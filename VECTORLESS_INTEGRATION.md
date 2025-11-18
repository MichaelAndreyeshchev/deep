# Vectorless Document Processing Integration

## 📄 Overview

The provided `vectorless-main/` folder contains a complete document processing system that can handle 30+ PDFs with intelligent chunking **without RAG**.

This guide explains how to use it alongside your main research application.

---

## 🏗️ What is Vectorless?

Vectorless is a document processing system that:
- ✅ Processes PDFs without vector databases
- ✅ Intelligent chunking (1200 chars/chunk, 10% overlap)
- ✅ Maintains context across chunks
- ✅ Tracks citations with `citationKey`
- ✅ Handles 30+ documents efficiently
- ✅ Parses AlphaSense transcripts
- ✅ SQLite storage (no external dependencies)

---

## 🚀 Setup Vectorless (Optional)

If you need to process PDF documents or transcripts, run Vectorless in parallel:

### 1. Navigate to Vectorless

```bash
cd vectorless-main
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Setup Database

```bash
# Create .env.local file
echo "DATABASE_URL=file:./.data/vectorless.db" > .env.local
echo "OPENAI_API_KEY=your-openai-api-key-here" >> .env.local
echo "FILE_STORAGE_DIR=./.data/uploads" >> .env.local

# Run migrations
pnpm db:migrate
```

### 4. Start Vectorless

```bash
# Option A: Start everything
pnpm dev

# Option B: Start separately
# Terminal 1:
pnpm dev:web

# Terminal 2:
pnpm dev:worker
```

### 5. Access Vectorless

Open: **http://localhost:3000**

---

## 🔄 Two-App Workflow

### Setup

You'll run two apps simultaneously:

| App | Purpose | Port | URL |
|-----|---------|------|-----|
| **Open Deep Research** | Web research, CDD reports | 13000 | http://localhost:13000 |
| **Vectorless** | PDF processing, document analysis | 3000 | http://localhost:3000 |

### Workflow

#### For Web-Only Research (No PDFs)

Use **Open Deep Research** (port 13000):
1. Ask research question
2. Answer clarifying questions
3. Get CDD report with web sources
4. Export as PDF/MD

#### For PDF-Based Research

Use **Vectorless** (port 3000):
1. Create research run
2. Upload PDFs (30+ documents)
3. Upload transcripts (AlphaSense format)
4. Ask clarifying questions
5. Generate research plan
6. Launch deep research
7. Edit report sections
8. Export with citations to uploaded docs

#### For Hybrid Research (Web + PDFs)

1. **Start with Vectorless**:
   - Upload documents
   - Process with worker
   - Extract key findings

2. **Switch to Open Deep Research**:
   - Use insights from PDFs as context
   - Perform web research for additional sources
   - Generate comprehensive CDD report
   - Combine PDF citations with web sources

---

## 📊 Vectorless Features

### Document Processing

**Supported Formats**:
- ✅ PDF (primary)
- ✅ TXT transcripts
- ✅ AlphaSense interview transcripts

**Processing Pipeline**:
```
PDF Upload → Queue (pending status) →
Ingest Worker → Extract pages →
Adaptive Chunking → Store chunks →
Create citation keys → Mark ready
```

**Chunking Algorithm**:
```typescript
{
  maxCharsPerChunk: 1200,
  overlapRatio: 0.1,
  minChunkChars: 250
}
```

### Citation System

Every chunk gets a unique `citationKey`:
- PDFs: `DOC-{documentId}-{chunkOrder}`
- Transcripts: `TRANS-{transcriptId}-{segmentOrder}`

Example:
```
DOC-a1b2c3-0   → First chunk of document a1b2c3
DOC-a1b2c3-1   → Second chunk
TRANS-x9y8-0   → First segment of transcript
```

### Transcript Parsing

Handles AlphaSense format:
```
Speaker Name: This is what they said...
Another Speaker: This is their response...
```

Parses into:
- Speaker identification
- Turn order
- Timestamps (estimated)
- Searchable segments

---

## 🔗 Integration Options

### Option 1: Use Separately (Current Setup)

**Pros**:
- ✅ No code changes needed
- ✅ Apps are independent
- ✅ Can run on different machines
- ✅ Easy to maintain

**Cons**:
- ⚠️ Need to switch between interfaces
- ⚠️ Manual data transfer
- ⚠️ Two separate systems

**Best For**:
- Testing PDF processing
- Working with existing PDFs
- Transcript analysis
- Document-heavy research

### Option 2: API Integration (Future)

Integrate Vectorless into main app via API:

1. **Start Vectorless as microservice**:
```bash
cd vectorless-main
pnpm dev:web  # Runs on port 3000
```

2. **Call from main app**:
```typescript
// In app/(chat)/api/chat/route.ts
const response = await fetch('http://localhost:3000/api/ingest/upload', {
  method: 'POST',
  body: formData
});
```

3. **Use document IDs** in research prompts

### Option 3: Full Merge (Advanced)

Merge Vectorless packages into main monorepo:

1. Copy packages:
```bash
cp -r vectorless-main/packages/* packages/
```

2. Update package.json workspaces
3. Install dependencies
4. Create upload endpoints in main app
5. Run ingest worker alongside main app

---

## 📁 Vectorless Architecture

### Directory Structure

```
vectorless-main/
├── apps/
│   ├── web/                    # Next.js research UI
│   │   ├── app/api/
│   │   │   ├── ingest/         # PDF upload
│   │   │   ├── transcripts/    # Transcript upload
│   │   │   └── research/       # Run management
│   │   └── lib/
│   │       └── orchestrator.ts # Clarify/Rewrite/Research
│   │
│   └── ingest-worker/          # Background processor
│       └── src/index.ts        # PDF chunking worker
│
├── packages/
│   ├── core/                   # Shared utilities
│   │   ├── chunking.ts         # Adaptive chunking algorithm
│   │   ├── pdf.ts              # PDF extraction (pdf-parse)
│   │   ├── storage.ts          # File storage (.data/uploads)
│   │   ├── transcript-parser.ts # AlphaSense parser
│   │   ├── orchestrator.ts     # Prompt builders
│   │   └── duckdb.ts           # Analytics (optional)
│   │
│   ├── db/                     # Prisma + SQLite
│   │   ├── prisma/schema.prisma
│   │   └── src/index.ts
│   │
│   └── ui/                     # Shared components
│
└── .data/                      # Storage
    ├── uploads/                # PDFs, transcripts
    ├── vectorless.db           # SQLite database
    └── duckdb/                 # Analytics DB
```

### Database Schema

Key tables:
- `ResearchRun` - Research sessions
- `Document` - Uploaded files
- `Chunk` - Document chunks with citation keys
- `Source` - Bibliography entries
- `Citation` - Inline citation tracking
- `InterviewTranscript` - Parsed transcripts
- `ProgressEvent` - Activity timeline
- `MethodologyEntry` - Audit trail

---

## 💡 Use Cases

### When to Use Main App (port 13000)

**Best for**:
- Web research
- Market analysis
- Competitive intelligence
- Quick CDD reports
- Public information research

**Example Questions**:
- "Research the SaaS CRM market"
- "Analyze competitive landscape for fintech"
- "Evaluate PE opportunity in healthcare IT"

### When to Use Vectorless (port 3000)

**Best for**:
- Processing confidential PDFs
- Analyzing 10-K filings
- Transcript analysis
- Document-heavy due diligence
- Internal company documents

**Example Workflows**:
- Upload 30 10-K filings → Extract financials
- Process interview transcripts → Find insights
- Analyze internal memos → Summarize themes

### Hybrid Approach

**Best for**:
- Comprehensive CDD combining web + internal docs
- PE deal flow research
- Investment committee materials

**Workflow**:
1. Upload PDFs to Vectorless
2. Extract key findings from documents
3. Use findings as context in main app
4. Perform web research to supplement
5. Generate combined CDD report

---

## 🔧 Vectorless API Endpoints

If you want to integrate programmatically:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/research/run` | POST | Create research run |
| `/api/ingest/upload` | POST | Upload PDF |
| `/api/transcripts/upload` | POST | Upload transcript |
| `/api/research/run/[id]/clarify` | POST | Ask clarifying questions |
| `/api/research/run/[id]/rewrite` | POST | Generate research plan |
| `/api/research/run/[id]/start` | POST | Launch deep research |
| `/api/research/run/[id]/status` | GET | Poll research status |
| `/api/research/run/[id]/sources` | GET | Get bibliography |
| `/api/research/run/[id]/export/markdown` | GET | Export as Markdown |
| `/api/research/run/[id]/export/pdf` | GET | Export as PDF |

---

## 📖 Example: Processing PDFs with Vectorless

### 1. Create Research Run

```typescript
POST http://localhost:3000/api/research/run
{
  "title": "SaaS Market Analysis",
  "brief": "Analyze the B2B SaaS accounting market for PE investment"
}

Response:
{
  "run": {
    "id": "clxxx...",
    "title": "SaaS Market Analysis",
    "status": "CLARIFYING"
  }
}
```

### 2. Upload Documents

```bash
curl -X POST http://localhost:3000/api/ingest/upload \
  -F "file=@company-10k.pdf" \
  -F "runId=clxxx..."
```

### 3. Wait for Processing

Check status:
```bash
GET http://localhost:3000/api/research/run/clxxx...
```

When `status: "ready"`, documents are processed.

### 4. Ask Clarifying Questions

```bash
POST http://localhost:3000/api/research/run/clxxx.../clarify
```

Returns clarifying questions to answer.

### 5. Launch Research

```bash
POST http://localhost:3000/api/research/run/clxxx.../start
```

Launches OpenAI Deep Research with document context.

### 6. Poll for Completion

```bash
GET http://localhost:3000/api/research/run/clxxx.../status
```

When complete, report sections are generated.

### 7. Export Report

```bash
GET http://localhost:3000/api/research/run/clxxx.../export/pdf
```

Downloads PDF with citations to uploaded documents.

---

## 🎯 Decision Guide

### Use Main App If:
- ✅ Researching public information
- ✅ Need fast CDD reports (2-5 min)
- ✅ Sources are web-based
- ✅ Don't have confidential PDFs
- ✅ Want purple-themed UI
- ✅ Need quick exports

### Use Vectorless If:
- ✅ Have 10+ PDFs to process
- ✅ Need transcript analysis
- ✅ Want citation keys to docs
- ✅ Analyzing confidential materials
- ✅ Building document database
- ✅ Need methodology audit trail

### Use Both If:
- ✅ Conducting comprehensive CDD
- ✅ Combining internal docs + web research
- ✅ Building investment committee materials
- ✅ Need maximum research depth

---

## 🔐 Data Privacy

### Main App
- Web sources only
- Citations to public URLs
- No persistent document storage
- Session-based data

### Vectorless
- Local file storage (`.data/uploads/`)
- SQLite database (`.data/vectorless.db`)
- No external services (except OpenAI)
- Full data control

---

## 📚 Learning Resources

### Vectorless Documentation

See `vectorless-main/README.md` for:
- Complete setup guide
- API endpoint documentation
- Database schema
- Workflow examples

### Code References

Key files to understand:

**Chunking**:
- `vectorless-main/packages/core/src/chunking.ts`
- Adaptive algorithm with overlap
- Token-agnostic (character-based)

**PDF Processing**:
- `vectorless-main/packages/core/src/pdf.ts`
- Uses pdf-parse library
- Extracts text per page

**Citation Tracking**:
- `vectorless-main/apps/ingest-worker/src/index.ts`
- Generates unique citation keys
- Links chunks to sources

**Transcript Parsing**:
- `vectorless-main/packages/core/src/transcript-parser.ts`
- AlphaSense format support
- Speaker turn detection

---

## ✨ Summary

**You have two powerful tools**:

1. **Open Deep Research (port 13000)** ⭐ MAIN APP
   - Web research
   - CDD reports
   - Fast turnaround
   - Purple theme
   - Clarifying questions
   - Export options

2. **Vectorless (port 3000)** 📄 OPTIONAL
   - PDF processing
   - Transcript analysis
   - Document chunking
   - Citation tracking
   - SQLite storage

**Use main app for 90% of research needs.**

**Add Vectorless only if you need PDF processing.**

---

**Status**: Both systems are ready to use  
**Main App**: ✅ Running on port 13000  
**Vectorless**: 📦 Available in `vectorless-main/` folder

---

**Need help?** See `COMPLETE_SETUP_GUIDE.md` for full instructions.

