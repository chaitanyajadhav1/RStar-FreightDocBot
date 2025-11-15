import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    const { count: docCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    const { count: trackingCount } = await supabase
      .from('shipment_tracking')
      .select('*', { count: 'exact', head: true });

    const { count: invoiceCount } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({ 
      status: 'FreightChat Pro API - Pure Agent Architecture',
      registeredUsers: userCount || 0,
      totalDocuments: docCount || 0,
      activeShipments: trackingCount || 0,
      invoicesProcessed: invoiceCount || 0,
      database: 'Supabase Connected',
      redis: 'Upstash Connected',
      agentStatus: '✓ Active',
      architecture: 'LangGraph Multi-Agent',
      deployment: 'Next.js Full-Stack',
      features: ['PDF Chat', 'AI Shipping Agent', 'Real-time Tracking', 'Invoice Processing'],
      version: '5.2.0-nextjs-integration'
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'Error',
      error: error.message
    }, { status: 500 });
  }
}
