// src/app/api/invoice/upload-invoice/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractAndValidateInvoice, InvoiceValidationResult } from '@/lib/agent';

import { createInvoiceRecord, verifyInvoiceSaved } from '@/lib/database';
import { Phone } from 'lucide-react';

// Force Node.js runtime for file processing
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large PDFs

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
interface ValidationSummary {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completeness: number;
  criticalFieldsMissing: number;
}

interface InvoiceMetadata {
  invoice_id: string;
  user_id: string;
  organization_id: string | null;
  thread_id: string;
  filename: string;
  filepath: string;
  uploaded_at: string;
  processed_at: string;
  status: 'valid' | 'invalid' | 'pending';
  
  // Invoice Details
  invoice_no: string | null;
  invoice_date: string | null;
  reference_no: string | null;
  proforma_invoice_no: string | null;
  marks_and_nos: string | null;
  
  // Consignee Details
  consignee_name: string | null;
  consignee_address: string | null;
  consignee_country: string | null;
  consignee_email: string | null;
  consignee_phone: string | null;
  
  // Exporter Details
  exporter_name: string | null;
  exporter_address: string | null;
  exporter_email: string | null;
  exporter_pan: string | null;
  exporter_gstin: string | null;
  exporter_iec: string | null;
  exporter_phone:string |null;
  
  // Bank Details
  bank_name: string | null;
  bank_account: string | null;
  bank_swift_code: string | null;
  bank_ifsc_code: string | null;
  
  // Shipment Details
  incoterms: string | null;
  place_of_receipt: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  final_destination: string | null;
  country_of_origin: string | null;
  hsn_code: string | null;
  
  // Financial Details
  total_amount: number | null;
  currency: string | null;
  
  // Validation & Items
  is_valid: boolean;
  completeness: number;
  validation_errors: string[];
  validation_warnings: string[];
  item_count: number;
  items: any[];
  has_signature: boolean;
  
  // Metadata
  extracted_text: string;
  document_type: string;
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================
function validateInvoiceData(validationResult: InvoiceValidationResult): ValidationSummary {
  const extractionErrors = Array.isArray(validationResult.errors) ? validationResult.errors : [];
  const extractionWarnings = Array.isArray(validationResult.warnings) ? validationResult.warnings : [];
  
  const { extractedData } = validationResult;
  const errors: string[] = [...extractionErrors];
  const warnings: string[] = [...extractionWarnings];

  console.log('[Validation] Starting with completeness:', validationResult.completeness + '%');

  // Count missing critical fields
  const criticalFields = [
    { name: 'Invoice Number', value: extractedData.invoiceNo },
    { name: 'Invoice Date', value: extractedData.date },
    { name: 'Consignee Name', value: extractedData.consignee?.name },
    { name: 'Exporter Name', value: extractedData.exporter?.name },
    { name: 'Total Amount', value: extractedData.totalAmount }
  ];

  const criticalFieldsMissing = criticalFields.filter(f => !f.value).length;

  // Log field status
  criticalFields.forEach(field => {
    const status = field.value ? '✓' : '✗';
    console.log(`[Validation] ${status} ${field.name}:`, field.value || 'MISSING');
  });

  // Strict validation: max 2 critical fields can be missing
  if (criticalFieldsMissing > 2) {
    errors.push(`Too many critical fields missing (${criticalFieldsMissing}/5)`);
  }

  // Amount validation
  if (extractedData.totalAmount !== null) {
    if (extractedData.totalAmount < 0) {
      errors.push('Total amount cannot be negative');
    } else if (extractedData.totalAmount < 10) {
      warnings.push('Total amount seems unusually low - please verify');
    }
  }

  // Items validation
  if (extractedData.itemList && extractedData.itemList.length > 0) {
    const itemsSum = extractedData.itemList.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const roundedSum = Math.round(itemsSum * 100) / 100;
    
    if (extractedData.totalAmount && Math.abs(roundedSum - extractedData.totalAmount) > 5.0) {
      warnings.push(`Items total (${roundedSum}) differs from invoice total (${extractedData.totalAmount})`);
    }
  }

  const summary: ValidationSummary = {
    isValid: errors.length === 0,
    errors,
    warnings,
    completeness: validationResult.completeness,
    criticalFieldsMissing
  };

  console.log('[Validation] Result:', {
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
// STORAGE MANAGEMENT
// ============================================
async function uploadToStorage(
  userId: string,
  filename: string,
  buffer: Buffer
): Promise<{ path: string; url: string }> {
  const { data, error } = await supabase.storage
    .from('invoices')
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
    .from('invoices')
    .getPublicUrl(data.path);

  console.log('[Storage] Uploaded:', data.path);
  return { path: data.path, url: publicUrl };
}

async function deleteFromStorage(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('invoices')
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
// DATABASE OPERATIONS
// ============================================
async function saveInvoiceToDatabase(
  invoiceData: InvoiceMetadata
): Promise<{ success: boolean; warning?: string }> {
  try {
    console.log('[DB] Saving invoice:', invoiceData.invoice_id);
    console.log('[DB] Invoice details:', {
      invoice_no: invoiceData.invoice_no,
      consignee: invoiceData.consignee_name,
      exporter: invoiceData.exporter_name,
      total_amount: invoiceData.total_amount,
      currency: invoiceData.currency,
      item_count: invoiceData.item_count
    });

    const savedInvoice = await createInvoiceRecord(invoiceData);
    console.log('[DB] ✓ Saved successfully');
    
    // Verify save
    const verified = await verifyInvoiceSaved(invoiceData.invoice_id);
    if (!verified) {
      console.error('[DB] ⚠️  Verification failed!');
      return { 
        success: false, 
        warning: 'Invoice not found after save - possible database issue' 
      };
    }
    
    console.log('[DB] ✓ Verified');
    return { success: true };
    
  } catch (error: any) {
    console.error('[DB] Save error:', {
      message: error.message,
      code: error.code
    });
    
    if (error.code === '23505' && error.message?.includes('invoice_no')) {
      return {
        success: false,
        warning: `Invoice ${invoiceData.invoice_no} already exists`
      };
    }
    
    return {
      success: false,
      warning: 'Database save failed'
    };
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
    console.log('[Upload] Processing invoice upload');
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
    const invoiceId = `inv_${timestamp}_${randomId}`;
    
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
    // STEP 4: AI EXTRACTION
    // ============================================
    console.log('[Upload] Starting AI extraction...');
    const aiExtraction = await extractAndValidateInvoice(extractedText);
    console.log('[Upload] ✓ AI extraction complete');
    console.log(`[Upload] Items: ${aiExtraction.extractedData.itemList?.length || 0}`);
    console.log(`[Upload] Completeness: ${aiExtraction.completeness}%`);

    // ============================================
    // STEP 5: VALIDATE EXTRACTED DATA
    // ============================================
    const validation = validateInvoiceData(aiExtraction);
    
    if (!validation.isValid) {
      console.log('[Upload] ✗ Validation failed - removing file');
      await deleteFromStorage(storagePath);
      
      return NextResponse.json({
        success: false,
        error: 'Invoice validation failed',
        validation: {
          isValid: false,
          errors: validation.errors,
          warnings: validation.warnings,
          completeness: validation.completeness,
          extractedData: {
            invoiceNo: aiExtraction.extractedData.invoiceNo,
            date: aiExtraction.extractedData.date,
            consignee: aiExtraction.extractedData.consignee?.name,
            exporter: aiExtraction.extractedData.exporter?.name
          }
        },
        message: 'Invoice contains missing or invalid required fields'
      }, { status: 400 });
    }

    // ============================================
    // STEP 6: PREPARE COMPLETE INVOICE METADATA
    // ============================================
    const { extractedData } = aiExtraction;
    const normalizedDate = normalizeDateFormat(extractedData.date);

    const invoiceData: InvoiceMetadata = {
      // Basic Info
      invoice_id: invoiceId,
      user_id: userId || 'anonymous',
      organization_id: organizationId,
      thread_id: threadId,
      filename: file.name,
      filepath: storagePath,
      uploaded_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      status: 'valid',
      
      // Invoice Details
      invoice_no: extractedData.invoiceNo,
      invoice_date: normalizedDate,
      reference_no: extractedData.referenceNo || null,
      proforma_invoice_no: extractedData.proformaInvoiceNo || null,
      marks_and_nos: extractedData.marksandnos || null,
      
      // Consignee Details (Complete)
      consignee_name: extractedData.consignee?.name || null,
      consignee_address: extractedData.consignee?.address || null,
      consignee_country: extractedData.consignee?.country || null,
      consignee_email: extractedData.consignee?.email || null,
      consignee_phone: extractedData.consignee?.phone || null,
      
      // Exporter Details (Complete)
      exporter_name: extractedData.exporter?.name || null,
      exporter_address: extractedData.exporter?.address || null,
      exporter_email: extractedData.exporter?.email || null,
      exporter_pan: extractedData.exporter?.pan || null,
      exporter_gstin: extractedData.exporter?.gstin || null,
      exporter_iec: extractedData.exporter?.iec || null,
      exporter_phone:extractedData.exporter?.phone||null,
      // Bank Details (Complete)
      bank_name: extractedData.bankDetails?.bankName || null,
      bank_account: extractedData.bankDetails?.usdAccount || extractedData.bankDetails?.euroAccount || null,
      bank_swift_code: extractedData.bankDetails?.swiftCode || null,
      bank_ifsc_code: extractedData.bankDetails?.ifscCode || null,
      
      // Shipment Details (Complete)
      incoterms: extractedData.shipmentDetails?.incoterms || null,
      place_of_receipt: extractedData.shipmentDetails?.placeOfReceipt || null,
      port_of_loading: extractedData.shipmentDetails?.portOfLoading || null,
      port_of_discharge: extractedData.shipmentDetails?.portOfDischarge || null,
      final_destination: extractedData.shipmentDetails?.finalDestination || null,
      country_of_origin: extractedData.shipmentDetails?.countryOfOrigin || null,
      hsn_code: extractedData.shipmentDetails?.hsnCode || null,
      
      // Financial Details
      total_amount: extractedData.totalAmount,
      currency: extractedData.currency || null,
      
      // Validation & Items
      is_valid: true,
      completeness: validation.completeness,
      validation_errors: validation.errors,
      validation_warnings: validation.warnings,
      item_count: extractedData.itemList?.length || 0,
      items: extractedData.itemList || [],
      has_signature: extractedData.signature || false,
      
      // Metadata
      extracted_text: extractedText.substring(0, TEXT_PREVIEW_LENGTH),
      document_type: 'invoice'
    };

    // ============================================
    // STEP 7: SAVE TO DATABASE
    // ============================================
    const dbResult = await saveInvoiceToDatabase(invoiceData);
    if (dbResult.warning) {
      validation.warnings.push(dbResult.warning);
    }

    // ============================================
    // STEP 8: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Upload] ✓ Success');
    console.log(`[Upload] Processing time: ${processingTime}ms`);
    console.log(`[Upload] Invoice: ${invoiceData.invoice_no}`);
    console.log(`[Upload] Completeness: ${validation.completeness}%`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json({
      success: true,
      invoiceId,
      filename: file.name,
      fileUrl: url,
      processingTime,
      validation: {
        isValid: true,
        completeness: validation.completeness,
        errors: [],
        warnings: validation.warnings,
        extractedData: {
          invoiceNo: extractedData.invoiceNo,
          marksandnos: extractedData.marksandnos,
          date: normalizedDate,
          referenceNo: extractedData.referenceNo,
          proformaInvoiceNo: extractedData.proformaInvoiceNo,
          consignee: {
            name: extractedData.consignee?.name,
            address: extractedData.consignee?.address,
            email: extractedData.consignee?.email,
            phone: extractedData.consignee?.phone,
            country: extractedData.consignee?.country,
          },
          exporter: {
            name: extractedData.exporter?.name,
            address: extractedData.exporter?.address,
            phone:extractedData.exporter?.phone,
            email: extractedData.exporter?.email,
            pan: extractedData.exporter?.pan,
            gstin: extractedData.exporter?.gstin,
            iec: extractedData.exporter?.iec
          },
          bankDetails: {
            bankName: extractedData.bankDetails?.bankName,
            usdAccount: extractedData.bankDetails?.usdAccount,
            swiftCode: extractedData.bankDetails?.swiftCode,
            ifscCode: extractedData.bankDetails?.ifscCode
          },
          shipmentDetails: {
            incoterms: extractedData.shipmentDetails?.incoterms,
            portOfLoading: extractedData.shipmentDetails?.portOfLoading,
            portOfDischarge: extractedData.shipmentDetails?.portOfDischarge,
            hsnCode: extractedData.shipmentDetails?.hsnCode,
            finalDestination: extractedData.shipmentDetails?.finalDestination,
            countryOfOrigin: extractedData.shipmentDetails?.countryOfOrigin,
            placeOfReceipt: extractedData.shipmentDetails?.placeOfReceipt
          },
          itemCount: extractedData.itemList?.length || 0,
          items: extractedData.itemList || [],
          totalAmount: extractedData.totalAmount,
          currency: extractedData.currency,
          signature: extractedData.signature
        }
      },
      message: `Invoice validated successfully. Extracted ${invoiceData.item_count} items with ${validation.completeness}% completeness.`
    });

  } catch (error: any) {
    console.error('═══════════════════════════════════════');
    console.error('[Upload] ✗ Error:', error.message);
    console.error('═══════════════════════════════════════');
    
    // Cleanup on error
    if (storagePath) {
      await deleteFromStorage(storagePath);
    }

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
        details: 'The invoice took too long to process. Please try a smaller file.'
      }, { status: 408 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to process invoice',
      details: error.message
    }, { status: 500 });
  }
}