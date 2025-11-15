// src/app/api/invoice/update/fumigation-certificate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getFumigationCertificateById, updateFumigationCertificate } from '@/lib/database';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for cross-verification
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// CONFIGURATION
// ============================================
const ALLOWED_UPDATE_FIELDS = [
  // Basic Certificate Info
  'certificate_number',
  'certificate_date',
  'dppqs_registration_number',
  'filename',
  'status',
  
  // Treatment Details
  'fumigant_name',
  'fumigation_date',
  'fumigation_place',
  'fumigant_dosage',
  'fumigation_duration',
  'minimum_temperature',
  'gastight_sheets',
  'pressure_decay_value',
  
  // Goods Description
  'container_number',
  'seal_number',
  'exporter_name',
  'exporter_address',
  'consignee_name',
  'cargo_type',
  'cargo_description',
  'quantity',
  'packaging_material',
  'additional_declaration',
  'shipping_mark',
  
  // Referenced Invoice
  'invoice_number',
  'invoice_date',
  
  // Operator Information
  'operator_name',
  'operator_signature_status',
  'accreditation_number',
  
  // Validation
  'is_valid',
  'completeness',
  'validation_errors',
  'validation_warnings',
  'invoice_match_verified'
] as const;

// ============================================
// INTERFACES
// ============================================
interface UpdateRequestBody {
  certificateId: string;
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
      if ((key.includes('_date') || key === 'certificate_date' || key === 'fumigation_date') && value) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          errors.push(`Invalid date format for ${key}. Expected YYYY-MM-DD`);
          continue;
        }
      }

      // Duration validation (e.g., "24 hrs", "48 hours")
      if (key === 'fumigation_duration' && value !== null && value !== undefined && value !== '') {
        const durationStr = String(value).trim();
        if (durationStr && !/^[\d.]+\s*(hrs?|hours?|days?|mins?|minutes?)$/i.test(durationStr)) {
          errors.push('Invalid fumigation_duration: must be a number followed by time unit (hrs, hours, days, etc.)');
          continue;
        }
      }

      // Temperature validation (e.g., "25°C", "77°F", "25")
      if (key === 'minimum_temperature' && value !== null && value !== undefined && value !== '') {
        const tempStr = String(value).trim();
        if (tempStr && !/^-?[\d.]+\s*(°C|°F|C|F)?$/i.test(tempStr)) {
          errors.push('Invalid minimum_temperature: must be a number optionally followed by °C or °F');
          continue;
        }
      }

      // Dosage validation (e.g., "48 g/m3", "2 tablets per ton")
      if (key === 'fumigant_dosage' && value !== null && value !== undefined && value !== '') {
        const dosageStr = String(value).trim();
        if (dosageStr && !/^[\d.]+\s*[a-zA-Z/³]+.*$/i.test(dosageStr)) {
          errors.push('Invalid fumigant_dosage: must include numeric value and unit');
          continue;
        }
      }

      // Pressure decay validation (e.g., "0.5 mb", "750 Pa")
      if (key === 'pressure_decay_value' && value !== null && value !== undefined && value !== '') {
        const pressureStr = String(value).trim();
        if (pressureStr && !/^[\d.]+\s*(mb|pa|kpa|psi|mmhg)?$/i.test(pressureStr)) {
          errors.push('Invalid pressure_decay_value: must be a number optionally followed by pressure unit');
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
      if ((key === 'is_valid' || key === 'gastight_sheets' || key === 'operator_signature_status' || key === 'invoice_match_verified') 
          && value !== null && typeof value !== 'boolean') {
        errors.push(`Invalid ${key}: must be a boolean`);
        continue;
      }

      // Status validation
      if (key === 'status' && value) {
        const validStatuses = ['valid', 'invalid', 'pending', 'deleted'];
        if (!validStatuses.includes(value)) {
          errors.push(`Invalid status: must be one of ${validStatuses.join(', ')}`);
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

      // Certificate number format validation (basic)
      if (key === 'certificate_number' && value) {
        const certNum = String(value).trim();
        if (certNum.length < 3) {
          errors.push('certificate_number too short - must be at least 3 characters');
          continue;
        }
      }

      // DPPQS registration validation (if applicable)
      if (key === 'dppqs_registration_number' && value) {
        const dppqsNum = String(value).trim();
        if (dppqsNum && !/^[A-Z0-9\/-]+$/i.test(dppqsNum)) {
          errors.push('Invalid dppqs_registration_number format');
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

function validateCertificateOwnership(certificate: any, userId: string): boolean {
  return certificate.user_id === userId;
}

// ============================================
// CROSS-VERIFICATION HELPERS
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
      .eq('invoice_number', invoiceNumber)
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

async function verifyContainerMatch(
  containerNumber: string,
  threadId: string
): Promise<{ matched: boolean; documentType?: string }> {
  try {
    if (!containerNumber) return { matched: false };

    console.log('[Verification] Checking container match:', containerNumber);
    
    // Check in packing lists
    const { data: packingList, error: plError } = await supabase
      .from('packing_lists')
      .select('*')
      .eq('thread_id', threadId)
      .like('box_details', `%${containerNumber}%`)
      .single();

    if (!plError && packingList) {
      console.log('[Verification] ✓ Container found in Packing List');
      return { matched: true, documentType: 'packing_list' };
    }

    // Could also check commercial invoices or other documents
    console.log('[Verification] No matching container found');
    return { matched: false };
  } catch (error) {
    console.error('[Verification] Error:', error);
    return { matched: false };
  }
}

// ============================================
// DATABASE OPERATIONS
// ============================================
async function performUpdate(
  certificateId: string,
  updateData: Record<string, any>,
  userId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Add metadata
    const finalUpdateData = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    console.log('[DB] Updating fumigation certificate:', {
      certificateId,
      fields: Object.keys(finalUpdateData),
      userId
    });

    const updatedCertificate = await updateFumigationCertificate(certificateId, finalUpdateData as any);

    if (!updatedCertificate) {
      return { success: false, error: 'Update operation returned null' };
    }

    console.log(`[DB] ✓ Fumigation certificate ${certificateId} updated successfully`);
    return { success: true, data: updatedCertificate };
  } catch (error: any) {
    console.error('[DB] Update failed:', {
      certificateId,
      error: error.message,
      code: error.code
    });
    return { success: false, error: error.message };
  }
}

// ============================================
// PUT/PATCH HANDLER - UPDATE FUMIGATION CERTIFICATE
// ============================================
export async function PUT(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Update] Processing fumigation certificate update');
    console.log('═══════════════════════════════════════');

    // Parse request body
    const body: UpdateRequestBody = await request.json();
    const { certificateId, userId, updateData, updateReason } = body;

    console.log('[Update] Request:', {
      certificateId,
      userId,
      fieldCount: Object.keys(updateData || {}).length,
      reason: updateReason || 'N/A'
    });

    // ============================================
    // STEP 1: VALIDATE REQUEST
    // ============================================
    if (!certificateId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Certificate ID is required' },
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
    // STEP 2: FETCH EXISTING CERTIFICATE
    // ============================================
    console.log('[Update] Fetching fumigation certificate...');
    const existingCertificate = await getFumigationCertificateById(certificateId);

    if (!existingCertificate) {
      console.log('[Update] ✗ Fumigation certificate not found');
      return NextResponse.json<ErrorResponse>(
        { error: 'Fumigation certificate not found' },
        { status: 404 }
      );
    }

    console.log('[Update] ✓ Fumigation certificate found:', {
      certificate_number: existingCertificate.certificate_number,
      owner: existingCertificate.user_id
    });

    // ============================================
    // STEP 3: VERIFY OWNERSHIP
    // ============================================
    if (!validateCertificateOwnership(existingCertificate, userId)) {
      console.log('[Update] ✗ Unauthorized access attempt');
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: You do not have permission to update this fumigation certificate' },
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
        existingCertificate.thread_id
      );

      validation.filteredData.invoice_match_verified = invoiceCheck.matched;
      
      if (invoiceCheck.matched && invoiceCheck.invoiceData) {
        // Optionally sync invoice date
        if (!validation.filteredData.invoice_date) {
          validation.filteredData.invoice_date = invoiceCheck.invoiceData.invoice_date;
        }
        console.log('[Update] ✓ Invoice match verified');
      } else {
        console.warn('[Update] ⚠️  Invoice number updated but no match found in thread');
      }
    }

    // ============================================
    // STEP 5: CROSS-VERIFY CONTAINER (if updated)
    // ============================================
    if (validation.filteredData.container_number) {
      const containerCheck = await verifyContainerMatch(
        validation.filteredData.container_number,
        existingCertificate.thread_id
      );

      if (containerCheck.matched) {
        console.log(`[Update] ✓ Container found in ${containerCheck.documentType}`);
      } else {
        console.warn('[Update] ⚠️  Container number not found in other documents');
      }
    }

    // ============================================
    // STEP 6: BUSINESS LOGIC VALIDATIONS
    // ============================================
    // Validate fumigation date is not after certificate date
    if (validation.filteredData.fumigation_date || validation.filteredData.certificate_date) {
      const fumDate = new Date(validation.filteredData.fumigation_date || existingCertificate.fumigation_date);
      const certDate = new Date(validation.filteredData.certificate_date || existingCertificate.certificate_date);
      
      if (certDate < fumDate) {
        console.warn('[Update] ⚠️  Certificate date is before fumigation date');
        // Add to warnings but allow update
        const warnings = validation.filteredData.validation_warnings 
          ? JSON.parse(validation.filteredData.validation_warnings) 
          : existingCertificate.validation_warnings || [];
        
        if (!warnings.includes('Certificate date is before fumigation date')) {
          warnings.push('Certificate date is before fumigation date');
          validation.filteredData.validation_warnings = JSON.stringify(warnings);
        }
      }
    }

    // ============================================
    // STEP 7: UPDATE DATABASE
    // ============================================
    const dbResult = await performUpdate(certificateId, validation.filteredData, userId);

    if (!dbResult.success) {
      console.log('[Update] ✗ Database update failed');
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Failed to update fumigation certificate',
          details: dbResult.error
        },
        { status: 500 }
      );
    }

    // ============================================
    // STEP 8: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Update] ✓ Success');
    console.log(`[Update] Processing time: ${processingTime}ms`);
    console.log(`[Update] Updated fields: ${Object.keys(validation.filteredData).length}`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json<UpdateResponse>({
      success: true,
      message: 'Fumigation certificate updated successfully',
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
        error: 'Failed to update fumigation certificate',
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
// GET HANDLER - RETRIEVE FUMIGATION CERTIFICATE
// ============================================
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Get] Retrieving fumigation certificate');
    console.log('═══════════════════════════════════════');

    const searchParams = request.nextUrl.searchParams;
    const certificateId = searchParams.get('certificateId');
    const userId = searchParams.get('userId');

    console.log('[Get] Request:', { certificateId, userId });

    // ============================================
    // STEP 1: VALIDATE PARAMETERS
    // ============================================
    if (!certificateId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Certificate ID is required' },
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
    const certificate = await getFumigationCertificateById(certificateId);

    if (!certificate) {
      console.log('[Get] ✗ Fumigation certificate not found');
      return NextResponse.json<ErrorResponse>(
        { error: 'Fumigation certificate not found' },
        { status: 404 }
      );
    }

    console.log('[Get] ✓ Fumigation certificate found:', {
      certificate_number: certificate.certificate_number,
      owner: certificate.user_id
    });

    // ============================================
    // STEP 3: VERIFY OWNERSHIP
    // ============================================
    if (!validateCertificateOwnership(certificate, userId)) {
      console.log('[Get] ✗ Unauthorized access attempt');
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: You do not have permission to view this fumigation certificate' },
        { status: 403 }
      );
    }

    // ============================================
    // STEP 4: PARSE JSON FIELDS
    // ============================================
    const response = { ...certificate };
    const jsonFields = ['validation_errors', 'validation_warnings'];
    
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
        error: 'Failed to fetch fumigation certificate',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE HANDLER - SOFT DELETE FUMIGATION CERTIFICATE
// ============================================
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Delete] Processing fumigation certificate deletion');
    console.log('═══════════════════════════════════════');

    const searchParams = request.nextUrl.searchParams;
    const certificateId = searchParams.get('certificateId');
    const userId = searchParams.get('userId');

    console.log('[Delete] Request:', { certificateId, userId });

    // Validate parameters
    if (!certificateId || !userId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Certificate ID and User ID are required' },
        { status: 400 }
      );
    }

    // Fetch and verify ownership
    const certificate = await getFumigationCertificateById(certificateId);
    if (!certificate) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Fumigation certificate not found' },
        { status: 404 }
      );
    }

    if (!validateCertificateOwnership(certificate, userId)) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: You do not have permission to delete this fumigation certificate' },
        { status: 403 }
      );
    }

    // Soft delete: update status to 'deleted'
    const result = await performUpdate(certificateId, {
      status: 'deleted',
      deleted_at: new Date().toISOString()
    }, userId);

    if (!result.success) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Failed to delete fumigation certificate', details: result.error },
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
      message: 'Fumigation certificate deleted successfully',
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
        error: 'Failed to delete fumigation certificate',
        details: error.message
      },
      { status: 500 }
    );
  }
}