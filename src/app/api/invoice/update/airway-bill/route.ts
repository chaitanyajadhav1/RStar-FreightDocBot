// src/app/api/invoice/update/airway-bill/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAirwayBillById, updateAirwayBill } from '@/lib/database';
import { verifyUserToken, getUserById } from '@/lib/auth';

// ============================================
// INTERFACES
// ============================================
interface UpdateRequestBody {
  airwayBillId: string;
  userId: string;
  updateData: Record<string, any>;
  updateReason?: string;
}

interface ErrorResponse {
  success?: boolean;
  error: string;
  details?: string;
}

// ============================================
// VALIDATION
// ============================================
const ALLOWED_UPDATE_FIELDS = [
  'document_type',
  'airway_bill_no',
  'invoice_no',
  'invoice_date',
  'shippers_name',
  'shippers_address',
  'consignees_name',
  'consignees_address',
  'issuing_carriers_name',
  'issuing_carriers_city',
  'agents_iata_code',
  'airport_of_departure',
  'airport_of_destination',
  'accounting_information',
  'hs_code_no',
  'no_of_pieces',
  'gross_weight',
  'chargeable_weight',
  'nature_of_goods',
  'is_valid',
  'completeness',
  'validation_errors',
  'validation_warnings',
] as const;

function validateUpdateData(updateData: Record<string, any>): {
  isValid: boolean;
  errors: string[];
  filteredData: Record<string, any>;
} {
  const errors: string[] = [];
  const filteredData: Record<string, any> = {};

  if (!updateData || typeof updateData !== 'object') {
    return {
      isValid: false,
      errors: ['Update data must be an object'],
      filteredData: {}
    };
  }

  // Filter and validate fields
  for (const [key, value] of Object.entries(updateData)) {
    if (ALLOWED_UPDATE_FIELDS.includes(key as any)) {
      filteredData[key] = value;
    }
  }

  if (Object.keys(filteredData).length === 0) {
    errors.push('No valid fields to update');
  }

  return {
    isValid: errors.length === 0,
    errors,
    filteredData
  };
}

// ============================================
// DATABASE OPERATIONS
// ============================================
async function performUpdate(
  airwayBillId: string,
  userId: string,
  updateData: Record<string, any>
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Add metadata
    const finalUpdateData = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    console.log('[DB] Updating airway bill:', {
      airwayBillId,
      userId,
      fields: Object.keys(finalUpdateData)
    });

    // Use the new function that finds by airwayBillId and userId
    const updatedAirwayBill = await updateAirwayBill(airwayBillId, userId, finalUpdateData);

    if (!updatedAirwayBill) {
      return { success: false, error: 'Update operation returned null' };
    }

    console.log(`[DB] ✓ Airway bill ${airwayBillId} updated successfully`);
    return { success: true, data: updatedAirwayBill };
  } catch (error: any) {
    console.error('[DB] Update failed:', {
      airwayBillId,
      userId,
      error: error.message,
      code: error.code
    });
    return { success: false, error: error.message };
  }
}

// ============================================
// PUT HANDLER - UPDATE AIRWAY BILL
// ============================================
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Update] Processing airway bill update');
    console.log('═══════════════════════════════════════');

    // Parse request body
    const body: UpdateRequestBody = await request.json();
    const { airwayBillId, userId, updateData, updateReason } = body;

    console.log('[Update] Request:', {
      airwayBillId,
      userId,
      userIdType: typeof userId,
      userIdLength: userId?.length,
      fieldCount: Object.keys(updateData || {}).length,
      reason: updateReason || 'N/A'
    });

    // ============================================
    // STEP 1: VERIFY AUTHENTICATION
    // ============================================
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const tokenData = await verifyUserToken(token);
    
    if (!tokenData) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: Invalid or expired token' },
        { status: 401 }
      );
    }

    const { userId: currentUserId, organizationId } = tokenData;
    const currentUser = await getUserById(currentUserId);
    
    if (!currentUser || !currentUser.is_active) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: User not active' },
        { status: 403 }
      );
    }

    const isAdmin = currentUser.role === 'admin';

    // ============================================
    // STEP 2: VALIDATE REQUEST
    // ============================================
    if (!airwayBillId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Airway Bill ID is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate userId is not empty or undefined string
    if (!userId || userId.trim() === '' || userId === 'undefined' || userId === 'null') {
      return NextResponse.json<ErrorResponse>(
        { error: 'User ID is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Validate update data
    const validation = validateUpdateData(updateData);
    if (!validation.isValid) {
      console.log('[Update] ✗ Validation failed:', validation.errors);
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Invalid update data',
          details: validation.errors.join(', ')
        },
        { status: 400 }
      );
    }

    console.log('[Update] ✓ Validation passed');
    console.log('[Update] Fields to update:', Object.keys(validation.filteredData));

    // ============================================
    // STEP 3: FETCH EXISTING AIRWAY BILL
    // ============================================
    console.log('[Update] Fetching airway bill...');
    let existingAirwayBill;
    
    try {
      existingAirwayBill = await getAirwayBillById(airwayBillId);
    } catch (error: any) {
      console.log('[Update] ✗ Airway bill not found:', error.message);
      return NextResponse.json<ErrorResponse>(
        { error: 'Airway bill not found' },
        { status: 404 }
      );
    }

    if (!existingAirwayBill) {
      console.log('[Update] ✗ Airway bill not found');
      return NextResponse.json<ErrorResponse>(
        { error: 'Airway bill not found' },
        { status: 404 }
      );
    }

    // If not found and current user is admin, verify document owner is in same organization
    if (isAdmin) {
      // The userId in request body is the document owner's userId (member's userId)
      const documentOwner = await getUserById(userId);
      if (!documentOwner) {
        console.log('[Update] ✗ Document owner not found');
        return NextResponse.json<ErrorResponse>(
          { error: 'Document owner not found' },
          { status: 404 }
        );
      }
      
      if (documentOwner.organization_id !== organizationId) {
        console.log('[Update] ✗ Admin cannot access airway bill - outside organization');
        return NextResponse.json<ErrorResponse>(
          { error: 'Airway bill not found or access denied' },
          { status: 404 }
        );
      }
      
      // Verify the airway bill belongs to the specified user
      if (existingAirwayBill.user_id !== userId) {
        console.log('[Update] ✗ Airway bill does not belong to specified user');
        return NextResponse.json<ErrorResponse>(
          { error: 'Airway bill not found or access denied' },
          { status: 404 }
        );
      }
      
      console.log('[Update] ✓ Admin accessing airway bill in same organization');
    }

    console.log('[Update] ✓ Airway bill found:', {
      airway_bill_id: existingAirwayBill.airway_bill_id,
      owner: existingAirwayBill.user_id,
      isAdmin: isAdmin
    });

    // ============================================
    // STEP 4: VERIFY PERMISSIONS
    // ============================================
    // If not admin, verify ownership (userId must match document owner)
    if (!isAdmin && existingAirwayBill.user_id !== userId) {
      console.log('[Update] ✗ Unauthorized: User does not own this airway bill');
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: You do not have permission to update this airway bill' },
        { status: 403 }
      );
    }

    // If admin, verify document owner is in same organization (already checked above)
    console.log('[Update] ✓ Permissions verified');

    // ============================================
    // STEP 5: UPDATE DATABASE
    // ============================================
    // Use the document owner's userId for the update (not the admin's userId)
    const documentOwnerUserId = existingAirwayBill.user_id;
    const dbResult = await performUpdate(airwayBillId, documentOwnerUserId, validation.filteredData);

    if (!dbResult.success) {
      console.log('[Update] ✗ Database update failed:', dbResult.error);
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Failed to update airway bill',
          details: dbResult.error || 'Database update failed'
        },
        { status: 500 }
      );
    }

    console.log('[Update] ✓ Database updated successfully');

    // ============================================
    // STEP 6: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Update] ✓ Airway bill update completed');
    console.log(`[Update] Processing time: ${processingTime}ms`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json({
      success: true,
      data: dbResult.data,
      message: 'Airway bill updated successfully'
    });
  } catch (error: any) {
    console.error('[Update] ✗ Unexpected error:', error);
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}
