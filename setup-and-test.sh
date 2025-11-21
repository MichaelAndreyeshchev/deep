#!/bin/bash

set -e  # Exit on error

echo "🚀 Deep Research Integration - Setup and Test"
echo "=============================================="
echo ""

if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and set your API keys:"
    echo "   - OPENAI_API_KEY (required)"
    echo "   - AUTH_SECRET (generate with: openssl rand -base64 32)"
    echo ""
    echo "After setting these, run this script again."
    exit 1
fi

if ! grep -q "OPENAI_API_KEY=sk-" .env 2>/dev/null && ! grep -q "OPENAI_API_KEY=.*[a-zA-Z0-9]" .env 2>/dev/null; then
    echo "⚠️  OPENAI_API_KEY not set in .env file"
    echo "   Please edit .env and add your OpenAI API key"
    exit 1
fi

echo "✅ Environment file configured"
echo ""

if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

echo "🔨 Building and starting services..."
echo "   This may take a few minutes on first run..."
echo ""

docker-compose up -d --build

echo ""
echo "⏳ Waiting for services to be healthy..."
echo "   This may take 30-60 seconds..."
echo ""

max_wait=120
elapsed=0
while [ $elapsed -lt $max_wait ]; do
    if docker-compose ps | grep -q "healthy"; then
        if docker-compose ps deep-research-service | grep -q "healthy"; then
            echo ""
            echo "✅ All services are healthy!"
            break
        fi
    fi
    
    echo -n "."
    sleep 2
    elapsed=$((elapsed + 2))
done

if [ $elapsed -ge $max_wait ]; then
    echo ""
    echo "⚠️  Services took longer than expected to start"
    echo "   Check status with: docker-compose ps"
    echo "   Check logs with: docker-compose logs"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📊 Service Status:"
docker-compose ps
echo ""

echo "🧪 Testing Python service..."
if curl -s http://localhost:8001/health | grep -q "healthy"; then
    echo "✅ Python service is responding"
else
    echo "⚠️  Python service health check failed"
    echo "   Check logs with: docker-compose logs deep-research-service"
fi

echo ""
echo "🌐 Access the application:"
echo "   Main App:        http://localhost:13000"
echo "   Python Service:  http://localhost:8001"
echo "   MinIO Console:   http://localhost:19001"
echo ""
echo "📖 Testing Instructions:"
echo "   1. Open http://localhost:13000 in your browser"
echo "   2. Click 'Deep Research' tab"
echo "   3. Select 'Iterative' or 'Deep' mode"
echo "   4. Enter a research query"
echo "   5. Watch the results stream in real-time!"
echo ""
echo "📚 For detailed testing guide, see: TESTING_GUIDE.md"
echo ""
echo "🛑 To stop all services: docker-compose down"
echo "📋 To view logs: docker-compose logs -f"
echo ""
