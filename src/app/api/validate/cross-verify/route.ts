// src/app/api/validate/cross-verify/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// INTERFACES
// ============================================
interface CrossVerificationRequest {
  commercialInvoiceNumber: string;
  documentType: 'scomet' | 'packinglist' | 'fumigation' | 'exportdeclaration';
  documentData: any;
  userId: string;
  threadId?: string;
}

interface VerificationResult {
  success: boolean;
  isValid: boolean;
  completeness: number;
  invoiceMatchVerified: boolean;
  amountsMatchVerified?: boolean;
  validationDetails: Record<string, any>;
  validation_errors: string[];
  validation_warnings: string[];
  crossDocumentMatches: Record<string, any>;
  commercialInvoice?: any;
  timestamp: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
  code?: string;
}

// ============================================
// VALIDATION HELPERS
// ============================================
function validateField(commercialValue: any, documentValue: any, fieldName: string) {
  if (!commercialValue && !documentValue) {
    return { match: true };
  }
  if (!commercialValue || !documentValue) {
    return { 
      match: false, 
      commercialValue, 
      documentValue,
      message: `${fieldName}: Missing in one document`
    };
  }
  
  const commercialStr = String(commercialValue).toLowerCase().trim();
  const documentStr = String(documentValue).toLowerCase().trim();
  
  return {
    match: commercialStr === documentStr,
    commercialValue: commercialValue,
    documentValue: documentValue,
    message: commercialStr === documentStr ? undefined : `${fieldName}: "${commercialValue}" vs "${documentValue}"`
  };
}

function normalizeDate(dateValue: any): string | null {
  if (!dateValue) return null;
  
  const dateStr = String(dateValue).trim();
  
  // Handle DD/MM/YYYY format
  const ddmmyyyyPattern = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/;
  const ddmmyyyyMatch = dateStr.match(ddmmyyyyPattern);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Handle YYYY-MM-DD format
  const yyyymmddPattern = /^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/;
  const yyyymmddMatch = dateStr.match(yyyymmddPattern);
  if (yyyymmddMatch) {
    const [, year, month, day] = yyyymmddMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try native Date parsing
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // Ignore parsing errors
  }
  
  return null;
}

// ============================================
// DATABASE OPERATIONS
// ============================================
async function getCommercialInvoiceByNumber(
  invoiceNumber: string, 
  userId: string,
  threadId?: string
): Promise<{ data: any | null; error: string | null }> {
  try {
    console.log('[DB] Fetching commercial invoice:', { invoiceNumber, userId, threadId });
    
    let query = supabase
      .from('invoices')
      .select('*')
      .eq('invoice_no', invoiceNumber)
      .eq('user_id', userId);

    // If threadId is provided, use it for more specific matching
    // if (threadId) {
    //   query = query.eq('thread_id', threadId);
    // }

    const { data, error } = await query;

    if (error) {
      console.error('[DB] Error fetching commercial invoice:', error);
      return { data: null, error: error.message };
    }

    if (!data || data.length === 0) {
      console.log('[DB] No commercial invoice found');
      return { data: null, error: 'Commercial invoice not found' };
    }

    // Return the most recent invoice if multiple found
    const sortedData = data.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    console.log('[DB] ✓ Commercial invoice found');
    return { data: sortedData[0], error: null };
  } catch (error: any) {
    console.error('[DB] Exception fetching commercial invoice:', error);
    return { data: null, error: error.message };
  }
}

// ============================================
// DOCUMENT-SPECIFIC VALIDATORS
// ============================================
function validateSCOMETWithCommercial(commercialData: any, scometData: any): VerificationResult {
  const validationDetails: any = {};
  const mismatches: string[] = [];
  let matchedFields = 0;
  let totalFields = 0;

  // Common invoice validations
  if (scometData.invoiceNumber) {
    totalFields++;
    const result = validateField(commercialData.invoice_no, scometData.invoiceNumber, 'Invoice Number');
    validationDetails.invoiceNumber = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  if (scometData.invoiceDate) {
    totalFields++;
    const normalizedCommercialDate = normalizeDate(commercialData.invoice_date);
    const normalizedDocumentDate = normalizeDate(scometData.invoiceDate);
    
    const isMatch = normalizedCommercialDate && normalizedDocumentDate && 
                    normalizedCommercialDate === normalizedDocumentDate;
    
    const result = {
      match: isMatch,
      message: !isMatch 
        ? `Invoice Date mismatch: Commercial (${commercialData.invoice_date}) vs SCOMET (${scometData.invoiceDate})`
        : undefined,
      commercialValue: commercialData.invoice_date,
      documentValue: scometData.invoiceDate
    };
    
    validationDetails.invoiceDate = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // SCOMET-specific validations
  if (scometData.consigneeName) {
    totalFields++;
    const result = validateField(commercialData.consignee_name, scometData.consigneeName, 'Consignee Name');
    validationDetails.consigneeName = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  if (scometData.destinationCountry) {
    totalFields++;
    const result = validateField(commercialData.final_destination, scometData.destinationCountry, 'Destination Country');
    validationDetails.destinationCountry = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  if (scometData.hsCode) {
    totalFields++;
    const result = validateField(commercialData.hsn_code, scometData.hsCode, 'HSN Code');
    validationDetails.hsCode = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Calculate completeness
  const completeness = totalFields > 0 ? Math.round((matchedFields / totalFields) * 100) : 0;
  const invoiceMatchVerified = mismatches.length === 0;

  return {
    success: true,
    isValid: invoiceMatchVerified,
    completeness,
    invoiceMatchVerified,
    validationDetails,
    validation_errors: invoiceMatchVerified ? [] : mismatches,
    validation_warnings: invoiceMatchVerified ? ['All fields match commercial invoice'] : [],
    crossDocumentMatches: {
      totalFieldsChecked: totalFields,
      matchedFields,
      matchPercentage: completeness
    },
    timestamp: new Date().toISOString()
  };
}

function validatePackingListWithCommercial(commercialData: any, packingListData: any): VerificationResult {
  const validationDetails: any = {};
  const mismatches: string[] = [];
  let matchedFields = 0;
  let totalFields = 0;

  // Invoice reference validations
  if (packingListData.invoiceNumber) {
    totalFields++;
    const result = validateField(commercialData.invoice_no, packingListData.invoiceNumber, 'Invoice Number');
    validationDetails.invoiceNumber = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  if (packingListData.invoiceDate) {
    totalFields++;
    const normalizedCommercialDate = normalizeDate(commercialData.invoice_date);
    const normalizedDocumentDate = normalizeDate(packingListData.invoiceDate);
    
    const isMatch = normalizedCommercialDate && normalizedDocumentDate && 
                    normalizedCommercialDate === normalizedDocumentDate;
    
    const result = {
      match: isMatch,
      message: !isMatch 
        ? `Invoice Date mismatch: Commercial (${commercialData.invoice_date}) vs Packing List (${packingListData.invoiceDate})`
        : undefined,
      commercialValue: commercialData.invoice_date,
      documentValue: packingListData.invoiceDate
    };
    
    validationDetails.invoiceDate = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Core business validations
  const packingListValidations = [
    { commercialField: 'consignee_name', documentField: 'consigneeName', fieldName: 'Consignee Name' },
    { commercialField: 'exporter_name', documentField: 'exporterName', fieldName: 'Exporter Name' },
    { commercialField: 'exporter_address', documentField: 'exporterAddress', fieldName: 'Exporter Address' },
    { commercialField: 'consignee_address', documentField: 'consigneeAddress', fieldName: 'Consignee Address' },
    { commercialField: 'port_of_loading', documentField: 'portOfLoading', fieldName: 'Port of Loading' },
    { commercialField: 'port_of_discharge', documentField: 'portOfDischarge', fieldName: 'Port of Discharge' },
    { commercialField: 'final_destination', documentField: 'finalDestination', fieldName: 'Final Destination' },
    { commercialField: 'country_of_origin', documentField: 'countryOfOrigin', fieldName: 'Country of Origin' },
    { commercialField: 'country_of_destination', documentField: 'countryOfDestination', fieldName: 'Country of Destination' },
    { commercialField: 'hsn_code', documentField: 'hsnCode', fieldName: 'HSN Code' },
    { commercialField: 'marks_and_nos', documentField: 'marksAndNos', fieldName: 'Marks and Numbers' },
    { commercialField: 'reference_no', documentField: 'referenceNo', fieldName: 'Reference Number' },
    { commercialField: 'proforma_invoice_no', documentField: 'proformaInvoiceNo', fieldName: 'Proforma Invoice Number' }
  ];

  packingListValidations.forEach(validation => {
    const documentValue = packingListData[validation.documentField];
    if (documentValue !== undefined && documentValue !== null && documentValue !== '') {
      totalFields++;
      const commercialValue = commercialData[validation.commercialField];
      const result = validateField(commercialValue, documentValue, validation.fieldName);
      validationDetails[validation.documentField] = result;
      if (result.match) matchedFields++;
      if (!result.match && result.message) mismatches.push(result.message);
    }
  });

  // Amount validation (if available)
  let amountsMatchVerified = true;
  if (packingListData.totalGrossWeight && commercialData.total_weight) {
    totalFields++;
    const result = validateField(commercialData.total_weight, packingListData.totalGrossWeight, 'Total Weight');
    validationDetails.totalWeight = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) {
      mismatches.push(result.message);
      amountsMatchVerified = false;
    }
  }

  // Calculate completeness
  const completeness = totalFields > 0 ? Math.round((matchedFields / totalFields) * 100) : 0;
  const invoiceMatchVerified = mismatches.length === 0;

  return {
    success: true,
    isValid: invoiceMatchVerified,
    completeness,
    invoiceMatchVerified,
    amountsMatchVerified,
    validationDetails,
    validation_errors: invoiceMatchVerified ? [] : mismatches,
    validation_warnings: invoiceMatchVerified ? ['All fields match commercial invoice'] : [],
    crossDocumentMatches: {
      totalFieldsChecked: totalFields,
      matchedFields,
      matchPercentage: completeness,
      amountsVerified: amountsMatchVerified
    },
    timestamp: new Date().toISOString()
  };
}

function validateFumigationWithCommercial(commercialData: any, fumigationData: any): VerificationResult {
  const validationDetails: any = {};
  const mismatches: string[] = [];
  let matchedFields = 0;
  let totalFields = 0;

  // Invoice reference validations
  if (fumigationData.invoiceNumber) {
    totalFields++;
    const result = validateField(commercialData.invoice_no, fumigationData.invoiceNumber, 'Invoice Number');
    validationDetails.invoiceNumber = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  if (fumigationData.invoiceDate) {
    totalFields++;
    const normalizedCommercialDate = normalizeDate(commercialData.invoice_date);
    const normalizedDocumentDate = normalizeDate(fumigationData.invoiceDate);
    
    const isMatch = normalizedCommercialDate && normalizedDocumentDate && 
                    normalizedCommercialDate === normalizedDocumentDate;
    
    const result = {
      match: isMatch,
      message: !isMatch 
        ? `Invoice Date mismatch: Commercial (${commercialData.invoice_date}) vs Fumigation (${fumigationData.invoiceDate})`
        : undefined,
      commercialValue: commercialData.invoice_date,
      documentValue: fumigationData.invoiceDate
    };
    
    validationDetails.invoiceDate = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Fumigation-specific validations
  if (fumigationData.exporterName) {
    totalFields++;
    const result = validateField(commercialData.exporter_name, fumigationData.exporterName, 'Exporter Name');
    validationDetails.exporterName = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  if (fumigationData.consigneeName) {
    totalFields++;
    const result = validateField(commercialData.consignee_name, fumigationData.consigneeName, 'Consignee Name');
    validationDetails.consigneeName = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Calculate completeness
  const completeness = totalFields > 0 ? Math.round((matchedFields / totalFields) * 100) : 0;
  const invoiceMatchVerified = mismatches.length === 0;

  return {
    success: true,
    isValid: invoiceMatchVerified,
    completeness,
    invoiceMatchVerified,
    validationDetails,
    validation_errors: invoiceMatchVerified ? [] : mismatches,
    validation_warnings: invoiceMatchVerified ? ['All fields match commercial invoice'] : [],
    crossDocumentMatches: {
      totalFieldsChecked: totalFields,
      matchedFields,
      matchPercentage: completeness
    },
    timestamp: new Date().toISOString()
  };
}

function validateExportDeclarationWithCommercial(commercialData: any, exportDeclarationData: any): VerificationResult {
  const validationDetails: any = {};
  const mismatches: string[] = [];
  let matchedFields = 0;
  let totalFields = 0;

  // Invoice reference validations
  if (exportDeclarationData.invoiceNo) {
    totalFields++;
    const result = validateField(commercialData.invoice_no, exportDeclarationData.invoiceNo, 'Invoice Number');
    validationDetails.invoiceNumber = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  if (exportDeclarationData.invoiceDate) {
    totalFields++;
    const normalizedCommercialDate = normalizeDate(commercialData.invoice_date);
    const normalizedDocumentDate = normalizeDate(exportDeclarationData.invoiceDate);
    
    const isMatch = normalizedCommercialDate && normalizedDocumentDate && 
                    normalizedCommercialDate === normalizedDocumentDate;
    
    const result = {
      match: isMatch,
      message: !isMatch 
        ? `Invoice Date mismatch: Commercial (${commercialData.invoice_date}) vs Export Declaration (${exportDeclarationData.invoiceDate})`
        : undefined,
      commercialValue: commercialData.invoice_date,
      documentValue: exportDeclarationData.invoiceDate
    };
    
    validationDetails.invoiceDate = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Export declaration specific validations
  const exportValidations = [
    { commercialField: 'exporter_name', documentField: 'exporterName', fieldName: 'Exporter Name' },
    { commercialField: 'consignee_name', documentField: 'consigneeName', fieldName: 'Consignee Name' },
    { commercialField: 'port_of_loading', documentField: 'portOfLoading', fieldName: 'Port of Loading' },
    { commercialField: 'port_of_discharge', documentField: 'portOfDischarge', fieldName: 'Port of Discharge' },
    { commercialField: 'final_destination', documentField: 'finalDestination', fieldName: 'Final Destination' },
    { commercialField: 'country_of_origin', documentField: 'countryOfOrigin', fieldName: 'Country of Origin' },
    { commercialField: 'hsn_code', documentField: 'hsnCode', fieldName: 'HSN Code' },
    { commercialField: 'total_amount', documentField: 'totalAmount', fieldName: 'Total Amount' },
    { commercialField: 'currency', documentField: 'currency', fieldName: 'Currency' }
  ];

  exportValidations.forEach(validation => {
    const documentValue = exportDeclarationData[validation.documentField];
    if (documentValue !== undefined && documentValue !== null && documentValue !== '') {
      totalFields++;
      const commercialValue = commercialData[validation.commercialField];
      const result = validateField(commercialValue, documentValue, validation.fieldName);
      validationDetails[validation.documentField] = result;
      if (result.match) matchedFields++;
      if (!result.match && result.message) mismatches.push(result.message);
    }
  });

  // Calculate completeness
  const completeness = totalFields > 0 ? Math.round((matchedFields / totalFields) * 100) : 0;
  const invoiceMatchVerified = mismatches.length === 0;

  return {
    success: true,
    isValid: invoiceMatchVerified,
    completeness,
    invoiceMatchVerified,
    validationDetails,
    validation_errors: invoiceMatchVerified ? [] : mismatches,
    validation_warnings: invoiceMatchVerified ? ['All fields match commercial invoice'] : [],
    crossDocumentMatches: {
      totalFieldsChecked: totalFields,
      matchedFields,
      matchPercentage: completeness
    },
    timestamp: new Date().toISOString()
  };
}

// ============================================
// MAIN API HANDLER
// ============================================
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════');
    console.log('[Cross-Verify] Processing cross-verification request');
    console.log('═══════════════════════════════════════');

    // Parse request body
    const body: CrossVerificationRequest = await request.json();
    const { commercialInvoiceNumber, documentType, documentData, userId, threadId } = body;

    console.log('[Cross-Verify] Request:', {
      commercialInvoiceNumber,
      documentType,
      userId,
      threadId: threadId || 'N/A',
      documentFields: Object.keys(documentData || {}).length
    });

    // ============================================
    // STEP 1: VALIDATE REQUEST
    // ============================================
    if (!commercialInvoiceNumber) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Commercial invoice number is required' },
        { status: 400 }
      );
    }

    if (!documentType) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Document type is required' },
        { status: 400 }
      );
    }

    if (!documentData) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Document data is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    const validDocumentTypes = ['scomet', 'packinglist', 'fumigation', 'exportdeclaration'];
    if (!validDocumentTypes.includes(documentType)) {
      return NextResponse.json<ErrorResponse>(
        { error: `Invalid document type. Must be one of: ${validDocumentTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // ============================================
    // STEP 2: FETCH COMMERCIAL INVOICE FROM DATABASE
    // ============================================
    console.log('[Cross-Verify] Fetching commercial invoice from database...');
    const { data: commercialInvoice, error: invoiceError } = await getCommercialInvoiceByNumber(
      commercialInvoiceNumber,
      userId,
      threadId
    );

    if (invoiceError || !commercialInvoice) {
      console.log('[Cross-Verify] ✗ Commercial invoice not found:', invoiceError);
      return NextResponse.json<ErrorResponse>(
        { 
          error: 'Commercial invoice not found',
          details: invoiceError || 'No invoice found with the provided number'
        },
        { status: 404 }
      );
    }

    console.log('[Cross-Verify] ✓ Commercial invoice found:', {
      invoiceNo: commercialInvoice.invoice_no,
      date: commercialInvoice.invoice_date,
      exporter: commercialInvoice.exporter_name
    });

    // ============================================
    // STEP 3: PERFORM DOCUMENT-SPECIFIC VALIDATION
    // ============================================
    console.log(`[Cross-Verify] Validating ${documentType} against commercial invoice...`);
    
    let validationResult: VerificationResult;

    switch (documentType) {
      case 'scomet':
        validationResult = validateSCOMETWithCommercial(commercialInvoice, documentData);
        break;
      case 'packinglist':
        validationResult = validatePackingListWithCommercial(commercialInvoice, documentData);
        break;
      case 'fumigation':
        validationResult = validateFumigationWithCommercial(commercialInvoice, documentData);
        break;
      case 'exportdeclaration':
        validationResult = validateExportDeclarationWithCommercial(commercialInvoice, documentData);
        break;
      default:
        return NextResponse.json<ErrorResponse>(
          { error: 'Unsupported document type' },
          { status: 400 }
        );
    }

    // Add commercial invoice to response for reference
    validationResult.commercialInvoice = {
      invoice_no: commercialInvoice.invoice_no,
      invoice_date: commercialInvoice.invoice_date,
      exporter_name: commercialInvoice.exporter_name,
      consignee_name: commercialInvoice.consignee_name,
      total_amount: commercialInvoice.total_amount,
      currency: commercialInvoice.currency
    };

    // ============================================
    // STEP 4: RETURN VALIDATION RESULTS
    // ============================================
    const processingTime = Date.now() - startTime;
    console.log('═══════════════════════════════════════');
    console.log('[Cross-Verify] ✓ Validation completed');
    console.log(`[Cross-Verify] Processing time: ${processingTime}ms`);
    console.log(`[Cross-Verify] Result: ${validationResult.isValid ? 'VALID' : 'INVALID'}`);
    console.log(`[Cross-Verify] Match: ${validationResult.invoiceMatchVerified ? 'VERIFIED' : 'MISMATCH'}`);
    console.log(`[Cross-Verify] Completeness: ${validationResult.completeness}%`);
    console.log(`[Cross-Verify] Errors: ${validationResult.validation_errors.length}`);
    console.log(`[Cross-Verify] Warnings: ${validationResult.validation_warnings.length}`);
    console.log('═══════════════════════════════════════');

    return NextResponse.json(validationResult);

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('═══════════════════════════════════════');
    console.error('[Cross-Verify] ✗ Error:', error.message);
    console.error('[Cross-Verify] Stack:', error.stack);
    console.error('[Cross-Verify] Processing time:', processingTime + 'ms');
    console.error('═══════════════════════════════════════');

    return NextResponse.json<ErrorResponse>(
      {
        error: 'Cross-verification failed',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET HANDLER - FOR TESTING/DOCUMENTATION
// ============================================
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Cross-verification API',
    description: 'Validate documents against commercial invoices',
    usage: {
      method: 'POST',
      endpoint: '/api/validate/cross-verify',
      body: {
        commercialInvoiceNumber: 'string (required)',
        documentType: 'scomet | packinglist | fumigation | exportdeclaration (required)',
        documentData: 'object (required)',
        userId: 'string (required)',
        threadId: 'string (optional)'
      }
    },
    supportedDocuments: [
      'SCOMET Declaration',
      'Packing List', 
      'Fumigation Certificate',
      'Export Declaration'
    ]
  });
}