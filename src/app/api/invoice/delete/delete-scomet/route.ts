// Route: /api/invoice/delete/delete-scomet/route.ts
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyUserToken, getUserById } from '@/lib/auth';
import { getSCOMETDeclarationById, deleteSCOMETDeclaration } from '@/lib/database';

// ============================================
// INTERFACES
// ============================================
interface DeleteSCOMETRequest {
  scometId: string;
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
// DELETE HANDLER - DELETE SCOMET DECLARATION
// ============================================
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[DELETE SCOMET] Processing deletion');
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
    console.log('[DELETE SCOMET] Auth:', {
      currentUserId,
      organizationId,
      isAdmin
    });

    // ============================================
    // STEP 2: VALIDATE REQUEST
    // ============================================
    const body: DeleteSCOMETRequest = await request.json();
    const { scometId, userId } = body;

    console.log('[DELETE SCOMET] Request:', { scometId, userId });

    if (!scometId) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'SCOMET ID is required' },
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
    // STEP 3: FETCH SCOMET DECLARATION
    // ============================================
    console.log('[DELETE SCOMET] Fetching declaration...');
    const scomet = await getSCOMETDeclarationById(scometId);
    
    if (!scomet) {
      console.log('[DELETE SCOMET] ✗ Declaration not found');
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'SCOMET declaration not found' },
        { status: 404 }
      );
    }

    console.log('[DELETE SCOMET] ✓ Declaration found:', {
      id: scomet.id,
      owner: scomet.user_id
    });

    // ============================================
    // STEP 4: VERIFY PERMISSIONS
    // ============================================
    
    // Case 1: Regular user - can only delete their own declarations
    if (!isAdmin) {
      if (scomet.user_id !== userId || currentUserId !== userId) {
        console.log('[DELETE SCOMET] ✗ Unauthorized: User does not own this declaration');
        return NextResponse.json<ErrorResponse>(
          { 
            success: false, 
            error: 'Unauthorized: You do not have permission to delete this SCOMET declaration' 
          },
          { status: 403 }
        );
      }
    }
    
    // Case 2: Admin - can delete declarations of users in same organization
    if (isAdmin) {
      // Verify document owner is in same organization
      const documentOwner = await getUserById(scomet.user_id);
      
      if (!documentOwner || documentOwner.organization_id !== organizationId) {
        console.log('[DELETE SCOMET] ✗ Admin cannot access - outside organization');
        return NextResponse.json<ErrorResponse>(
          { 
            success: false, 
            error: 'Unauthorized: Cannot delete declarations outside your organization' 
          },
          { status: 403 }
        );
      }
      
      console.log('[DELETE SCOMET] ✓ Admin accessing declaration in same organization');
    }

    console.log('[DELETE SCOMET] ✓ Permissions verified');

    // ============================================
    // STEP 5: DELETE DECLARATION
    // ============================================
    console.log('[DELETE SCOMET] Deleting declaration...');
    await deleteSCOMETDeclaration(scometId);
    console.log('[DELETE SCOMET] ✓ Declaration deleted');

    // ============================================
    // STEP 6: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[DELETE SCOMET] ✓ Success');
    console.log(`[DELETE SCOMET] Processing time: ${processingTime}ms`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json<SuccessResponse>({
      success: true,
      message: 'SCOMET declaration deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('═══════════════════════════════════════');
    console.error('[DELETE SCOMET] ✗ Error:', error.message);
    console.error('[DELETE SCOMET] Stack:', error.stack);
    console.error('[DELETE SCOMET] Processing time:', processingTime + 'ms');
    console.error('═══════════════════════════════════════');

    return NextResponse.json<ErrorResponse>(
      { 
        success: false, 
        error: 'Failed to delete SCOMET declaration',
        details: error.message
      },
      { status: 500 }
    );
  }
}