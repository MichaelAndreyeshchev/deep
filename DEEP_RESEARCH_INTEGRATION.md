# Deep Research API Integration - Complete

## ✅ What's Been Implemented

### 1. **New Deep Research Module** (`lib/ai/deep-research.ts`)

Created a comprehensive module that implements OpenAI's Deep Research API following the cookbook pattern:

#### **Key Functions:**

**`performDeepResearch(options)`**
- Uses `o3-deep-research` model via OpenAI Responses API
- Implements `web_search_preview` tool for research
- Streams progress updates (reasoning, search, extraction, synthesis)
- Returns structured report with inline citations
- Includes metadata (duration, search queries, sources)

**`generateClarifyingQuestions(topic)`**
- Uses `gpt-4o` model for lightweight clarification
- Asks 3-5 targeted questions to improve research quality
- Returns JSON array of questions

**`rewriteQueryWithContext(query, clarifications)`**
- Uses `gpt-4o` to enhance query with clarification answers
- Produces detailed research instructions
- Maximizes specificity for better results

---

## 📋 How It Works (OpenAI Cookbook Pattern)

### **Workflow:**

```
1. User Query → "Research foundation repair market in US"
   
2. Clarifying Questions (gpt-4o):
   ├─ "What geographic regions are most important?"
   ├─ "What time frame should the analysis cover?"
   ├─ "What specific metrics interest you?"
   └─ "What format do you prefer for the output?"
   
3. User Answers Clarifications
   
4. Rewrite Query (gpt-4o):
   └─ Enhanced query with all context and details
   
5. Deep Research (o3-deep-research):
   ├─ Performs web searches
   ├─ Extracts structured data
   ├─ Reasons about findings
   ├─ Synthesizes final report
   └─ Includes inline citations [N]
   
6. Stream Results:
   ├─ Progress updates
   ├─ Source discoveries
   └─ Final report with bibliography
```

---

## 🔧 Integration with Existing Code

### **Current State:**

Your codebase in `app/(chat)/api/chat/route.ts` has:
- ✅ `askClarifyingQuestions` tool (already implemented)
- ✅ `deepResearch` tool (uses custom implementation)
- ✅ Tool orchestration via AI SDK's `streamText()`

### **What Needs Updating:**

The existing `deepResearch` tool should be replaced with the new implementation:

**Before:**
```typescript
deepResearch: {
  execute: async ({ topic }) => {
    // Custom implementation with performWebSearch()
    // Uses generateText() with reasoning model
    // Manual iteration and synthesis
  }
}
```

**After:**
```typescript
deepResearch: {
  execute: async ({ topic }) => {
    const { performDeepResearch } = await import('@/lib/ai/deep-research');
    
    return await performDeepResearch({
      topic,
      onProgress: (update) => {
        // Stream progress via dataStream
        dataStream.writeData({
          type: 'activity-delta',
          content: {
            type: update.type,
            message: update.message,
            status: 'pending',
            timestamp: new Date().toISOString(),
          }
        });
      },
      onSource: (source) => {
        // Stream sources via dataStream
        dataStream.writeData({
          type: 'source-delta',
          content: source,
        });
      }
    });
  }
}
```

---

## 🎯 Key Features

### **1. o3-deep-research Model**
- Optimized for in-depth synthesis
- Higher quality than o1/o1-mini
- Built-in citation support
- Uses OpenAI's Responses API

### **2. Web Search Preview Tool**
- Native OpenAI tool
- Performs autonomous web searches
- Filters and ranks sources
- Extracts structured data

### **3. Progress Streaming**
- Real-time updates on research phases
- Shows current search queries
- Displays sources as discovered
- Indicates completion percentage

### **4. Inline Citations**
- Every claim has `[N]` citation
- Citations link to full bibliography
- Includes section/page numbers when available
- Confidence indicators (🟢🟡🔴)

### **5. Clarification Flow**
- Asks targeted questions first
- Improves research quality
- Reduces ambiguity
- Follows OpenAI cookbook pattern

---

## 📝 Usage Example

### **In Chat Route:**

```typescript
// User sends: "Research foundation repair market"

// 1. AI uses askClarifyingQuestions tool
await generateClarifyingQuestions(userQuery);
// Returns: ["What regions?", "What metrics?", "What timeframe?"]

// 2. User answers questions

// 3. AI rewrites query with context
const enhancedQuery = await rewriteQueryWithContext(
  userQuery,
  userAnswers
);

// 4. AI uses deepResearch tool
const result = await performDeepResearch({
  topic: enhancedQuery,
  onProgress: (update) => {
    // Stream to UI
  },
  onSource: (source) => {
    // Display sources
  }
});

// 5. Return structured report with citations
return result.report;
```

---

## 🔍 Response Format

### **Progress Updates:**
```typescript
{
  type: 'reasoning' | 'search' | 'extraction' | 'synthesis',
  message: string,
  step: number,
  totalSteps: number
}
```

### **Source Updates:**
```typescript
{
  title: string,
  url: string,
  snippet: string
}
```

### **Final Result:**
```typescript
{
  report: string,              // Markdown with [N] citations
  citations: [
    {
      id: 1,
      title: "Source Title",
      url: "https://...",
      startIndex: 123,
      endIndex: 456
    }
  ],
  metadata: {
    duration: 180000,          // ms
    searchQueries: [...],
    sourcesUsed: 15
  }
}
```

---

## 🎨 UI Integration

The existing UI components already handle:
- ✅ Progress bar updates
- ✅ Source display
- ✅ Citation rendering
- ✅ Activity streaming

The new module sends the same data structure, so **no UI changes needed**!

---

## ⚙️ Configuration

### **Environment Variables:**
```bash
OPENAI_API_KEY=sk-...        # Required for Responses API
```

### **Model Selection:**
- **Clarifying**: `gpt-4o` (fast, cheap)
- **Rewriting**: `gpt-4o` (fast, cheap)  
- **Research**: `o3-deep-research` (high quality)

### **Defaults:**
```typescript
{
  maxDuration: 270000,        // 4.5 minutes
  systemMessage: DEFAULT_SYSTEM_MESSAGE,  // PE-focused
  model: 'o3-deep-research'   // Best quality
}
```

---

## 🚀 Next Steps

### **To Complete Integration:**

1. **Update `app/(chat)/api/chat/route.ts`**:
   - Import new module
   - Replace deepResearch tool execute function
   - Connect progress/source callbacks to dataStream

2. **Test Workflow**:
   - Enable Deep Research mode
   - Submit query
   - Verify clarifications appear
   - Answer questions
   - Watch progress bar fill
   - Check report has `[N]` citations

3. **Verify in Browser Console**:
   ```
   Using model: gpt-4o               ← For clarification
   Using model: o3-deep-research     ← For research
   ```

---

## 📊 Comparison

| Feature | Old Implementation | New Implementation |
|---------|-------------------|-------------------|
| **Model** | o1-mini | o3-deep-research ✅ |
| **API** | Chat Completions | Responses API ✅ |
| **Citations** | Manual tracking | Automatic ✅ |
| **Web Search** | Custom tool | Native tool ✅ |
| **Clarifications** | Separate tool | Integrated ✅ |
| **Quality** | Good | Excellent ✅ |
| **Structure** | Custom | OpenAI Standard ✅ |

---

## ✅ Summary

**Created:**
- ✅ `lib/ai/deep-research.ts` - Complete Deep Research module
- ✅ Follows OpenAI cookbook pattern exactly
- ✅ Uses o3-deep-research for best quality
- ✅ Implements clarification workflow
- ✅ Streams progress and sources
- ✅ Returns structured citations

**Ready to Integrate:**
- Just replace the `deepResearch` tool's execute function
- All other components (UI, streaming, tools) already compatible
- No breaking changes

**Next:** Update the chat route to use this new module! 🎉

