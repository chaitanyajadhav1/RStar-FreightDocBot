// src/app/api/invoice/update/export-declaration/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getExportDeclarationById, updateExportDeclaration } from '@/lib/database';
import { redis } from '@/lib/config';

// ============================================
// CONFIGURATION
// ============================================
const ALLOWED_UPDATE_FIELDS = [
  // Basic Declaration Info
  'declaration_no',
  'declaration_date',
  'declaration_type',
  'filename',
  'status',
  'reference_no',
  
  // Exporter Information
  'exporter_name',
  'exporter_address',
  'exporter_gstin',
  'exporter_iec',
  'exporter_pan',
  'exporter_email',
  'exporter_phone',
  'exporter_state',
  'exporter_city',
  'exporter_pincode',
  
  // Consignee/Buyer Information
  'consignee_name',
  'consignee_address',
  'consignee_country',
  'consignee_city',
  'consignee_email',
  'consignee_phone',
  
  // Shipping Details
  'port_of_loading',
  'port_of_discharge',
  'country_of_destination',
  'country_of_final_destination',
  'mode_of_shipment',
  'vessel_name',
  'shipping_bill_no',
  'shipping_bill_date',
  'container_no',
  'seal_no',
  
  // Financial Details
  'fob_value',
  'freight_value',
  'insurance_value',
  'total_invoice_value',
  'currency',
  'exchange_rate',
  'inr_value',
  
  // Customs Details
  'customs_office',
  'customs_officer',
  'customs_stamp',
  'let_export_order_no',
  'let_export_order_date',
  'duty_drawback_claim',
  'rodtep_claim',
  'meis_claim',
  
  // Product Details
  'items',
  'item_count',
  'total_quantity',
  'total_weight',
  'net_weight',
  'gross_weight',
  'packaging_type',
  'no_of_packages',
  
  // HSN and Classification
  'hsn_code',
  'export_product_description',
  'statistical_code',
  
  // Bank Details
  'bank_name',
  'bank_account',
  'bank_swift_code',
  'bank_ad_code',
  
  // Validation
  'is_valid',
  'completeness',
  'validation_errors',
  'validation_warnings',
  
  // Certification & Compliance
  'certificate_of_origin',
  'phytosanitary_certificate',
  'quality_certificate',
  'has_signature',
  'verification_status',
  'verification_data',
  'verification_notes'
] as const;

// ============================================
// INTERFACES
// ============================================
interface UpdateRequestBody {
  declarationId: string;
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
      if ((key.includes('_date') || key === 'declaration_date') && value) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          errors.push(`Invalid date format for ${key}. Expected YYYY-MM-DD`);
          continue;
        }
      }

      // Numeric field validation
      if ((key.includes('_value') || key.includes('_quantity') || key.includes('_weight')) 
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
      if ((key === 'is_valid' || key.includes('_claim') || key.includes('_certificate') || key === 'customs_stamp') 
          && value !== null && typeof value !== 'boolean') {
        errors.push(`Invalid ${key}: must be a boolean`);
        continue;
      }

      // Mode of shipment validation
      if (key === 'mode_of_shipment' && value) {
        const validModes = ['Sea', 'Air', 'Road', 'Rail', 'Courier', 'Post'];
        if (!validModes.includes(value)) {
          errors.push(`Invalid mode_of_shipment: must be one of ${validModes.join(', ')}`);
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

function validateDeclarationOwnership(declaration: any, userId: string): boolean {
  return declaration.user_id === userId;
}

// ============================================
// REDIS CACHE OPERATIONS
// ============================================
async function updateRedisCache(
  declarationId: string,
  updateData: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const redisKey = `export_declaration:${declarationId}`;
    const exists = await redis.exists(redisKey);

    if (!exists) {
      console.log('[Redis] Export declaration not in cache, skipping update');
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
    console.log(`[Redis] ✓ Updated cache for ${declarationId}`);

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
  declarationId: string,
  updateData: Record<string, any>,
  userId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Add metadata
    const finalUpdateData = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    console.log('[DB] Updating export declaration:', {
      declarationId,
      fields: Object.keys(finalUpdateData),
      userId
    });

    const updatedDeclaration = await updateExportDeclaration(declarationId, finalUpdateData as any);

    if (!updatedDeclaration) {
      return { success: false, error: 'Update operation returned null' };
    }

    console.log(`[DB] ✓ Export declaration ${declarationId} updated successfully`);
    return { success: true, data: updatedDeclaration };
  } catch (error: any) {
    console.error('[DB] Update failed:', {
      declarationId,
      error: error.message,
      code: error.code
    });
    return { success: false, error: error.message };
  }
}

// ============================================
// PUT/PATCH HANDLER - UPDATE EXPORT DECLARATION
// ============================================
export async function PUT(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Update] Processing export declaration update');
    console.log('═══════════════════════════════════════');

    // Parse request body
    const body: UpdateRequestBody = await request.json();
    const { declarationId, userId, updateData, updateReason } = body;

    console.log('[Update] Request:', {
      declarationId,
      userId,
      fieldCount: Object.keys(updateData || {}).length,
      reason: updateReason || 'N/A'
    });

    // ============================================
    // STEP 1: VALIDATE REQUEST
    // ============================================
    if (!declarationId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Declaration ID is required' },
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
    // STEP 2: FETCH EXISTING DECLARATION
    // ============================================
    console.log('[Update] Fetching export declaration...');
    const existingDeclaration = await getExportDeclarationById(declarationId);

    if (!existingDeclaration) {
      console.log('[Update] ✗ Export declaration not found');
      return NextResponse.json<ErrorResponse>(
        { error: 'Export declaration not found' },
        { status: 404 }
      );
    }

    console.log('[Update] ✓ Export declaration found:', {
      declaration_no: existingDeclaration.declaration_no,
      owner: existingDeclaration.user_id
    });

    // ============================================
    // STEP 3: VERIFY OWNERSHIP
    // ============================================
    if (!validateDeclarationOwnership(existingDeclaration, userId)) {
      console.log('[Update] ✗ Unauthorized access attempt');
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: You do not have permission to update this export declaration' },
        { status: 403 }
      );
    }

    console.log('[Update] ✓ Ownership verified');

    // ============================================
    // STEP 4: UPDATE DATABASE
    // ============================================
    const dbResult = await performUpdate(declarationId, validation.filteredData, userId);

    if (!dbResult.success) {
      console.log('[Update] ✗ Database update failed');
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Failed to update export declaration',
          details: dbResult.error
        },
        { status: 500 }
      );
    }

    // ============================================
    // STEP 5: UPDATE REDIS CACHE
    // ============================================
    const cacheResult = await updateRedisCache(declarationId, validation.filteredData);
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
      message: 'Export declaration updated successfully',
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
        error: 'Failed to update export declaration',
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
// GET HANDLER - RETRIEVE EXPORT DECLARATION
// ============================================
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Get] Retrieving export declaration');
    console.log('═══════════════════════════════════════');

    const searchParams = request.nextUrl.searchParams;
    const declarationId = searchParams.get('declarationId');
    const userId = searchParams.get('userId');

    console.log('[Get] Request:', { declarationId, userId });

    // ============================================
    // STEP 1: VALIDATE PARAMETERS
    // ============================================
    if (!declarationId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Declaration ID is required' },
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
      const redisKey = `export_declaration:${declarationId}`;
      const cachedData = await redis.hgetall(redisKey);

      if (cachedData && Object.keys(cachedData).length > 0) {
        console.log('[Get] ✓ Found in Redis cache');

        // Verify ownership
        if (cachedData.user_id !== userId) {
          console.log('[Get] ✗ Unauthorized cache access');
          return NextResponse.json<ErrorResponse>(
            { error: 'Unauthorized: You do not have permission to view this export declaration' },
            { status: 403 }
          );
        }

        // Parse JSON fields
        const declaration = { ...cachedData };
        const jsonFields = ['items', 'validation_errors', 'validation_warnings', 'verification_data'];
        for (const field of jsonFields) {
          if (declaration[field]) {
            try {
              declaration[field] = JSON.parse(declaration[field]);
            } catch (e) {
              console.warn(`[Get] Failed to parse ${field} from cache`);
            }
          }
        }

        const processingTime = Date.now() - startTime;
        console.log(`[Get] ✓ Returned from cache (${processingTime}ms)`);

        return NextResponse.json({
          success: true,
          data: declaration,
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
    const declaration = await getExportDeclarationById(declarationId);

    if (!declaration) {
      console.log('[Get] ✗ Export declaration not found');
      return NextResponse.json<ErrorResponse>(
        { error: 'Export declaration not found' },
        { status: 404 }
      );
    }

    console.log('[Get] ✓ Export declaration found:', {
      declaration_no: declaration.declaration_no,
      owner: declaration.user_id
    });

    // ============================================
    // STEP 4: VERIFY OWNERSHIP
    // ============================================
    if (!validateDeclarationOwnership(declaration, userId)) {
      console.log('[Get] ✗ Unauthorized access attempt');
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: You do not have permission to view this export declaration' },
        { status: 403 }
      );
    }

    // ============================================
    // STEP 5: UPDATE CACHE FOR FUTURE REQUESTS
    // ============================================
    try {
      const redisKey = `export_declaration:${declarationId}`;
      const cacheData: Record<string, any> = { ...declaration };

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
      console.warn('[Get] Failed to cache export declaration:', cacheError);
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
      data: declaration,
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
        error: 'Failed to fetch export declaration',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE HANDLER - SOFT DELETE EXPORT DECLARATION
// ============================================
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Delete] Processing export declaration deletion');
    console.log('═══════════════════════════════════════');

    const searchParams = request.nextUrl.searchParams;
    const declarationId = searchParams.get('declarationId');
    const userId = searchParams.get('userId');

    console.log('[Delete] Request:', { declarationId, userId });

    // Validate parameters
    if (!declarationId || !userId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Declaration ID and User ID are required' },
        { status: 400 }
      );
    }

    // Fetch and verify ownership
    const declaration = await getExportDeclarationById(declarationId);
    if (!declaration) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Export declaration not found' },
        { status: 404 }
      );
    }

    if (!validateDeclarationOwnership(declaration, userId)) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: You do not have permission to delete this export declaration' },
        { status: 403 }
      );
    }

    // Soft delete: update status to 'deleted'
    const result = await performUpdate(declarationId, {
      status: 'deleted',
      deleted_at: new Date().toISOString()
    }, userId);

    if (!result.success) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Failed to delete export declaration', details: result.error },
        { status: 500 }
      );
    }

    // Remove from Redis cache
    try {
      await redis.del(`export_declaration:${declarationId}`);
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
      message: 'Export declaration deleted successfully',
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
        error: 'Failed to delete export declaration',
        details: error.message
      },
      { status: 500 }
    );
  }
}