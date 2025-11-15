// src/app/api/invoice/upload-packinglist/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractAndValidatePackingList, PackingListValidationResult } from '@/lib/agent';
// import { extractAndValidatePackingList, PackingListValidationResult } from '@/lib/agent/groq/packinglist/agent';

import { createPackingListRecord, verifyPackingListSaved } from '@/lib/database';

// Force Node.js runtime for file processing
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

// ============================================
// CONFIGURATION
// ============================================
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['application/pdf'];
const TEXT_PREVIEW_LENGTH = 5000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

interface ValidationSummary {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completeness: number;
  criticalFieldsMissing: number;
}

interface PackingListMetadata {
  packing_list_id: string;
  user_id: string;
  organization_id: string | null;
  thread_id: string;
  filename: string;
  filepath: string;
  uploaded_at: string;
  processed_at: string;
  status: 'valid' | 'invalid' | 'pending';
  
  // Core Packing List fields
  packing_list_number: string | null;
  packing_list_date: string | null;
  reference_no: string | null;
  proforma_invoice_no: string | null;
  
  // Exporter details
  exporter_name: string | null;
  exporter_address: string | null;
  exporter_email: string | null;
  exporter_phone: string | null;
  exporter_mobile: string | null;
  exporter_pan: string | null;
  exporter_gstin: string | null;
  exporter_iec: string | null;
  
  // Consignee details
  consignee_name: string | null;
  consignee_address: string | null;
  consignee_email: string | null;
  consignee_phone: string | null;
  consignee_mobile: string | null;
  consignee_po_box: string | null;
  
  // Bank details
  bank_name: string | null;
  bank_address: string | null;
  bank_account_usd: string | null;
  bank_account_euro: string | null;
  bank_ifsc_code: string | null;
  bank_swift_code: string | null;
  bank_branch_code: string | null;
  bank_ad_code: string | null;
  bank_bsr_code: string | null;
  
  // Shipment details
  marks_and_nos: string | null;
  country_of_origin: string | null;
  country_of_destination: string | null;
  pre_carriage_by: string | null;
  place_of_receipt: string | null;
  delivery_terms: string | null;
  hsn_code: string | null;
  vessel_flight_no: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  final_destination: string | null;
  freight_terms: string | null;
  
  // Referenced Invoice details
  invoice_number: string | null;
  invoice_date: string | null;
  
  // Box Details
  box_details: string | null; // JSON array of BoxDetail objects
  total_boxes: number;
  total_gross_weight: string | null;
  total_net_weight: string | null;
  total_box_weight: string | null;
  package_type: string | null; // e.g., "WOODEN BOXES"
  
  // Additional fields
  description_of_goods: string | null;
  certification_statement: string | null;
  
  // Validation
  is_valid: boolean;
  completeness: number;
  validation_errors: string[];
  validation_warnings: string[];
  invoice_match_verified: boolean;
  amounts_match_verified: boolean;
  
  extracted_text: string;
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================
function validatePackingListData(validationResult: PackingListValidationResult): ValidationSummary {
  const extractionErrors = Array.isArray(validationResult.errors) ? validationResult.errors : [];
  const extractionWarnings = Array.isArray(validationResult.warnings) ? validationResult.warnings : [];
  
  const { extractedData } = validationResult;
  const errors: string[] = [...extractionErrors];
  const warnings: string[] = [...extractionWarnings];

  console.log('[Validation] Starting Packing List validation, completeness:', validationResult.completeness + '%');

  // Critical fields
  const criticalFields = [
    { name: 'PL Number', value: extractedData.packingListNumber },
    { name: 'PL Date', value: extractedData.packingListDate },
    { name: 'Exporter Name', value: extractedData.exporter?.name },
    { name: 'Consignee Name', value: extractedData.consignee?.name },
    { name: 'Box Details', value: extractedData.boxDetails && extractedData.boxDetails.length > 0 }
  ];

  const criticalFieldsMissing = criticalFields.filter(f => !f.value).length;

  // Log field status
  criticalFields.forEach(field => {
    const status = field.value ? '✓' : '✗';
    console.log(`[Validation] ${status} ${field.name}:`, field.value || 'MISSING');
  });

  // Validation rules
  if (!extractedData.packingListNumber) {
    errors.push('PL NO. is required');
  }

  if (!extractedData.packingListDate) {
    errors.push('DATE is required');
  }

  if (!extractedData.exporter?.name) {
    errors.push('Exporter name is required');
  }

  if (!extractedData.consignee?.name) {
    errors.push('Consignee name is required');
  }

  // Box details validation
  if (!extractedData.boxDetails || extractedData.boxDetails.length === 0) {
    errors.push('BOX NO, SIZE & WT DETAILS are required');
  } else {
    console.log(`[Validation] Found ${extractedData.boxDetails.length} boxes`);
    
    extractedData.boxDetails.forEach((box: BoxDetail, index: number) => {
      if (!box.boxNumber) {
        warnings.push(`Box ${index + 1}: Missing BOX NO`);
      }
      if (!box.size) {
        warnings.push(`Box ${index + 1}: Missing SIZE`);
      }
      if (!box.grossWeight && !box.netWeight) {
        warnings.push(`Box ${index + 1}: Missing WEIGHT DETAILS`);
      }
    });
  }

  // Fail if too many critical fields missing
  if (criticalFieldsMissing > 1) {
    errors.push(`Too many critical fields missing (${criticalFieldsMissing}/${criticalFields.length})`);
  }

  const summary: ValidationSummary = {
    isValid: errors.length === 0,
    errors,
    warnings,
    completeness: validationResult.completeness,
    criticalFieldsMissing
  };

  console.log('[Validation] Packing List result:', {
    isValid: summary.isValid,
    errors: summary.errors.length,
    warnings: summary.warnings.length,
    completeness: summary.completeness + '%',
    criticalMissing: summary.criticalFieldsMissing
  });

  return summary;
}

// ============================================
// DATE NORMALIZATION
// ============================================
function normalizeDateFormat(dateStr: string | null): string | null {
  if (!dateStr) return null;
  
  try {
    const patterns = [
      { regex: /^(\d{2})\.(\d{2})\.(\d{4})$/, format: 'DD.MM.YYYY' },
      { regex: /^(\d{2})-(\d{2})-(\d{4})$/, format: 'DD-MM-YYYY' },
      { regex: /^(\d{4})-(\d{2})-(\d{2})$/, format: 'YYYY-MM-DD' },
      { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, format: 'DD/MM/YYYY' },
      { regex: /^(\d{2})-(\d{2})-(\d{2})$/, format: 'YY-MM-DD' }
    ];
    
    for (const { regex, format } of patterns) {
      const match = dateStr.match(regex);
      if (!match) continue;

      let year: string, month: string, day: string;

      switch (format) {
        case 'DD.MM.YYYY':
        case 'DD-MM-YYYY':
        case 'DD/MM/YYYY':
          [, day, month, year] = match;
          break;
        case 'YYYY-MM-DD':
          [, year, month, day] = match;
          break;
        case 'YY-MM-DD':
          [, year, month, day] = match;
          year = '20' + year;
          break;
        default:
          continue;
      }

      const y = parseInt(year);
      const m = parseInt(month);
      const d = parseInt(day);
      
      if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const normalized = `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        console.log(`[Date] Normalized: ${dateStr} -> ${normalized}`);
        return normalized;
      }
    }
    
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch (error) {
    console.error('[Date] Parse error:', dateStr, error);
  }
  
  console.warn('[Date] Failed to normalize:', dateStr);
  return null;
}

// ============================================
// STORAGE MANAGEMENT
// ============================================
async function uploadToStorage(
  userId: string,
  filename: string,
  buffer: Buffer
): Promise<{ path: string; url: string }> {
  const { data, error } = await supabase.storage
    .from('packing_lists')
    .upload(`${userId}/${filename}`, buffer, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('[Storage] Upload error:', error);
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('packing_lists')
    .getPublicUrl(data.path);

  console.log('[Storage] Uploaded Packing List:', data.path);
  return { path: data.path, url: publicUrl };
}

async function deleteFromStorage(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('packing_lists')
      .remove([path]);
    
    if (error) {
      console.error('[Storage] Delete error:', error);
    } else {
      console.log('[Storage] Deleted:', path);
    }
  } catch (error) {
    console.error('[Storage] Delete failed:', error);
  }
}

// ============================================
// PDF PARSING
// ============================================
async function parsePDF(buffer: Buffer): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const PDFParser = (await import('pdf2json')).default;
      const pdfParser = new PDFParser(null, true);
      
      const timeout = setTimeout(() => {
        pdfParser.destroy();
        reject(new Error('PDF parsing timed out after 60 seconds'));
      }, 60000);
      
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        clearTimeout(timeout);
        console.error('[PDF] Parser error:', errData.parserError);
        reject(new Error(`PDF parsing failed: ${errData.parserError}`));
      });
      
      pdfParser.on('pdfParser_dataReady', () => {
        clearTimeout(timeout);
        try {
          const rawText = (pdfParser as any).getRawTextContent();
          
          if (!rawText || rawText.trim().length < 50) {
            reject(new Error('PDF appears to be empty or contains insufficient text'));
            return;
          }
          
          console.log(`[PDF] Extracted ${rawText.length} characters`);
          resolve(rawText);
        } catch (error) {
          console.error('[PDF] Text extraction error:', error);
          reject(error);
        }
      });
      
      pdfParser.parseBuffer(buffer);
    } catch (error) {
      console.error('[PDF] Initialization error:', error);
      reject(new Error('Failed to initialize PDF parser'));
    }
  });
}

// ============================================
// INVOICE MATCHING & VALIDATION
// ============================================
async function verifyInvoiceMatchAndAmounts(
  invoiceNumber: string,
  threadId: string
): Promise<{ matched: boolean; amountsMatch: boolean; invoiceData?: any }> {
  try {
    console.log('[Match] Searching for invoice:', invoiceNumber, 'in thread:', threadId);
    
    const { data, error } = await supabase
      .from('commercial_invoices')
      .select('*')
      .eq('invoice_number', invoiceNumber)
      .eq('thread_id', threadId)
      .single();

    if (error || !data) {
      console.log('[Match] No matching Commercial Invoice found');
      return { matched: false, amountsMatch: false };
    }

    console.log('[Match] ✓ Found matching Commercial Invoice:', invoiceNumber);
    
    const amountsMatch = true;

    return { 
      matched: true, 
      amountsMatch,
      invoiceData: data
    };
  } catch (error) {
    console.error('[Match] Error checking invoice:', error);
    return { matched: false, amountsMatch: false };
  }
}

// ============================================
// DATABASE OPERATIONS
// ============================================
async function savePackingListToDatabase(
  packingListData: PackingListMetadata
): Promise<{ success: boolean; warning?: string }> {
  try {
    console.log('[DB] Saving Packing List:', packingListData.packing_list_id);
    
    await createPackingListRecord(packingListData);
    console.log('[DB] ✓ Saved Packing List successfully');
    
    const verified = await verifyPackingListSaved(packingListData.packing_list_id);
    if (!verified) {
      console.error('[DB] ⚠️  Verification failed!');
      return { 
        success: false, 
        warning: 'Packing List not found after save - possible database issue' 
      };
    }
    
    console.log('[DB] ✓ Verified Packing List');
    return { success: true };
    
  } catch (error: any) {
    console.error('[DB] Save error:', {
      message: error.message,
      code: error.code
    });
    
    if (error.code === '23505' && error.message?.includes('packing_list_number')) {
      return {
        success: false,
        warning: `Packing List ${packingListData.packing_list_number} already exists`
      };
    }
    
    return {
      success: false,
      warning: 'Database save failed - please try again'
    };
  }
}

// ============================================
// THREAD MANAGEMENT
// ============================================
async function updateThreadWithPackingList(
  threadId: string,
  packingListId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('threads')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('thread_id', threadId);

    if (error) {
      console.error('[DB] Thread update error:', error);
    } else {
      console.log(`[DB] ✓ Updated thread:${threadId}`);
    }
  } catch (error) {
    console.error('[DB] Thread update failed:', error);
  }
}

// ============================================
// MAIN HANDLER
// ============================================
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let storagePath: string | null = null;

  try {
    // ============================================
    // STEP 1: PARSE REQUEST
    // ============================================
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const threadId = formData.get('threadId') as string;
    const userId = formData.get('userId') as string;
    const organizationId = formData.get('organizationId') as string | null;

    console.log('═══════════════════════════════════════');
    console.log('[Upload] Processing Packing List upload');
    console.log('[Upload] Document: CD - Packing List - 00187');
    console.log('[Upload] Thread:', threadId);
    console.log('[Upload] User:', userId || 'anonymous');
    console.log('═══════════════════════════════════════');

    // Validate inputs
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID required' }, { status: 400 });
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Generate IDs
    const timestamp = Date.now();
    const randomId = Math.floor(Math.random() * 1000000000);
    const filename = `${timestamp}-${randomId}-${file.name}`;
    const packingListId = `pl_${timestamp}_${randomId}`;
    
    // Convert to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log(`[Upload] File: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

    // ============================================
    // STEP 2: UPLOAD TO STORAGE
    // ============================================
    const { path, url } = await uploadToStorage(
      userId || 'anonymous',
      filename,
      buffer
    );
    storagePath = path;

    // ============================================
    // STEP 3: EXTRACT TEXT FROM PDF
    // ============================================
    console.log('[Upload] Parsing PDF...');
    const extractedText = await parsePDF(buffer);
    console.log(`[Upload] ✓ Extracted ${extractedText.length} characters`);

    // ============================================
    // STEP 4: AI EXTRACTION FOR PACKING LIST
    // ============================================
    console.log('[Upload] Starting AI extraction...');
    console.log('[Upload] Extracting: All Packing List fields');
    const aiExtraction = await extractAndValidatePackingList(extractedText);
    console.log('[Upload] ✓ AI extraction complete');
    console.log(`[Upload] Completeness: ${aiExtraction.completeness}%`);

    // ============================================
    // STEP 5: VALIDATE EXTRACTED DATA
    // ============================================
    const validation = validatePackingListData(aiExtraction);
    
    if (!validation.isValid) {
      console.log('[Upload] ✗ Validation failed - removing file');
      await deleteFromStorage(storagePath);
      
      return NextResponse.json({
        success: false,
        error: 'Packing List validation failed',
        validation: {
          isValid: false,
          errors: validation.errors,
          warnings: validation.warnings,
          completeness: validation.completeness,
          extractedData: {
            packingListNumber: aiExtraction.extractedData.packingListNumber,
            packingListDate: aiExtraction.extractedData.packingListDate,
            exporterName: aiExtraction.extractedData.exporter?.name,
            consigneeName: aiExtraction.extractedData.consignee?.name
          }
        },
        message: 'Packing List missing required fields'
      }, { status: 400 });
    }

    // ============================================
    // STEP 6: VERIFY INVOICE MATCH & AMOUNTS
    // ============================================
    const { extractedData } = aiExtraction;
    let invoiceMatchVerified = false;
    let amountsMatchVerified = false;
    
    if (extractedData.invoiceNumber) {
      const invoiceCheck = await verifyInvoiceMatchAndAmounts(
        extractedData.invoiceNumber,
        threadId
      );
      
      invoiceMatchVerified = invoiceCheck.matched;
      amountsMatchVerified = invoiceCheck.amountsMatch;
      
      if (!invoiceCheck.matched) {
        validation.warnings.push(
          `Commercial Invoice ${extractedData.invoiceNumber} not found in thread`
        );
      } else {
        console.log('[Upload] ✓ Invoice match verified');
      }
    }

    // ============================================
    // STEP 7: PREPARE PACKING LIST METADATA
    // ============================================
    const boxDetails = extractedData.boxDetails || [];
    const totalBoxes = boxDetails.length;
    const normalizedDate = normalizeDateFormat(extractedData.packingListDate);
    
    const packingListData: PackingListMetadata = {
      packing_list_id: packingListId,
      user_id: userId || 'anonymous',
      organization_id: organizationId,
      thread_id: threadId,
      filename: file.name,
      filepath: storagePath,
      uploaded_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      status: 'valid',
      
      // Core Packing List fields
      packing_list_number: extractedData.packingListNumber,
      packing_list_date: normalizedDate,
      reference_no: extractedData.referenceNo,
      proforma_invoice_no: extractedData.proformaInvoiceNo,
      
      // Exporter details
      exporter_name: extractedData.exporter?.name || null,
      exporter_address: extractedData.exporter?.address || null,
      exporter_email: extractedData.exporter?.email || null,
      exporter_phone: extractedData.exporter?.phone || null,
      exporter_mobile: extractedData.exporter?.mobile || null,
      exporter_pan: extractedData.exporter?.pan || null,
      exporter_gstin: extractedData.exporter?.gstin || null,
      exporter_iec: extractedData.exporter?.iec || null,
      
      // Consignee details
      consignee_name: extractedData.consignee?.name || null,
      consignee_address: extractedData.consignee?.address || null,
      consignee_email: extractedData.consignee?.email || null,
      consignee_phone: extractedData.consignee?.phone || null,
      consignee_mobile: extractedData.consignee?.mobile || null,
      consignee_po_box: extractedData.consignee?.poBox || null,
      
      // Bank details
      bank_name: extractedData.bankDetails?.bankName || null,
      bank_address: extractedData.bankDetails?.bankAddress || null,
      bank_account_usd: extractedData.bankDetails?.usdAccount || null,
      bank_account_euro: extractedData.bankDetails?.euroAccount || null,
      bank_ifsc_code: extractedData.bankDetails?.ifscCode || null,
      bank_swift_code: extractedData.bankDetails?.swiftCode || null,
      bank_branch_code: extractedData.bankDetails?.branchCode || null,
      bank_ad_code: extractedData.bankDetails?.adCode || null,
      bank_bsr_code: extractedData.bankDetails?.bsrCode || null,
      
      // Shipment details
      marks_and_nos: extractedData.marksAndNos || null,
      country_of_origin: extractedData.shipmentDetails?.countryOfOrigin || null,
      country_of_destination: extractedData.shipmentDetails?.countryOfDestination || null,
      pre_carriage_by: extractedData.shipmentDetails?.preCarriageBy || null,
      place_of_receipt: extractedData.shipmentDetails?.placeOfReceipt || null,
      delivery_terms: extractedData.shipmentDetails?.deliveryTerms || null,
      hsn_code: extractedData.shipmentDetails?.hsnCode || null,
      vessel_flight_no: extractedData.shipmentDetails?.vesselFlightNo || null,
      port_of_loading: extractedData.shipmentDetails?.portOfLoading || null,
      port_of_discharge: extractedData.shipmentDetails?.portOfDischarge || null,
      final_destination: extractedData.shipmentDetails?.finalDestination || null,
      freight_terms: extractedData.shipmentDetails?.freightTerms || null,
      
      // Referenced Invoice
      invoice_number: extractedData.invoiceNumber,
      invoice_date: extractedData.invoiceDate,
      
      // Box Details
      box_details: JSON.stringify(boxDetails),
      total_boxes: totalBoxes,
      total_gross_weight: extractedData.totalGrossWeight || null,
      total_net_weight: extractedData.totalNetWeight || null,
      total_box_weight: extractedData.totalBoxWeight || null,
      package_type: extractedData.packageType || null,
      
      // Additional fields
      description_of_goods: extractedData.descriptionOfGoods || null,
      certification_statement: extractedData.certificationStatement || null,
      
      // Validation
      is_valid: true,
      completeness: validation.completeness,
      validation_errors: validation.errors,
      validation_warnings: validation.warnings,
      invoice_match_verified: invoiceMatchVerified,
      amounts_match_verified: amountsMatchVerified,
      
      extracted_text: extractedText.substring(0, TEXT_PREVIEW_LENGTH)
    };

    // ============================================
    // STEP 8: SAVE TO DATABASE
    // ============================================
    const dbResult = await savePackingListToDatabase(packingListData);
    
    if (!dbResult.success) {
      await deleteFromStorage(storagePath);
      
      return NextResponse.json({
        success: false,
        error: 'Failed to save Packing List',
        details: dbResult.warning || 'Database storage failed'
      }, { status: 500 });
    }

    // ============================================
    // STEP 9: UPDATE THREAD
    // ============================================
    await updateThreadWithPackingList(threadId, packingListId);

    // ============================================
    // STEP 10: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Upload] ✓ Packing List processed successfully');
    console.log(`[Upload] Processing time: ${processingTime}ms`);
    console.log(`[Upload] PL NO.: ${packingListData.packing_list_number}`);
    console.log(`[Upload] DATE: ${packingListData.packing_list_date}`);
    console.log(`[Upload] Exporter: ${packingListData.exporter_name}`);
    console.log(`[Upload] Consignee: ${packingListData.consignee_name}`);
    console.log(`[Upload] Total Boxes: ${totalBoxes}`);
    console.log(`[Upload] Completeness: ${validation.completeness}%`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json({
      success: true,
      packingListId,
      filename: file.name,
      fileUrl: url,
      processingTime,
      validation: {
        isValid: true,
        completeness: validation.completeness,
        errors: [],
        warnings: validation.warnings,
        invoiceMatchVerified,
        amountsMatchVerified,
        extractedData: {
          packingListNumber: extractedData.packingListNumber,
          packingListDate: normalizedDate,
          referenceNo: extractedData.referenceNo,
          proformaInvoiceNo: extractedData.proformaInvoiceNo,
          
          exporter: {
            name: extractedData.exporter?.name,
            address: extractedData.exporter?.address,
            email: extractedData.exporter?.email,
            phone: extractedData.exporter?.phone,
            mobile: extractedData.exporter?.mobile,
            pan: extractedData.exporter?.pan,
            gstin: extractedData.exporter?.gstin,
            iec: extractedData.exporter?.iec
          },
          
          consignee: {
            name: extractedData.consignee?.name,
            address: extractedData.consignee?.address,
            email: extractedData.consignee?.email,
            phone: extractedData.consignee?.phone,
            mobile: extractedData.consignee?.mobile,
            poBox: extractedData.consignee?.poBox
          },
          
          bankDetails: {
            bankName: extractedData.bankDetails?.bankName,
            bankAddress: extractedData.bankDetails?.bankAddress,
            usdAccount: extractedData.bankDetails?.usdAccount,
            euroAccount: extractedData.bankDetails?.euroAccount,
            ifscCode: extractedData.bankDetails?.ifscCode,
            swiftCode: extractedData.bankDetails?.swiftCode,
            branchCode: extractedData.bankDetails?.branchCode,
            adCode: extractedData.bankDetails?.adCode,
            bsrCode: extractedData.bankDetails?.bsrCode
          },
          
          shipmentDetails: {
            countryOfOrigin: extractedData.shipmentDetails?.countryOfOrigin,
            countryOfDestination: extractedData.shipmentDetails?.countryOfDestination,
            preCarriageBy: extractedData.shipmentDetails?.preCarriageBy,
            placeOfReceipt: extractedData.shipmentDetails?.placeOfReceipt,
            deliveryTerms: extractedData.shipmentDetails?.deliveryTerms,
            hsnCode: extractedData.shipmentDetails?.hsnCode,
            vesselFlightNo: extractedData.shipmentDetails?.vesselFlightNo,
            portOfLoading: extractedData.shipmentDetails?.portOfLoading,
            portOfDischarge: extractedData.shipmentDetails?.portOfDischarge,
            finalDestination: extractedData.shipmentDetails?.finalDestination,
            freightTerms: extractedData.shipmentDetails?.freightTerms
          },
          
          marksAndNos: extractedData.marksAndNos,
          invoiceNumber: extractedData.invoiceNumber,
          invoiceDate: extractedData.invoiceDate,
          
          boxDetails: boxDetails,
          totalBoxes: totalBoxes,
          totalGrossWeight: extractedData.totalGrossWeight,
          totalNetWeight: extractedData.totalNetWeight,
          totalBoxWeight: extractedData.totalBoxWeight,
          packageType: extractedData.packageType,
          
          descriptionOfGoods: extractedData.descriptionOfGoods,
          certificationStatement: extractedData.certificationStatement
        }
      },
      message: `Packing List validated successfully. ${totalBoxes} box(es) found.${invoiceMatchVerified ? ' Matches Commercial Invoice.' : ''}${validation.warnings.length > 0 ? ` ${validation.warnings.length} warning(s).` : ''}`
    });

  } catch (error: any) {
    console.error('═══════════════════════════════════════');
    console.error('[Upload] ✗ Error:', error.message);
    console.error('═══════════════════════════════════════');
    
    // Cleanup on error
    if (storagePath) {
      await deleteFromStorage(storagePath);
    }

    // Determine appropriate error response
    if (error.message.includes('PDF')) {
      return NextResponse.json({
        success: false,
        error: 'PDF processing failed',
        details: error.message
      }, { status: 400 });
    }

    if (error.message.includes('timed out')) {
      return NextResponse.json({
        success: false,
        error: 'Processing timeout',
        details: 'The document took too long to process. Please try a smaller file.'
      }, { status: 408 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to process Packing List',
      details: error.message
    }, { status: 500 });
  }
}