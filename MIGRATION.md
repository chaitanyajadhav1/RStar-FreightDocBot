# Express to Next.js Migration

This document outlines the migration from Express server to Next.js full-stack application.

## What was migrated:

### 1. API Routes
- `/auth/register` → `/api/auth/register`
- `/auth/login` → `/api/auth/login`
- `/auth/profile` → `/api/auth/profile`
- `/upload/pdf` → `/api/upload/pdf`
- `/chat/documents` → `/api/chat/documents`
- `/agent/shipping/start` → `/api/agent/shipping/start`
- `/agent/shipping/message` → `/api/agent/shipping/message`
- `/track/:trackingNumber` → `/api/track/[trackingNumber]`
- `/shipments` → `/api/shipments`
- Worker endpoints → `/api/worker/*`

### 2. Dependencies Added
All Express server dependencies have been added to the Next.js project:
- LangChain packages for AI/ML
- Supabase for database
- Redis/Upstash for caching
- JWT for authentication
- Multer for file uploads
- BullMQ for job queues

### 3. Configuration
- Created `src/lib/config.ts` for shared configuration
- Created `src/lib/auth.ts` for authentication utilities
- Created `src/lib/database.ts` for database operations
- Created `src/lib/workflow.ts` for the shipping agent

### 4. Frontend Integration
- Updated API base URLs to use Next.js API routes
- All existing functionality preserved
- CORS middleware added for API routes

## Environment Variables Required:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_api_key
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
JWT_SECRET=your_jwt_secret_key
```

## Running the Application:

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (copy from .env.example)

3. Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Features Preserved:

- ✅ PDF upload and processing
- ✅ Document chat with vector search
- ✅ AI shipping agent with LangGraph
- ✅ Invoice processing
- ✅ Shipment tracking
- ✅ Redis data storage
- ✅ User authentication
- ✅ Real-time data from Redis

## Architecture:

- **Frontend**: Next.js with Material-UI
- **API**: Next.js API routes
- **Database**: Supabase (PostgreSQL)
- **Vector Store**: Qdrant
- **Cache**: Upstash Redis
- **AI**: OpenAI + LangChain
- **Authentication**: JWT tokens
