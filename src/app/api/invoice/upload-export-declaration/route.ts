// src/app/api/invoice/upload-export-declaration/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extractAndValidateExportDeclaration, ExportDeclarationValidationResult, detectDocumentType } from '@/lib/agent';
import { createExportDeclarationRecord, verifyExportDeclarationSaved } from '@/lib/database';

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
interface ValidationSummary {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completeness: number;
  criticalFieldsMissing: number;
}

interface ExportDeclarationMetadata {
  declaration_id: string;
  user_id: string;
  organization_id: string | null;
  thread_id: string;
  filename: string;
  filepath: string;
  uploaded_at: string;
  processed_at: string;
  status: 'valid' | 'invalid' | 'pending';
  
  // Core fields
  document_type: string;
  invoice_no: string | null;
  invoice_date: string | null;
  shipping_bill_no: string | null;
  shipping_bill_date: string | null;
  
  // Valuation fields
  valuation_method: string | null;
  seller_buyer_related: boolean | null;
  relationship_influenced_price: boolean | null;
  applicable_rule: string | null;
  
  // Transaction fields
  payment_terms: string | null;
  delivery_terms: string | null;
  type_of_sale: string | null;
  
  // Declaration fields
  declaration_status: string | null;
  signed_by: string | null;
  signed_date: string | null;
  declaration_number: string | null;
  
  // Validation
  is_valid: boolean;
  completeness: number;
  validation_errors: string[];
  validation_warnings: string[];
  
  extracted_text: string;
}

// ============================================
// DATE CONVERSION UTILITY
// ============================================
function convertToISODate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  
  // Remove any whitespace
  dateStr = dateStr.trim();
  
  // If already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Handle DD.MM.YYYY format
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('.');
    return `${year}-${month}-${day}`;
  }
  
  // Handle DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  }
  
  // Handle DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`;
  }
  
  // Try to parse as Date object and convert
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    console.error('[Date] Conversion failed:', e);
  }
  
  // If all else fails, return null
  console.warn('[Date] Could not convert date format:', dateStr);
  return null;
}

// ============================================
// BOOLEAN TO INTEGER CONVERSION UTILITY
// ============================================
function convertBooleanToInt(value: boolean | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return value ? 1 : 0;
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================
function validateExportDeclarationData(validationResult: ExportDeclarationValidationResult): ValidationSummary {
  const extractionErrors = Array.isArray(validationResult.errors) ? validationResult.errors : [];
  const extractionWarnings = Array.isArray(validationResult.warnings) ? validationResult.warnings : [];
  
  const { extractedData } = validationResult;
  const errors: string[] = [...extractionErrors];
  const warnings: string[] = [...extractionWarnings];

  console.log('[Validation] Starting export declaration validation, completeness:', validationResult.completeness + '%');

  // Count missing critical fields
  const criticalFields = [
    { name: 'Invoice Number', value: extractedData.invoiceNo },
    { name: 'Invoice Date', value: extractedData.invoiceDate },
    { name: 'Valuation Method', value: extractedData.valuationMethod }
  ];

  const criticalFieldsMissing = criticalFields.filter(f => !f.value).length;

  // Log field status
  criticalFields.forEach(field => {
    const status = field.value ? '✓' : '✗';
    console.log(`[Validation] ${status} ${field.name}:`, field.value || 'MISSING');
  });

  // Strict validation
  if (criticalFieldsMissing > 1) {
    errors.push(`Too many critical fields missing (${criticalFieldsMissing}/3)`);
  }

  // Relationship validation
  if (extractedData.sellerBuyerRelated === null) {
    warnings.push('Seller-Buyer relationship status not specified');
  }

  if (extractedData.relationshipInfluencedPrice === null) {
    warnings.push('Relationship price influence status not specified');
  }

  // Date validation
  if (extractedData.shippingBillDate && extractedData.invoiceDate) {
    const shippingDate = new Date(extractedData.shippingBillDate);
    const invoiceDate = new Date(extractedData.invoiceDate);
    
    if (shippingDate < invoiceDate) {
      warnings.push('Shipping bill date is before invoice date - may need verification');
    }
  }

  const summary: ValidationSummary = {
    isValid: errors.length === 0,
    errors,
    warnings,
    completeness: validationResult.completeness,
    criticalFieldsMissing
  };

  console.log('[Validation] Export declaration result:', {
    isValid: summary.isValid,
    errors: summary.errors.length,
    warnings: summary.warnings.length,
    completeness: summary.completeness + '%',
    criticalMissing: summary.criticalFieldsMissing
  });

  return summary;
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
    .from('export_declarations')
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
    .from('export_declarations')
    .getPublicUrl(data.path);

  console.log('[Storage] Uploaded export declaration:', data.path);
  return { path: data.path, url: publicUrl };
}

async function deleteFromStorage(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('export_declarations')
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
// DATABASE OPERATIONS
// ============================================
async function saveExportDeclarationToDatabase(
  declarationData: ExportDeclarationMetadata
): Promise<{ success: boolean; warning?: string }> {
  try {
    console.log('[DB] Saving export declaration:', declarationData.declaration_id);
    
    await createExportDeclarationRecord(declarationData);
    console.log('[DB] ✓ Saved export declaration successfully');
    
    // Verify save
    const verified = await verifyExportDeclarationSaved(declarationData.declaration_id);
    if (!verified) {
      console.error('[DB] ⚠️  Verification failed!');
      return { 
        success: false, 
        warning: 'Export declaration not found after save - possible database issue' 
      };
    }
    
    console.log('[DB] ✓ Verified export declaration');
    return { success: true };
    
  } catch (error: any) {
    console.error('[DB] Save error:', {
      message: error.message,
      code: error.code
    });
    
    return {
      success: false,
      warning: 'Database save failed - please try again'
    };
  }
}

// ============================================
// THREAD MANAGEMENT
// ============================================
async function updateThreadWithDeclaration(
  threadId: string,
  declarationId: string
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
    console.log('[Upload] Processing export declaration upload');
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
    
    // Generate proper UUID for declaration ID (fixes the database error)
    const declarationId = randomUUID();
    
    // Convert to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log(`[Upload] File: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    console.log(`[Upload] Generated UUID: ${declarationId}`);

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
    // STEP 4: DETECT DOCUMENT TYPE
    // ============================================
    console.log('[Upload] Detecting document type...');
    const detectedType = await detectDocumentType(extractedText);
    console.log(`[Upload] Detected type: ${detectedType}`);

    // ============================================
    // STEP 5: AI EXTRACTION FOR EXPORT DECLARATION
    // ============================================
    console.log('[Upload] Starting AI extraction for export declaration...');
    const aiExtraction = await extractAndValidateExportDeclaration(extractedText);
    console.log('[Upload] ✓ AI extraction complete');
    console.log(`[Upload] Completeness: ${aiExtraction.completeness}%`);

    // ============================================
    // STEP 6: VALIDATE EXTRACTED DATA
    // ============================================
    const validation = validateExportDeclarationData(aiExtraction);
    
    if (!validation.isValid) {
      console.log('[Upload] ✗ Validation failed - removing file');
      await deleteFromStorage(storagePath);
      
      return NextResponse.json({
        success: false,
        error: 'Export declaration validation failed',
        validation: {
          isValid: false,
          errors: validation.errors,
          warnings: validation.warnings,
          completeness: validation.completeness,
          extractedData: {
            invoiceNo: aiExtraction.extractedData.invoiceNo,
            invoiceDate: aiExtraction.extractedData.invoiceDate,
            shippingBillNo: aiExtraction.extractedData.shippingBillNo,
            valuationMethod: aiExtraction.extractedData.valuationMethod
          }
        },
        message: 'Export declaration contains missing or invalid required fields'
      }, { status: 400 });
    }

    // ============================================
    // STEP 7: PREPARE DECLARATION METADATA
    // ============================================
    const { extractedData } = aiExtraction;

    const declarationData: ExportDeclarationMetadata = {
      declaration_id: declarationId,
      user_id: userId || 'anonymous',
      organization_id: organizationId,
      thread_id: threadId,
      filename: file.name,
      filepath: storagePath,
      uploaded_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      status: 'valid',
      
      // Core fields - WITH DATE CONVERSION
      document_type: extractedData.documentType || 'Export Value Declaration',
      invoice_no: extractedData.invoiceNo,
      invoice_date: convertToISODate(extractedData.invoiceDate),
      shipping_bill_no: extractedData.shippingBillNo,
      shipping_bill_date: convertToISODate(extractedData.shippingBillDate),
      
      // Valuation fields
      valuation_method: extractedData.valuationMethod,
      seller_buyer_related: extractedData.sellerBuyerRelated,
      relationship_influenced_price: extractedData.relationshipInfluencedPrice,
      applicable_rule: extractedData.applicableRule,
      
      // Transaction fields
      payment_terms: extractedData.paymentTerms,
      delivery_terms: extractedData.deliveryTerms,
      type_of_sale: extractedData.typeOfSale,
      
      // Declaration fields - WITH DATE CONVERSION
      declaration_status: extractedData.declarationStatus,
      signed_by: extractedData.signedBy,
      signed_date: convertToISODate(extractedData.signedDate),
      declaration_number: extractedData.declarationNumber,
      
      // Validation
      is_valid: true,
      completeness: validation.completeness,
      validation_errors: validation.errors,
      validation_warnings: validation.warnings,
      
      extracted_text: extractedText.substring(0, TEXT_PREVIEW_LENGTH)
    };

    // ============================================
    // STEP 8: SAVE TO DATABASE
    // ============================================
    const dbResult = await saveExportDeclarationToDatabase(declarationData);
    
    if (!dbResult.success) {
      await deleteFromStorage(storagePath);
      
      return NextResponse.json({
        success: false,
        error: 'Failed to save export declaration',
        details: dbResult.warning || 'Database storage failed'
      }, { status: 500 });
    }

    // ============================================
    // STEP 9: UPDATE THREAD
    // ============================================
    await updateThreadWithDeclaration(threadId, declarationId);

    // ============================================
    // STEP 10: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Upload] ✓ Export declaration processed successfully');
    console.log(`[Upload] Processing time: ${processingTime}ms`);
    console.log(`[Upload] Invoice: ${declarationData.invoice_no}`);
    console.log(`[Upload] Shipping Bill: ${declarationData.shipping_bill_no}`);
    console.log(`[Upload] Completeness: ${validation.completeness}%`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json({
      success: true,
      declarationId,
      filename: file.name,
      fileUrl: url,
      processingTime,
      validation: {
        isValid: true,
        completeness: validation.completeness,
        errors: [],
        warnings: validation.warnings,
        extractedData: {
          documentType: extractedData.documentType,
          invoiceNo: extractedData.invoiceNo,
          invoiceDate: extractedData.invoiceDate,
          shippingBillNo: extractedData.shippingBillNo,
          shippingBillDate: extractedData.shippingBillDate,
          valuationMethod: extractedData.valuationMethod,
          sellerBuyerRelated: extractedData.sellerBuyerRelated,
          relationshipInfluencedPrice: extractedData.relationshipInfluencedPrice,
          paymentTerms: extractedData.paymentTerms,
          deliveryTerms: extractedData.deliveryTerms,
          typeOfSale: extractedData.typeOfSale,
          declarationStatus: extractedData.declarationStatus,
          applicableRule: extractedData.applicableRule,
          declarationNumber: extractedData.declarationNumber,
          signedBy: extractedData.signedBy,
          signedDate: extractedData.signedDate
        }
      },
      message: `Export declaration validated successfully. Ready for cross-verification with commercial invoice.`
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
      error: 'Failed to process export declaration',
      details: error.message
    }, { status: 500 });
  }
}