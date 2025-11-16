// src/app/api/invoice/upload-fumigation-certificate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extractAndValidateFumigationCertificate, FumigationCertificateValidationResult } from '@/lib/agent';
import { createFumigationCertificateRecord, verifyFumigationCertificateSaved } from '@/lib/database';

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

interface FumigationCertificateMetadata {
  fumigation_certificate_id: string;
  user_id: string;
  organization_id: string | null;
  thread_id: string;
  filename: string;
  filepath: string;
  uploaded_at: string;
  processed_at: string;
  status: 'valid' | 'invalid' | 'pending';
  
  // Core Certificate fields
  certificate_number: string | null;
  certificate_date: string | null;
  dppqs_registration_number: string | null;
  
  // Treatment Details
  fumigant_name: string | null;
  fumigation_date: string | null;
  fumigation_place: string | null;
  fumigant_dosage: string | null;
  fumigation_duration: string | null;
  minimum_temperature: string | null;
  gastight_sheets: boolean | null;
  pressure_decay_value: string | null;
  invoice_no_fumigation_certificate:string|null;
  invoice_date_fumigation_certificate:string|null;
  // Goods Description
  container_number: string | null;
  seal_number: string | null;
  exporter_name: string | null;
  exporter_address: string | null;
  consignee_name: string | null;
  cargo_type: string | null;
  cargo_description: string | null;
  quantity: string | null;
  packaging_material: string | null;
  additional_declaration: string | null;
  shipping_mark: string | null;
  
  // Referenced Invoice
  invoice_number: string | null;
  invoice_date: string | null;
  
  // Operator Information
  operator_name: string | null;
  operator_signature_status: boolean | null;
  accreditation_number: string | null;
  
  // Validation
  is_valid: boolean;
  completeness: number;
  validation_errors: string[];
  validation_warnings: string[];
  invoice_match_verified: boolean;
  
  extracted_text: string;
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================
function validateFumigationCertificateData(validationResult: FumigationCertificateValidationResult): ValidationSummary {
  const extractionErrors = Array.isArray(validationResult.errors) ? validationResult.errors : [];
  const extractionWarnings = Array.isArray(validationResult.warnings) ? validationResult.warnings : [];
  
  const { extractedData } = validationResult;
  const errors: string[] = [...extractionErrors];
  const warnings: string[] = [...extractionWarnings];

  console.log('[Validation] Starting Fumigation Certificate validation, completeness:', validationResult.completeness + '%');
  console.log(extractedData.invoiceDate);
  console.log(extractedData.invoiceNo);
  console.log("(((((((((((((((((((((((((((((((((((((((((((((****************))))))))))))))))))))))))))")
  // Critical fields from Fumigation Certificate
  const criticalFields = [
    { name: 'Certificate Number', value: extractedData.certificateNumber },
    { name: 'Certificate Date', value: extractedData.certificateDate },
    { name: 'Fumigant Name', value: extractedData.fumigantName },
    { name: 'Fumigation Date', value: extractedData.fumigationDate },
    { name: 'Fumigation Place', value: extractedData.fumigationPlace },
    { name: 'Exporter Name', value: extractedData.exporterName },
    { name: 'Cargo Description', value: extractedData.cargoDescription }
  ];

  const criticalFieldsMissing = criticalFields.filter(f => !f.value).length;

  // Log field status
  criticalFields.forEach(field => {
    const status = field.value ? '✓' : '✗';
    console.log(`[Validation] ${status} ${field.name}:`, field.value || 'MISSING');
  });

  // Validation rules
  if (!extractedData.certificateNumber) {
    errors.push('Certificate Number is required');
  }

  if (!extractedData.certificateDate) {
    errors.push('Certificate Date/Date of Issue is required');
  }

  if (!extractedData.fumigantName) {
    errors.push('Name of fumigant is required');
  }

  if (!extractedData.fumigationDate) {
    errors.push('Date of fumigation is required');
  }

  if (!extractedData.fumigationPlace) {
    errors.push('Place of fumigation is required');
  }

  if (!extractedData.exporterName) {
    warnings.push('Exporter name and address not found');
  }

  if (!extractedData.cargoDescription) {
    warnings.push('Cargo description not found');
  }

  // Treatment validation
  if (!extractedData.fumigantDosage) {
    warnings.push('Fumigant dosage not specified');
  }

  if (!extractedData.fumigationDuration) {
    warnings.push('Duration of fumigation not specified');
  }

  if (extractedData.gastightSheets === null) {
    warnings.push('Gastight sheets usage not confirmed');
  }

  // Date validation
  if (extractedData.certificateDate && extractedData.fumigationDate) {
    const certDate = new Date(extractedData.certificateDate);
    const fumDate = new Date(extractedData.fumigationDate);
    
    if (certDate < fumDate) {
      warnings.push('Certificate date is before fumigation date - may need verification');
    }
  }

  // Operator validation
  if (!extractedData.operatorSignatureStatus) {
    warnings.push('Operator signature not detected');
  }

  // Fail if too many critical fields missing
  if (criticalFieldsMissing > 2) {
    errors.push(`Too many critical fields missing (${criticalFieldsMissing}/${criticalFields.length})`);
  }

  const summary: ValidationSummary = {
    isValid: errors.length === 0,
    errors,
    warnings,
    completeness: validationResult.completeness,
    criticalFieldsMissing
  };

  console.log('[Validation] Fumigation Certificate result:', {
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
    .from('fumigation_certificates')
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
    .from('fumigation_certificates')
    .getPublicUrl(data.path);

  console.log('[Storage] Uploaded Fumigation Certificate:', data.path);
  return { path: data.path, url: publicUrl };
}

async function deleteFromStorage(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('fumigation_certificates')
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
async function verifyInvoiceMatch(
  shippingMark: string | null,
  threadId: string
): Promise<{ matched: boolean; invoiceData?: any }> {
  try {
    if (!shippingMark) {
      console.log('[Match] No shipping mark found for invoice matching');
      return { matched: false };
    }

    // Extract potential invoice number from shipping mark (e.g., "222500187 Dt 17.07.2025")
    const invoiceNumberMatch = shippingMark.match(/(\d+)/);
    if (!invoiceNumberMatch) {
      console.log('[Match] Could not extract invoice number from shipping mark');
      return { matched: false };
    }

    const potentialInvoiceNumber = invoiceNumberMatch[1];
    console.log('[Match] Searching for invoice:', potentialInvoiceNumber, 'in thread:', threadId);
    
    // Query commercial_invoices table
    const { data, error } = await supabase
      .from('commercial_invoices')
      .select('*')
      .eq('invoice_number', potentialInvoiceNumber)
      .eq('thread_id', threadId)
      .single();

    if (error || !data) {
      console.log('[Match] No matching Commercial Invoice found');
      return { matched: false };
    }

    console.log('[Match] ✓ Found matching Commercial Invoice:', potentialInvoiceNumber);
    
    return { 
      matched: true, 
      invoiceData: data
    };
  } catch (error) {
    console.error('[Match] Error checking invoice:', error);
    return { matched: false };
  }
}

// ============================================
// DATABASE OPERATIONS
// ============================================
async function saveFumigationCertificateToDatabase(
  certificateData: FumigationCertificateMetadata
): Promise<{ success: boolean; warning?: string }> {
  try {
    console.log('[DB] Saving Fumigation Certificate:', certificateData.fumigation_certificate_id);
    
    await createFumigationCertificateRecord(certificateData);
    console.log('[DB] ✓ Saved Fumigation Certificate successfully');
    
    // Verify save
    const verified = await verifyFumigationCertificateSaved(certificateData.fumigation_certificate_id);
    if (!verified) {
      console.error('[DB] ⚠️  Verification failed!');
      return { 
        success: false, 
        warning: 'Fumigation Certificate not found after save - possible database issue' 
      };
    }
    
    console.log('[DB] ✓ Verified Fumigation Certificate');
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
async function updateThreadWithCertificate(
  threadId: string,
  certificateId: string
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
    console.log('[Upload] Processing Fumigation Certificate upload');
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
    
    // Generate proper UUID for certificate ID (fixes the database error)
    const certificateId = randomUUID();
    
    // Convert to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log(`[Upload] File: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    console.log(`[Upload] Generated UUID: ${certificateId}`);

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
    // STEP 4: AI EXTRACTION FOR FUMIGATION CERTIFICATE
    // ============================================
    console.log('[Upload] Starting AI extraction for Fumigation Certificate...');
    const aiExtraction = await extractAndValidateFumigationCertificate(extractedText);
    console.log('[Upload] ✓ AI extraction complete');
    console.log(`[Upload] Completeness: ${aiExtraction.completeness}%`);

    // ============================================
    // STEP 5: VALIDATE EXTRACTED DATA
    // ============================================
    const validation = validateFumigationCertificateData(aiExtraction);
    
    if (!validation.isValid) {
      console.log('[Upload] ✗ Validation failed - removing file');
      await deleteFromStorage(storagePath);
      
      return NextResponse.json({
        success: false,
        error: 'Fumigation Certificate validation failed',
        validation: {
          isValid: false,
          errors: validation.errors,
          warnings: validation.warnings,
          completeness: validation.completeness,
          extractedData: {
            certificateNumber: aiExtraction.extractedData.certificateNumber,
            certificateDate: aiExtraction.extractedData.certificateDate,
            fumigantName: aiExtraction.extractedData.fumigantName,
            fumigationDate: aiExtraction.extractedData.fumigationDate
          }
        },
        message: 'Fumigation Certificate contains missing or invalid required fields'
      }, { status: 400 });
    }

    // ============================================
    // STEP 6: VERIFY INVOICE MATCH
    // ============================================
    const { extractedData } = aiExtraction;
    let invoiceMatchVerified = false;
    let matchedInvoiceNumber: string | null = null;
    let matchedInvoiceDate: string | null = null;
    
    if (extractedData.shippingMark) {
      const invoiceCheck = await verifyInvoiceMatch(
        extractedData.shippingMark,
        threadId
      );
      
      invoiceMatchVerified = invoiceCheck.matched;
      
      if (invoiceCheck.matched && invoiceCheck.invoiceData) {
        matchedInvoiceNumber = invoiceCheck.invoiceData.invoice_number;
        matchedInvoiceDate = invoiceCheck.invoiceData.invoice_date;
        console.log('[Upload] ✓ Invoice match verified from shipping mark');
      } else {
        validation.warnings.push(
          `Could not match shipping mark "${extractedData.shippingMark}" to a Commercial Invoice in thread`
        );
      }
    } else {
      validation.warnings.push('No shipping mark found - cannot verify against Commercial Invoice');
    }

    // ============================================
    // STEP 7: PREPARE CERTIFICATE METADATA
    // ============================================
    const certificateData: FumigationCertificateMetadata = {
      fumigation_certificate_id: certificateId,
      user_id: userId || 'anonymous',
      organization_id: organizationId,
      thread_id: threadId,
      filename: file.name,
      filepath: storagePath,
      uploaded_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      status: 'valid',
      
      // Core Certificate fields
      certificate_number: extractedData.certificateNumber,
      certificate_date: extractedData.certificateDate,
      dppqs_registration_number: extractedData.dppqsRegistrationNumber,
      
      // Treatment Details
      fumigant_name: extractedData.fumigantName,
      fumigation_date: extractedData.fumigationDate,
      fumigation_place: extractedData.fumigationPlace,
      fumigant_dosage: extractedData.fumigantDosage,
      fumigation_duration: extractedData.fumigationDuration,
      minimum_temperature: extractedData.minimumTemperature,
      gastight_sheets: extractedData.gastightSheets,
      pressure_decay_value: extractedData.pressureDecayValue,
      invoice_date_fumigation_certificate:extractedData.invoiceDate,
      invoice_no_fumigation_certificate:extractedData.invoiceNo,
      // Goods Description
      container_number: extractedData.containerNumber,
      seal_number: extractedData.sealNumber,
      exporter_name: extractedData.exporterName,
      exporter_address: extractedData.exporterAddress,
      consignee_name: extractedData.consigneeName,
      cargo_type: extractedData.cargoType,
      cargo_description: extractedData.cargoDescription,
      quantity: extractedData.quantity,
      packaging_material: extractedData.packagingMaterial,
      additional_declaration: extractedData.additionalDeclaration,
      shipping_mark: extractedData.shippingMark,
      
      // Referenced Invoice (from matching)
      invoice_number: matchedInvoiceNumber,
      invoice_date: matchedInvoiceDate,
      
      // Operator Information
      operator_name: extractedData.operatorName,
      operator_signature_status: extractedData.operatorSignatureStatus,
      accreditation_number: extractedData.accreditationNumber,
      
      // Validation
      is_valid: true,
      completeness: validation.completeness,
      validation_errors: validation.errors,
      validation_warnings: validation.warnings,
      invoice_match_verified: invoiceMatchVerified,
      
      extracted_text: extractedText.substring(0, TEXT_PREVIEW_LENGTH)
    };

    // ============================================
    // STEP 8: SAVE TO DATABASE
    // ============================================
    const dbResult = await saveFumigationCertificateToDatabase(certificateData);
    
    if (!dbResult.success) {
      await deleteFromStorage(storagePath);
      
      return NextResponse.json({
        success: false,
        error: 'Failed to save Fumigation Certificate',
        details: dbResult.warning || 'Database storage failed'
      }, { status: 500 });
    }

    // ============================================
    // STEP 9: UPDATE THREAD
    // ============================================
    await updateThreadWithCertificate(threadId, certificateId);

    // ============================================
    // STEP 10: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Upload] ✓ Fumigation Certificate processed successfully');
    console.log(`[Upload] Processing time: ${processingTime}ms`);
    console.log(`[Upload] Certificate No.: ${certificateData.certificate_number}`);
    console.log(`[Upload] Date of Issue: ${certificateData.certificate_date}`);
    console.log(`[Upload] Fumigant: ${certificateData.fumigant_name}`);
    console.log(`[Upload] Exporter: ${certificateData.exporter_name}`);
    console.log(`[Upload] Invoice Match: ${invoiceMatchVerified ? 'YES' : 'NO'}`);
    console.log(`[Upload] Completeness: ${validation.completeness}%`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json({
      success: true,
      certificateId,
      filename: file.name,
      fileUrl: url,
      processingTime,
      validation: {
        isValid: true,
        completeness: validation.completeness,
        errors: [],
        warnings: validation.warnings,
        invoiceMatchVerified,
        extractedData: {
          certificateNumber: extractedData.certificateNumber,
          certificateDate: extractedData.certificateDate,
          invoie_date_fumigation_certificate:extractedData.invoiceDate,
          invoice_no_fumigation_certificate:extractedData.invoiceNo,
          dppqsRegistrationNumber: extractedData.dppqsRegistrationNumber,
          fumigantName: extractedData.fumigantName,
          fumigationDate: extractedData.fumigationDate,
          fumigationPlace: extractedData.fumigationPlace,
          fumigantDosage: extractedData.fumigantDosage,
          fumigationDuration: extractedData.fumigationDuration,
          minimumTemperature: extractedData.minimumTemperature,
          gastightSheets: extractedData.gastightSheets,
          containerNumber: extractedData.containerNumber,
          exporterName: extractedData.exporterName,
          exporterAddress: extractedData.exporterAddress,
          consigneeName: extractedData.consigneeName,
          cargoType: extractedData.cargoType,
          cargoDescription: extractedData.cargoDescription,
          quantity: extractedData.quantity,
          packagingMaterial: extractedData.packagingMaterial,
          additionalDeclaration: extractedData.additionalDeclaration,
          shippingMark: extractedData.shippingMark,
          invoiceNumber: matchedInvoiceNumber,
          invoiceDate: matchedInvoiceDate,
          operatorName: extractedData.operatorName,
          operatorSignatureStatus: extractedData.operatorSignatureStatus,
          accreditationNumber: extractedData.accreditationNumber
        }
      },
      message: `Fumigation Certificate validated successfully. Treatment completed on ${extractedData.fumigationDate} at ${extractedData.fumigationPlace}.${invoiceMatchVerified ? ' Matches Commercial Invoice.' : ' No matching invoice found.'}${validation.warnings.length > 0 ? ` ${validation.warnings.length} warning(s).` : ''}`
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
      error: 'Failed to process Fumigation Certificate',
      details: error.message
    }, { status: 500 });
  }
}