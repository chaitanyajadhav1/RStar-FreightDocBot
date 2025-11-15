// Route: /api/invoice/delete/delete-fumigation-certificate/route.ts
// ============================================
// DELETE FUMIGATION CERTIFICATE
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyUserToken, getUserById } from '@/lib/auth';
import { getFumigationCertificateById, deleteFumigationCertificate } from '@/lib/database';

// ============================================
// INTERFACES
// ============================================
interface DeleteFumigationRequest {
  certificateId: string;
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
// DELETE HANDLER - DELETE FUMIGATION CERTIFICATE
// ============================================
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[DELETE FUMIGATION] Processing deletion');
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
    console.log('[DELETE FUMIGATION] Auth:', {
      currentUserId,
      organizationId,
      isAdmin
    });

    // ============================================
    // STEP 2: VALIDATE REQUEST
    // ============================================
    const body: DeleteFumigationRequest = await request.json();
    const { certificateId, userId } = body;

    console.log('[DELETE FUMIGATION] Request:', { certificateId, userId });

    if (!certificateId) {
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'Certificate ID is required' },
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
    // STEP 3: FETCH FUMIGATION CERTIFICATE
    // ============================================
    console.log('[DELETE FUMIGATION] Fetching certificate...');
    const certificate = await getFumigationCertificateById(certificateId);
    
    if (!certificate) {
      console.log('[DELETE FUMIGATION] ✗ Certificate not found');
      return NextResponse.json<ErrorResponse>(
        { success: false, error: 'Fumigation certificate not found' },
        { status: 404 }
      );
    }

    console.log('[DELETE FUMIGATION] ✓ Certificate found:', {
      id: certificate.id,
      owner: certificate.user_id
    });

    // ============================================
    // STEP 4: VERIFY PERMISSIONS
    // ============================================
    
    // Case 1: Regular user - can only delete their own certificates
    if (!isAdmin) {
      if (certificate.user_id !== userId || currentUserId !== userId) {
        console.log('[DELETE FUMIGATION] ✗ Unauthorized: User does not own this certificate');
        return NextResponse.json<ErrorResponse>(
          { 
            success: false, 
            error: 'Unauthorized: You do not have permission to delete this certificate' 
          },
          { status: 403 }
        );
      }
    }
    
    // Case 2: Admin - can delete certificates of users in same organization
    if (isAdmin) {
      // Verify document owner is in same organization
      const documentOwner = await getUserById(certificate.user_id);
      
      if (!documentOwner || documentOwner.organization_id !== organizationId) {
        console.log('[DELETE FUMIGATION] ✗ Admin cannot access - outside organization');
        return NextResponse.json<ErrorResponse>(
          { 
            success: false, 
            error: 'Unauthorized: Cannot delete certificates outside your organization' 
          },
          { status: 403 }
        );
      }
      
      console.log('[DELETE FUMIGATION] ✓ Admin accessing certificate in same organization');
    }

    console.log('[DELETE FUMIGATION] ✓ Permissions verified');

    // ============================================
    // STEP 5: DELETE CERTIFICATE
    // ============================================
    console.log('[DELETE FUMIGATION] Deleting certificate...');
    await deleteFumigationCertificate(certificateId);
    console.log('[DELETE FUMIGATION] ✓ Certificate deleted');

    // ============================================
    // STEP 6: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[DELETE FUMIGATION] ✓ Success');
    console.log(`[DELETE FUMIGATION] Processing time: ${processingTime}ms`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json<SuccessResponse>({
      success: true,
      message: 'Fumigation certificate deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('═══════════════════════════════════════');
    console.error('[DELETE FUMIGATION] ✗ Error:', error.message);
    console.error('[DELETE FUMIGATION] Stack:', error.stack);
    console.error('[DELETE FUMIGATION] Processing time:', processingTime + 'ms');
    console.error('═══════════════════════════════════════');

    return NextResponse.json<ErrorResponse>(
      { 
        success: false, 
        error: 'Failed to delete fumigation certificate',
        details: error.message
      },
      { status: 500 }
    );
  }
}