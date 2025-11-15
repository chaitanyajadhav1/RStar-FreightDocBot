import { InvoiceData, PackingListData } from '../types/documents'

export const validateField = (commercialValue: any, documentValue: any, fieldName: string) => {
  if (!commercialValue && !documentValue) {
    return { match: true }
  }
  if (!commercialValue || !documentValue) {
    return { 
      match: false, 
      commercialValue, 
      documentValue,
      message: `${fieldName}: Missing in one document`
    }
  }
  
  const commercialStr = String(commercialValue).toLowerCase().trim()
  const documentStr = String(documentValue).toLowerCase().trim()
  
  return {
    match: commercialStr === documentStr,
    commercialValue: commercialValue,
    documentValue: documentValue,
    message: commercialStr === documentStr ? undefined : `${fieldName}: "${commercialValue}" vs "${documentValue}"`
  }
}

export const validateDocumentWithCommercial = (commercialData: InvoiceData | null, documentData: any, documentType: string) => {
  if (!commercialData) {
    return {
      invoiceMatchVerified: false,
      validationDetails: {},
      validation_warnings: ['Cannot validate: Commercial invoice not available']
    }
  }

  const validationDetails: any = {}
  const mismatches: string[] = []

  // Common validations for all documents
  if (documentData.invoiceNumber || documentData.invoiceNo) {
    const result = validateField(commercialData.invoice_no, documentData.invoiceNumber || documentData.invoiceNo, 'Invoice Number')
    validationDetails.invoiceNumber = result
    if (!result.match && result.message) mismatches.push(result.message)
  }

  if (documentData.invoiceDate) {
    const normalizeDate = (dateValue: any): string | null => {
      if (!dateValue) return null;
      
      const dateStr = String(dateValue).trim();
      
      const ddmmyyyyPattern = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/;
      const ddmmyyyyMatch = dateStr.match(ddmmyyyyPattern);
      if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      const yyyymmddPattern = /^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/;
      const yyyymmddMatch = dateStr.match(yyyymmddPattern);
      if (yyyymmddMatch) {
        const [, year, month, day] = yyyymmddMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      return null;
    };
    
    const normalizedCommercialDate = normalizeDate(commercialData.invoice_date);
    const normalizedDocumentDate = normalizeDate(documentData.invoiceDate);
    
    const isMatch = normalizedCommercialDate && normalizedDocumentDate && 
                    normalizedCommercialDate === normalizedDocumentDate;
    
    const result = {
      match: isMatch,
      message: !isMatch 
        ? `Invoice Date mismatch: Commercial (${commercialData.invoice_date}) vs Document (${documentData.invoiceDate})`
        : undefined,
      commercialValue: commercialData.invoice_date,
      documentValue: documentData.invoiceDate
    };
    
    validationDetails.invoiceDate = result;
    if (!result.match && result.message) mismatches.push(result.message);
  }

  // Document-specific validations
  if (documentType === 'packinglist') {
    // Validate all packing list fields except amounts
    const packingListValidations = [
      { 
        commercialField: 'consignee_name', 
        documentField: 'consigneeName', 
        fieldName: 'Consignee Name' 
      },
      { 
        commercialField: 'exporter_name', 
        documentField: 'exporterName', 
        fieldName: 'Exporter Name' 
      },
      { 
        commercialField: 'exporter_address', 
        documentField: 'exporterAddress', 
        fieldName: 'Exporter Address' 
      },
      { 
        commercialField: 'consignee_address', 
        documentField: 'consigneeAddress', 
        fieldName: 'Consignee Address' 
      },
      { 
        commercialField: 'port_of_loading', 
        documentField: 'portOfLoading', 
        fieldName: 'Port of Loading' 
      },
      { 
        commercialField: 'port_of_discharge', 
        documentField: 'portOfDischarge', 
        fieldName: 'Port of Discharge' 
      },
      { 
        commercialField: 'final_destination', 
        documentField: 'finalDestination', 
        fieldName: 'Final Destination' 
      },
      { 
        commercialField: 'country_of_origin', 
        documentField: 'countryOfOrigin', 
        fieldName: 'Country of Origin' 
      },
      { 
        commercialField: 'country_of_destination', 
        documentField: 'countryOfDestination', 
        fieldName: 'Country of Destination' 
      },
      { 
        commercialField: 'hsn_code', 
        documentField: 'hsnCode', 
        fieldName: 'HSN Code' 
      },
      { 
        commercialField: 'marksand_nos', 
        documentField: 'marksAndNos', 
        fieldName: 'Marks and Numbers' 
      },
      { 
        commercialField: 'reference_no', 
        documentField: 'referenceNo', 
        fieldName: 'Reference Number' 
      },
      { 
        commercialField: 'proforma_invoice_no', 
        documentField: 'proformaInvoiceNo', 
        fieldName: 'Proforma Invoice Number' 
      },
      { 
        commercialField: 'incoterms', 
        documentField: 'deliveryTerms', 
        fieldName: 'Delivery/Incoterms' 
      },
      { 
        commercialField: 'place_of_receipt', 
        documentField: 'placeOfReceipt', 
        fieldName: 'Place of Receipt' 
      }
    ];

    packingListValidations.forEach(validation => {
      const documentValue = documentData[validation.documentField];
      if (documentValue !== undefined && documentValue !== null && documentValue !== '') {
        const commercialValue = (commercialData as any)[validation.commercialField];
        const result = validateField(commercialValue, documentValue, validation.fieldName);
        validationDetails[validation.documentField] = result;
        if (!result.match && result.message) mismatches.push(result.message);
      }
    });

    // Validate contact information if present
    if (documentData.exporterEmail) {
      const result = validateField(commercialData.exporter_email, documentData.exporterEmail, 'Exporter Email');
      validationDetails.exporterEmail = result;
      if (!result.match && result.message) mismatches.push(result.message);
    }
    
    if (documentData.country_of_destination) {
      const result = validateField(commercialData.final_destination, documentData.country_of_destination, 'Country of Destination');
      validationDetails.country_of_destination = result;
      if (!result.match && result.message) mismatches.push(result.message);
    }
    if (documentData.exporterPhone) {
      const result = validateField(commercialData.exporter_phone, documentData.exporterPhone, 'Exporter Phone');
      validationDetails.exporterPhone = result;
      if (!result.match && result.message) mismatches.push(result.message);
    }

    if (documentData.consigneeEmail) {
      const result = validateField(commercialData.consignee_email, documentData.consigneeEmail, 'Consignee Email');
      validationDetails.consigneeEmail = result;
      if (!result.match && result.message) mismatches.push(result.message);
    }

    if (documentData.consigneePhone) {
      const result = validateField(commercialData.consignee_phone, documentData.consigneePhone, 'Consignee Phone');
      validationDetails.consigneePhone = result;
      if (!result.match && result.message) mismatches.push(result.message);
    }

    // Validate bank details if present
    if (documentData.bankName) {
      const result = validateField(commercialData.bank_name, documentData.bankName, 'Bank Name');
      validationDetails.bankName = result;
      if (!result.match && result.message) mismatches.push(result.message);
    }

    if (documentData.bankSwiftCode) {
      const result = validateField(commercialData.bank_swift_code, documentData.bankSwiftCode, 'Bank SWIFT Code');
      validationDetails.bankSwiftCode = result;
      if (!result.match && result.message) mismatches.push(result.message);
    }

    // Validate items description (basic check)
    if (documentData.descriptionOfGoods && commercialData.items && commercialData.items.length > 0) {
      const commercialDescriptions = commercialData.items.map(item => 
        item.description.toLowerCase().trim()
      ).join('; ');
      
      const documentDescription = String(documentData.descriptionOfGoods).toLowerCase().trim();
      
      // Check if any commercial item description is contained in packing list description
      const hasMatchingDescription = commercialData.items.some(item =>
        documentDescription.includes(item.description.toLowerCase().trim())
      );
      
      const result = {
        match: hasMatchingDescription,
        commercialValue: commercialDescriptions,
        documentValue: documentData.descriptionOfGoods,
        message: !hasMatchingDescription 
          ? `Goods Description mismatch: Commercial items not fully matching packing list description`
          : undefined
      };
      
      validationDetails.descriptionOfGoods = result;
      if (!result.match && result.message) mismatches.push(result.message);
    }
  }

  if (documentType === 'scomet') {
    if (documentData.consigneeName) {
      const result = validateField(commercialData.consignee_name, documentData.consigneeName, 'Consignee Name')
      validationDetails.consigneeName = result
      if (!result.match && result.message) mismatches.push(result.message)
    }
    if (documentData.destinationCountry) {
      const result = validateField(commercialData.final_destination, documentData.destinationCountry, 'Destination Country')
      validationDetails.destinationCountry = result
      if (!result.match && result.message) mismatches.push(result.message)
    }
    
    if (documentData.hsCode) {
      const result = validateField(commercialData.hsn_code, documentData.hsCode, 'HSN Code')
       validationDetails.hsCode = result
     if (!result.match && result.message) mismatches.push(result.message)
      }
  }

  if (documentType === 'fumigation' && documentData.shippingMark) {
    const result = validateField(commercialData.invoice_no, documentData.shippingMark, 'Shipping Mark')
    validationDetails.shippingMark = result
    if (!result.match && result.message) mismatches.push(result.message)
  }

  if (documentType === 'exportdeclaration') {
    // EXPORT DECLARATION SPECIFIC VALIDATIONS
    const exportDeclarationValidations = [
      { 
        commercialField: 'invoice_no', 
        documentField: 'invoiceNo', 
        fieldName: 'Invoice Number' 
      },
      { 
        commercialField: 'invoice_date', 
        documentField: 'invoiceDate', 
        fieldName: 'Invoice Date' 
      },
      { 
        commercialField: 'exporter_name', 
        documentField: 'exporterName', 
        fieldName: 'Exporter Name' 
      },
      { 
        commercialField: 'consignee_name', 
        documentField: 'consigneeName', 
        fieldName: 'Consignee Name' 
      },
      { 
        commercialField: 'port_of_loading', 
        documentField: 'portOfLoading', 
        fieldName: 'Port of Loading' 
      },
      { 
        commercialField: 'port_of_discharge', 
        documentField: 'portOfDischarge', 
        fieldName: 'Port of Discharge' 
      },
      { 
        commercialField: 'final_destination', 
        documentField: 'finalDestination', 
        fieldName: 'Final Destination' 
      },
      { 
        commercialField: 'country_of_origin', 
        documentField: 'countryOfOrigin', 
        fieldName: 'Country of Origin' 
      },
      { 
        commercialField: 'hsn_code', 
        documentField: 'hsnCode', 
        fieldName: 'HSN Code' 
      },
      { 
        commercialField: 'total_amount', 
        documentField: 'totalAmount', 
        fieldName: 'Total Amount' 
      },
      { 
        commercialField: 'currency', 
        documentField: 'currency', 
        fieldName: 'Currency' 
      }
    ];

    exportDeclarationValidations.forEach(validation => {
      const documentValue = documentData[validation.documentField];
      if (documentValue !== undefined && documentValue !== null && documentValue !== '') {
        const commercialValue = (commercialData as any)[validation.commercialField];
        const result = validateField(commercialValue, documentValue, validation.fieldName);
        validationDetails[validation.documentField] = result;
        if (!result.match && result.message) mismatches.push(result.message);
      }
    });

    // Validate payment terms if present
    if (documentData.paymentTerms) {
      const commercialPaymentTerms = commercialData.payment_terms || 'Not specified in commercial invoice';
      const result = validateField(commercialPaymentTerms, documentData.paymentTerms, 'Payment Terms');
      validationDetails.paymentTerms = result;
      if (!result.match && result.message) mismatches.push(result.message);
    }

    // Validate delivery terms if present
    if (documentData.deliveryTerms) {
      const commercialDeliveryTerms = commercialData.incoterms || 'Not specified in commercial invoice';
      const result = validateField(commercialDeliveryTerms, documentData.deliveryTerms, 'Delivery Terms');
      validationDetails.deliveryTerms = result;
      if (!result.match && result.message) mismatches.push(result.message);
    }

    // Validate declaration status and signature
    if (documentData.declarationStatus) {
      const validStatuses = ['signed', 'verified', 'pending', 'approved'];
      const statusValid = validStatuses.includes(documentData.declarationStatus.toLowerCase());
      validationDetails.declarationStatus = {
        match: statusValid,
        commercialValue: 'N/A',
        documentValue: documentData.declarationStatus,
        message: statusValid ? undefined : `Invalid declaration status: ${documentData.declarationStatus}`
      };
      if (!statusValid && validationDetails.declarationStatus.message) {
        mismatches.push(validationDetails.declarationStatus.message);
      }
    }

    // Validate valuation method if present
    if (documentData.valuationMethod) {
      const validMethods = ['transaction value', 'deductive value', 'computed value', 'fallback method'];
      const methodValid = validMethods.includes(documentData.valuationMethod.toLowerCase());
      validationDetails.valuationMethod = {
        match: methodValid,
        commercialValue: 'N/A',
        documentValue: documentData.valuationMethod,
        message: methodValid ? undefined : `Invalid valuation method: ${documentData.valuationMethod}`
      };
      if (!methodValid && validationDetails.valuationMethod.message) {
        mismatches.push(validationDetails.valuationMethod.message);
      }
    }

    // Validate relationship information
    if (documentData.sellerBuyerRelated !== undefined && documentData.sellerBuyerRelated !== null) {
      validationDetails.sellerBuyerRelated = {
        match: true, // Just record the information
        commercialValue: 'N/A',
        documentValue: documentData.sellerBuyerRelated ? 'Related' : 'Not Related',
        message: undefined
      };
    }

    if (documentData.relationshipInfluencedPrice !== undefined && documentData.relationshipInfluencedPrice !== null) {
      validationDetails.relationshipInfluencedPrice = {
        match: true, // Just record the information
        commercialValue: 'N/A',
        documentValue: documentData.relationshipInfluencedPrice ? 'Price Influenced' : 'Price Not Influenced',
        message: undefined
      };
    }
  }

  const invoiceMatchVerified = mismatches.length === 0

  return {
    invoiceMatchVerified,
    validationDetails,
    validation_warnings: invoiceMatchVerified 
      ? ['All fields match commercial invoice'] 
      : mismatches
  }
}

// Specialized packing list validation function
export const validatePackingListWithCommercial = (commercialData: InvoiceData, packingListData: PackingListData) => {
  const baseValidation = validateDocumentWithCommercial(commercialData, packingListData, 'packinglist');
  
  // Additional packing list specific validations
  const additionalMismatches: string[] = [];
  const additionalDetails: any = {};

  // Validate box details if present
  if (packingListData.boxDetails && packingListData.boxDetails.length > 0) {
    // Check if the number of boxes matches item count (rough validation)
    if (commercialData.item_count && packingListData.totalBoxes) {
      const boxesMatch = packingListData.totalBoxes >= commercialData.item_count;
      additionalDetails.boxCount = {
        match: boxesMatch,
        commercialValue: commercialData.item_count,
        documentValue: packingListData.totalBoxes,
        message: boxesMatch ? undefined : `Box count (${packingListData.totalBoxes}) less than item count (${commercialData.item_count})`
      };
      if (!boxesMatch && additionalDetails.boxCount.message) {
        additionalMismatches.push(additionalDetails.boxCount.message);
      }
    }

    // Validate weights are present and reasonable
    if (packingListData.totalGrossWeight && packingListData.totalNetWeight) {
      const grossWeight = parseFloat(packingListData.totalGrossWeight);
      const netWeight = parseFloat(packingListData.totalNetWeight);
      
      if (!isNaN(grossWeight) && !isNaN(netWeight)) {
        const weightValid = grossWeight >= netWeight && grossWeight > 0 && netWeight > 0;
        additionalDetails.weights = {
          match: weightValid,
          commercialValue: 'N/A',
          documentValue: `Gross: ${packingListData.totalGrossWeight}, Net: ${packingListData.totalNetWeight}`,
          message: weightValid ? undefined : 'Weight values are inconsistent (gross should be >= net)'
        };
        if (!weightValid && additionalDetails.weights.message) {
          additionalMismatches.push(additionalDetails.weights.message);
        }
      }
    }
  }

  // Combine results
  const allMismatches = [...baseValidation.validation_warnings.filter(msg => msg !== 'All fields match commercial invoice'), ...additionalMismatches];
  const allDetails = { ...baseValidation.validationDetails, ...additionalDetails };

  const completeMatchVerified = allMismatches.length === 0;

  return {
    ...baseValidation,
    invoiceMatchVerified: completeMatchVerified,
    validationDetails: allDetails,
    validation_warnings: completeMatchVerified 
      ? ['All fields match commercial invoice'] 
      : allMismatches,
    amountsMatchVerified: true // Explicitly mark amounts as not validated
  };
}

export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255)
}

// Additional validation helpers that might be useful
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))
}

export const validateDate = (dateString: string): boolean => {
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

export const validateNumber = (value: any): boolean => {
  if (value === null || value === undefined || value === '') return false
  const num = Number(value)
  return !isNaN(num) && isFinite(num)
}

export const validateRequired = (value: any): boolean => {
  return value !== null && value !== undefined && value !== ''
}

export const validateHSNCode = (hsnCode: string): boolean => {
  // Basic HSN code validation - 4-8 digits
  const hsnRegex = /^\d{4,8}$/
  return hsnRegex.test(hsnCode.replace(/\s/g, ''))
}

export const validateGSTIN = (gstin: string): boolean => {
  // Basic GSTIN validation - 15 alphanumeric characters
  const gstinRegex = /^[0-9A-Z]{15}$/
  return gstinRegex.test(gstin)
}

export const validatePAN = (pan: string): boolean => {
  // Basic PAN validation - 10 alphanumeric characters
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
  return panRegex.test(pan)
}

export const validateIEC = (iec: string): boolean => {
  // Basic IEC validation - 10 digits
  const iecRegex = /^\d{10}$/
  return iecRegex.test(iec)
}

export const validateSWIFTCode = (swiftCode: string): boolean => {
  // SWIFT/BIC code validation - 8 or 11 characters
  const swiftRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/
  return swiftRegex.test(swiftCode)
}

export const validateIFSCCode = (ifscCode: string): boolean => {
  // IFSC code validation - 11 characters
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
  return ifscRegex.test(ifscCode)
}

// Comprehensive document validation
export const validateInvoiceCompleteness = (invoice: InvoiceData): { completeness: number; missingFields: string[] } => {
  const requiredFields = [
    'invoice_no',
    'invoice_date',
    'exporter_name',
    'consignee_name',
    'items',
    'total_amount',
    'currency'
  ]

  const missingFields: string[] = []
  
  requiredFields.forEach(field => {
    const value = (invoice as any)[field]
    if (!value || (Array.isArray(value) && value.length === 0)) {
      missingFields.push(field)
    }
  })

  const completeness = ((requiredFields.length - missingFields.length) / requiredFields.length) * 100
  
  return {
    completeness: Math.round(completeness),
    missingFields
  }
}

// Packing list completeness validation
export const validatePackingListCompleteness = (packingList: PackingListData): { completeness: number; missingFields: string[] } => {
  const requiredFields = [
    'packingListNumber',
    'packingListDate',
    'exporterName',
    'consigneeName',
    'invoiceNumber',
    'marksAndNos',
    'boxDetails',
    'totalGrossWeight',
    'totalNetWeight'
  ]

  const missingFields: string[] = []
  
  requiredFields.forEach(field => {
    const value = (packingList as any)[field]
    if (!value || (Array.isArray(value) && value.length === 0)) {
      missingFields.push(field)
    }
  })

  const completeness = ((requiredFields.length - missingFields.length) / requiredFields.length) * 100
  
  return {
    completeness: Math.round(completeness),
    missingFields
  }
}

// Export Declaration completeness validation
export const validateExportDeclarationCompleteness = (exportDeclaration: any): { completeness: number; missingFields: string[] } => {
  const requiredFields = [
    'invoiceNo',
    'invoiceDate',
    'declarationStatus',
    'signedBy',
    'signedDate',
    'valuationMethod',
    'paymentTerms'
  ]

  const missingFields: string[] = []
  
  requiredFields.forEach(field => {
    const value = exportDeclaration[field]
    if (!value || (Array.isArray(value) && value.length === 0)) {
      missingFields.push(field)
    }
  })

  const completeness = ((requiredFields.length - missingFields.length) / requiredFields.length) * 100
  
  return {
    completeness: Math.round(completeness),
    missingFields
  }
}

// Validation result formatter
export const formatValidationResults = (errors: string[], warnings: string[]) => {
  return {
    isValid: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    summary: errors.length === 0 ? 'Document is valid' : `Document has ${errors.length} error(s)`,
    details: {
      errors,
      warnings
    }
  }
}

// Currency validation
export const validateCurrency = (currency: string): boolean => {
  const validCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CNY', 'SGD', 'AED']
  return validCurrencies.includes(currency.toUpperCase())
}

// Amount validation
export const validateAmount = (amount: number): boolean => {
  return amount > 0 && amount < 1000000000 // Reasonable upper limit
}

// Quantity validation
export const validateQuantity = (quantity: number): boolean => {
  return quantity > 0 && quantity < 1000000 // Reasonable upper limit
}

// Unit price validation
export const validateUnitPrice = (unitPrice: number): boolean => {
  return unitPrice >= 0 && unitPrice < 1000000 // Reasonable upper limit
}

// Weight validation for packing list
export const validateWeight = (weight: string): boolean => {
  const weightNum = parseFloat(weight);
  return !isNaN(weightNum) && weightNum > 0 && weightNum < 100000; // Reasonable upper limit
}

// Box details validation
export const validateBoxDetails = (boxDetails: any[]): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!boxDetails || boxDetails.length === 0) {
    return { isValid: false, errors: ['No box details provided'] };
  }

  boxDetails.forEach((box, index) => {
    const boxNumber = index + 1;
    
    if (!box.contents) {
      errors.push(`Box ${boxNumber}: Missing contents description`);
    }
    
    if (box.grossWeight && !validateWeight(box.grossWeight)) {
      errors.push(`Box ${boxNumber}: Invalid gross weight`);
    }
    
    if (box.netWeight && !validateWeight(box.netWeight)) {
      errors.push(`Box ${boxNumber}: Invalid net weight`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}