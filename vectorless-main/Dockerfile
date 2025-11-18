FROM node:20-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
WORKDIR /app

# --- Dependencies layer ----------------------------------------------------
FROM base AS deps

COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml tsconfig.base.json ./

RUN mkdir -p apps/web apps/ingest-worker packages/core packages/db packages/ui

COPY apps/web/package.json apps/web/package.json
COPY apps/ingest-worker/package.json apps/ingest-worker/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile

# --- Build layer -----------------------------------------------------------
FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages

COPY . .

# Generate Prisma client
RUN pnpm --filter @vectorless/db prisma:generate

# Build the web app with proper environment
ENV NODE_ENV=production
RUN pnpm --filter web build

RUN chmod +x start.sh

# --- Runtime layer ---------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production

WORKDIR /app

# Copy necessary files
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/ingest-worker ./apps/ingest-worker
COPY --from=build /app/packages ./packages
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/start.sh ./start.sh

RUN mkdir -p .data/uploads .data/duckdb && chmod +x start.sh

EXPOSE 3000
CMD ["./start.sh"]

