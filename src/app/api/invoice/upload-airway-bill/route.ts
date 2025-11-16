// src/app/api/invoice/upload-airway-bill/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extractAndValidateAirwayBill, AirwayBillValidationResult, detectDocumentType } from '@/lib/agent';
import { createAirwayBillRecord, verifyAirwayBillSaved } from '@/lib/database';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

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

interface AirwayBillMetadata {
  airway_bill_id: string;
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
  airway_bill_no: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  
  // Shipper information
  shippers_name: string | null;
  shippers_address: string | null;
  
  // Consignee information
  consignees_name: string | null;
  consignees_address: string | null;
  
  // Carrier information
  issuing_carriers_name: string | null;
  issuing_carriers_city: string | null;
  agents_iata_code: string | null;
  
  // Shipment details
  airport_of_departure: string | null;
  airport_of_destination: string | null;
  accounting_information: string | null;
  
  // Cargo details
  hs_code_no: string | null;
  no_of_pieces: string | null;
  gross_weight: string | null;
  chargeable_weight: string | null;
  nature_of_goods: string | null;
  
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
// VALIDATION FUNCTIONS
// ============================================
function validateAirwayBillData(validationResult: AirwayBillValidationResult): ValidationSummary {
  const extractionErrors = Array.isArray(validationResult.errors) ? validationResult.errors : [];
  const extractionWarnings = Array.isArray(validationResult.warnings) ? validationResult.warnings : [];
  
  const { extractedData } = validationResult;
  const errors: string[] = [...extractionErrors];
  const warnings: string[] = [...extractionWarnings];

  console.log('[Validation] Starting airway bill validation, completeness:', validationResult.completeness + '%');

  // Count missing critical fields
  const criticalFields = [
    { name: 'Airway Bill Number', value: extractedData.airwayBillNo },
    { name: 'Shippers Name', value: extractedData.shippersName },
    { name: 'Consignees Name', value: extractedData.consigneesName },
    { name: 'Issuing Carriers Name', value: extractedData.issuingCarriersName }
  ];

  const criticalFieldsMissing = criticalFields.filter(f => !f.value).length;

  // Log field status
  criticalFields.forEach(field => {
    const status = field.value ? '✓' : '✗';
    console.log(`[Validation] ${status} ${field.name}:`, field.value || 'MISSING');
  });

  // Strict validation
  if (criticalFieldsMissing > 1) {
    errors.push(`Too many critical fields missing (${criticalFieldsMissing}/4)`);
  }

  // Address validation
  if (!extractedData.shippersAddress) {
    warnings.push('Shipper address not found');
  }

  if (!extractedData.consigneesAddress) {
    warnings.push('Consignee address not found');
  }

  // Airport validation
  if (!extractedData.airportOfDeparture) {
    warnings.push('Airport of departure not specified');
  }

  const summary: ValidationSummary = {
    isValid: errors.length === 0,
    errors,
    warnings,
    completeness: validationResult.completeness,
    criticalFieldsMissing
  };

  console.log('[Validation] Airway bill result:', {
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
    .from('airway_bills')
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
    .from('airway_bills')
    .getPublicUrl(data.path);

  console.log('[Storage] Uploaded airway bill:', data.path);
  return { path: data.path, url: publicUrl };
}

async function deleteFromStorage(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('airway_bills')
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
// PDF PARSING WITH PYTHON MICROSERVICE
// ============================================

/**
 * Parse PDF using Python microservice (most robust for complex PDFs)
 */
async function parsePDFWithPython(buffer: Buffer): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('[Python] Starting Python PDF extraction...');
      
      // Create temporary directory if it doesn't exist
      const tempDir = '/tmp';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Save buffer to temporary file
      const tempFile = path.join(tempDir, `pdf_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`);
      fs.writeFileSync(tempFile, buffer);
      
      console.log(`[Python] Temporary file created: ${tempFile}`);
      
      // Get the path to the Python script
      const pythonScriptPath = path.join(process.cwd(), 'pdf_extractor.py');
      
      if (!fs.existsSync(pythonScriptPath)) {
        throw new Error(`Python script not found at: ${pythonScriptPath}`);
      }
      
      // Run Python script
      const pythonProcess = spawn('python3', [pythonScriptPath, tempFile]);
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code: number) => {
        // Clean up temp file regardless of outcome
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
            console.log(`[Python] Temporary file deleted: ${tempFile}`);
          }
        } catch (e) {
          console.warn('[Python] Could not delete temp file:', e);
        }
        
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            if (result.success) {
              console.log(`[Python] ✓ Extracted ${result.length} characters using: ${result.methods_used?.join(', ')}`);
              resolve(result.text);
            } else {
              reject(new Error(result.error || 'Python extraction failed'));
            }
          } catch (e) {
            reject(new Error(`Invalid JSON response from Python: ${stdout}. Error: ${e}`));
          }
        } else {
          reject(new Error(`Python process exited with code ${code}. Stderr: ${stderr}`));
        }
      });
      
      // Handle process errors
      pythonProcess.on('error', (error) => {
        // Clean up temp file on error
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        } catch (e) {
          console.warn('[Python] Could not delete temp file on error:', e);
        }
        reject(new Error(`Python process failed to start: ${error.message}`));
      });
      
      // Set timeout for Python process (30 seconds)
      const timeout = setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Python extraction timed out after 30 seconds'));
      }, 30000);
      
      pythonProcess.on('close', () => {
        clearTimeout(timeout);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Parse PDF using pdf-parse (fallback method)
 */
async function parsePDFWithPdfParse(buffer: Buffer): Promise<string> {
  try {
    console.log('[PDF-parse] Starting pdf-parse extraction...');
    
    // Use require for better compatibility with pdf-parse
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    const text = data.text;
    
    console.log(`[PDF-parse] ✓ Extracted ${text.length} characters`);
    console.log(`[PDF-parse] Metadata:`, {
      pages: data.numpages,
      info: data.info,
      metadata: data.metadata
    });
    
    return text;
  } catch (error) {
    console.error('[PDF-parse] Extraction failed:', error);
    throw error;
  }
}

/**
 * Parse PDF using pdf2json (fallback method)
 */
async function parsePDFWithPdf2Json(buffer: Buffer): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('[pdf2json] Starting pdf2json extraction...');
      const PDFParser = (await import('pdf2json')).default;
      const pdfParser = new PDFParser(null, true);
      
      const timeout = setTimeout(() => {
        pdfParser.destroy();
        reject(new Error('pdf2json parsing timed out'));
      }, 30000);
      
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        clearTimeout(timeout);
        reject(new Error(`pdf2json error: ${errData.parserError}`));
      });
      
      pdfParser.on('pdfParser_dataReady', () => {
        clearTimeout(timeout);
        try {
          const rawText = (pdfParser as any).getRawTextContent();
          if (rawText && rawText.trim().length > 50) {
            console.log(`[pdf2json] ✓ Extracted ${rawText.length} characters`);
            resolve(rawText);
          } else {
            reject(new Error('pdf2json returned insufficient text'));
          }
        } catch (error) {
          reject(error);
        }
      });
      
      pdfParser.parseBuffer(buffer);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Simple text extraction as last resort fallback
 */
async function extractSimpleText(buffer: Buffer): Promise<string> {
  try {
    console.log('[Simple] Attempting simple text extraction...');
    
    // Convert buffer to string and look for text patterns
    const bufferString = buffer.toString('latin1');
    const textMatches = bufferString.match(/[A-Za-z0-9\s.,;:!?@#$%^&*()_+\-=\[\]{}|'"<>\/\\]+/g);
    
    if (textMatches && textMatches.length > 0) {
      const extracted = textMatches.join(' ').substring(0, 10000);
      console.log(`[Simple] ✓ Extracted ${extracted.length} characters using simple method`);
      return extracted;
    }
    
    throw new Error('No readable text patterns found in PDF');
  } catch (error) {
    console.error('[Simple] Simple extraction failed:', error);
    return 'PDF text extraction limited. Document may contain images or complex fonts that require manual processing.';
  }
}

/**
 * Main PDF parsing function with intelligent fallbacks
 */
async function parsePDF(buffer: Buffer): Promise<string> {
  console.log('[PDF] Starting PDF text extraction...');
  
  // Method 1: Try Python service (most robust for complex PDFs)
  try {
    return await parsePDFWithPython(buffer);
  } catch (error) {
    console.warn('[PDF] Python service failed:', error instanceof Error ? error.message : String(error));
  }
  
  // Method 2: Try pdf-parse (fallback)
  try {
    console.log('[PDF] Falling back to pdf-parse...');
    return await parsePDFWithPdfParse(buffer);
  } catch (error) {
    console.warn('[PDF] pdf-parse failed:', error instanceof Error ? error.message : String(error));
  }
  
  // Method 3: Try pdf2json (fallback)
  try {
    console.log('[PDF] Falling back to pdf2json...');
    return await parsePDFWithPdf2Json(buffer);
  } catch (error) {
    console.warn('[PDF] pdf2json failed:', error instanceof Error ? error.message : String(error));
  }
  
  // Method 4: Simple extraction (last resort)
  console.log('[PDF] Falling back to simple text extraction...');
  return await extractSimpleText(buffer);
}

// ============================================
// DATABASE OPERATIONS
// ============================================
async function saveAirwayBillToDatabase(
  airwayBillData: AirwayBillMetadata
): Promise<{ success: boolean; warning?: string }> {
  try {
    console.log('[DB] Saving airway bill:', airwayBillData.airway_bill_id);
    
    await createAirwayBillRecord(airwayBillData);
    console.log('[DB] ✓ Saved airway bill successfully');
    
    // Verify save
    const verified = await verifyAirwayBillSaved(airwayBillData.airway_bill_id);
    if (!verified) {
      console.error('[DB] ⚠️  Verification failed!');
      return { 
        success: false, 
        warning: 'Airway bill not found after save - possible database issue' 
      };
    }
    
    console.log('[DB] ✓ Verified airway bill');
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
async function updateThreadWithAirwayBill(
  threadId: string,
  airwayBillId: string
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
    console.log('[Upload] Processing airway bill upload');
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
    
    // Generate proper UUID for airway bill ID
    const airwayBillId = randomUUID();
    
    // Convert to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log(`[Upload] File: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    console.log(`[Upload] Generated UUID: ${airwayBillId}`);

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
    // STEP 5: AI EXTRACTION FOR AIRWAY BILL
    // ============================================
    console.log('[Upload] Starting AI extraction for airway bill...');
    const aiExtraction = await extractAndValidateAirwayBill(extractedText);
    console.log('[Upload] ✓ AI extraction complete');
    console.log(`[Upload] Completeness: ${aiExtraction.completeness}%`);

    // ============================================
    // STEP 6: VALIDATE EXTRACTED DATA
    // ============================================
    const validation = validateAirwayBillData(aiExtraction);
    
    if (!validation.isValid) {
      console.log('[Upload] ✗ Validation failed - removing file');
      await deleteFromStorage(storagePath);
      
      return NextResponse.json({
        success: false,
        error: 'Airway bill validation failed',
        validation: {
          isValid: false,
          errors: validation.errors,
          warnings: validation.warnings,
          completeness: validation.completeness,
          extractedData: {
            airwayBillNo: aiExtraction.extractedData.airwayBillNo,
            shippersName: aiExtraction.extractedData.shippersName,
            consigneesName: aiExtraction.extractedData.consigneesName,
            issuingCarriersName: aiExtraction.extractedData.issuingCarriersName
          }
        },
        message: 'Airway bill contains missing or invalid required fields'
      }, { status: 400 });
    }

    // ============================================
    // STEP 7: PREPARE AIRWAY BILL METADATA
    // ============================================
    const { extractedData } = aiExtraction;

    const airwayBillData: AirwayBillMetadata = {
      airway_bill_id: airwayBillId,
      user_id: userId || 'anonymous',
      organization_id: organizationId,
      thread_id: threadId,
      filename: file.name,
      filepath: storagePath,
      uploaded_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      status: 'valid',
      
      // Core fields - WITH DATE CONVERSION
      document_type: extractedData.documentType || 'Air Waybill',
      airway_bill_no: extractedData.airwayBillNo,
      invoice_no: extractedData.invoiceNo,
      invoice_date: convertToISODate(extractedData.invoiceDate),
      
      // Shipper information
      shippers_name: extractedData.shippersName,
      shippers_address: extractedData.shippersAddress,
      
      // Consignee information
      consignees_name: extractedData.consigneesName,
      consignees_address: extractedData.consigneesAddress,
      
      // Carrier information
      issuing_carriers_name: extractedData.issuingCarriersName,
      issuing_carriers_city: extractedData.issuingCarriersCity,
      agents_iata_code: extractedData.agentsIataCode,
      
      // Shipment details
      airport_of_departure: extractedData.airportOfDeparture,
      airport_of_destination: extractedData.airportOfDestination,
      accounting_information: extractedData.accountingInformation,
      
      // Cargo details
      hs_code_no: extractedData.hsCodeNo,
      no_of_pieces: extractedData.noOfPieces,
      gross_weight: extractedData.grossWeight,
      chargeable_weight: extractedData.chargeableWeight,
      nature_of_goods: extractedData.natureOfGoods,
      
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
    const dbResult = await saveAirwayBillToDatabase(airwayBillData);
    
    if (!dbResult.success) {
      await deleteFromStorage(storagePath);
      
      return NextResponse.json({
        success: false,
        error: 'Failed to save airway bill',
        details: dbResult.warning || 'Database storage failed'
      }, { status: 500 });
    }

    // ============================================
    // STEP 9: UPDATE THREAD
    // ============================================
    await updateThreadWithAirwayBill(threadId, airwayBillId);

    // ============================================
    // STEP 10: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Upload] ✓ Airway bill processed successfully');
    console.log(`[Upload] Processing time: ${processingTime}ms`);
    console.log(`[Upload] Airway Bill No: ${airwayBillData.airway_bill_no}`);
    console.log(`[Upload] Invoice No: ${airwayBillData.invoice_no}`);
    console.log(`[Upload] Completeness: ${validation.completeness}%`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json({
      success: true,
      airwayBillId,
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
          airwayBillNo: extractedData.airwayBillNo,
          invoiceNo: extractedData.invoiceNo,
          invoiceDate: extractedData.invoiceDate,
          shippersName: extractedData.shippersName,
          shippersAddress: extractedData.shippersAddress,
          consigneesName: extractedData.consigneesName,
          consigneesAddress: extractedData.consigneesAddress,
          issuingCarriersName: extractedData.issuingCarriersName,
          issuingCarriersCity: extractedData.issuingCarriersCity,
          agentsIataCode: extractedData.agentsIataCode,
          airportOfDeparture: extractedData.airportOfDeparture,
          airportOfDestination: extractedData.airportOfDestination,
          accountingInformation: extractedData.accountingInformation,
          hsCodeNo: extractedData.hsCodeNo,
          noOfPieces: extractedData.noOfPieces,
          grossWeight: extractedData.grossWeight,
          chargeableWeight: extractedData.chargeableWeight,
          natureOfGoods: extractedData.natureOfGoods
        }
      },
      message: `Airway bill validated successfully. Ready for cross-verification with commercial invoice.`
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
      error: 'Failed to process airway bill',
      details: error.message
    }, { status: 500 });
  }
}