# Deep Research Fix Instructions

## ❌ Current Errors

1. **"This model is only supported in v1/responses and not in v1/chat/completions"**
   - The `deepResearch` tool in `app/(chat)/api/chat/route.ts` is using the Chat Completions API
   - `o3-deep-research` ONLY works with the Responses API

2. **"Invalid URL" error with `/url?q=...`**
   - Relative URLs from search results need validation before processing

---

## ✅ QUICK FIX (10 Minutes)

### Option 1: Use a Different Reasoning Model (FASTEST)

Change the reasoning model in `lib/ai/models.ts`:

```typescript
// Change from:
export const DEFAULT_REASONING_MODEL_NAME: string = 'o3-deep-research';

// To:
export const DEFAULT_REASONING_MODEL_NAME: string = 'o1';
```

This will use `o1` instead, which works with the Chat Completions API and the existing code.

**Then rebuild:**
```bash
docker compose down
docker compose up -d --build
```

---

### Option 2: Manual Code Replacement (COMPLETE FIX)

1. **Open `app/(chat)/api/chat/route.ts`**

2. **Find the `deepResearch` tool** (starts around line 686)

3. **Delete everything from line 686 to line 1267** (the entire `deepResearch: { ... },` block)

4. **Replace with the code from `DEEP_RESEARCH_TOOL_REPLACEMENT.ts`**
   - Copy the entire contents of that file
   - Paste it where you deleted the old code
   - Make sure indentation matches (12 spaces)

5. **Rebuild:**
```bash
docker compose down
docker compose up -d --build
```

---

## 🔧 Fix Invalid URL Error

Add URL validation to the `search` tool in `app/(chat)/api/chat/route.ts`:

Find the `search` tool (around line 541) and update:

```typescript
search: {
  description: 'Search for information on a topic using web search',
  parameters: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }) => {
    try {
      addSearchQuery(query);
      const result = await performWebSearch(query);
      
      // ✅ ADD THIS: Validate and filter URLs
      if (result.success && Array.isArray(result.data)) {
        result.data = result.data.filter((item: any) => {
          try {
            // Check if URL is absolute and valid
            const url = new URL(item.url);
            return url.protocol === 'http:' || url.protocol === 'https:';
          } catch {
            console.warn(`Skipping invalid URL: ${item.url}`);
            return false; // Skip invalid URLs
          }
        });
      }
      
      return result;
    } catch (error: any) {
      console.error('Search error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
},
```

---

## 🎯 Recommended Approach

**For immediate functionality:**
- Use **Option 1** (Change to `o1` model)
- This works with your existing code
- Takes 2 minutes

**For full o3-deep-research support:**
- Use **Option 2** (Manual replacement)
- Gives you the Responses API implementation
- Takes 10 minutes
- Follows OpenAI cookbook exactly

---

## 📊 Model Comparison

| Model | API | Quality | Speed | Cost |
|-------|-----|---------|-------|------|
| **o1** | Chat Completions | Very Good | Fast | Lower |
| **o3-deep-research** | Responses | Excellent | Slower | Higher |

Both models will give you high-quality research reports with citations!

---

##  Alternative: Disable Deep Research Temporarily

If you want to test other features first:

1. **Remove `deepResearch` from `allTools` array**
2. **Only use `askClarifyingQuestions` and standard chat**
3. **Re-enable later when you've done the replacement**

---

## ✅ After Applying Fix

1. **Hard refresh browser:** `Ctrl + Shift + R`
2. **Check console:** Should NOT see "This model is only supported..." error
3. **Enable Deep Research mode**
4. **Submit a query**
5. **Watch for:**
   - Progress bar filling
   - Sources appearing
   - No URL errors
   - Final report with citations

---

## 🆘 If Still Having Issues

The core problem is: The current `deepResearch` implementation uses `generateText()` which calls `/v1/chat/completions`, but `o3-deep-research` requires `/v1/responses`.

**The new module (`lib/ai/deep-research.ts`) correctly uses the Responses API**, but it's not yet integrated.

Choose Option 1 (use `o1`) for now, and you can do Option 2 later when you have time!

---

Generated: 2025-01-19
Files: 
- `DEEP_RESEARCH_TOOL_REPLACEMENT.ts` (contains replacement code)
- `lib/ai/deep-research.ts` (new Responses API module)
- This file (instructions)

