// src/app/api/admin/documents/route.ts - Admin endpoint to get any user's documents
import { NextRequest, NextResponse } from 'next/server';
import { 
  verifyUserToken,
  getUserById
} from '@/lib/auth';
import {
  getUserInvoices,
  getUserSCOMETDeclarations,
  getUserPackingLists,
  getUserFumigationCertificates,
  getUserExportDeclarations
} from '@/lib/database';

function safeParseJSON(value: any, defaultValue: any = []): any {
  if (!value) return defaultValue;
  try {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    return value;
  } catch (e) {
    console.error('Error parsing JSON:', e);
    return defaultValue;
  }
}

// GET - Fetch documents for a specific user (admin only)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = await verifyUserToken(token);

    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Check if current user is admin
    const currentUser = await getUserById(decoded.userId);
    if (!currentUser || !currentUser.is_active) {
      return NextResponse.json({ error: 'User not active' }, { status: 403 });
    }

    if (currentUser.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Forbidden: Admin role required' 
      }, { status: 403 });
    }

    // Get targetUserId from query params
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    
    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify target user exists and is in same organization (for security)
    const targetUser = await getUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Target user not found' },
        { status: 404 }
      );
    }

    // Admin can only view users in their organization
    if (targetUser.organization_id !== decoded.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Cannot access users outside your organization' },
        { status: 403 }
      );
    }

    console.log('[Admin API] Fetching documents for user:', targetUserId);

    // Fetch all document types for the target user in parallel
    const [
      invoices,
      scometDeclarations,
      packingLists,
      fumigationCertificates,
      exportDeclarations
    ] = await Promise.all([
      getUserInvoices(targetUserId),
      getUserSCOMETDeclarations(targetUserId),
      getUserPackingLists(targetUserId),
      getUserFumigationCertificates(targetUserId),
      getUserExportDeclarations(targetUserId)
    ]);

    console.log('[Admin API] Documents found:', {
      invoices: invoices.length,
      scomet: scometDeclarations.length,
      packingLists: packingLists.length,
      fumigationCertificates: fumigationCertificates.length,
      exportDeclarations: exportDeclarations.length
    });

    // Get the most recent document of each type
    const mostRecentInvoice = invoices.length > 0 ? invoices[0] : null;
    const mostRecentSCOMET = scometDeclarations.length > 0 ? scometDeclarations[0] : null;
    const mostRecentPackingList = packingLists.length > 0 ? packingLists[0] : null;
    const mostRecentFumigation = fumigationCertificates.length > 0 ? fumigationCertificates[0] : null;
    const mostRecentExportDeclaration = exportDeclarations.length > 0 ? exportDeclarations[0] : null;

    // Format response similar to user-documents route
    return NextResponse.json({
      success: true,
      documents: {
        currentInvoice: mostRecentInvoice ? {
          invoiceId: mostRecentInvoice.invoice_id,
          filename: mostRecentInvoice.filename,
          fileUrl: mostRecentInvoice.filepath,
          uploadedAt: mostRecentInvoice.uploaded_at,
          processedAt: mostRecentInvoice.processed_at,
          status: mostRecentInvoice.status,
          invoiceNo: mostRecentInvoice.invoice_no,
          invoiceDate: mostRecentInvoice.invoice_date,
          consigneeName: mostRecentInvoice.consignee_name,
          consigneeAddress: mostRecentInvoice.consignee_address,
          exporterName: mostRecentInvoice.exporter_name,
          exporterAddress: mostRecentInvoice.exporter_address,
          totalAmount: mostRecentInvoice.total_amount,
          currency: mostRecentInvoice.currency,
          items: safeParseJSON(mostRecentInvoice.items, []),
          is_valid: mostRecentInvoice.is_valid,
          completeness: mostRecentInvoice.completeness,
          validation_errors: safeParseJSON(mostRecentInvoice.validation_errors, []),
          validation_warnings: safeParseJSON(mostRecentInvoice.validation_warnings, []),
          extracted_text: mostRecentInvoice.extracted_text
        } : null,

        currentSCOMET: mostRecentSCOMET ? {
          declarationId: mostRecentSCOMET.declaration_id,
          filename: mostRecentSCOMET.filename,
          fileUrl: mostRecentSCOMET.filepath,
          uploadedAt: mostRecentSCOMET.uploaded_at,
          processedAt: mostRecentSCOMET.processed_at,
          status: mostRecentSCOMET.status,
          declarationNo: mostRecentSCOMET.declaration_no,
          declarationDate: mostRecentSCOMET.declaration_date,
          exporterName: mostRecentSCOMET.exporter_name,
          exporterAddress: mostRecentSCOMET.exporter_address,
          is_valid: mostRecentSCOMET.is_valid,
          completeness: mostRecentSCOMET.completeness,
          validation_errors: safeParseJSON(mostRecentSCOMET.validation_errors, []),
          validation_warnings: safeParseJSON(mostRecentSCOMET.validation_warnings, []),
          extracted_text: mostRecentSCOMET.extracted_text
        } : null,

        currentPackingList: mostRecentPackingList ? {
          packingListId: mostRecentPackingList.packing_list_id,
          filename: mostRecentPackingList.filename,
          fileUrl: mostRecentPackingList.filepath,
          uploadedAt: mostRecentPackingList.uploaded_at,
          processedAt: mostRecentPackingList.processed_at,
          status: mostRecentPackingList.status,
          packingListNumber: mostRecentPackingList.packing_list_number,
          packingListDate: mostRecentPackingList.packing_list_date,
          is_valid: mostRecentPackingList.is_valid,
          completeness: mostRecentPackingList.completeness,
          validation_errors: safeParseJSON(mostRecentPackingList.validation_errors, []),
          validation_warnings: safeParseJSON(mostRecentPackingList.validation_warnings, []),
          extracted_text: mostRecentPackingList.extracted_text
        } : null,

        currentFumigationCertificate: mostRecentFumigation ? {
          certificateId: mostRecentFumigation.certificate_id,
          filename: mostRecentFumigation.filename,
          fileUrl: mostRecentFumigation.filepath,
          uploadedAt: mostRecentFumigation.uploaded_at,
          processedAt: mostRecentFumigation.processed_at,
          status: mostRecentFumigation.status,
          certificateNo: mostRecentFumigation.certificate_no,
          certificateDate: mostRecentFumigation.certificate_date,
          is_valid: mostRecentFumigation.is_valid,
          completeness: mostRecentFumigation.completeness,
          validation_errors: safeParseJSON(mostRecentFumigation.validation_errors, []),
          validation_warnings: safeParseJSON(mostRecentFumigation.validation_warnings, []),
          extracted_text: mostRecentFumigation.extracted_text
        } : null,

        currentExportDeclaration: mostRecentExportDeclaration ? {
          declarationId: mostRecentExportDeclaration.declaration_id,
          filename: mostRecentExportDeclaration.filename,
          fileUrl: mostRecentExportDeclaration.filepath,
          uploadedAt: mostRecentExportDeclaration.uploaded_at,
          processedAt: mostRecentExportDeclaration.processed_at,
          status: mostRecentExportDeclaration.status,
          declarationNo: mostRecentExportDeclaration.declaration_no,
          declarationDate: mostRecentExportDeclaration.declaration_date,
          invoiceNo: mostRecentExportDeclaration.invoice_no,
          invoiceDate: mostRecentExportDeclaration.invoice_date,
          shippingBillNo: mostRecentExportDeclaration.shipping_bill_no,
          shippingBillDate: mostRecentExportDeclaration.shipping_bill_date,
          is_valid: mostRecentExportDeclaration.is_valid,
          completeness: mostRecentExportDeclaration.completeness,
          validation_errors: safeParseJSON(mostRecentExportDeclaration.validation_errors, []),
          validation_warnings: safeParseJSON(mostRecentExportDeclaration.validation_warnings, []),
          extracted_text: mostRecentExportDeclaration.extracted_text
        } : null
      },
      allDocuments: {
        invoices: invoices.map((inv: any) => ({
          invoiceId: inv.invoice_id,
          filename: inv.filename,
          invoiceNo: inv.invoice_no,
          uploadedAt: inv.uploaded_at
        })),
        scomet: scometDeclarations.map((s: any) => ({
          declarationId: s.declaration_id,
          filename: s.filename,
          declarationNo: s.declaration_no,
          uploadedAt: s.uploaded_at
        })),
        packingLists: packingLists.map((p: any) => ({
          packingListId: p.packing_list_id,
          filename: p.filename,
          packingListNumber: p.packing_list_number,
          uploadedAt: p.uploaded_at
        })),
        fumigationCertificates: fumigationCertificates.map((f: any) => ({
          certificateId: f.certificate_id,
          filename: f.filename,
          certificateNo: f.certificate_no,
          uploadedAt: f.uploaded_at
        })),
        exportDeclarations: exportDeclarations.map((e: any) => ({
          declarationId: e.declaration_id,
          filename: e.filename,
          declarationNo: e.declaration_no,
          uploadedAt: e.uploaded_at
        }))
      },
      targetUserId
    });

  } catch (error: any) {
    console.error('[Admin API] Error fetching user documents:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch documents',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

