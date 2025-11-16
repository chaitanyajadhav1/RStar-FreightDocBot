// Route: /api/invoice/delete/delete-packinglist/route.ts
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyUserToken, getUserById } from '@/lib/auth';
import { getPackingListById, deletePackingList } from '@/lib/database';

// ============================================
// INTERFACES
// ============================================
interface DeletePackingListRequest {
  packingListId: string;
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
// DELETE HANDLER - DELETE PACKING LIST
// ============================================
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[DELETE PACKING LIST] Processing deletion');
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
    console.log('[DELETE PACKING LIST] Auth:', {
      currentUserId,
      organizationId,
      isAdmin
    });

    // ============================================
    // STEP 2: VALIDATE REQUEST
    // ============================================
    const body: DeletePackingListRequest = await request.json();
    const { packingListId, userId } = body;

    console.log('[DELETE PACKING LIST] Request:', { packingListId, userId });

    if (!packingListId) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'Packing List ID is required' },
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
    // STEP 3: FETCH PACKING LIST
    // ============================================
    console.log('[DELETE PACKING LIST] Fetching packing list...');
    const packingList = await getPackingListById(packingListId);
    
    if (!packingList) {
      console.log('[DELETE PACKING LIST] ✗ Packing list not found');
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'Packing list not found' },
        { status: 404 }
      );
    }

    console.log('[DELETE PACKING LIST] ✓ Packing list found:', {
      id: packingList.id,
      owner: packingList.user_id
    });

    // ============================================
    // STEP 4: VERIFY PERMISSIONS
    // ============================================
    
    // Case 1: Regular user - can only delete their own packing lists
    if (!isAdmin) {
      if (packingList.user_id !== userId || currentUserId !== userId) {
        console.log('[DELETE PACKING LIST] ✗ Unauthorized: User does not own this packing list');
        return NextResponse.json<ErrorResponse>(
          { 
            success: false, 
            error: 'Unauthorized: You do not have permission to delete this packing list' 
          },
          { status: 403 }
        );
      }
    }
    
    // Case 2: Admin - can delete packing lists of users in same organization
    if (isAdmin) {
      // Verify document owner is in same organization
      const documentOwner = await getUserById(packingList.user_id);
      
      if (!documentOwner || documentOwner.organization_id !== organizationId) {
        console.log('[DELETE PACKING LIST] ✗ Admin cannot access - outside organization');
        return NextResponse.json<ErrorResponse>(
          { 
            success: false, 
            error: 'Unauthorized: Cannot delete packing lists outside your organization' 
          },
          { status: 403 }
        );
      }
      
      console.log('[DELETE PACKING LIST] ✓ Admin accessing packing list in same organization');
    }

    console.log('[DELETE PACKING LIST] ✓ Permissions verified');

    // ============================================
    // STEP 5: DELETE PACKING LIST
    // ============================================
    console.log('[DELETE PACKING LIST] Deleting packing list...');
    await deletePackingList(packingListId);
    console.log('[DELETE PACKING LIST] ✓ Packing list deleted');

    // ============================================
    // STEP 6: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[DELETE PACKING LIST] ✓ Success');
    console.log(`[DELETE PACKING LIST] Processing time: ${processingTime}ms`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json<SuccessResponse>({
      success: true,
      message: 'Packing list deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('═══════════════════════════════════════');
    console.error('[DELETE PACKING LIST] ✗ Error:', error.message);
    console.error('[DELETE PACKING LIST] Stack:', error.stack);
    console.error('[DELETE PACKING LIST] Processing time:', processingTime + 'ms');
    console.error('═══════════════════════════════════════');

    return NextResponse.json<ErrorResponse>(
      { 
        success: false, 
        error: 'Failed to delete packing list',
        details: error.message
      },
      { status: 500 }
    );
  }
}