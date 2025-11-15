// src/app/api/invoice/update/commercial-invoice/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getInvoiceByInvoiceNoAndUserId, updateInvoice, getUserInvoices } from '@/lib/database';
import { redis } from '@/lib/config';
import { verifyUserToken, getUserById } from '@/lib/auth';

// ============================================
// CONFIGURATION
// ============================================
const ALLOWED_UPDATE_FIELDS = [
  // Basic invoice info
  'invoice_no',
  'invoice_date',
  'filename',
  'status',
  'reference_no',
  'proforma_invoice_no',
  
  // Consignee information
  'consignee_name',
  'consignee_address',
  'consignee_email',
  'consignee_phone',
  'consignee_mobile',
  'consignee_country',
  'consignee_po_box',
  
  // Exporter information
  'exporter_name',
  'exporter_address',
  'exporter_email',
  'exporter_phone',
  'exporter_mobile',
  'exporter_pan',
  'exporter_gstin',
  'exporter_iec',
  'exporter_factory',
  
  // Shipping details
  'incoterms',
  'pre_carriage',
  'place_of_receipt',
  'vessel_flight',
  'port_of_loading',
  'port_of_discharge',
  'final_destination',
  'country_of_origin',
  'country_of_destination',
  'hsn_code',
  'freight_terms',
  
  // Bank details
  'bank_name',
  'bank_address',
  'bank_account',
  'bank_account_usd',
  'bank_account_euro',
  'bank_swift_code',
  'bank_ifsc_code',
  'bank_branch_code',
  'bank_ad_code',
  'bank_bsr_code',
  
  // Payment and packaging
  'payment_terms',
  'marks_and_nos',
  'packaging',
  
  // Validation
  'is_valid',
  'completeness',
  'validation_errors',
  'validation_warnings',
  
  // Items and totals
  'item_count',
  'items',
  'total_amount',
  'total_amount_in_words',
  'currency',
  
  // Certifications
  'igst_status',
  'drawback_sr_no',
  'rodtep_claim',
  'commission_rate',
  
  // Verification
  'has_signature',
  'verification_status',
  'verification_data',
  'verification_notes'
] as const;

// ============================================
// INTERFACES
// ============================================
interface UpdateRequestBody {
  invoiceNo: string;
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
  raw?: any;
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
      // Additional validation for specific fields
      if (key === 'invoice_date' && value) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          errors.push(`Invalid date format for ${key}. Expected YYYY-MM-DD`);
          continue;
        }
      }

      if (key === 'total_amount' && value !== null && value !== undefined) {
        const amount = Number(value);
        if (isNaN(amount) || amount < 0) {
          errors.push(`Invalid total_amount: must be a positive number`);
          continue;
        }
      }

      if (key === 'completeness' && value !== null && value !== undefined) {
        const completeness = Number(value);
        if (isNaN(completeness) || completeness < 0 || completeness > 100) {
          errors.push(`Invalid completeness: must be between 0 and 100`);
          continue;
        }
      }

      if (key === 'is_valid' && typeof value !== 'boolean') {
        errors.push(`Invalid is_valid: must be a boolean`);
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

function validateInvoiceOwnership(invoice: any, userId: string): boolean {
  return invoice.user_id === userId;
}

// ============================================
// REDIS CACHE OPERATIONS
// ============================================
async function updateRedisCache(
  invoiceNo: string,
  userId: string,
  updateData: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const redisKey = `invoice:${userId}:${invoiceNo}`;
    const exists = await redis.exists(redisKey);

    if (!exists) {
      console.log('[Redis] Invoice not in cache, skipping update');
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
    console.log(`[Redis] ✓ Updated cache for ${invoiceNo}`);

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
  invoiceNo: string,
  userId: string,
  updateData: Record<string, any>
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Add metadata
    const finalUpdateData = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    console.log('[DB] Updating invoice:', {
      invoiceNo,
      userId,
      fields: Object.keys(finalUpdateData)
    });

    // Use the new function that finds by invoiceNo and userId
    const updatedInvoice = await updateInvoice(invoiceNo, userId, finalUpdateData);

    if (!updatedInvoice) {
      return { success: false, error: 'Update operation returned null' };
    }

    console.log(`[DB] ✓ Invoice ${invoiceNo} updated successfully`);
    return { success: true, data: updatedInvoice };
  } catch (error: any) {
    console.error('[DB] Update failed:', {
      invoiceNo,
      userId,
      error: error.message,
      code: error.code
    });
    return { success: false, error: error.message };
  }
}

// ============================================
// PUT/PATCH HANDLER - UPDATE INVOICE
// ============================================
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Update] Processing invoice update');
    console.log('═══════════════════════════════════════');

    // Parse request body
    const body: UpdateRequestBody = await request.json();
    const { invoiceNo, userId, updateData, updateReason } = body;

    console.log('[Update] Request:', {
      invoiceNo,
      userId,
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
    if (!invoiceNo) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Invoice number is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'User ID is required' },
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
    // STEP 3: FETCH EXISTING INVOICE
    // ============================================
    console.log('[Update] Fetching invoice...');
    // First try to get invoice by userId (for ownership check)
    let existingInvoice = await getInvoiceByInvoiceNoAndUserId(invoiceNo, userId);

    // If not found and current user is admin, verify document owner is in same organization
    if (!existingInvoice && isAdmin) {
      // The userId in request body is the document owner's userId (member's userId)
      const documentOwner = await getUserById(userId);
      if (documentOwner && documentOwner.organization_id === organizationId) {
        // Get all invoices for this user and find by invoiceNo
        const userInvoices = await getUserInvoices(userId);
        existingInvoice = userInvoices.find((inv: any) => inv.invoice_no === invoiceNo);
        if (existingInvoice) {
          console.log('[Update] ✓ Admin accessing invoice in same organization');
        }
      }
      
      if (!existingInvoice) {
        console.log('[Update] ✗ Admin cannot access invoice - not found or outside organization');
        return NextResponse.json<ErrorResponse>(
          { error: 'Invoice not found or access denied' },
          { status: 404 }
        );
      }
    }

    if (!existingInvoice) {
      console.log('[Update] ✗ Invoice not found or access denied');
      return NextResponse.json<ErrorResponse>(
        { error: 'Invoice not found or access denied' },
        { status: 404 }
      );
    }

    console.log('[Update] ✓ Invoice found:', {
      invoice_no: existingInvoice.invoice_no,
      owner: existingInvoice.user_id,
      isAdmin: isAdmin
    });

    // ============================================
    // STEP 4: VERIFY PERMISSIONS
    // ============================================
    // If not admin, verify ownership (userId must match document owner)
    if (!isAdmin && existingInvoice.user_id !== userId) {
      console.log('[Update] ✗ Unauthorized: User does not own this invoice');
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized: You do not have permission to update this invoice' },
        { status: 403 }
      );
    }

    // If admin, verify document owner is in same organization (already checked above)
    console.log('[Update] ✓ Permissions verified');

    // ============================================
    // STEP 5: UPDATE DATABASE
    // ============================================
    // Use the document owner's userId for the update (not the admin's userId)
    const documentOwnerUserId = existingInvoice.user_id;
    const dbResult = await performUpdate(invoiceNo, documentOwnerUserId, validation.filteredData);

    if (!dbResult.success) {
      console.log('[Update] ✗ Database update failed');
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Failed to update invoice',
          details: dbResult.error
        },
        { status: 500 }
      );
    }

    // ============================================
    // STEP 6: UPDATE REDIS CACHE
    // ============================================
    const cacheResult = await updateRedisCache(invoiceNo, documentOwnerUserId, validation.filteredData);
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

    const formattedInvoice = formatInvoiceForFrontend(dbResult.data);

    return NextResponse.json<UpdateResponse>({
      success: true,
      message: 'Invoice updated successfully',
      data: formattedInvoice,
      raw: dbResult.data,
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
        error: 'Failed to update invoice',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET HANDLER - RETRIEVE INVOICE
// ============================================
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Get] Retrieving invoice');
    console.log('═══════════════════════════════════════');

    const searchParams = request.nextUrl.searchParams;
    const invoiceNo = searchParams.get('invoiceNo');
    const userId = searchParams.get('userId');

    console.log('[Get] Request:', { invoiceNo, userId });

    // ============================================
    // STEP 1: VALIDATE PARAMETERS
    // ============================================
    if (!invoiceNo) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Invoice number is required' },
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
      const redisKey = `invoice:${userId}:${invoiceNo}`;
      const cachedData = await redis.hgetall(redisKey);

      if (cachedData && Object.keys(cachedData).length > 0) {
        console.log('[Get] ✓ Found in Redis cache');

        // Ownership already verified by the key structure
        console.log('[Get] ✓ Ownership verified by cache key');

        // Parse JSON fields
        const invoice = { ...cachedData };
        const jsonFields = ['items', 'validation_errors', 'validation_warnings'];
        for (const field of jsonFields) {
          if (invoice[field]) {
            try {
              invoice[field] = JSON.parse(invoice[field]);
            } catch (e) {
              console.warn(`[Get] Failed to parse ${field} from cache`);
            }
          }
        }

        const processingTime = Date.now() - startTime;
        console.log(`[Get] ✓ Returned from cache (${processingTime}ms)`);

        return NextResponse.json({
          success: true,
          data: invoice,
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
    const invoice = await getInvoiceByInvoiceNoAndUserId(invoiceNo, userId);

    if (!invoice) {
      console.log('[Get] ✗ Invoice not found');
      return NextResponse.json<ErrorResponse>(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    console.log('[Get] ✓ Invoice found:', {
      invoice_no: invoice.invoice_no,
      owner: invoice.user_id
    });

    // ============================================
    // STEP 4: VERIFY OWNERSHIP (already verified by query)
    // ============================================
    console.log('[Get] ✓ Ownership verified by query');

    // ============================================
    // STEP 5: UPDATE CACHE FOR FUTURE REQUESTS
    // ============================================
    try {
      const redisKey = `invoice:${userId}:${invoiceNo}`;
      const cacheData: Record<string, any> = { ...invoice };

      // Convert arrays/objects to JSON strings
      for (const [key, value] of Object.entries(cacheData)) {
        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
          cacheData[key] = JSON.stringify(value);
        }
      }

      await redis.hset(redisKey, cacheData);
      // Set expiration to 24 hours
      await redis.expire(redisKey, 86400);
      console.log('[Get] ✓ Cached for future requests');
    } catch (cacheError) {
      console.warn('[Get] Failed to cache invoice:', cacheError);
    }

    // ============================================
    // STEP 6: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Get] ✓ Success');
    console.log(`[Get] Processing time: ${processingTime}ms`);
    console.log('═══════════════════════════════════════');

    const formattedInvoice = formatInvoiceForFrontend(invoice);

    return NextResponse.json({
      success: true,
      data: formattedInvoice,
      raw: invoice,
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
        error: 'Failed to fetch invoice',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE HANDLER - SOFT DELETE INVOICE
// ============================================
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Delete] Processing invoice deletion');
    console.log('═══════════════════════════════════════');

    const searchParams = request.nextUrl.searchParams;
    const invoiceNo = searchParams.get('invoiceNo');
    const userId = searchParams.get('userId');

    console.log('[Delete] Request:', { invoiceNo, userId });

    // Validate parameters
    if (!invoiceNo || !userId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Invoice number and User ID are required' },
        { status: 400 }
      );
    }

    // Fetch and verify ownership (implicit in the query)
    const invoice = await getInvoiceByInvoiceNoAndUserId(invoiceNo, userId);
    if (!invoice) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    console.log('[Delete] ✓ Invoice found and ownership verified');

    // Soft delete: update status to 'deleted'
    const result = await performUpdate(invoiceNo, userId, {
      status: 'deleted',
      deleted_at: new Date().toISOString()
    });

    if (!result.success) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Failed to delete invoice', details: result.error },
        { status: 500 }
      );
    }

    // Remove from Redis cache
    try {
      await redis.del(`invoice:${userId}:${invoiceNo}`);
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
      message: 'Invoice deleted successfully',
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
        error: 'Failed to delete invoice',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH HANDLER - ALIAS FOR PUT
// ============================================
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return PUT(request);
}

function formatInvoiceForFrontend(invoice: any) {
  if (!invoice) {
    return null;
  }

  const items = parseJsonField(invoice.items, []);
  const validationErrors = parseJsonField(invoice.validation_errors, []);
  const validationWarnings = parseJsonField(invoice.validation_warnings, []);
  const normalizedItems = normalizeInvoiceItems(items);

  const calculatedTotal = calculateTotalFromItems(normalizedItems);

  const resolvedItemCount = isValidNumber(invoice.item_count)
    ? Number(invoice.item_count)
    : normalizedItems.length;

  const resolvedTotalAmount = isValidNumber(invoice.total_amount)
    ? Number(invoice.total_amount)
    : calculatedTotal;

  return {
    invoiceId: invoice.invoice_id,
    filename: invoice.filename || '',
    fileUrl: invoice.filepath || '',
    uploaded_at: invoice.uploaded_at || null,
    processed_at: invoice.processed_at || null,
    status: invoice.status || 'processed',
    document_type: invoice.document_type || 'Commercial Invoice',

    invoice_no: invoice.invoice_no || '',
    invoice_date: invoice.invoice_date || '',
    reference_no: invoice.reference_no || '',
    proforma_invoice_no: invoice.proforma_invoice_no || '',
    marks_and_nos: invoice.marks_and_nos || '',

    consignee_name: invoice.consignee_name || '',
    consignee_address: invoice.consignee_address || '',
    consignee_email: invoice.consignee_email || '',
    consignee_phone: invoice.consignee_phone || '',
    consignee_country: invoice.consignee_country || '',

    exporter_name: invoice.exporter_name || '',
    exporter_address: invoice.exporter_address || '',
    exporter_email: invoice.exporter_email || '',
    exporter_phone: invoice.exporter_phone || '',
    exporter_pan: invoice.exporter_pan || '',
    exporter_gstin: invoice.exporter_gstin || '',
    exporter_iec: invoice.exporter_iec || '',

    incoterms: invoice.incoterms || '',
    place_of_receipt: invoice.place_of_receipt || '',
    port_of_loading: invoice.port_of_loading || '',
    port_of_discharge: invoice.port_of_discharge || '',
    final_destination: invoice.final_destination || '',
    country_of_origin: invoice.country_of_origin || '',
    country_of_destination: invoice.country_of_destination || '',
    hsn_code: invoice.hsn_code || '',

    bank_name: invoice.bank_name || '',
    bank_account: invoice.bank_account || '',
    bank_swift_code: invoice.bank_swift_code || '',
    bank_ifsc_code: invoice.bank_ifsc_code || '',
    payment_terms: invoice.payment_terms || '',

    currency: invoice.currency || 'USD',
    total_amount: resolvedTotalAmount,
    item_count: resolvedItemCount,
    items: normalizedItems,

    igst_status: invoice.igst_status || '',
    drawback_sr_no: invoice.drawback_sr_no || '',
    rodtep_claim: coerceBoolean(invoice.rodtep_claim),
    commission_rate: invoice.commission_rate ?? '',

    has_signature: coerceBoolean(invoice.has_signature),
    verification_status: invoice.verification_status || 'pending',
    verification_data: invoice.verification_data || null,

    is_valid: coerceBoolean(invoice.is_valid),
    completeness: isValidNumber(invoice.completeness) ? Number(invoice.completeness) : 0,
    validation_errors: validationErrors,
    validation_warnings: validationWarnings
  };
}

function parseJsonField(value: any, fallback: any) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function normalizeInvoiceItems(items: any[]): any[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => {
    const description =
      item?.description ??
      item?.itemDescription ??
      item?.productDescription ??
      item?.goodsDescription ??
      '';

    const quantity = toNumber(
      item?.quantity ??
      item?.qty ??
      item?.quantityValue
    );

    const unit =
      item?.unit ??
      item?.unitOfMeasure ??
      item?.uom ??
      '';

    const unitPrice = toNumber(
      item?.unitPrice ??
      item?.unit_price ??
      item?.pricePerUnit ??
      item?.rate
    );

    const totalPrice = toNumber(
      item?.totalPrice ??
      item?.total_price ??
      item?.amount ??
      item?.lineTotal ??
      (quantity * unitPrice)
    );

    const hsCode =
      item?.hsCode ??
      item?.hs_code ??
      item?.hsnCode ??
      item?.hsn_code ??
      '';

    return {
      ...item,
      description,
      quantity,
      unit,
      unitPrice,
      totalPrice,
      hsCode,
      lineNumber: item?.lineNumber ?? index + 1
    };
  });
}

function calculateTotalFromItems(items: any[]): number {
  if (!items || !Array.isArray(items)) {
    return 0;
  }

  return items.reduce((total, item) => {
    const itemTotal = toNumber(
      item.totalPrice ??
      item.total_price ??
      item.amount ??
      item.lineTotal
    );
    return total + itemTotal;
  }, 0);
}

function toNumber(value: any, fallback = 0): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const numericValue = typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : value;
  const parsed = Number(numericValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isValidNumber(value: any): boolean {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function coerceBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return false;
}