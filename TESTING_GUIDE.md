# Testing Guide: qx-labs Deep Research Integration

This guide shows you how to test the qx-labs/agents-deep-research integration with a single `docker-compose up` command.

## Prerequisites

- Docker and Docker Compose installed
- OpenAI API key (required for the Python research service)

## Quick Start (One Command)

### 1. Set Up Environment Variables

First, copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:
```bash
OPENAI_API_KEY=your_openai_api_key_here
AUTH_SECRET=your_random_secret_here  # Generate with: openssl rand -base64 32
```

### 2. Start All Services

Run everything with one command:

```bash
docker-compose up
```

This will start:
- **deep-research-service** (Python FastAPI) on port 8001
- **app** (Next.js) on port 13000
- **postgres** on port 15432
- **redis** on port 16379
- **minio** on port 19000/19001

Wait for all services to be healthy. You'll see:
```
deep-research-service | 🚀 Deep Research Service starting up...
deep-research-service |    OpenAI API Key: ✓ Set
deep-research-service |    Search Provider: OpenAI (web_search_preview)
app | ▲ Next.js 15.x.x
app | - Local:        http://localhost:3000
```

### 3. Access the Application

Open your browser to: **http://localhost:13000**

## Testing the Integration

### Test 1: Verify Python Service is Running

Check the health endpoint:
```bash
curl http://localhost:8001/health
# Should return: {"status":"healthy"}
```

Check the service info:
```bash
curl http://localhost:8001/
# Should return service details with modes: ["iterative", "deep"]
```

### Test 2: Test Iterative Research Mode

1. Open http://localhost:13000 in your browser
2. In the chat input area, you'll see two mode selectors:
   - **Search / Deep Research** tabs
   - Click **"Deep Research"**
3. A second selector will appear:
   - **Iterative / Deep** tabs
   - Select **"Iterative"** (this is the default)
4. Enter a research query, for example:
   ```
   What are the latest trends in AI agents for 2025?
   ```
5. Press Enter or click Send

**Expected behavior:**
- You should see activity updates streaming in real-time:
  - "Starting iterative research..."
  - "Iteration 1 starting..."
  - "Observations: ..."
  - "Addressing: [knowledge gap]"
  - "Executing research tools"
  - "New findings discovered"
- Citations should appear as they're discovered
- Final report should be displayed with proper formatting
- The whole process should take 5-10 minutes

### Test 3: Test Deep Research Mode

1. In the same chat interface, ensure "Deep Research" is selected
2. Select **"Deep"** from the research mode selector
3. Enter a research query:
   ```
   Analyze the competitive landscape of AI research companies
   ```
4. Press Enter or click Send

**Expected behavior:**
- Similar to iterative mode but with more detailed progress:
  - "Creating report outline..."
  - "Starting parallel section research..."
  - "Section draft completed"
  - "Compiling final report..."
- More comprehensive report (20+ pages vs 5 pages)
- More citations
- Takes longer (10-15 minutes)

### Test 4: Verify Citations are Tracked

After a research completes:
1. Look for the citations section in the UI
2. Each citation should have:
   - Title
   - URL (clickable)
   - Source type (web)
3. Citations should be numbered and referenced in the report

### Test 5: Test Fallback Mechanism

1. Stop the Python service:
   ```bash
   docker-compose stop deep-research-service
   ```
2. Try submitting a deep research query
3. You should see: "Using fallback research pipeline..."
4. The original o3-deep-research pipeline should run instead

## Troubleshooting

### Service Won't Start

**Problem:** `deep-research-service` fails to start

**Solutions:**
1. Check if OpenAI API key is set:
   ```bash
   docker-compose logs deep-research-service | grep "OpenAI API Key"
   # Should show: ✓ Set
   ```

2. Check for Python dependency errors:
   ```bash
   docker-compose logs deep-research-service
   ```

3. Rebuild the service:
   ```bash
   docker-compose build deep-research-service
   docker-compose up deep-research-service
   ```

### Health Check Failing

**Problem:** Service starts but health check fails

**Solution:**
```bash
# Check if the service is responding
docker-compose exec deep-research-service curl http://localhost:8001/health

# Check service logs
docker-compose logs deep-research-service
```

### Next.js App Can't Connect to Python Service

**Problem:** "Failed to connect to research service" error

**Solutions:**
1. Verify Python service is healthy:
   ```bash
   docker-compose ps
   # deep-research-service should show "healthy"
   ```

2. Check the PYTHON_SERVICE_URL is correct:
   ```bash
   docker-compose exec app env | grep PYTHON_SERVICE_URL
   # Should show: http://deep-research-service:8001
   ```

3. Test connectivity from app container:
   ```bash
   docker-compose exec app curl http://deep-research-service:8001/health
   ```

### Research Takes Too Long or Times Out

**Problem:** Research doesn't complete or times out

**Solutions:**
1. Check the Python service logs for errors:
   ```bash
   docker-compose logs -f deep-research-service
   ```

2. Reduce max_iterations or max_time_minutes in the request
   - Iterative mode defaults: 3 iterations, 10 minutes
   - Deep mode defaults: 5 iterations, 15 minutes

3. Check OpenAI API rate limits and quotas

### No Intermediate Results Showing

**Problem:** Research completes but no progress updates appear

**Solutions:**
1. Check browser console for SSE connection errors
2. Verify the API proxy is working:
   ```bash
   curl -N http://localhost:13000/api/deep-research-stream \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"query":"test","mode":"iterative"}'
   ```
3. Check that dataStream events are being sent (check Next.js logs)

## Development Mode

For faster iteration during development:

### Run Python Service Locally (Without Docker)

```bash
cd services/py-deep-research

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export OPENAI_API_KEY=your_key_here

# Run the service
python main.py
```

The service will run on http://localhost:8001 with hot reload enabled.

### Run Next.js App Locally

```bash
# In the root directory
npm install
npm run dev
```

Update `.env` to point to local Python service:
```bash
PYTHON_SERVICE_URL=http://localhost:8001
```

## Monitoring and Logs

### View All Logs
```bash
docker-compose logs -f
```

### View Specific Service Logs
```bash
# Python research service
docker-compose logs -f deep-research-service

# Next.js app
docker-compose logs -f app

# Database
docker-compose logs -f postgres
```

### Check Service Health
```bash
docker-compose ps
```

All services should show "healthy" status.

## Stopping Services

### Stop All Services
```bash
docker-compose down
```

### Stop and Remove Volumes (Clean Slate)
```bash
docker-compose down -v
```

### Stop Specific Service
```bash
docker-compose stop deep-research-service
```

## Performance Tips

1. **Iterative mode** is faster (5-10 min) - use for quick research
2. **Deep mode** is thorough (10-15 min) - use for comprehensive reports
3. Reduce `max_iterations` for faster results (but less thorough)
4. Use `background_context` to provide uploaded documents for better results

## Next Steps

After successful testing:
1. Review the generated reports for quality
2. Check citation accuracy and relevance
3. Test with different types of queries (technical, market analysis, etc.)
4. Monitor OpenAI API usage and costs
5. Consider adding rate limiting for production use

## Support

If you encounter issues not covered in this guide:
1. Check the PR description: https://github.com/MichaelAndreyeshchev/deep/pull/2
2. Review the integration documentation in `DEEP_RESEARCH_INTEGRATION.md`
3. Check Python service logs for detailed error messages
4. Leave comments on the PR for assistance
