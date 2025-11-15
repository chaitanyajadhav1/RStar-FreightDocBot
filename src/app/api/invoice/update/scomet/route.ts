// src/app/api/invoice/update/scomet/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSCOMETDeclarationById, updateSCOMETDeclaration } from '@/lib/database';
import { redis } from '@/lib/config';

// ============================================
// CONFIGURATION
// ============================================
const ALLOWED_UPDATE_FIELDS = [
  // Basic SCOMET Info
  'scomet_no',
  'scomet_date',
  'application_no',
  'application_date',
  'filename',
  'status',
  'reference_no',
  
  // Applicant/Exporter Information
  'applicant_name',
  'applicant_address',
  'applicant_iec',
  'applicant_pan',
  'applicant_gstin',
  'applicant_email',
  'applicant_phone',
  'applicant_contact_person',
  
  // End User Information
  'end_user_name',
  'end_user_address',
  'end_user_country',
  'end_user_type',
  'end_user_certificate',
  'end_user_undertaking',
  
  // Consignee Information
  'consignee_name',
  'consignee_address',
  'consignee_country',
  'consignee_relationship',
  
  // Product Classification
  'scomet_category',
  'scomet_item_no',
  'product_description',
  'technical_specifications',
  'end_use_purpose',
  'dual_use_classification',
  
  // License Details
  'license_type',
  'license_no',
  'license_date',
  'license_validity',
  'authorized_quantity',
  'authorized_value',
  'utilized_quantity',
  'utilized_value',
  'balance_quantity',
  'balance_value',
  
  // Items and Quantities
  'items',
  'item_count',
  'total_quantity',
  'quantity_unit',
  'total_value',
  'currency',
  
  // Export Details
  'country_of_origin',
  'country_of_destination',
  'port_of_export',
  'intended_use',
  'installation_location',
  
  // Regulatory Compliance
  'dgft_approval',
  'dgft_approval_no',
  'dgft_approval_date',
  'atomic_energy_clearance',
  'space_commission_clearance',
  'ministry_clearance',
  'clearance_reference_no',
  
  // Technical Details
  'technical_parameters',
  'performance_characteristics',
  'manufacturing_details',
  'technology_transfer',
  
  // Declaration & Undertaking
  'non_diversion_clause',
  'end_use_certificate_required',
  'post_shipment_verification',
  'undertaking_given',
  'undertaking_date',
  
  // Validation
  'is_valid',
  'completeness',
  'validation_errors',
  'validation_warnings',
  
  // Verification
  'has_signature',
  'verification_status',
  'verification_data',
  'verification_notes',
  
  // Additional Fields
  'remarks',
  'special_conditions',
  'transit_countries',
  'export_control_classification'
] as const;

// ============================================
// INTERFACES
// ============================================
interface UpdateRequestBody {
  scometId: string;
  userId: string;
  updateData: Record<string, any>;
  updateReason?: string;
}

interface UpdateResponse {
  success: boolean;
  message: string;
  data?: any;
  updatedFields?: string[];
  timestamp?: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
  code?: string;
}

// ============================================
// VALIDATION HELPERS
// ============================================
function validateUpdateData(updateData: Record<string, any>): {
  isValid: boolean;
  errors: string[];
  filteredData: Record<string, any>;
} {
  const errors: string[] = [];
  const filteredData: Record<string, any> = {};

  // Check if updateData is empty
  if (!updateData || Object.keys(updateData).length === 0) {
    errors.push('Update data cannot be empty');
    return { isValid: false, errors, filteredData };
  }

  // Filter and validate each field
  for (const [key, value] of Object.entries(updateData)) {
    if (ALLOWED_UPDATE_FIELDS.includes(key as any)) {
      // Date validation
      if ((key.includes('_date') || key === 'scomet_date' || key === 'application_date') && value) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          errors.push(`Invalid date format for ${key}. Expected YYYY-MM-DD`);
          continue;
        }
      }

      // Numeric field validation
      if ((key.includes('_value') || key.includes('_quantity')) 
          && value !== null && value !== undefined) {
        const amount = Number(value);
        if (isNaN(amount) || amount < 0) {
          errors.push(`Invalid ${key}: must be a positive number`);
          continue;
        }
      }

      // Completeness validation
      if (key === 'completeness' && value !== null && value !== undefined) {
        const completeness = Number(value);
        if (isNaN(completeness) || completeness < 0 || completeness > 100) {
          errors.push(`Invalid completeness: must be between 0 and 100`);
          continue;
        }
      }

      // Boolean validation
      if ((key === 'is_valid' || key.includes('_clearance') || key.includes('_given') 
           || key.includes('_required') || key.includes('_verification') || key === 'dgft_approval'
           || key === 'technology_transfer' || key === 'non_diversion_clause') 
          && value !== null && typeof value !== 'boolean') {
        errors.push(`Invalid ${key}: must be a boolean`);
        continue;
      }

      // SCOMET Category validation
      if (key === 'scomet_category' && value) {
        const validCategories = [
          'Category 0', 'Category 1', 'Category 2', 'Category 3', 
          'Category 4', 'Category 5', 'Category 6', 'Category 7', 
          'Category 8', 'Category 9'
        ];
        if (!validCategories.includes(value)) {
          errors.push(`Invalid scomet_category: must be one of ${validCategories.join(', ')}`);
          continue;
        }
      }

      // License Type validation
      if (key === 'license_type' && value) {
        const validTypes = ['General', 'Specific', 'Deemed Export', 'CKD/SKD'];
        if (!validTypes.includes(value)) {
          errors.push(`Invalid license_type: must be one of ${validTypes.join(', ')}`);
          continue;
        }
      }

      // End User Type validation
      if (key === 'end_user_type' && value) {
        const validTypes = ['Government', 'Private', 'Research', 'Educational', 'Military', 'Other'];
        if (!validTypes.includes(value)) {
          errors.push(`Invalid end_user_type: must be one of ${validTypes.join(', ')}`);
          continue;
        }
      }

      filteredData[key] = value;
    } else {
      console.warn(`[Update] Ignoring unknown field: ${key}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    filteredData
  };
}

function validateSCOMETOwnership(scomet: any, userId: string): boolean {
  return scomet.user_id === userId;
}

// ============================================
// REDIS CACHE OPERATIONS
// ============================================
async function updateRedisCache(
  scometId: string,
  updateData: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const redisKey = `scomet:${scometId}`;
    const exists = await redis.exists(redisKey);

    if (!exists) {
      console.log('[Redis] SCOMET declaration not in cache, skipping update');
      return { success: true };
    }

    // Convert complex types to JSON strings for Redis
    const redisData: Record<string, any> = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (value === null || value === undefined) {
        redisData[key] = '';
      } else if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
        redisData[key] = JSON.stringify(value);
      } else {
        redisData[key] = String(value);
      }
    }

    // Update updated_at timestamp
    redisData.updated_at = new Date().toISOString();

    await redis.hset(redisKey, redisData);
    console.log(`[Redis] ✓ Updated cache for ${scometId}`);

    return { success: true };
  } catch (error: any) {
    console.error('[Redis] Cache update failed:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// DATABASE OPERATIONS
// ============================================
async function performUpdate(
  scometId: string,
  updateData: Record<string, any>,
  userId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Add metadata
    const finalUpdateData = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    console.log('[DB] Updating SCOMET declaration:', {
      scometId,
      fields: Object.keys(finalUpdateData),
      userId
    });

    const updatedSCOMET = await updateSCOMETDeclaration(scometId, finalUpdateData as any);

    if (!updatedSCOMET) {
      return { success: false, error: 'Update operation returned null' };
    }

    console.log(`[DB] ✓ SCOMET declaration ${scometId} updated successfully`);
    return { success: true, data: updatedSCOMET };
  } catch (error: any) {
    console.error('[DB] Update failed:', {
      scometId,
      error: error.message,
      code: error.code
    });
    return { success: false, error: error.message };
  }
}

// ============================================
// PUT/PATCH HANDLER - UPDATE SCOMET
// ============================================
export async function PUT(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Update] Processing SCOMET declaration update');
    console.log('═══════════════════════════════════════');

    // Parse request body
    const body: UpdateRequestBody = await request.json();
    const { scometId, userId, updateData, updateReason } = body;

    console.log('[Update] Request:', {
      scometId,
      userId,
      fieldCount: Object.keys(updateData || {}).length,
      reason: updateReason || 'N/A'
    });

    // ============================================
    // STEP 1: VALIDATE REQUEST
    // ============================================
    if (!scometId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'SCOMET ID is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'User ID is required' },
        { status: 401 }
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
    // STEP 2: FETCH EXISTING SCOMET DECLARATION
    // ============================================
    console.log('[Update] Fetching SCOMET declaration...');
    const existingSCOMET = await getSCOMETDeclarationById(scometId);

    if (!existingSCOMET) {
      console.log('[Update] ✗ SCOMET declaration not found');
      return NextResponse.json<ErrorResponse>(
        { error: 'SCOMET declaration not found' },
        { status: 404 }
      );
    }

    console.log('[Update] ✓ SCOMET declaration found:', {
      scomet_no: existingSCOMET.scomet_no,
      owner: existingSCOMET.user_id
    });

    // ============================================
    // STEP 3: VERIFY OWNERSHIP
    // ============================================
    if (!validateSCOMETOwnership(existingSCOMET, userId)) {
      console.log('[Update] ✗ Unauthorized access attempt');
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: You do not have permission to update this SCOMET declaration' },
        { status: 403 }
      );
    }

    console.log('[Update] ✓ Ownership verified');

    // ============================================
    // STEP 4: UPDATE DATABASE
    // ============================================
    const dbResult = await performUpdate(scometId, validation.filteredData, userId);

    if (!dbResult.success) {
      console.log('[Update] ✗ Database update failed');
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Failed to update SCOMET declaration',
          details: dbResult.error
        },
        { status: 500 }
      );
    }

    // ============================================
    // STEP 5: UPDATE REDIS CACHE
    // ============================================
    const cacheResult = await updateRedisCache(scometId, validation.filteredData);
    if (!cacheResult.success) {
      console.warn('[Update] ⚠️  Cache update failed, but continuing...');
    }

    // ============================================
    // STEP 6: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Update] ✓ Success');
    console.log(`[Update] Processing time: ${processingTime}ms`);
    console.log(`[Update] Updated fields: ${Object.keys(validation.filteredData).length}`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json<UpdateResponse>({
      success: true,
      message: 'SCOMET declaration updated successfully',
      data: dbResult.data,
      updatedFields: Object.keys(validation.filteredData),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('═══════════════════════════════════════');
    console.error('[Update] ✗ Error:', error.message);
    console.error('[Update] Processing time:', processingTime + 'ms');
    console.error('═══════════════════════════════════════');

    return NextResponse.json<ErrorResponse>(
      {
        error: 'Failed to update SCOMET declaration',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH HANDLER - ALIAS FOR PUT
// ============================================
export async function PATCH(request: NextRequest) {
  return PUT(request);
}

// ============================================
// GET HANDLER - RETRIEVE SCOMET DECLARATION
// ============================================
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Get] Retrieving SCOMET declaration');
    console.log('═══════════════════════════════════════');

    const searchParams = request.nextUrl.searchParams;
    const scometId = searchParams.get('scometId');
    const userId = searchParams.get('userId');

    console.log('[Get] Request:', { scometId, userId });

    // ============================================
    // STEP 1: VALIDATE PARAMETERS
    // ============================================
    if (!scometId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'SCOMET ID is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    // ============================================
    // STEP 2: TRY REDIS CACHE FIRST
    // ============================================
    try {
      const redisKey = `scomet:${scometId}`;
      const cachedData = await redis.hgetall(redisKey);

      if (cachedData && Object.keys(cachedData).length > 0) {
        console.log('[Get] ✓ Found in Redis cache');

        // Verify ownership
        if (cachedData.user_id !== userId) {
          console.log('[Get] ✗ Unauthorized cache access');
          return NextResponse.json<ErrorResponse>(
            { error: 'Unauthorized: You do not have permission to view this SCOMET declaration' },
            { status: 403 }
          );
        }

        // Parse JSON fields
        const scomet = { ...cachedData };
        const jsonFields = [
          'items', 'validation_errors', 'validation_warnings', 
          'technical_parameters', 'performance_characteristics',
          'manufacturing_details', 'verification_data', 'transit_countries'
        ];
        for (const field of jsonFields) {
          if (scomet[field]) {
            try {
              scomet[field] = JSON.parse(scomet[field]);
            } catch (e) {
              console.warn(`[Get] Failed to parse ${field} from cache`);
            }
          }
        }

        const processingTime = Date.now() - startTime;
        console.log(`[Get] ✓ Returned from cache (${processingTime}ms)`);

        return NextResponse.json({
          success: true,
          data: scomet,
          source: 'cache'
        });
      }
    } catch (redisError) {
      console.warn('[Get] Redis error, falling back to database:', redisError);
    }

    // ============================================
    // STEP 3: FETCH FROM DATABASE
    // ============================================
    console.log('[Get] Fetching from database...');
    const scomet = await getSCOMETDeclarationById(scometId);

    if (!scomet) {
      console.log('[Get] ✗ SCOMET declaration not found');
      return NextResponse.json<ErrorResponse>(
        { error: 'SCOMET declaration not found' },
        { status: 404 }
      );
    }

    console.log('[Get] ✓ SCOMET declaration found:', {
      scomet_no: scomet.scomet_no,
      owner: scomet.user_id
    });

    // ============================================
    // STEP 4: VERIFY OWNERSHIP
    // ============================================
    if (!validateSCOMETOwnership(scomet, userId)) {
      console.log('[Get] ✗ Unauthorized access attempt');
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: You do not have permission to view this SCOMET declaration' },
        { status: 403 }
      );
    }

    // ============================================
    // STEP 5: UPDATE CACHE FOR FUTURE REQUESTS
    // ============================================
    try {
      const redisKey = `scomet:${scometId}`;
      const cacheData: Record<string, any> = { ...scomet };

      // Convert arrays/objects to JSON strings
      for (const [key, value] of Object.entries(cacheData)) {
        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
          cacheData[key] = JSON.stringify(value);
        }
      }

      await redis.hset(redisKey, cacheData);
      await redis.expire(redisKey, 86400); // 24 hours
      console.log('[Get] ✓ Cached for future requests');
    } catch (cacheError) {
      console.warn('[Get] Failed to cache SCOMET declaration:', cacheError);
    }

    // ============================================
    // STEP 6: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Get] ✓ Success');
    console.log(`[Get] Processing time: ${processingTime}ms`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json({
      success: true,
      data: scomet,
      source: 'database'
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('═══════════════════════════════════════');
    console.error('[Get] ✗ Error:', error.message);
    console.error('[Get] Processing time:', processingTime + 'ms');
    console.error('═══════════════════════════════════════');

    return NextResponse.json<ErrorResponse>(
      {
        error: 'Failed to fetch SCOMET declaration',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE HANDLER - SOFT DELETE SCOMET DECLARATION
// ============================================
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Delete] Processing SCOMET declaration deletion');
    console.log('═══════════════════════════════════════');

    const searchParams = request.nextUrl.searchParams;
    const scometId = searchParams.get('scometId');
    const userId = searchParams.get('userId');

    console.log('[Delete] Request:', { scometId, userId });

    // Validate parameters
    if (!scometId || !userId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'SCOMET ID and User ID are required' },
        { status: 400 }
      );
    }

    // Fetch and verify ownership
    const scomet = await getSCOMETDeclarationById(scometId);
    if (!scomet) {
      return NextResponse.json<ErrorResponse>(
        { error: 'SCOMET declaration not found' },
        { status: 404 }
      );
    }

    if (!validateSCOMETOwnership(scomet, userId)) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: You do not have permission to delete this SCOMET declaration' },
        { status: 403 }
      );
    }

    // Soft delete: update status to 'deleted'
    const result = await performUpdate(scometId, {
      status: 'deleted',
      deleted_at: new Date().toISOString()
    }, userId);

    if (!result.success) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Failed to delete SCOMET declaration', details: result.error },
        { status: 500 }
      );
    }

    // Remove from Redis cache
    try {
      await redis.del(`scomet:${scometId}`);
      console.log('[Delete] ✓ Removed from cache');
    } catch (cacheError) {
      console.warn('[Delete] Failed to remove from cache:', cacheError);
    }

    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Delete] ✓ Success');
    console.log(`[Delete] Processing time: ${processingTime}ms`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json<UpdateResponse>({
      success: true,
      message: 'SCOMET declaration deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('═══════════════════════════════════════');
    console.error('[Delete] ✗ Error:', error.message);
    console.error('[Delete] Processing time:', processingTime + 'ms');
    console.error('═══════════════════════════════════════');

    return NextResponse.json<ErrorResponse>(
      {
        error: 'Failed to delete SCOMET declaration',
        details: error.message
      },
      { status: 500 }
    );
  }
}