// Route: /api/invoice/delete/delete-invoice/route.ts
// ============================================
// DELETE COMMERCIAL INVOICE
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyUserToken, getUserById } from '@/lib/auth';
import { getInvoiceByIdAndUserId, deleteInvoiceByIdAndUser } from '@/lib/database';

// ============================================
// INTERFACES
// ============================================
interface DeleteInvoiceRequest {
  invoiceId: string;  // This is actually invoice_id (UUID)
  userId: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
}

interface SuccessResponse {
  success: true;
  message: string;
  deletedInvoice?: {
    invoice_id: string;
    invoice_no: string;
    filename: string;
  };
  timestamp?: string;
}

// ============================================
// DELETE HANDLER - DELETE COMMERCIAL INVOICE
// ============================================
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[DELETE INVOICE] Processing deletion');
    console.log('═══════════════════════════════════════');

    // ============================================
    // STEP 1: VERIFY AUTHENTICATION
    // ============================================
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'Unauthorized: Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const tokenData = await verifyUserToken(token);
    
    if (!tokenData) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'Unauthorized: Invalid or expired token' },
        { status: 401 }
      );
    }

    const { userId: currentUserId, organizationId } = tokenData;
    
    // Verify user is active
    const currentUser = await getUserById(currentUserId);
    if (!currentUser || !currentUser.is_active) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'Unauthorized: User not active' },
        { status: 403 }
      );
    }

    const isAdmin = currentUser.role === 'admin';
    console.log('[DELETE INVOICE] Auth:', {
      currentUserId,
      organizationId,
      isAdmin
    });

    // ============================================
    // STEP 2: VALIDATE REQUEST
    // ============================================
    const body: DeleteInvoiceRequest = await request.json();
    const { invoiceId, userId } = body;

    console.log('[DELETE INVOICE] Request:', { invoiceId, userId });

    if (!invoiceId) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // ============================================
    // STEP 3: FETCH INVOICE
    // ============================================
    console.log('[DELETE INVOICE] Fetching invoice...');
    
    // Fetch invoice using invoice_id and user_id
    let invoice = await getInvoiceByIdAndUserId(invoiceId, userId);
    
    // If not found and current user is admin, check organization access
    if (!invoice && isAdmin) {
      console.log('[DELETE INVOICE] Invoice not found for user, checking admin access...');
      
      const documentOwner = await getUserById(userId);
      if (documentOwner && documentOwner.organization_id === organizationId) {
        // Admin can access invoices in their organization
        const { getInvoiceById } = await import('@/lib/database');
        invoice = await getInvoiceById(invoiceId);
        
        if (invoice && invoice.organization_id === organizationId) {
          console.log('[DELETE INVOICE] ✓ Admin accessing invoice in same organization');
        } else {
          invoice = null;
        }
      }
      
      if (!invoice) {
        console.log('[DELETE INVOICE] ✗ Admin cannot access invoice - not found or outside organization');
        return NextResponse.json<ErrorResponse>(
          { success: false, error: 'Invoice not found or access denied' },
          { status: 404 }
        );
      }
    }
    
    if (!invoice) {
      console.log('[DELETE INVOICE] ✗ Invoice not found');
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    console.log('[DELETE INVOICE] ✓ Invoice found:', {
      invoice_id: invoice.invoice_id,
      invoice_no: invoice.invoice_no,
      filename: invoice.filename,
      owner: invoice.user_id
    });

    // ============================================
    // STEP 4: VERIFY PERMISSIONS
    // ============================================
    
    // Case 1: Regular user - can only delete their own invoices
    if (!isAdmin) {
      if (invoice.user_id !== userId || currentUserId !== userId) {
        console.log('[DELETE INVOICE] ✗ Unauthorized: User does not own this invoice');
        return NextResponse.json<ErrorResponse>(
          { 
            success: false, 
            error: 'Unauthorized: You do not have permission to delete this invoice' 
          },
          { status: 403 }
        );
      }
    }
    
    // Case 2: Admin - verify organization match
    if (isAdmin) {
      if (invoice.organization_id !== organizationId) {
        console.log('[DELETE INVOICE] ✗ Unauthorized: Invoice outside admin organization');
        return NextResponse.json<ErrorResponse>(
          { 
            success: false, 
            error: 'Unauthorized: Cannot delete invoice outside your organization' 
          },
          { status: 403 }
        );
      }
    }
    
    console.log('[DELETE INVOICE] ✓ Permissions verified');

    // ============================================
    // STEP 5: DELETE INVOICE
    // ============================================
    console.log('[DELETE INVOICE] Deleting invoice...');
    
    // Delete using invoice_id and the actual owner's user_id from the invoice record
    await deleteInvoiceByIdAndUser(invoice.invoice_id, invoice.user_id);
    
    console.log('[DELETE INVOICE] ✓ Invoice deleted');

    // ============================================
    // STEP 6: CLEAR REDIS CACHE (if applicable)
    // ============================================
    try {
      const { redis } = await import('@/lib/config');
      const redisKeys = [
        `invoice:${invoice.user_id}:${invoice.invoice_no}`,
        `invoice:${invoice.invoice_id}`,
        `user:${invoice.user_id}:invoices`
      ];
      
      for (const key of redisKeys) {
        await redis.del(key);
      }
      
      console.log('[DELETE INVOICE] ✓ Removed from cache');
    } catch (cacheError) {
      console.warn('[DELETE INVOICE] Failed to remove from cache:', cacheError);
      // Continue even if cache clear fails
    }

    // ============================================
    // STEP 7: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[DELETE INVOICE] ✓ Success');
    console.log(`[DELETE INVOICE] Processing time: ${processingTime}ms`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json<SuccessResponse>({
      success: true,
      message: 'Commercial invoice deleted successfully',
      deletedInvoice: {
        invoice_id: invoice.invoice_id,
        invoice_no: invoice.invoice_no,
        filename: invoice.filename
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('═══════════════════════════════════════');
    console.error('[DELETE INVOICE] ✗ Error:', error.message);
    console.error('[DELETE INVOICE] Stack:', error.stack);
    console.error('[DELETE INVOICE] Processing time:', processingTime + 'ms');
    console.error('═══════════════════════════════════════');

    return NextResponse.json<ErrorResponse>(
      { 
        success: false, 
        error: 'Failed to delete invoice',
        details: error.message
      },
      { status: 500 }
    );
  }
}