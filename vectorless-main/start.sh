#!/bin/sh
set -euo pipefail

mkdir -p .data/uploads

echo "Running database migrations..."
pnpm db:migrate || echo "Migration skipped (may need manual setup)"

echo "Starting Next.js server..."
exec pnpm start

