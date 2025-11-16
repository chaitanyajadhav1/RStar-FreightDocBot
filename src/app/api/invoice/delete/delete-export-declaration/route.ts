// Route: /api/invoice/delete/delete-export-declaration/route.ts
// ============================================
// DELETE EXPORT DECLARATION
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyUserToken, getUserById } from '@/lib/auth';
import { getExportDeclarationById, deleteExportDeclaration } from '@/lib/database';

// ============================================
// INTERFACES
// ============================================
interface DeleteExportDeclarationRequest {
  declarationId: string;
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
// DELETE HANDLER - DELETE EXPORT DECLARATION
// ============================================
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[DELETE EXPORT DECLARATION] Processing deletion');
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
    console.log('[DELETE EXPORT DECLARATION] Auth:', {
      currentUserId,
      organizationId,
      isAdmin
    });

    // ============================================
    // STEP 2: VALIDATE REQUEST
    // ============================================
    const body: DeleteExportDeclarationRequest = await request.json();
    const { declarationId, userId } = body;

    console.log('[DELETE EXPORT DECLARATION] Request:', { declarationId, userId });

    if (!declarationId) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'Declaration ID is required' },
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
    // STEP 3: FETCH EXPORT DECLARATION
    // ============================================
    console.log('[DELETE EXPORT DECLARATION] Fetching declaration...');
    const declaration = await getExportDeclarationById(declarationId);
    
    if (!declaration) {
      console.log('[DELETE EXPORT DECLARATION] ✗ Declaration not found');
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'Export declaration not found' },
        { status: 404 }
      );
    }

    console.log('[DELETE EXPORT DECLARATION] ✓ Declaration found:', {
      id: declaration.id,
      owner: declaration.user_id
    });

    // ============================================
    // STEP 4: VERIFY PERMISSIONS
    // ============================================
    
    // Case 1: Regular user - can only delete their own declarations
    if (!isAdmin) {
      if (declaration.user_id !== userId || currentUserId !== userId) {
        console.log('[DELETE EXPORT DECLARATION] ✗ Unauthorized: User does not own this declaration');
        return NextResponse.json<ErrorResponse>(
          { 
            success: false, 
            error: 'Unauthorized: You do not have permission to delete this declaration' 
          },
          { status: 403 }
        );
      }
    }
    
    // Case 2: Admin - can delete declarations of users in same organization
    if (isAdmin) {
      // Verify document owner is in same organization
      const documentOwner = await getUserById(declaration.user_id);
      
      if (!documentOwner || documentOwner.organization_id !== organizationId) {
        console.log('[DELETE EXPORT DECLARATION] ✗ Admin cannot access - outside organization');
        return NextResponse.json<ErrorResponse>(
          { 
            success: false, 
            error: 'Unauthorized: Cannot delete declarations outside your organization' 
          },
          { status: 403 }
        );
      }
      
      console.log('[DELETE EXPORT DECLARATION] ✓ Admin accessing declaration in same organization');
    }

    console.log('[DELETE EXPORT DECLARATION] ✓ Permissions verified');

    // ============================================
    // STEP 5: DELETE DECLARATION
    // ============================================
    console.log('[DELETE EXPORT DECLARATION] Deleting declaration...');
    await deleteExportDeclaration(declarationId);
    console.log('[DELETE EXPORT DECLARATION] ✓ Declaration deleted');

    // ============================================
    // STEP 6: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[DELETE EXPORT DECLARATION] ✓ Success');
    console.log(`[DELETE EXPORT DECLARATION] Processing time: ${processingTime}ms`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json<SuccessResponse>({
      success: true,
      message: 'Export declaration deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('═══════════════════════════════════════');
    console.error('[DELETE EXPORT DECLARATION] ✗ Error:', error.message);
    console.error('[DELETE EXPORT DECLARATION] Stack:', error.stack);
    console.error('[DELETE EXPORT DECLARATION] Processing time:', processingTime + 'ms');
    console.error('═══════════════════════════════════════');

    return NextResponse.json<ErrorResponse>(
      { 
        success: false, 
        error: 'Failed to delete export declaration',
        details: error.message
      },
      { status: 500 }
    );
  }
}