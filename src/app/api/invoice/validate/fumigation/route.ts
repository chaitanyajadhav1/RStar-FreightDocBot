// src/app/api/invoice/validate/fumigation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getInvoiceById, getFumigationCertificateById, verifyFumigationCertificateAgainstInvoice } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, certificateId, userId } = await request.json();

    if (!invoiceId || !certificateId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: invoiceId, certificateId, userId' },
        { status: 400 }
      );
    }

    console.log('[VALIDATION] Starting fumigation certificate validation:', {
      invoiceId,
      certificateId,
      userId
    });

    // Fetch both documents
    const [commercialInvoice, fumigationCertificate] = await Promise.all([
      getInvoiceById(invoiceId),
      getFumigationCertificateById(certificateId)
    ]);

    if (!commercialInvoice) {
      return NextResponse.json(
        { error: 'Commercial invoice not found' },
        { status: 404 }
      );
    }

    if (!fumigationCertificate) {
      return NextResponse.json(
        { error: 'Fumigation certificate not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (commercialInvoice.user_id !== userId || fumigationCertificate.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to documents' },
        { status: 403 }
      );
    }

    // Perform cross-verification
    const validationResult = await verifyFumigationCertificateAgainstInvoice(
      fumigationCertificate,
      commercialInvoice
    );

    console.log('[VALIDATION] Fumigation certificate validation completed:', {
      status: validationResult.status,
      verified: validationResult.verified,
      passedChecks: validationResult.comparisonData.passedChecks,
      totalChecks: validationResult.comparisonData.totalChecks
    });

    return NextResponse.json({
      success: true,
      message: 'Fumigation certificate validation completed successfully',
      validationResults: validationResult.comparisonData.checks,
      overallStatus: validationResult.status,
      verified: validationResult.verified,
      notes: validationResult.notes,
      comparisonData: validationResult.comparisonData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[VALIDATION] Fumigation certificate validation error:', error);
    return NextResponse.json(
      { 
        error: 'Validation failed',
        details: error.message 
      },
      { status: 500 }
    );
  }
}