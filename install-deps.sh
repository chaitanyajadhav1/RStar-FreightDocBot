#!/bin/bash

echo "Installing dependencies for Next.js PDF RAG application..."

# Install all dependencies
npm install

echo "Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env.local and fill in your environment variables"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:3000 to see the application"
echo ""
echo "Required environment variables:"
echo "- SUPABASE_URL"
echo "- SUPABASE_ANON_KEY" 
echo "- OPENAI_API_KEY"
echo "- QDRANT_URL"
echo "- QDRANT_API_KEY"
echo "- UPSTASH_REDIS_REST_URL"
echo "- UPSTASH_REDIS_REST_TOKEN"
echo "- JWT_SECRET"
