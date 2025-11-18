# Research Features Implementation

This document describes the enhanced research capabilities that have been implemented in the Open Deep Research application.

## Overview

The deep research feature now includes:
1. **Domain Blocklist** - Filters out low-quality sources
2. **Citation Tracking System** - Every claim is linked to its source
3. **Structured Report Generation** - Professional research reports
4. **PDF & Markdown Export** - Multiple output formats

---

## 1. Domain Blocklist

### Purpose
Filters out domains known for producing low-quality or unreliable content, focusing research on credible sources.

### Blocked Domains
The following domains are automatically excluded from research:
- Market research spam sites (fortunebusinessinsights.com, grandviewresearch.com, etc.)
- Low-quality aggregators (globenewswire.com, github.com, etc.)
- Consulting spam (myconsultingcoach.com)

### Implementation
- **File**: `app/(chat)/api/chat/route.ts`
- **Lines**: 47-80
- Applied in:
  - `performWebSearch()` - Filters search results
  - `scrapeUrl()` - Rejects blocked URLs
  - `extractFromUrls()` - Filters URL list before processing

### How It Works
```typescript
// Example: Search results are automatically filtered
const filteredResults = searchResults.filter(result => !isBlockedDomain(result.url));
```

---

## 2. Citation Tracking System

### Features
- **Inline Citations**: Every factual claim includes [N] citation markers
- **Source Mapping**: Each citation number maps to a specific source
- **Clickable Citations**: In the UI, citations are clickable links to sources
- **Bibliography**: Complete reference list with URLs

### Implementation
**File**: `app/(chat)/api/chat/route.ts` (lines 773-897)

The system:
1. Creates a citation map from all research findings
2. Assigns unique citation numbers to each source
3. Instructs the AI to add [N] after every factual claim
4. Generates a references section with full URLs

### Example Output
```markdown
The market is expected to grow by 25% annually [1]. This growth is driven 
by increasing demand [2][3] and technological advancement [1].

## References
[1] TechCrunch - https://techcrunch.com/article
[2] Reuters - https://reuters.com/article
[3] Nature - https://nature.com/article
```

---

## 3. Structured Report Generation

### Report Structure
Every research report includes:

#### **Executive Summary**
- 2-3 paragraphs
- High-level overview
- Key findings and conclusions
- Fully cited [N]

#### **Detailed Findings**
- Multiple subsections by topic area
- Comprehensive discussion
- Specific details with citations [N]
- Evidence-based analysis

#### **Key Insights**
- Bullet points or paragraphs
- Most important discoveries
- All insights cited [N]

#### **Conclusions**
- Synthesis of findings
- Implications
- Recommendations
- Citations throughout [N]

#### **Limitations and Uncertainties**
- Knowledge gaps
- Conflicting information
- Areas for further research

#### **References**
- Complete bibliography
- Format: [N] Title - URL
- All sources used in research

### AI Prompt Engineering
The system uses a comprehensive prompt that:
- Requires citations after EVERY factual claim
- Provides citation numbers mapped to sources
- Specifies exact report structure
- Emphasizes comprehensive, detailed output

---

## 4. Export Functionality

### Supported Formats

#### **Markdown Export**
- ✅ Preserves all formatting
- ✅ Keeps inline citations
- ✅ Download as `.md` file
- **Use Case**: Import into documentation systems, GitHub, Notion, etc.

#### **PDF Export**
- ✅ Professional formatting
- ✅ Preserves citations
- ✅ Includes metadata (date, sources, duration)
- ✅ Complete references section
- **Use Case**: Presentations, sharing, archival

#### **Copy to Clipboard**
- ✅ Quick markdown copy
- ✅ Paste anywhere
- **Use Case**: Quick sharing, editing

### Implementation
**File**: `components/research-report.tsx` (lines 46-130)

### PDF Generation
Uses `jspdf` library with:
- Automatic text wrapping
- Page breaks
- Metadata header
- References section
- Professional formatting

---

## 5. Research Report UI Component

### Features

#### **Interactive Display**
- Tabbed interface (Report / References)
- Syntax-highlighted markdown
- Clickable citations link to sources
- Responsive design

#### **Citation Links**
Inline citations [N] are:
- Clickable
- Highlight on hover
- Show full URL on title tooltip
- Open in new tab

#### **References Panel**
- Numbered citations
- Source titles
- Full URLs
- External link indicators

#### **Export Actions**
Header buttons for:
- Copy Markdown
- Download Markdown
- Download PDF

### Implementation
**File**: `components/research-report.tsx`

### Usage
The component automatically displays when deep research completes:

```typescript
{researchReport && (
  <ResearchReport
    report={researchReport.report}
    citations={researchReport.citations}
    metadata={researchReport.metadata}
  />
)}
```

---

## Usage Guide

### Running Deep Research

1. **Enable Deep Research Mode**
   - Toggle the deep research option in the UI
   - Or use experimental_deepResearch parameter

2. **Ask a Research Question**
   ```
   "Research the current state of quantum computing and its commercial applications"
   ```

3. **Monitor Progress**
   - Watch the activity panel for search/extract/analyze steps
   - View sources as they're discovered
   - See progress through research depth levels

4. **Review Report**
   - Full structured report displays automatically
   - All claims are cited with [N]
   - Click citations to view sources
   - Switch to References tab to see all sources

5. **Export Results**
   - **Copy**: Quick clipboard copy
   - **Markdown**: Download for documentation
   - **PDF**: Download for sharing/presentation

---

## Technical Details

### Data Flow

1. **Research Execution**
   ```
   User Query → Deep Research Tool → Multiple Search/Extract Cycles → 
   Reasoning Analysis → Final Synthesis with Citations
   ```

2. **Citation Tracking**
   ```
   Finding Collection → Citation Map Creation → AI Report Generation → 
   Structured Output with [N] → UI Rendering with Links
   ```

3. **Report Generation**
   ```
   Raw Findings + Citations Map → Structured Prompt → AI Synthesis → 
   Markdown Report → Data Stream → React Component
   ```

### Key Files

| File | Purpose |
|------|---------|
| `app/(chat)/api/chat/route.ts` | Core research logic, blocklist, citations |
| `components/research-report.tsx` | Report display and export |
| `components/message.tsx` | Integration into chat |
| `lib/deep-research-context.tsx` | State management |

### Dependencies Added

```json
{
  "openai": "^4.73.1",     // OpenAI API with web search
  "jspdf": "^2.5.2"        // PDF generation
}
```

---

## Benefits

### For Users
✅ **Reliable Sources** - Blocked low-quality domains  
✅ **Full Transparency** - Every claim is cited  
✅ **Professional Output** - Structured reports  
✅ **Multiple Formats** - Export as MD or PDF  
✅ **Easy Verification** - Click citations to check sources  

### For Research Quality
✅ **Source Verification** - All claims traceable  
✅ **Academic Standards** - Inline citations + bibliography  
✅ **Comprehensive Coverage** - Structured approach ensures completeness  
✅ **Reproducibility** - Full source list enables verification  

---

## Example Research Report

```markdown
# Research Report: Quantum Computing Commercial Applications

## Executive Summary

Quantum computing has emerged as a transformative technology with significant 
commercial potential [1]. Major companies including IBM, Google, and Microsoft 
have invested heavily in quantum computing infrastructure [2][3]. Current 
applications focus on optimization problems, drug discovery, and cryptography [1][4].

## Detailed Findings

### Market Growth
The quantum computing market is projected to reach $65 billion by 2030 [5]. 
This growth is driven by increasing investment from both private and public 
sectors [6][7]...

### Commercial Applications

#### Drug Discovery
Pharmaceutical companies are using quantum computers to simulate molecular 
interactions [8]. This has reduced drug discovery timelines by up to 40% [9]...

## Key Insights
- Quantum advantage has been demonstrated in specific use cases [10]
- Error correction remains a significant challenge [11][12]
- Hybrid classical-quantum approaches show the most promise [13]

## Conclusions
Quantum computing is transitioning from research to commercial viability [14]...

## References
[1] Nature - https://nature.com/articles/quantum-commercial
[2] TechCrunch - https://techcrunch.com/quantum-ibm
[3] MIT Technology Review - https://technologyreview.com/quantum-google
...
```

---

## Future Enhancements

Potential improvements:
- [ ] Support for more export formats (DOCX, HTML)
- [ ] Citation style options (APA, MLA, Chicago)
- [ ] Advanced filtering (by source type, date, credibility)
- [ ] Save/share research reports
- [ ] Compare multiple research reports

---

## Troubleshooting

### Citations Not Appearing
**Issue**: Report lacks [N] citations  
**Solution**: Ensure reasoning model has enough tokens (maxTokens: 16000)

### Blocked Domain Message
**Issue**: "Domain is blocked" error  
**Solution**: Expected behavior - find alternative sources

### PDF Generation Fails
**Issue**: PDF export shows error  
**Solution**: Use Markdown export as fallback; check browser console

### Missing Sources
**Issue**: References tab is empty  
**Solution**: Ensure research completed fully; check for errors in logs

---

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify OPENAI_API_KEY is set correctly
3. Ensure reasoning model is configured
4. Review Docker logs: `docker-compose logs app`

---

**Implementation Date**: November 17, 2024  
**Version**: 1.0.0  
**Status**: ✅ Complete and Production Ready

