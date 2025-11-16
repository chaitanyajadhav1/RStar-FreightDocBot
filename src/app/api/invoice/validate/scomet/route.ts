// src/app/api/invoice/validate/scomet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getInvoiceById, getSCOMETDeclarationById, verifySCOMETAgainstInvoice } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, scometId, userId } = await request.json();

    if (!invoiceId || !scometId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: invoiceId, scometId, userId' },
        { status: 400 }
      );
    }

    console.log('[VALIDATION] Starting SCOMET declaration validation:', {
      invoiceId,
      scometId,
      userId
    });

    // Fetch both documents
    const [commercialInvoice, scometDeclaration] = await Promise.all([
      getInvoiceById(invoiceId),
      getSCOMETDeclarationById(scometId)
    ]);

    if (!commercialInvoice) {
      return NextResponse.json(
        { error: 'Commercial invoice not found' },
        { status: 404 }
      );
    }

    if (!scometDeclaration) {
      return NextResponse.json(
        { error: 'SCOMET declaration not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (commercialInvoice.user_id !== userId || scometDeclaration.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to documents' },
        { status: 403 }
      );
    }

    // Perform cross-verification
    const validationResult = await verifySCOMETAgainstInvoice(
      scometDeclaration,
      commercialInvoice
    );

    console.log('[VALIDATION] SCOMET declaration validation completed:', {
      status: validationResult.status,
      verified: validationResult.verified,
      passedChecks: validationResult.comparisonData.passedChecks,
      totalChecks: validationResult.comparisonData.totalChecks
    });

    return NextResponse.json({
      success: true,
      message: 'SCOMET declaration validation completed successfully',
      validationResults: validationResult.comparisonData.checks,
      overallStatus: validationResult.status,
      verified: validationResult.verified,
      notes: validationResult.notes,
      comparisonData: validationResult.comparisonData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[VALIDATION] SCOMET declaration validation error:', error);
    return NextResponse.json(
      { 
        error: 'Validation failed',
        details: error.message 
      },
      { status: 500 }
    );
  }
}