// src/app/api/invoice/update/packinglist/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getPackingListById, updatePackingList } from '@/lib/database';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for cache operations
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// CONFIGURATION
// ============================================
const ALLOWED_UPDATE_FIELDS = [
  // Core fields
  'packing_list_number',
  'packing_list_date',
  'reference_no',
  'proforma_invoice_no',
  'filename',
  'status',
  
  // Exporter details
  'exporter_name',
  'exporter_address',
  'exporter_email',
  'exporter_phone',
  'exporter_mobile',
  'exporter_pan',
  'exporter_gstin',
  'exporter_iec',
  
  // Consignee details
  'consignee_name',
  'consignee_address',
  'consignee_email',
  'consignee_phone',
  'consignee_mobile',
  'consignee_po_box',
  
  // Bank details
  'bank_name',
  'bank_address',
  'bank_account_usd',
  'bank_account_euro',
  'bank_ifsc_code',
  'bank_swift_code',
  'bank_branch_code',
  'bank_ad_code',
  'bank_bsr_code',
  
  // Shipment details
  'marks_and_nos',
  'country_of_origin',
  'country_of_destination',
  'pre_carriage_by',
  'place_of_receipt',
  'delivery_terms',
  'hsn_code',
  'vessel_flight_no',
  'port_of_loading',
  'port_of_discharge',
  'final_destination',
  'freight_terms',
  
  // Invoice reference
  'invoice_number',
  'invoice_date',
  
  // Box details
  'box_details',
  'total_boxes',
  'total_gross_weight',
  'total_net_weight',
  'total_box_weight',
  'package_type',
  
  // Additional fields
  'description_of_goods',
  'certification_statement',
  
  // Validation
  'is_valid',
  'completeness',
  'validation_errors',
  'validation_warnings',
  'invoice_match_verified',
  'amounts_match_verified'
] as const;

// ============================================
// INTERFACES
// ============================================
interface BoxDetail {
  boxNumber: string | null;
  size: string | null;
  grossWeight: string | null;
  boxWeight: string | null;
  netWeight: string | null;
  contents: string | null;
}

interface UpdateRequestBody {
  packingListId: string;
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
      if (key.includes('_date') && value) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          errors.push(`Invalid date format for ${key}. Expected YYYY-MM-DD`);
          continue;
        }
      }

      // Email validation
      if (key.includes('_email') && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push(`Invalid email format for ${key}`);
          continue;
        }
      }

      // Numeric field validation
      if (key === 'total_boxes' && value !== null && value !== undefined) {
        const boxes = Number(value);
        if (isNaN(boxes) || boxes < 0 || !Number.isInteger(boxes)) {
          errors.push('Invalid total_boxes: must be a non-negative integer');
          continue;
        }
      }

      // Weight validation
      if ((key === 'total_gross_weight' || key === 'total_net_weight' || key === 'total_box_weight') 
          && value !== null && value !== undefined && value !== '') {
        // Allow string format like "100 KG" or numeric
        const weightStr = String(value).trim();
        if (weightStr && !/^[\d.]+\s*(kg|KG|kgs|KGS|g|G|gms|GMS|lbs|LBS)?$/i.test(weightStr)) {
          errors.push(`Invalid ${key}: must be a number optionally followed by weight unit`);
          continue;
        }
      }

      // Completeness validation
      if (key === 'completeness' && value !== null && value !== undefined) {
        const completeness = Number(value);
        if (isNaN(completeness) || completeness < 0 || completeness > 100) {
          errors.push('Invalid completeness: must be between 0 and 100');
          continue;
        }
      }

      // Boolean validation
      if ((key === 'is_valid' || key === 'invoice_match_verified' || key === 'amounts_match_verified') 
          && value !== null && typeof value !== 'boolean') {
        errors.push(`Invalid ${key}: must be a boolean`);
        continue;
      }

      // Status validation
      if (key === 'status' && value) {
        const validStatuses = ['valid', 'invalid', 'pending', 'deleted', 'processed'];
        if (!validStatuses.includes(value)) {
          errors.push(`Invalid status: must be one of ${validStatuses.join(', ')}`);
          continue;
        }
      }

      // Box details validation
      if (key === 'box_details' && value) {
        try {
          let boxDetails: BoxDetail[];
          
          // Parse if string
          if (typeof value === 'string') {
            boxDetails = JSON.parse(value);
          } else {
            boxDetails = value;
          }

          // Validate array
          if (!Array.isArray(boxDetails)) {
            errors.push('box_details must be an array');
            continue;
          }

          // Validate each box
          for (let i = 0; i < boxDetails.length; i++) {
            const box = boxDetails[i];
            if (typeof box !== 'object' || box === null) {
              errors.push(`box_details[${i}]: must be an object`);
              continue;
            }

            // Check required structure
            const validKeys = ['boxNumber', 'size', 'grossWeight', 'boxWeight', 'netWeight', 'contents'];
            const boxKeys = Object.keys(box);
            const invalidKeys = boxKeys.filter(k => !validKeys.includes(k));
            
            if (invalidKeys.length > 0) {
              errors.push(`box_details[${i}]: contains invalid keys: ${invalidKeys.join(', ')}`);
            }
          }

          // Store as JSON string for database
          filteredData[key] = JSON.stringify(boxDetails);
          continue;
        } catch (e) {
          errors.push('box_details: invalid JSON format');
          continue;
        }
      }

      // Arrays validation (errors, warnings)
      if ((key === 'validation_errors' || key === 'validation_warnings') && value) {
        if (!Array.isArray(value)) {
          errors.push(`${key} must be an array`);
          continue;
        }
        // Store as JSON string
        filteredData[key] = JSON.stringify(value);
        continue;
      }

      // String length validation for text fields
      if (typeof value === 'string' && value.length > 5000) {
        errors.push(`${key} exceeds maximum length of 5000 characters`);
        continue;
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

function validatePackingListOwnership(packingList: any, userId: string): boolean {
  return packingList.user_id === userId;
}

// ============================================
// DATABASE OPERATIONS
// ============================================
async function performUpdate(
  packingListId: string,
  updateData: Record<string, any>,
  userId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Add metadata
    const finalUpdateData = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    console.log('[DB] Updating packing list:', {
      packingListId,
      fields: Object.keys(finalUpdateData),
      userId
    });

    const updatedPackingList = await updatePackingList(packingListId, finalUpdateData as any);

    if (!updatedPackingList) {
      return { success: false, error: 'Update operation returned null' };
    }

    console.log(`[DB] ✓ Packing list ${packingListId} updated successfully`);
    return { success: true, data: updatedPackingList };
  } catch (error: any) {
    console.error('[DB] Update failed:', {
      packingListId,
      error: error.message,
      code: error.code
    });
    return { success: false, error: error.message };
  }
}

// ============================================
// INVOICE CROSS-VERIFICATION
// ============================================
async function verifyInvoiceMatch(
  invoiceNumber: string,
  threadId: string
): Promise<{ matched: boolean; invoiceData?: any }> {
  try {
    console.log('[Verification] Checking invoice match:', invoiceNumber);
    
    const { data, error } = await supabase
      .from('commercial_invoices')
      .select('*')
      .eq('invoice_no', invoiceNumber)
      .eq('thread_id', threadId)
      .single();

    if (error || !data) {
      console.log('[Verification] No matching invoice found');
      return { matched: false };
    }

    console.log('[Verification] ✓ Invoice match found');
    return { matched: true, invoiceData: data };
  } catch (error) {
    console.error('[Verification] Error:', error);
    return { matched: false };
  }
}

// ============================================
// PUT/PATCH HANDLER - UPDATE PACKING LIST
// ============================================
export async function PUT(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Update] Processing packing list update');
    console.log('═══════════════════════════════════════');

    // Parse request body
    const body: UpdateRequestBody = await request.json();
    const { packingListId, userId, updateData, updateReason } = body;

    console.log('[Update] Request:', {
      packingListId,
      userId,
      fieldCount: Object.keys(updateData || {}).length,
      fields: Object.keys(updateData || {}),
      reason: updateReason || 'N/A'
    });

    // ============================================
    // STEP 1: VALIDATE REQUEST
    // ============================================
    if (!packingListId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Packing List ID is required' },
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
    // STEP 2: FETCH EXISTING PACKING LIST
    // ============================================
    console.log('[Update] Fetching packing list...');
    const existingPackingList = await getPackingListById(packingListId);

    if (!existingPackingList) {
      console.log('[Update] ✗ Packing list not found');
      return NextResponse.json<ErrorResponse>(
        { error: 'Packing list not found' },
        { status: 404 }
      );
    }

    console.log('[Update] ✓ Packing list found:', {
      packing_list_number: existingPackingList.packing_list_number,
      owner: existingPackingList.user_id
    });

    // ============================================
    // STEP 3: VERIFY OWNERSHIP
    // ============================================
    if (!validatePackingListOwnership(existingPackingList, userId)) {
      console.log('[Update] ✗ Unauthorized access attempt');
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: You do not have permission to update this packing list' },
        { status: 403 }
      );
    }

    console.log('[Update] ✓ Ownership verified');

    // ============================================
    // STEP 4: CROSS-VERIFY INVOICE (if updated)
    // ============================================
    if (validation.filteredData.invoice_number) {
      const invoiceCheck = await verifyInvoiceMatch(
        validation.filteredData.invoice_number,
        existingPackingList.thread_id
      );

      // Update verification flags
      validation.filteredData.invoice_match_verified = invoiceCheck.matched;
      
      if (!invoiceCheck.matched) {
        console.warn('[Update] ⚠️  Invoice number updated but no match found in thread');
        // Add warning to validation warnings
        const currentWarnings = validation.filteredData.validation_warnings 
          ? JSON.parse(validation.filteredData.validation_warnings) 
          : [];
        currentWarnings.push('Invoice number does not match any commercial invoice in this thread');
        validation.filteredData.validation_warnings = JSON.stringify(currentWarnings);
      } else {
        console.log('[Update] ✓ Invoice match verified');
      }
    }

    // ============================================
    // STEP 5: UPDATE DATABASE
    // ============================================
    const dbResult = await performUpdate(packingListId, validation.filteredData, userId);

    if (!dbResult.success) {
      console.log('[Update] ✗ Database update failed');
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Failed to update packing list',
          details: dbResult.error
        },
        { status: 500 }
      );
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
      message: 'Packing list updated successfully',
      data: dbResult.data,
      updatedFields: Object.keys(validation.filteredData),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('═══════════════════════════════════════');
    console.error('[Update] ✗ Error:', error.message);
    console.error('[Update] Stack:', error.stack);
    console.error('[Update] Processing time:', processingTime + 'ms');
    console.error('═══════════════════════════════════════');

    return NextResponse.json<ErrorResponse>(
      {
        error: 'Failed to update packing list',
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
// GET HANDLER - RETRIEVE PACKING LIST
// ============================================
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Get] Retrieving packing list');
    console.log('═══════════════════════════════════════');

    const searchParams = request.nextUrl.searchParams;
    const packingListId = searchParams.get('packingListId');
    const userId = searchParams.get('userId');

    console.log('[Get] Request:', { packingListId, userId });

    // ============================================
    // STEP 1: VALIDATE PARAMETERS
    // ============================================
    if (!packingListId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Packing List ID is required' },
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
    // STEP 2: FETCH FROM DATABASE
    // ============================================
    console.log('[Get] Fetching from database...');
    const packingList = await getPackingListById(packingListId);

    if (!packingList) {
      console.log('[Get] ✗ Packing list not found');
      return NextResponse.json<ErrorResponse>(
        { error: 'Packing list not found' },
        { status: 404 }
      );
    }

    console.log('[Get] ✓ Packing list found:', {
      packing_list_number: packingList.packing_list_number,
      owner: packingList.user_id
    });

    // ============================================
    // STEP 3: VERIFY OWNERSHIP
    // ============================================
    if (!validatePackingListOwnership(packingList, userId)) {
      console.log('[Get] ✗ Unauthorized access attempt');
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: You do not have permission to view this packing list' },
        { status: 403 }
      );
    }

    // ============================================
    // STEP 4: PARSE JSON FIELDS
    // ============================================
    const response = { ...packingList };
    const jsonFields = ['box_details', 'validation_errors', 'validation_warnings'];
    
    for (const field of jsonFields) {
      if (response[field] && typeof response[field] === 'string') {
        try {
          response[field] = JSON.parse(response[field]);
        } catch (e) {
          console.warn(`[Get] Failed to parse ${field}`);
        }
      }
    }

    // ============================================
    // STEP 5: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Get] ✓ Success');
    console.log(`[Get] Processing time: ${processingTime}ms`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json({
      success: true,
      data: response,
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
        error: 'Failed to fetch packing list',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE HANDLER - SOFT DELETE PACKING LIST
// ============================================
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Delete] Processing packing list deletion');
    console.log('═══════════════════════════════════════');

    const searchParams = request.nextUrl.searchParams;
    const packingListId = searchParams.get('packingListId');
    const userId = searchParams.get('userId');

    console.log('[Delete] Request:', { packingListId, userId });

    // Validate parameters
    if (!packingListId || !userId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Packing List ID and User ID are required' },
        { status: 400 }
      );
    }

    // Fetch and verify ownership
    const packingList = await getPackingListById(packingListId);
    if (!packingList) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Packing list not found' },
        { status: 404 }
      );
    }

    if (!validatePackingListOwnership(packingList, userId)) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: You do not have permission to delete this packing list' },
        { status: 403 }
      );
    }

    // Soft delete: update status to 'deleted'
    const result = await performUpdate(packingListId, {
      status: 'deleted',
      deleted_at: new Date().toISOString()
    }, userId);

    if (!result.success) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Failed to delete packing list', details: result.error },
        { status: 500 }
      );
    }

    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Delete] ✓ Success');
    console.log(`[Delete] Processing time: ${processingTime}ms`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json<UpdateResponse>({
      success: true,
      message: 'Packing list deleted successfully',
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
        error: 'Failed to delete packing list',
        details: error.message
      },
      { status: 500 }
    );
  }
}