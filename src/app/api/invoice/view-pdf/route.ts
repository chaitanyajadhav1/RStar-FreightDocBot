// src/app/api/invoice/view-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Get file path and bucket from query parameters
    const { searchParams } = new URL(request.url);
    let filePath = searchParams.get('path');
    const bucket = searchParams.get('bucket') || 'invoices';
    
    if (!filePath) {
      return NextResponse.json(
        { error: 'File path required' },
        { status: 400 }
      );
    }

    console.log(`[PDF Viewer] Attempting to download from bucket: ${bucket}, path: ${filePath}`);

    // Clean up file path
    filePath = filePath.trim();
    
    // First, let's verify the file exists by checking the storage
    const { data: files, error: listError } = await supabase.storage
      .from(bucket)
      .list('', {
        limit: 100,
        offset: 0,
      });

    if (listError) {
      console.error('[PDF Viewer] List error:', listError);
    } else {
      console.log('[PDF Viewer] Files in storage:', files?.map(f => f.name));
      const fileExists = files?.some(f => f.name === filePath);
      console.log('[PDF Viewer] File exists:', fileExists);
    }

    // Try to download the file
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (error || !data) {
      console.error('[PDF Viewer] Download error:', error);
      
      // Try alternative approach - get public URL
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);
      
      console.log('[PDF Viewer] Public URL:', publicUrlData.publicUrl);
      
      // Check if it's a path issue - try to find the actual file
      const actualFiles = files?.filter(f => 
        f.name.includes(filePath) || filePath.includes(f.name)
      );
      
      if (actualFiles && actualFiles.length > 0) {
        console.log('[PDF Viewer] Similar files found:', actualFiles.map(f => f.name));
        
        // Try the first similar file
        const { data: altData, error: altError } = await supabase.storage
          .from(bucket)
          .download(actualFiles[0].name);
          
        if (!altError && altData) {
          const arrayBuffer = await altData.arrayBuffer();
          return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': 'inline',
              'Cache-Control': 'private, max-age=3600',
            },
          });
        }
      }
      
      return NextResponse.json(
        { 
          error: 'File not found or access denied', 
          details: error?.message,
          debug: {
            requestedPath: filePath,
            bucket,
            filesInBucket: files?.length,
            similarFiles: actualFiles?.map(f => f.name)
          }
        },
        { status: 404 }
      );
    }

    // Convert blob to array buffer
    const arrayBuffer = await data.arrayBuffer();
    
    // Return PDF with proper headers
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });

  } catch (error: any) {
    console.error('[PDF Viewer] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load PDF', details: error.message },
      { status: 500 }
    );
  }
}