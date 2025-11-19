# PowerShell script to apply the deep research fix

Write-Host "Applying Deep Research Fix..." -ForegroundColor Green

# Step 1: Create backup
Write-Host "Creating backup of route.ts..." -ForegroundColor Yellow
Copy-Item "app/(chat)/api/chat/route.ts" "app/(chat)/api/chat/route.ts.backup" -Force

# Step 2: Apply the minimal working fix
Write-Host "Updating chat route..." -ForegroundColor Yellow

# Read the file
$content = Get-Content "app/(chat)/api/chat/route.ts" -Raw

# Add import
if ($content -notmatch 'runAgentPipeline') {
    $content = $content -replace '(import OpenAI from .openai.;)', "`$1`nimport { runAgentPipeline } from '@/lib/ai/deep-research-pipeline';"
}

# Enable all tools
$content = $content -replace 'experimental_activeTools: experimental_deepResearch \? allTools : webSearchTools,', 'experimental_activeTools: allTools, // Always enable all tools including deepResearch'

# Update deepResearch description
$content = $content -replace "('Perform deep research on a topic using an AI agent.*?Should be used after askClarifyingQuestions.')", "'Perform deep research using the four-agent pipeline: Triage → Clarifier/Instruction → Research. This automatically handles clarifications and research planning. Use this for any comprehensive research, market analysis, or report generation.'"

# Save the file
$content | Set-Content "app/(chat)/api/chat/route.ts" -NoNewline

Write-Host "Deep research fix applied!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run: docker compose up -d --build" -ForegroundColor White
Write-Host "2. Access http://localhost:13000" -ForegroundColor White
Write-Host "3. Type a research query in the chat" -ForegroundColor White
Write-Host ""
Write-Host "The AI will now automatically use deepResearch for research queries!" -ForegroundColor Green
