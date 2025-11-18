# Open Deep Research

An Open-Source clone of Open AI's Deep Research experiment. This implementation uses OpenAI's native web search capabilities combined with reasoning models to perform comprehensive web research.

Check out the demo [here](https://x.com/nickscamara_/status/1886459999905521912)

![Open Deep Research Hero](public/open-hero.png)

## Features

- **OpenAI Native Web Search**
  - Uses OpenAI's built-in web search tool via Responses API
  - Real-time access to current web information
  - Automatic citation and source tracking
  - Extract structured data from multiple websites
  - No additional API keys required beyond OpenAI
- [Next.js](https://nextjs.org) App Router
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance
- [AI SDK](https://sdk.vercel.ai/docs)
  - Unified API for generating text, structured objects, and tool calls with LLMs
  - Hooks for building dynamic chat and generative user interfaces
  - Supports OpenAI (default), Anthropic, Cohere, and other model providers
- [shadcn/ui](https://ui.shadcn.com)
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility
- Data Persistence
  - [Vercel Postgres powered by Neon](https://vercel.com/storage/postgres) for saving chat history and user data
  - [Vercel Blob](https://vercel.com/storage/blob) for efficient file storage
- [NextAuth.js](https://github.com/nextauthjs/next-auth)
  - Simple and secure authentication

## Model Providers

This template ships with OpenAI `gpt-4o` as the default. However, with the [AI SDK](https://sdk.vercel.ai/docs), you can switch LLM providers to [OpenAI](https://openai.com), [Anthropic](https://anthropic.com), [Cohere](https://cohere.com/), and [many more](https://sdk.vercel.ai/providers/ai-sdk-providers) with just a few lines of code.

This repo is compatible with [OpenRouter](https://openrouter.ai/) and [OpenAI](https://openai.com/). To use OpenRouter, you need to set the `OPENROUTER_API_KEY` environment variable.

## Function Max Duration

By default, the function timeout is set to 300 seconds (5 minutes). If you're using Vercel's Hobby tier, you'll need to reduce this to 60 seconds. You can adjust this by changing the `MAX_DURATION` environment variable in your `.env` file:

```bash
MAX_DURATION=60
```

Learn more about it [here](https://vercel.com/docs/functions/configuring-functions/duration#duration-limits)

## Deploy Your Own

You can deploy your own version of the Next.js AI Chatbot to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnickscamara%2Fopen-deep-research&env=AUTH_SECRET,OPENAI_API_KEY,OPENROUTER_API_KEY,BLOB_READ_WRITE_TOKEN,POSTGRES_URL,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN,REASONING_MODEL,BYPASS_JSON_VALIDATION,TOGETHER_API_KEY,MAX_DURATION&envDescription=Learn%20more%20about%20how%20to%20get%20the%20API%20Keys%20for%20the%20application&envLink=https%3A%2F%2Fgithub.com%2Fvercel%2Fai-chatbot%2Fblob%2Fmain%2F.env.example&demo-title=AI%20Chatbot&demo-description=An%20Open-Source%20AI%20Chatbot%20Template%20Built%20With%20Next.js%20and%20the%20AI%20SDK%20by%20Vercel.&demo-url=https%3A%2F%2Fchat.vercel.ai&stores=[{%22type%22:%22postgres%22},{%22type%22:%22blob%22}])

## Running locally

You will need to set up environment variables to run Open Deep Research. It's recommended you use [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for this, but a `.env` file is all that is necessary.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various API accounts.

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Authentication
AUTH_SECRET=your_random_secret_here  # Generate with: openssl rand -base64 32

# AI Models (REQUIRED)
OPENAI_API_KEY=sk-...                    # Required for both AI and web search

# Optional: Alternative AI Providers
OPENROUTER_API_KEY=sk-...                # For OpenRouter models (optional)
TOGETHER_API_KEY=...                     # For TogetherAI models (optional)

# Database (PostgreSQL)
POSTGRES_URL=postgresql://user:password@localhost:5432/dbname

# Redis (for rate limiting)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# File Storage (Vercel Blob or MinIO)
BLOB_READ_WRITE_TOKEN=...

# Reasoning Model (optional)
REASONING_MODEL=gpt-4o                   # or deepseek-ai/DeepSeek-R1
BYPASS_JSON_VALIDATION=false             # Set to true for non-OpenAI models

# Function Duration
MAX_DURATION=300                         # 300 seconds (5 min) or 60 for Vercel Hobby
```

### Get API Keys

**OpenAI API** (Required): 
- Get your API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- This single key provides both AI capabilities and web search functionality
- Web search is included with OpenAI's Responses API

### Installation Steps

```bash
# 1. First install all dependencies
pnpm install

# 2. Set up your .env file with the variables above

# 3. Run database migrations
pnpm db:migrate

# 4. Run the app
pnpm dev
```

Your app should now be running on [localhost:3000](http://localhost:3000/).


# Models dependencies

If you want to use a model other than the default, you will need to install the dependencies for that model.


TogetherAI's Deepseek:
```bash
pnpm add @ai-sdk/togetherai
```

Note: Maximum rate limit https://docs.together.ai/docs/rate-limits

## Reasoning Model Configuration

The application uses a separate model for reasoning tasks (like research analysis and structured outputs). This can be configured using the `REASONING_MODEL` environment variable.

### Available Options

| Provider | Models | Notes |
|----------|--------|-------|
| OpenAI | `gpt-4o`, `o1`, `o3-mini` | Native JSON schema support |
| TogetherAI | `deepseek-ai/DeepSeek-R1` | Requires `BYPASS_JSON_VALIDATION=true` |

### Important Notes

- Only certain OpenAI models (gpt-4o, o1, o3-mini) natively support structured JSON outputs
- Other models (deepseek-reasoner) can be used but may require disabling JSON schema validation
- When using models that don't support JSON schema:
  - Set `BYPASS_JSON_VALIDATION=true` in your .env file
  - This allows non-OpenAI models to be used for reasoning tasks
  - Note: Without JSON validation, the model responses may be less structured
- The reasoning model is used for tasks that require structured thinking and analysis, such as:
  - Research analysis
  - Document suggestions
  - Data extraction
  - Structured responses
- If no `REASONING_MODEL` is specified, it defaults to `o1-mini`
- If an invalid model is specified, it will fall back to `o1-mini`

### Usage

Add to your `.env` file:
```bash
# Choose one of: deepseek-reasoner, deepseek-ai/DeepSeek-R1
REASONING_MODEL=deepseek-ai/DeepSeek-R1

# Required when using models that don't support JSON schema (like deepseek-reasoner)
BYPASS_JSON_VALIDATION=true
```

The reasoning model is automatically used when the application needs structured outputs or complex analysis, regardless of which model the user has selected for general chat.
