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
  documentType: 'scomet' | 'packinglist' | 'fumigation' | 'exportdeclaration' | 'airwaybill';
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

function normalizePaymentTerms(paymentTerms: any): string {
  if (!paymentTerms) return '';
  
  const terms = String(paymentTerms).toLowerCase().trim();
  
  // Common payment terms normalization
  if (terms.includes('advance') || terms.includes('prepaid') || terms.includes('before shipment')) {
    return 'advance';
  }
  if (terms.includes('letter of credit') || terms.includes('l/c') || terms.includes('lc')) {
    return 'letter of credit';
  }
  if (terms.includes('document against payment') || terms.includes('d/p') || terms.includes('dp')) {
    return 'document against payment';
  }
  if (terms.includes('document against acceptance') || terms.includes('d/a') || terms.includes('da')) {
    return 'document against acceptance';
  }
  if (terms.includes('open account') || terms.includes('credit')) {
    return 'open account';
  }
  if (terms.includes('cash') || terms.includes('immediate')) {
    return 'cash';
  }
  
  return terms;
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

  // CD – Fumigation Certificate: Shipping mark or brand → Commercial Invoice No. and Date
  if (fumigationData.shippingMark) {
    const shippingMark = String(fumigationData.shippingMark).trim();
    const invoiceNo = String(commercialData.invoice_no || '').trim();
    const invoiceDate = commercialData.invoice_date ? normalizeDate(commercialData.invoice_date) : null;
    
    // Check if shipping mark contains invoice number
    let invoiceNoMatch = false;
    if (invoiceNo && shippingMark) {
      // Extract invoice number from shipping mark (could be in format like "222500187 Dt 17.07.2025")
      const invoiceNoInMark = shippingMark.match(/\d+/);
      if (invoiceNoInMark) {
        invoiceNoMatch = invoiceNoInMark[0] === invoiceNo || shippingMark.includes(invoiceNo);
      } else {
        invoiceNoMatch = shippingMark.includes(invoiceNo);
      }
    }
    
    // Check if shipping mark contains invoice date
    let invoiceDateMatch = false;
    if (invoiceDate && shippingMark) {
      // Try to find date in shipping mark (format could be DD.MM.YYYY, DD/MM/YYYY, etc.)
      // First try DD.MM.YYYY or DD/MM/YYYY format (most common in shipping marks)
      const ddmmyyyyPattern = /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/;
      const ddmmyyyyMatch = shippingMark.match(ddmmyyyyPattern);
      if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        const extractedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        if (extractedDate === invoiceDate) {
          invoiceDateMatch = true;
        }
      }
      
      // If not matched, try YYYY-MM-DD format
      if (!invoiceDateMatch) {
        const yyyymmddPattern = /(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/;
        const yyyymmddMatch = shippingMark.match(yyyymmddPattern);
        if (yyyymmddMatch) {
          const [, year, month, day] = yyyymmddMatch;
          const extractedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          if (extractedDate === invoiceDate) {
            invoiceDateMatch = true;
          }
        }
      }
    }
    
    // Validate shipping mark contains invoice number
    if (invoiceNo) {
      totalFields++;
      const result = {
        match: invoiceNoMatch,
        commercialValue: commercialData.invoice_no,
        documentValue: fumigationData.shippingMark,
        message: !invoiceNoMatch 
          ? `Shipping mark/brand does not contain Commercial Invoice No: "${commercialData.invoice_no}"`
          : undefined
      };
      validationDetails.shippingMarkInvoiceNo = result;
      if (result.match) matchedFields++;
      if (!result.match && result.message) mismatches.push(result.message);
    }
    
    // Validate shipping mark contains invoice date
    if (invoiceDate) {
      totalFields++;
      const result = {
        match: invoiceDateMatch,
        commercialValue: commercialData.invoice_date,
        documentValue: fumigationData.shippingMark,
        message: !invoiceDateMatch 
          ? `Shipping mark/brand does not contain Commercial Invoice Date: "${commercialData.invoice_date}"`
          : undefined
      };
      validationDetails.shippingMarkInvoiceDate = result;
      if (result.match) matchedFields++;
      if (!result.match && result.message) mismatches.push(result.message);
    }
  }

  // Invoice reference validations (fallback if shipping mark validation not available)
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

// UPDATED: Enhanced Export Declaration Validation
function validateExportDeclarationWithCommercial(commercialData: any, exportDeclarationData: any): VerificationResult {
  const validationDetails: any = {};
  const mismatches: string[] = [];
  let matchedFields = 0;
  let totalFields = 0;

  // ============================================
  // CORE INVOICE REFERENCE VALIDATIONS
  // ============================================
  
  // Invoice Number - Critical Match
  if (exportDeclarationData.invoiceNo) {
    totalFields++;
    const result = validateField(commercialData.invoice_no, exportDeclarationData.invoiceNo, 'Invoice Number');
    validationDetails.invoiceNo = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Invoice Date - Critical Match
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

  // ============================================
  // PAYMENT TERMS VALIDATION - ENHANCED
  // ============================================
  if (exportDeclarationData.paymentTerms && commercialData.payment_terms) {
    totalFields++;
    
    const normalizedCommercialPayment = normalizePaymentTerms(commercialData.payment_terms);
    const normalizedExportPayment = normalizePaymentTerms(exportDeclarationData.paymentTerms);
    
    let paymentMatch = false;
    let paymentMessage = '';
    
    if (normalizedCommercialPayment && normalizedExportPayment) {
      paymentMatch = normalizedCommercialPayment === normalizedExportPayment ||
                    normalizedCommercialPayment.includes(normalizedExportPayment) ||
                    normalizedExportPayment.includes(normalizedCommercialPayment);
      
      if (!paymentMatch) {
        paymentMessage = `Payment Terms mismatch: Commercial (${commercialData.payment_terms}) vs Export Declaration (${exportDeclarationData.paymentTerms})`;
      }
    } else {
      // Fallback to exact match if normalization fails
      const exactMatch = String(commercialData.payment_terms).toLowerCase() === 
                        String(exportDeclarationData.paymentTerms).toLowerCase();
      paymentMatch = exactMatch;
      if (!paymentMatch) {
        paymentMessage = `Payment Terms mismatch: Commercial (${commercialData.payment_terms}) vs Export Declaration (${exportDeclarationData.paymentTerms})`;
      }
    }
    
    const result = {
      match: paymentMatch,
      message: paymentMessage || undefined,
      commercialValue: commercialData.payment_terms,
      documentValue: exportDeclarationData.paymentTerms,
      normalized: {
        commercial: normalizedCommercialPayment,
        export: normalizedExportPayment
      }
    };
    
    validationDetails.paymentTerms = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // ============================================
  // CD – Annexure A: SHIPPING BILL VALIDATIONS
  // ============================================
  // Shipping Bill No - should be present (validated for presence)
  if (exportDeclarationData.shippingBillNo) {
    totalFields++;
    validationDetails.shippingBillNo = {
      match: true,
      commercialValue: 'N/A (Commercial Invoice)',
      documentValue: exportDeclarationData.shippingBillNo,
      message: undefined
    };
    matchedFields++; // Shipping bill is export-specific, so presence is good
  }

  // CD – Annexure A: Shipping Date → Commercial Invoice Shipping Date (validated against invoice date logic)
  if (exportDeclarationData.shippingBillDate) {
    totalFields++;
    // Shipping bill date should be logical (not before invoice date)
    const invoiceDate = normalizeDate(commercialData.invoice_date);
    const shippingBillDate = normalizeDate(exportDeclarationData.shippingBillDate);
    
    let dateLogicValid = true;
    let dateMessage = '';
    
    if (invoiceDate && shippingBillDate) {
      const invoiceDateTime = new Date(invoiceDate).getTime();
      const shippingBillDateTime = new Date(shippingBillDate).getTime();
      
      // Shipping bill date should not be before invoice date
      if (shippingBillDateTime < invoiceDateTime) {
        dateLogicValid = false;
        dateMessage = `Shipping Date (${exportDeclarationData.shippingBillDate}) cannot be before Commercial Invoice Date (${commercialData.invoice_date})`;
      }
    }
    
    const result = {
      match: dateLogicValid,
      message: dateMessage || undefined,
      commercialValue: commercialData.invoice_date || 'N/A (Commercial Invoice)',
      documentValue: exportDeclarationData.shippingBillDate,
      dateLogic: dateLogicValid ? 'valid' : 'invalid'
    };
    
    validationDetails.shippingBillDate = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // ============================================
  // VALUATION AND BUSINESS VALIDATIONS
  // ============================================
  const exportValidations = [
    { commercialField: 'exporter_name', documentField: 'exporterName', fieldName: 'Exporter Name' },
    { commercialField: 'consignee_name', documentField: 'consigneeName', fieldName: 'Consignee Name' },
    { commercialField: 'port_of_loading', documentField: 'portOfLoading', fieldName: 'Port of Loading' },
    { commercialField: 'port_of_discharge', documentField: 'portOfDischarge', fieldName: 'Port of Discharge' },
    { commercialField: 'final_destination', documentField: 'finalDestination', fieldName: 'Final Destination' },
    { commercialField: 'country_of_origin', documentField: 'countryOfOrigin', fieldName: 'Country of Origin' },
    { commercialField: 'hsn_code', documentField: 'hsnCode', fieldName: 'HSN Code' },
    { commercialField: 'total_amount', documentField: 'totalAmount', fieldName: 'Total Amount' },
    { commercialField: 'currency', documentField: 'currency', fieldName: 'Currency' },
    { commercialField: 'delivery_terms', documentField: 'deliveryTerms', fieldName: 'Delivery Terms' }
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

  // ============================================
  // DECLARATION SPECIFIC VALIDATIONS
  // ============================================
  
  // Declaration Status
  if (exportDeclarationData.declarationStatus) {
    totalFields++;
    const validStatuses = ['submitted', 'approved', 'pending', 'rejected', 'completed'];
    const statusValid = validStatuses.includes(exportDeclarationData.declarationStatus.toLowerCase());
    
    const result = {
      match: statusValid,
      message: !statusValid ? `Invalid declaration status: ${exportDeclarationData.declarationStatus}` : undefined,
      commercialValue: 'N/A (Commercial Invoice)',
      documentValue: exportDeclarationData.declarationStatus
    };
    
    validationDetails.declarationStatus = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Signed Date Validation
  if (exportDeclarationData.signedDate) {
    totalFields++;
    const signedDate = normalizeDate(exportDeclarationData.signedDate);
    const invoiceDate = normalizeDate(commercialData.invoice_date);
    
    let signedDateValid = true;
    let signedDateMessage = '';
    
    if (signedDate && invoiceDate) {
      const signedDateTime = new Date(signedDate).getTime();
      const invoiceDateTime = new Date(invoiceDate).getTime();
      
      // Signed date should not be before invoice date
      if (signedDateTime < invoiceDateTime) {
        signedDateValid = false;
        signedDateMessage = `Signed Date (${exportDeclarationData.signedDate}) cannot be before Invoice Date (${commercialData.invoice_date})`;
      }
    }
    
    const result = {
      match: signedDateValid,
      message: signedDateMessage || undefined,
      commercialValue: 'N/A (Commercial Invoice)',
      documentValue: exportDeclarationData.signedDate
    };
    
    validationDetails.signedDate = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Calculate completeness
  const completeness = totalFields > 0 ? Math.round((matchedFields / totalFields) * 100) : 0;
  
  // Critical validations for invoice match
  const criticalFieldsValid = 
    (!exportDeclarationData.invoiceNo || validationDetails.invoiceNo?.match) &&
    (!exportDeclarationData.invoiceDate || validationDetails.invoiceDate?.match);
  
  const invoiceMatchVerified = mismatches.length === 0 && criticalFieldsValid;

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
      matchPercentage: completeness,
      criticalFieldsValid,
      paymentTermsVerified: validationDetails.paymentTerms?.match || false,
      dateLogicVerified: validationDetails.shippingBillDate?.match && validationDetails.signedDate?.match
    },
    timestamp: new Date().toISOString()
  };
}

// Airlines – Airway Bill Validation Function
function validateAirwayBillWithCommercial(commercialData: any, airwayBillData: any): VerificationResult {
  const validationDetails: any = {};
  const mismatches: string[] = [];
  let matchedFields = 0;
  let totalFields = 0;

  // Airlines – Airway Bill: Invoice No → Commercial Invoice No
  if (airwayBillData.invoice_no) {
    totalFields++;
    const result = validateField(commercialData.invoice_no, airwayBillData.invoice_no, 'Invoice Number');
    validationDetails.invoice_no = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Airlines – Airway Bill: Invoice Date → Commercial Invoice Date
  if (airwayBillData.invoice_date) {
    totalFields++;
    const normalizedCommercialDate = normalizeDate(commercialData.invoice_date);
    const normalizedDocumentDate = normalizeDate(airwayBillData.invoice_date);
    
    const isMatch = normalizedCommercialDate && normalizedDocumentDate && 
                    normalizedCommercialDate === normalizedDocumentDate;
    
    const result = {
      match: isMatch,
      message: !isMatch 
        ? `Invoice Date mismatch: Commercial (${commercialData.invoice_date}) vs Airway Bill (${airwayBillData.invoice_date})`
        : undefined,
      commercialValue: commercialData.invoice_date,
      documentValue: airwayBillData.invoice_date
    };
    
    validationDetails.invoice_date = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Airlines – Airway Bill: Shippers Name → Commercial Invoice Shipper Name
  if (airwayBillData.shippers_name) {
    totalFields++;
    const result = validateField(commercialData.exporter_name, airwayBillData.shippers_name, 'Shippers Name');
    validationDetails.shippers_name = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Airlines – Airway Bill: Shippers Address → Commercial Invoice Shipper Address
  if (airwayBillData.shippers_address) {
    totalFields++;
    const result = validateField(commercialData.exporter_address, airwayBillData.shippers_address, 'Shippers Address');
    validationDetails.shippers_address = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Airlines – Airway Bill: Consignees Name → Commercial Invoice Consignee Name
  if (airwayBillData.consignees_name) {
    totalFields++;
    const result = validateField(commercialData.consignee_name, airwayBillData.consignees_name, 'Consignees Name');
    validationDetails.consignees_name = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Airlines – Airway Bill: Consignees Address → Commercial Invoice Consignee Address
  if (airwayBillData.consignees_address) {
    totalFields++;
    const result = validateField(commercialData.consignee_address, airwayBillData.consignees_address, 'Consignees Address');
    validationDetails.consignees_address = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Airlines – Airway Bill: Issuing Carriers Name → Commercial Invoice Carrier Name
  if (airwayBillData.issuing_carriers_name) {
    totalFields++;
    // Carrier name might be in vessel_flight or other fields in commercial invoice
    const carrierName = commercialData.vessel_flight || commercialData.carrier_name || '';
    const result = validateField(carrierName, airwayBillData.issuing_carriers_name, 'Issuing Carriers Name');
    validationDetails.issuing_carriers_name = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Airlines – Airway Bill: Issuing Carriers City (presence check only, no cross-validation)
  if (airwayBillData.issuing_carriers_city) {
    totalFields++;
    validationDetails.issuing_carriers_city = {
      match: true,
      commercialValue: 'N/A (Commercial Invoice)',
      documentValue: airwayBillData.issuing_carriers_city,
      message: undefined
    };
    matchedFields++; // Presence is good
  }

  // Airlines – Airway Bill: HS Code No → Commercial Invoice HS Code
  if (airwayBillData.hs_code_no) {
    totalFields++;
    const result = validateField(commercialData.hsn_code, airwayBillData.hs_code_no, 'HS Code');
    validationDetails.hs_code_no = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Additional Airway Bill validations
  const airwayBillValidations = [
    // Shipment details
    { commercialField: 'port_of_loading', documentField: 'airport_of_departure', fieldName: 'Port/Airport of Departure' },
    { commercialField: 'port_of_discharge', documentField: 'airport_of_destination', fieldName: 'Port/Airport of Destination' },
    { commercialField: 'final_destination', documentField: 'airport_of_destination', fieldName: 'Final Destination' },
    { commercialField: 'marks_and_nos', documentField: 'marks_and_nos', fieldName: 'Marks and Numbers' }
  ];

  airwayBillValidations.forEach(validation => {
    const documentValue = airwayBillData[validation.documentField];
    if (documentValue !== undefined && documentValue !== null && documentValue !== '') {
      totalFields++;
      const commercialValue = commercialData[validation.commercialField];
      const result = validateField(commercialValue, documentValue, validation.fieldName);
      validationDetails[validation.documentField] = result;
      if (result.match) matchedFields++;
      if (!result.match && result.message) mismatches.push(result.message);
    }
  });

  // Cargo weight validation (if available)
  let amountsMatchVerified = true;
  if (airwayBillData.gross_weight && commercialData.total_weight) {
    totalFields++;
    const result = validateField(commercialData.total_weight, airwayBillData.gross_weight, 'Total Weight');
    validationDetails.gross_weight = result;
    if (result.match) matchedFields++;
    if (!result.match && result.message) {
      mismatches.push(result.message);
      amountsMatchVerified = false;
    }
  }

  // Nature of goods validation
  if (airwayBillData.nature_of_goods && commercialData.description_of_goods) {
    totalFields++;
    const commercialDesc = String(commercialData.description_of_goods).toLowerCase();
    const airwayDesc = String(airwayBillData.nature_of_goods).toLowerCase();
    
    // Simple substring match for goods description
    const isMatch = commercialDesc.includes(airwayDesc) || airwayDesc.includes(commercialDesc);
    
    const result = {
      match: isMatch,
      message: !isMatch 
        ? `Goods description mismatch: Commercial (${commercialData.description_of_goods}) vs Airway Bill (${airwayBillData.nature_of_goods})`
        : undefined,
      commercialValue: commercialData.description_of_goods,
      documentValue: airwayBillData.nature_of_goods
    };
    
    validationDetails.nature_of_goods = result;
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
    amountsMatchVerified,
    validationDetails,
    validation_errors: invoiceMatchVerified ? [] : mismatches,
    validation_warnings: invoiceMatchVerified ? ['All fields match commercial invoice'] : ['Some fields may require manual verification'],
    crossDocumentMatches: {
      totalFieldsChecked: totalFields,
      matchedFields,
      matchPercentage: completeness,
      weightsVerified: amountsMatchVerified
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

    const validDocumentTypes = ['scomet', 'packinglist', 'fumigation', 'exportdeclaration', 'airwaybill'];
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
      exporter: commercialInvoice.exporter_name,
      paymentTerms: commercialInvoice.payment_terms
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
      case 'airwaybill':
        validationResult = validateAirwayBillWithCommercial(commercialInvoice, documentData);
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
      currency: commercialInvoice.currency,
      port_of_loading: commercialInvoice.port_of_loading,
      port_of_discharge: commercialInvoice.port_of_discharge,
      final_destination: commercialInvoice.final_destination,
      payment_terms: commercialInvoice.payment_terms,
      delivery_terms: commercialInvoice.delivery_terms
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
    
    // Log specific details for export declaration
    if (documentType === 'exportdeclaration') {
      console.log(`[Cross-Verify] Payment Terms Verified: ${validationResult.crossDocumentMatches.paymentTermsVerified}`);
      console.log(`[Cross-Verify] Date Logic Verified: ${validationResult.crossDocumentMatches.dateLogicVerified}`);
    }
    
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
        documentType: 'scomet | packinglist | fumigation | exportdeclaration | airwaybill (required)',
        documentData: 'object (required)',
        userId: 'string (required)',
        threadId: 'string (optional)'
      }
    },
    supportedDocuments: [
      'SCOMET Declaration',
      'Packing List', 
      'Fumigation Certificate',
      'Export Declaration',
      'Airway Bill'
    ],
    exportDeclarationValidations: [
      'Invoice Number (Critical)',
      'Invoice Date (Critical)', 
      'Payment Terms (Enhanced)',
      'Shipping Bill Date Logic',
      'Signed Date Logic',
      'Exporter/Consignee Details',
      'Port and Destination Information',
      'HS Code and Amounts'
    ]
  });
}