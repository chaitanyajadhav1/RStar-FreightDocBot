// src/app/api/invoice/upload-scomet/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractAndValidateSCOMETDeclaration, SCOMETDeclarationValidationResult } from '@/lib/agent';
// import { extractAndValidateSCOMETDeclaration, SCOMETDeclarationValidationResult } from '@/lib/agent/groq/scomet-declaration/agent';

import { createSCOMETDeclarationRecord, verifySCOMETDeclarationSaved } from '@/lib/database';

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

interface SCOMETDeclarationMetadata {
  scomet_declaration_id: string;
  user_id: string;
  organization_id: string | null;
  thread_id: string;
  filename: string;
  filepath: string;
  uploaded_at: string;
  processed_at: string;
  status: 'valid' | 'invalid' | 'pending';
  
  // Document info
  document_date: string | null;
  document_type: string;
  
  // Core fields
  consignee_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  destination_country: string | null;
  
  // SCOMET specific
  scomet_coverage: boolean | null;
  hs_code: string | null;
  goods_description: string | null;
  
  // Declaration fields
  declaration_statement: string | null;
  signed_status: boolean | null;
  signatory_name: string | null;
  
  // Validation
  is_valid: boolean;
  completeness: number;
  validation_errors: string[];
  validation_warnings: string[];
  
  extracted_text: string;
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================
function validateSCOMETDeclarationData(validationResult: SCOMETDeclarationValidationResult): ValidationSummary {
  const extractionErrors = Array.isArray(validationResult.errors) ? validationResult.errors : [];
  const extractionWarnings = Array.isArray(validationResult.warnings) ? validationResult.warnings : [];
  
  const { extractedData } = validationResult;
  const errors: string[] = [...extractionErrors];
  const warnings: string[] = [...extractionWarnings];

  console.log('[Validation] Starting SCOMET declaration validation, completeness:', validationResult.completeness + '%');

  // Count missing critical fields
  const criticalFields = [
    { name: 'Document Date', value: extractedData.documentDate },
    { name: 'Consignee Name', value: extractedData.consigneeName },
    { name: 'Invoice Number', value: extractedData.invoiceNumber },
    { name: 'Invoice Date', value: extractedData.invoiceDate },
    { name: 'Destination Country', value: extractedData.destinationCountry },
    { name: 'SCOMET Coverage', value: extractedData.scometCoverage !== null }
  ];

  const criticalFieldsMissing = criticalFields.filter(f => !f.value).length;

  // Log field status
  criticalFields.forEach(field => {
    const status = field.value ? '✓' : '✗';
    console.log(`[Validation] ${status} ${field.name}:`, field.value || 'MISSING');
  });

  // Strict validation
  if (criticalFieldsMissing > 2) {
    errors.push(`Too many critical fields missing (${criticalFieldsMissing}/${criticalFields.length})`);
  }

  // SCOMET specific validation
  if (extractedData.scometCoverage === null) {
    errors.push('SCOMET coverage status not specified (Yes/No required)');
  }

  if (!extractedData.hsCode) {
    warnings.push('HS Code is missing');
  }

  if (!extractedData.goodsDescription) {
    warnings.push('Goods description is missing');
  }

  // Date validation
  if (extractedData.documentDate && extractedData.invoiceDate) {
    const documentDate = new Date(extractedData.documentDate);
    const invoiceDate = new Date(extractedData.invoiceDate);
    
    if (documentDate < invoiceDate) {
      warnings.push('Document date is before invoice date - may need verification');
    }
  }

  // Signature validation
  if (!extractedData.signedStatus) {
    warnings.push('Document signature not detected');
  }

  const summary: ValidationSummary = {
    isValid: errors.length === 0,
    errors,
    warnings,
    completeness: validationResult.completeness,
    criticalFieldsMissing
  };

  console.log('[Validation] SCOMET declaration result:', {
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
    .from('scomet_declarations')
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
    .from('scomet_declarations')
    .getPublicUrl(data.path);

  console.log('[Storage] Uploaded SCOMET declaration:', data.path);
  return { path: data.path, url: publicUrl };
}

async function deleteFromStorage(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('scomet_declarations')
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
async function saveSCOMETDeclarationToDatabase(
  declarationData: SCOMETDeclarationMetadata
): Promise<{ success: boolean; warning?: string }> {
  try {
    console.log('[DB] Saving SCOMET declaration:', declarationData.scomet_declaration_id);
    
    await createSCOMETDeclarationRecord(declarationData);
    console.log('[DB] ✓ Saved SCOMET declaration successfully');
    
    // Verify save
    const verified = await verifySCOMETDeclarationSaved(declarationData.scomet_declaration_id);
    if (!verified) {
      console.error('[DB] ⚠️  Verification failed!');
      return { 
        success: false, 
        warning: 'SCOMET declaration not found after save - possible database issue' 
      };
    }
    
    console.log('[DB] ✓ Verified SCOMET declaration');
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
        // Add reference to SCOMET declaration if needed
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
    console.log('[Upload] Processing SCOMET declaration upload');
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
    const declarationId = `scomet_${timestamp}_${randomId}`;
    
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
    // STEP 4: AI EXTRACTION FOR SCOMET DECLARATION
    // ============================================
    console.log('[Upload] Starting AI extraction for SCOMET declaration...');
    const aiExtraction = await extractAndValidateSCOMETDeclaration(extractedText);
    console.log('[Upload] ✓ AI extraction complete');
    console.log(`[Upload] Completeness: ${aiExtraction.completeness}%`);

    // ============================================
    // STEP 5: VALIDATE EXTRACTED DATA
    // ============================================
    const validation = validateSCOMETDeclarationData(aiExtraction);
    
    if (!validation.isValid) {
      console.log('[Upload] ✗ Validation failed - removing file');
      await deleteFromStorage(storagePath);
      
      return NextResponse.json({
        success: false,
        error: 'SCOMET declaration validation failed',
        validation: {
          isValid: false,
          errors: validation.errors,
          warnings: validation.warnings,
          completeness: validation.completeness,
          extractedData: {
            documentDate: aiExtraction.extractedData.documentDate,
            consigneeName: aiExtraction.extractedData.consigneeName,
            invoiceNumber: aiExtraction.extractedData.invoiceNumber,
            scometCoverage: aiExtraction.extractedData.scometCoverage
          }
        },
        message: 'SCOMET declaration contains missing or invalid required fields'
      }, { status: 400 });
    }

    // ============================================
    // STEP 6: PREPARE DECLARATION METADATA
    // ============================================
    const { extractedData } = aiExtraction;

    const declarationData: SCOMETDeclarationMetadata = {
      scomet_declaration_id: declarationId,
      user_id: userId || 'anonymous',
      organization_id: organizationId,
      thread_id: threadId,
      filename: file.name,
      filepath: storagePath,
      uploaded_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      status: 'valid',
      
      // Document info
      document_date: extractedData.documentDate,
      document_type: 'SCOMET Declaration',
      
      // Core fields
      consignee_name: extractedData.consigneeName,
      invoice_number: extractedData.invoiceNumber,
      invoice_date: extractedData.invoiceDate,
      destination_country: extractedData.destinationCountry,
      
      // SCOMET specific
      scomet_coverage: extractedData.scometCoverage,
      hs_code: extractedData.hsCode,
      goods_description: extractedData.goodsDescription,
      
      // Declaration fields
      declaration_statement: extractedData.declarationStatement,
      signed_status: extractedData.signedStatus,
      signatory_name: extractedData.signatoryName,
      
      // Validation
      is_valid: true,
      completeness: validation.completeness,
      validation_errors: validation.errors,
      validation_warnings: validation.warnings,
      
      extracted_text: extractedText.substring(0, TEXT_PREVIEW_LENGTH)
    };

    // ============================================
    // STEP 7: SAVE TO DATABASE
    // ============================================
    const dbResult = await saveSCOMETDeclarationToDatabase(declarationData);
    
    if (!dbResult.success) {
      await deleteFromStorage(storagePath);
      
      return NextResponse.json({
        success: false,
        error: 'Failed to save SCOMET declaration',
        details: dbResult.warning || 'Database storage failed'
      }, { status: 500 });
    }

    // ============================================
    // STEP 8: UPDATE THREAD
    // ============================================
    await updateThreadWithDeclaration(threadId, declarationId);

    // ============================================
    // STEP 9: RETURN SUCCESS RESPONSE
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Upload] ✓ SCOMET declaration processed successfully');
    console.log(`[Upload] Processing time: ${processingTime}ms`);
    console.log(`[Upload] Invoice: ${declarationData.invoice_number}`);
    console.log(`[Upload] Consignee: ${declarationData.consignee_name}`);
    console.log(`[Upload] SCOMET Coverage: ${declarationData.scomet_coverage ? 'YES' : 'NO'}`);
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
          documentDate: extractedData.documentDate,
          documentType: 'SCOMET Declaration',
          consigneeName: extractedData.consigneeName,
          invoiceNumber: extractedData.invoiceNumber,
          invoiceDate: extractedData.invoiceDate,
          destinationCountry: extractedData.destinationCountry,
          scometCoverage: extractedData.scometCoverage,
          hsCode: extractedData.hsCode,
          goodsDescription: extractedData.goodsDescription,
          declarationStatement: extractedData.declarationStatement,
          signedStatus: extractedData.signedStatus,
          signatoryName: extractedData.signatoryName
        }
      },
      message: `SCOMET declaration validated successfully. ${extractedData.scometCoverage ? 'Items fall under SCOMET list.' : 'Items do not fall under SCOMET list.'}`
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
      error: 'Failed to process SCOMET declaration',
      details: error.message
    }, { status: 500 });
  }
}