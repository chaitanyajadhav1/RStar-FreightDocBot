// Route: /api/invoice/delete/delete-airway-bill/route.ts
// ============================================
// DELETE AIRWAY BILL
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyUserToken, getUserById } from '@/lib/auth';
import { getAirwayBillById, deleteAirwayBill } from '@/lib/database';

// ============================================
// INTERFACES
// ============================================
interface DeleteAirwayBillRequest {
  airwayBillId: string;
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
  timestamp?: string;
}

// ============================================
// DELETE HANDLER - DELETE AIRWAY BILL
// ============================================
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[DELETE AIRWAY BILL] Processing deletion');
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
    console.log('[DELETE AIRWAY BILL] Auth:', {
      currentUserId,
      organizationId,
      isAdmin
    });

    // ============================================
    // STEP 2: VALIDATE REQUEST
    // ============================================
    const body: DeleteAirwayBillRequest = await request.json();
    const { airwayBillId, userId } = body;

    console.log('[DELETE AIRWAY BILL] Request:', { airwayBillId, userId });

    if (!airwayBillId) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'Airway Bill ID is required' },
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
    // STEP 3: FETCH AIRWAY BILL
    // ============================================
    console.log('[DELETE AIRWAY BILL] Fetching airway bill...');
    const airwayBill = await getAirwayBillById(airwayBillId);
    
    if (!airwayBill) {
      console.log('[DELETE AIRWAY BILL] ✗ Airway bill not found');
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'Airway bill not found' },
        { status: 404 }
      );
    }

    console.log('[DELETE AIRWAY BILL] ✓ Airway bill found:', {
      id: airwayBill.id,
      owner: airwayBill.user_id
    });

    // ============================================
    // STEP 4: VERIFY PERMISSIONS
    // ============================================
    
    // Case 1: Regular user - can only delete their own airway bills
    if (!isAdmin) {
      if (airwayBill.user_id !== userId || currentUserId !== userId) {
        console.log('[DELETE AIRWAY BILL] ✗ Unauthorized: User does not own this airway bill');
        return NextResponse.json<ErrorResponse>(
          { 
            success: false, 
            error: 'Unauthorized: You do not have permission to delete this airway bill' 
          },
          { status: 403 }
        );
      }
    }
    
    // Case 2: Admin - can delete airway bills of users in same organization
    if (isAdmin) {
      // Verify document owner is in same organization
      const documentOwner = await getUserById(airwayBill.user_id);
      
      if (!documentOwner || documentOwner.organization_id !== organizationId) {
        console.log('[DELETE AIRWAY BILL] ✗ Admin cannot access - outside organization');
        return NextResponse.json<ErrorResponse>(
          { 
            success: false, 
            error: 'Unauthorized: Cannot delete airway bills outside your organization' 
          },
          { status: 403 }
        );
      }
      
      console.log('[DELETE AIRWAY BILL] ✓ Admin accessing airway bill in same organization');
    }

    console.log('[DELETE AIRWAY BILL] ✓ Permissions verified');

    // ============================================
    // STEP 5: DELETE AIRWAY BILL
    // ============================================
    console.log('[DELETE AIRWAY BILL] Deleting airway bill...');
    await deleteAirwayBill(airwayBillId);
    console.log('[DELETE AIRWAY BILL] ✓ Airway bill deleted');

    // ============================================
    // STEP 6: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[DELETE AIRWAY BILL] ✓ Success');
    console.log(`[DELETE AIRWAY BILL] Processing time: ${processingTime}ms`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json<SuccessResponse>({
      success: true,
      message: 'Airway bill deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('═══════════════════════════════════════');
    console.error('[DELETE AIRWAY BILL] ✗ Error:', error.message);
    console.error('[DELETE AIRWAY BILL] Stack:', error.stack);
    console.error('[DELETE AIRWAY BILL] Processing time:', processingTime + 'ms');
    console.error('═══════════════════════════════════════');

    return NextResponse.json<ErrorResponse>(
      { 
        success: false, 
        error: 'Failed to delete airway bill',
        details: error.message
      },
      { status: 500 }
    );
  }
}