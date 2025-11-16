// src/app/api/invoice/validate/packinglist/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getInvoiceById, getPackingListById, verifyPackingListAgainstInvoice } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, packingListId, userId } = await request.json();

    if (!invoiceId || !packingListId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: invoiceId, packingListId, userId' },
        { status: 400 }
      );
    }

    console.log('[VALIDATION] Starting packing list validation:', {
      invoiceId,
      packingListId,
      userId
    });

    // Fetch both documents
    const [commercialInvoice, packingList] = await Promise.all([
      getInvoiceById(invoiceId),
      getPackingListById(packingListId)
    ]);

    if (!commercialInvoice) {
      return NextResponse.json(
        { error: 'Commercial invoice not found' },
        { status: 404 }
      );
    }

    if (!packingList) {
      return NextResponse.json(
        { error: 'Packing list not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (commercialInvoice.user_id !== userId || packingList.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to documents' },
        { status: 403 }
      );
    }

    // Perform cross-verification
    const validationResult = await verifyPackingListAgainstInvoice(
      packingList,
      commercialInvoice
    );

    console.log('[VALIDATION] Packing list validation completed:', {
      status: validationResult.status,
      verified: validationResult.verified,
      passedChecks: validationResult.comparisonData.passedChecks,
      totalChecks: validationResult.comparisonData.totalChecks
    });

    return NextResponse.json({
      success: true,
      message: 'Packing list validation completed successfully',
      validationResults: validationResult.comparisonData.checks,
      overallStatus: validationResult.status,
      verified: validationResult.verified,
      notes: validationResult.notes,
      comparisonData: validationResult.comparisonData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[VALIDATION] Packing list validation error:', error);
    return NextResponse.json(
      { 
        error: 'Validation failed',
        details: error.message 
      },
      { status: 500 }
    );
  }
}