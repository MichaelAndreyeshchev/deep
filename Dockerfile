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

# Create uploads directory for local file storage
RUN mkdir -p /app/public/uploads/documents/pdfs && \
    mkdir -p /app/public/uploads/documents/markdowns && \
    mkdir -p /app/public/uploads/documents/docxs && \
    mkdir -p /app/public/uploads/documents/csvs

# Expose the port the app runs on
EXPOSE 3000

# Start the application with migrations
CMD ["sh", "-c", "pnpm run db:migrate && pnpm start"]
