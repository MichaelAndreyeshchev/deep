# OpenAI Web Search Integration Guide

This project uses **OpenAI's native web search capability** via the Responses API to power its research features.

## Overview

Instead of using third-party search APIs, this implementation leverages OpenAI's built-in `web_search` tool, which provides:

- ✅ **Real-time web access** - Get current information from the internet
- ✅ **Automatic citations** - URLs are automatically cited with titles and locations
- ✅ **Single API key** - No need for separate search API keys
- ✅ **Native integration** - Seamlessly works with OpenAI models
- ✅ **Cost-effective** - Included with your OpenAI API usage

## How It Works

### 1. Web Search

When a user asks a question requiring current information:

```typescript
const response = await openai.responses.create({
  model: 'gpt-4o-mini',
  tools: [{ type: 'web_search_preview' }],
  input: 'Search for: latest AI news'
});
```

The model:
1. Decides if web search is needed
2. Performs the search automatically
3. Returns results with citations
4. Includes URL annotations for sources

### 2. Web Scraping

To extract content from specific URLs:

```typescript
const response = await openai.responses.create({
  model: 'gpt-4o-mini',
  tools: [{ type: 'web_search_preview' }],
  input: `Visit ${url} and extract the main content`
});
```

### 3. Data Extraction

To extract structured data from multiple URLs:

```typescript
const response = await openai.responses.create({
  model: 'gpt-4o-mini',
  tools: [{ type: 'web_search_preview' }],
  input: `Visit these URLs: ${urls.join(', ')}. ${extractionPrompt}`
});
```

### 4. Deep Research

The deep research feature combines:
- Multiple iterative web searches
- Content extraction from relevant sources
- Reasoning model analysis
- Comprehensive report synthesis

## Implementation Details

### File: `app/(chat)/api/chat/route.ts`

Three helper functions handle web operations:

#### `performWebSearch(query, maxResults)`
- Uses OpenAI Responses API with `web_search_preview` tool
- Extracts URLs from response annotations
- Returns structured search results with titles, URLs, and descriptions

#### `scrapeUrl(url)`
- Requests the model to visit and extract content from a URL
- Returns content in markdown format
- Handles errors gracefully

#### `extractFromUrls(urls, prompt)`
- Visits multiple URLs
- Extracts data based on custom prompt
- Returns structured data for each URL

## API Response Format

OpenAI's web search responses include:

```json
{
  "output": [
    {
      "type": "web_search_call",
      "id": "ws_xxx",
      "status": "completed"
    },
    {
      "type": "message",
      "content": [{
        "type": "output_text",
        "text": "Response with inline citations...",
        "annotations": [{
          "type": "url_citation",
          "start_index": 100,
          "end_index": 200,
          "url": "https://example.com",
          "title": "Page Title"
        }]
      }]
    }
  ]
}
```

## Advantages Over Third-Party APIs

### vs. Firecrawl
- ❌ Firecrawl: Requires separate API key and subscription
- ✅ OpenAI: Single API key for everything

### vs. Brave Search + Jina AI
- ❌ Brave: Limited free tier (2,000 queries/month)
- ❌ Jina: Separate service to manage
- ✅ OpenAI: Unlimited searches (pay per token)

### Cost Comparison

**OpenAI Web Search:**
- Charged per token usage (input + output)
- Model: `gpt-4o-mini` is cost-effective for search
- No separate search API costs

**Example Costs (approximate):**
- Simple search: ~$0.001 - $0.005 per query
- Complex extraction: ~$0.01 - $0.05 per page
- Deep research: ~$0.50 - $2.00 per comprehensive report

## Configuration Options

### Model Selection

You can use different models for different search complexity:

```typescript
// Fast, cheap searches
model: 'gpt-4o-mini'

// Better understanding
model: 'gpt-4o'

// Deep analysis with reasoning
model: 'o1-mini' or 'gpt-4.1'
```

### Domain Filtering (Optional)

Limit searches to specific domains:

```typescript
tools: [{
  type: 'web_search_preview',
  filters: {
    allowed_domains: [
      'wikipedia.org',
      'nature.com',
      'arxiv.org'
    ]
  }
}]
```

### User Location (Optional)

Provide geographic context for better results:

```typescript
tools: [{
  type: 'web_search_preview',
  user_location: {
    type: 'approximate',
    country: 'US',
    city: 'San Francisco',
    region: 'California'
  }
}]
```

## Rate Limits

Web search follows the same rate limits as your OpenAI API tier:
- **Free tier**: 3 requests/minute, 200 requests/day
- **Tier 1**: 500 requests/minute
- **Tier 2**: 5,000 requests/minute
- **Tier 3+**: Higher limits

Check your limits at: [platform.openai.com/account/limits](https://platform.openai.com/account/limits)

## Best Practices

### 1. Use Appropriate Models
- Use `gpt-4o-mini` for simple searches (faster, cheaper)
- Use `gpt-4o` or reasoning models for complex analysis

### 2. Cache Results
- Store search results when possible
- Avoid redundant searches for the same queries

### 3. Error Handling
- Always handle potential API errors
- Implement retry logic for transient failures
- Provide fallback content when searches fail

### 4. Citation Display
- Always show sources to users
- Make citations clickable
- Include timestamps when relevant

## Troubleshooting

### "Model not found" Error
**Solution**: Ensure you're using a model that supports web search:
- ✅ `gpt-4o`, `gpt-4o-mini`
- ✅ `o1-mini`, `o1-preview`
- ❌ `gpt-3.5-turbo` (not supported)

### "Rate limit exceeded"
**Solution**: 
- Check your API tier limits
- Implement exponential backoff
- Consider upgrading your API tier

### "Web search not available"
**Solution**:
- Verify `OPENAI_API_KEY` is set correctly
- Ensure your account has access to Responses API
- Check if web search is enabled for your organization

### No Results Returned
**Solution**:
- Query might be too specific
- Try broader search terms
- Check response annotations for empty results

## Testing Web Search

### Quick Test

```bash
curl "https://api.openai.com/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "tools": [{"type": "web_search_preview"}],
    "input": "What are the latest developments in AI?"
  }'
```

### In the App

1. Start the app: `pnpm dev`
2. Ask: "Search for the latest news about SpaceX"
3. Check the response includes citations
4. Verify sources are displayed with URLs

## Additional Resources

- [OpenAI Web Search Docs](https://platform.openai.com/docs/guides/web-search)
- [Responses API Reference](https://platform.openai.com/docs/api-reference/responses)
- [OpenAI Pricing](https://openai.com/pricing)

## Support

For issues specific to OpenAI web search:
- Check [OpenAI Status](https://status.openai.com/)
- Review [API Documentation](https://platform.openai.com/docs)
- Contact [OpenAI Support](https://help.openai.com/)

---

**Powered by OpenAI's Native Web Search** 🔍

