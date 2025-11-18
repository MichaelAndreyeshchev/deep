FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Install dependencies first for better caching
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# Copy the rest of the application
COPY . .

# Build the application without running migrations
RUN pnpm build

# Expose the port the app runs on
EXPOSE 3000

# Start the application with migrations
CMD ["sh", "-c", "pnpm run db:migrate && pnpm start"]
