// src/lib/config.ts - Fixed with proper environment variable handling

import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

// ========== ENVIRONMENT VARIABLES ==========

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Redis configuration
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;


// Other services
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const QDRANT_URL = process.env.QDRANT_URL || '';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// ========== VALIDATION & LOGGING ==========

const missingVars: string[] = [];

if (!SUPABASE_URL) {
  missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
}

if (!SUPABASE_ANON_KEY) {
  missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
}

if (!UPSTASH_REDIS_REST_URL) {
  missingVars.push('UPSTASH_REDIS_REST_URL');
}

if (!UPSTASH_REDIS_REST_TOKEN) {
  missingVars.push('UPSTASH_REDIS_REST_TOKEN');
}

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  console.error('\nPlease add these to your .env.local file:');
  missingVars.forEach(v => console.error(`  ${v}=`));
}


let supabase: any;
let supabaseAdmin: any;

try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✓ Supabase client initialized');
  } else {
    throw new Error('Missing Supabase configuration');
  }
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  // Create a dummy client to prevent runtime errors
  supabase = null;
}

try {
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('✓ Supabase admin client initialized');
  } else {
    throw new Error('Missing Supabase service role configuration');
  }
} catch (error) {
  console.error('Failed to initialize Supabase admin client:', error);
  supabaseAdmin = null;
}

// ========== REDIS CLIENTS ==========

let redis: any;

try {
  if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('✓ Redis client initialized');
  } else {
    throw new Error('Missing Redis configuration');
  }
} catch (error) {
  console.error('Failed to initialize Redis client:', error);
  redis = null;
}

// ========== REDIS CONNECTION FOR BULLMQ ==========

const redisConnection = {
  host: UPSTASH_REDIS_REST_URL?.replace('https://', '').replace(':443', '') || 'localhost',
  port: 6379,
  password: UPSTASH_REDIS_REST_TOKEN || undefined,
  tls: UPSTASH_REDIS_REST_URL?.includes('https') ? {} : undefined,
};

// ========== EXPORTS ==========

export {
  supabase,
  supabaseAdmin,
  redis,
  redisConnection,
  JWT_SECRET,
  QDRANT_URL,
  QDRANT_API_KEY,
  OPENAI_API_KEY,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
};

// ========== HEALTH CHECK FUNCTION ==========

export function checkConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!SUPABASE_URL) errors.push('NEXT_PUBLIC_SUPABASE_URL is missing');
  if (!SUPABASE_ANON_KEY) errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
  if (!SUPABASE_SERVICE_ROLE_KEY) errors.push('SUPABASE_SERVICE_ROLE_KEY is missing');
  if (!UPSTASH_REDIS_REST_URL) errors.push('UPSTASH_REDIS_REST_URL is missing');
  if (!UPSTASH_REDIS_REST_TOKEN) errors.push('UPSTASH_REDIS_REST_TOKEN is missing');
  
  return {
    valid: errors.length === 0,
    errors
  };
}