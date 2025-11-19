# Testing the Four-Agent Deep Research Pipeline

## ✅ Setup Complete

The application is now running with the four-agent deep research pipeline fully integrated. Here's how to test it:

## 🚀 How to Access

1. Open your browser and go to: **http://localhost:13000**
2. Log in or use the application in anonymous mode

## 🧪 Testing the Pipeline

### Basic Test Query

Type this in the **regular chat** (NOT the Deep Research tab):

```
I want to develop a research report on the foundation repair and waterproofing services market in the US. The report should cover market map and profit pools, demand drivers and headwinds, geographic drivers, customer segments, business model, and target list.
```

### What You Should See

1. **The AI will automatically invoke the deepResearch tool**
   - You should see a message like "I'll help you develop a comprehensive research report..."

2. **Four-Agent Pipeline in Action**:
   - 🤖 **Triage Agent** - Analyzes your query
   - 💭 **Clarifying Agent** - May ask questions like:
     - What specific geographic regions are you most interested in?
     - What time frame should the analysis cover?
     - Are you looking for residential, commercial, or both segments?
   - 📝 **Instruction Agent** - Builds research instructions
   - 🔍 **Research Agent** - Executes with o3-deep-research

3. **Progress Indicators**:
   - Purple progress bar showing completion
   - Real-time activity updates: "Searching for market data..."
   - Source discovery notifications

4. **Final Report Features**:
   - Inline citations [1], [2], etc.
   - Comprehensive sections covering all requested topics
   - Citations with metadata:
     ```json
     {
       "title": "Foundation Repair Market Report 2024",
       "url": "https://example.com/report",
       "start_index": 245,
       "end_index": 312
     }
     ```

## 🔍 Troubleshooting

### If the AI uses regular search instead of deepResearch:

1. **Clear your browser cache** and refresh (Ctrl+F5)
2. **Check the Docker logs**:
   ```powershell
   docker logs deep-app-1 -f
   ```
3. **Ensure you're in the regular chat**, not the Deep Research tab

### If you don't see the four agents:

1. Check for "Using model: o3-deep-research" in the logs
2. Look for "runAgentPipeline" being called
3. Watch for agent events like:
   - "Triage Agent analyzing query"
   - "Clarifying Agent generating questions"
   - "Research Agent executing search"

## 📊 Monitoring Agent Activity

In the Docker logs, you should see:

```
Agent Event: {
  agentName: "Triage Agent",
  type: "handoff",
  content: { decision: "needs_clarification" }
}

Agent Event: {
  agentName: "Clarifying Agent", 
  type: "clarifications",
  content: { questions: [...] }
}

Agent Event: {
  agentName: "Research Agent",
  type: "tool_call",
  content: { tool: "WebSearchTool", query: "..." }
}
```

## 🎯 Quick Test Queries

Try these to see different pipeline behaviors:

1. **Simple query** (may skip clarifications):
   ```
   What is the current market size of foundation repair services in the US?
   ```

2. **Complex query** (triggers clarifications):
   ```
   Create a comprehensive competitive analysis of foundation repair companies including market share, service offerings, pricing strategies, and geographic coverage.
   ```

3. **Technical query** (uses deep research):
   ```
   Analyze the latest waterproofing technologies and their cost-effectiveness for residential vs commercial applications.
   ```

## ✨ Success Indicators

You'll know it's working when:
- ✅ The AI says it's using deepResearch 
- ✅ You see purple progress indicators
- ✅ Agent activities appear in the UI
- ✅ The final report has numbered citations [1], [2], etc.
- ✅ Citations are clickable and show source metadata

## 🐛 Debug Mode

To see detailed agent interactions, check the browser console (F12) for:
- `activity-delta` events
- `source-delta` events  
- `research-report` events
- `clarification-needed` events

---

The system is now ready! Just type your research query in the chat and watch the four-agent pipeline create a comprehensive, citation-rich report. 🚀
