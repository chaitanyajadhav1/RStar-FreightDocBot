// ============================================
// PACKING LIST INTERFACES
// ============================================

export interface BoxDetail {
  boxNumber: string | null;
  size: string | null;
  grossWeight: string | null;
  boxWeight: string | null;
  netWeight: string | null;
  contents: string | null;
}

export interface ExporterInfo {
  name: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  pan: string | null;
  gstin: string | null;
  iec: string | null;
}

export interface ConsigneeInfo {
  name: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  poBox: string | null;
}

export interface BankDetails {
  bankName: string | null;
  bankAddress: string | null;
  usdAccount: string | null;
  euroAccount: string | null;
  ifscCode: string | null;
  swiftCode: string | null;
  branchCode: string | null;
  adCode: string | null;
  bsrCode: string | null;
}

export interface ShipmentDetails {
  countryOfOrigin: string | null;
  countryOfDestination: string | null;
  preCarriageBy: string | null;
  placeOfReceipt: string | null;
  deliveryTerms: string | null;
  hsnCode: string | null;
  vesselFlightNo: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  finalDestination: string | null;
  freightTerms: string | null;
}

export interface PackingListData {
  // Core fields
  packingListNumber: string | null;
  packingListDate: string | null;
  referenceNo: string | null;
  proformaInvoiceNo: string | null;
  
  // Exporter details
  exporter: ExporterInfo;
  
  // Consignee details
  consignee: ConsigneeInfo;
  
  // Bank details
  bankDetails: BankDetails;
  
  // Shipment details
  shipmentDetails: ShipmentDetails;
  
  // Marks and numbers
  marksAndNos: string | null;
  
  // Invoice reference
  invoiceNumber: string | null;
  invoiceDate: string | null;
  
  // Box details
  boxDetails: BoxDetail[];
  totalBoxes: number;
  totalGrossWeight: string | null;
  totalNetWeight: string | null;
  totalBoxWeight: string | null;
  packageType: string | null;
  
  // Additional fields
  descriptionOfGoods: string | null;
  certificationStatement: string | null;
}

export interface PackingListValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  extractedData: PackingListData;
  completeness: number;
}

// ============================================
// GROQ CLIENT (Reuse from SCOMET)
// ============================================

const GROQ_CONFIG = {
  apiKey: process.env.GROQ_API_KEY || '',
  model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  timeout: 30000,
  maxTokens: 8000,
  maxRetries: 3,
  retryDelay: 1000,
  requestDelay:15000,
};

class GroqClient {
  private apiKey: string;
  private model: string;
  private timeout: number;
  private maxTokens: number;
  private maxRetries: number;
  private retryDelay: number;
  private requestDelay: number;

  constructor(config: typeof GROQ_CONFIG) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.timeout = config.timeout;
    this.maxTokens = config.maxTokens;
    this.maxRetries = config.maxRetries;
    this.retryDelay = config.retryDelay;
    this.requestDelay=config.requestDelay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    
    const truncated = text.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');
    
    const cutPoint = Math.max(lastPeriod, lastNewline);
    if (cutPoint > maxLength * 0.8) {
      return truncated.substring(0, cutPoint + 1);
    }
    
    return truncated;
  }

  async generate(prompt: string, systemPrompt?: string, options?: any): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Groq API key is required. Set GROQ_API_KEY environment variable.');
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`[Groq] Attempt ${attempt}/${this.maxRetries}...`);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: options?.max_tokens || this.maxTokens,
            temperature: options?.temperature || 0.1,
            top_p: options?.top_p || 0.9,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage = errorData?.error?.message || response.statusText;
          
          if (response.status === 400 && errorMessage.toLowerCase().includes('token')) {
            throw new Error('TOKEN_OVERFLOW');
          }
          
          if (response.status === 429) {
            if (attempt < this.maxRetries) {
              await this.sleep(this.retryDelay * attempt * 2);
              continue;
            }
          }
          
          throw new Error(`Groq API error: ${response.status} - ${errorMessage}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        
        console.log('[Groq] Response received, length:', content.length);
        return content;

      } catch (error: any) {
        lastError = error;
        
        if (error.name === 'AbortError' || error.message === 'TOKEN_OVERFLOW') {
          if (attempt < this.maxRetries) {
            await this.sleep(this.retryDelay);
            continue;
          }
        }
        
        console.error(`[Groq] Attempt ${attempt} failed:`, error.message);
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay * attempt);
          continue;
        }
      }
    }

    throw new Error(`Failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  async extractJSON(
    documentText: string,
    schema: string,
    instruction: string,
    attempt: number = 1
  ): Promise<any> {
    const systemPrompt = `You are an expert packing list data extraction AI. Extract information EXACTLY as it appears.
Return ONLY valid JSON matching the schema. No explanations, no markdown, just pure JSON.`;

    let textToAnalyze = documentText;
    if (attempt > 1) {
      const maxLength = 10000 - (attempt * 2000);
      textToAnalyze = this.truncateText(documentText, maxLength);
      console.log(`[Groq] Retry ${attempt}: Truncated to ${textToAnalyze.length} chars`);
    } else {
      textToAnalyze = this.truncateText(documentText, 12000);
    }

    const prompt = `${instruction}

SCHEMA:
${schema}

PACKING LIST TEXT:
${textToAnalyze}

Return ONLY the JSON object:`;

    try {
      const response = await this.generate(prompt, systemPrompt, {
        temperature: 0.1,
        max_tokens: this.maxTokens
      });
      
      return this.parseJSON(response);
      
    } catch (error: any) {
      console.error('[Groq] Extraction error:', error.message);
      
      if (error.message.includes('TOKEN_OVERFLOW') && attempt < this.maxRetries) {
        await this.sleep(this.retryDelay);
        return this.extractJSON(documentText, schema, instruction, attempt + 1);
      }
      
      return null;
    }
  }

  private parseJSON(response: string): any {
    let cleaned = response.trim();
    
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const jsonStart = cleaned.search(/[\{\[]/);
    if (jsonStart > 0) {
      cleaned = cleaned.substring(jsonStart);
    }
    
    const jsonEnd = cleaned.lastIndexOf('}') !== -1 ? cleaned.lastIndexOf('}') : cleaned.lastIndexOf(']');
    if (jsonEnd !== -1 && jsonEnd < cleaned.length - 1) {
      cleaned = cleaned.substring(0, jsonEnd + 1);
    }
    
    try {
      return JSON.parse(cleaned);
    } catch (parseError) {
      console.error('[Groq] JSON parse error:', cleaned.substring(0, 300));
      
      try {
        let fixed = cleaned;
        const quoteCount = (fixed.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          const lastBrace = fixed.lastIndexOf('}');
          if (lastBrace !== -1) {
            fixed = fixed.substring(0, lastBrace) + '"' + fixed.substring(lastBrace);
          }
        }
        return JSON.parse(fixed);
      } catch (fixError) {
        throw parseError;
      }
    }
  }
}

const groq = new GroqClient(GROQ_CONFIG);

// ============================================
// PACKING LIST EXTRACTION FUNCTIONS
// ============================================

async function extractPackingListBasicInfoGroq(documentText: string): Promise<{
  packingListNumber: string | null;
  packingListDate: string | null;
  referenceNo: string | null;
  proformaInvoiceNo: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
}> {
  console.log('[Groq] Extracting packing list basic information...');
  
  const schema = `{
  "packingListNumber": "PL NO or Packing List number",
  "packingListDate": "Date in DD.MM.YYYY or DD/MM/YYYY",
  "referenceNo": "Reference number",
  "proformaInvoiceNo": "Proforma Invoice number (PI NO, PMI/xxxxx)",
  "invoiceNumber": "Invoice number",
  "invoiceDate": "Invoice date"
}`;

  const instruction = `Extract basic packing list info: PL NO, DATE, REFERENCE NO, PROFORMA INVOICE NO, INVOICE NO & DATE.`;

  const result = await groq.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Groq] Packing list basic info extracted');
    return {
      packingListNumber: result.packingListNumber || null,
      packingListDate: result.packingListDate || null,
      referenceNo: result.referenceNo || null,
      proformaInvoiceNo: result.proformaInvoiceNo || null,
      invoiceNumber: result.invoiceNumber || null,
      invoiceDate: result.invoiceDate || null
    };
  }
  
  return {
    packingListNumber: null,
    packingListDate: null,
    referenceNo: null,
    proformaInvoiceNo: null,
    invoiceNumber: null,
    invoiceDate: null
  };
}

async function extractPackingListExporterGroq(documentText: string): Promise<ExporterInfo> {
  console.log('[Groq] Extracting exporter information...');
  
  const schema = `{
  "name": "Exporter company name",
  "address": "Full address (corporate + factory)",
  "email": "Email address",
  "phone": "Phone number with country code",
  "mobile": "Mobile number",
  "pan": "PAN number (AABCP5078K format)",
  "gstin": "GSTIN (27AABCP5078K1Z1 format)",
  "iec": "IEC code"
}`;

  const instruction = `Extract EXPORTER/SHIPPER info: name, addresses, PAN, GSTIN, IEC, email, phone.`;

  const result = await groq.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Groq] Exporter extracted:', result.name);
    return {
      name: result.name || null,
      address: result.address || null,
      email: result.email || null,
      phone: result.phone || null,
      mobile: result.mobile || null,
      pan: result.pan || null,
      gstin: result.gstin || null,
      iec: result.iec || null
    };
  }
  
  return {
    name: null, address: null, email: null, phone: null,
    mobile: null, pan: null, gstin: null, iec: null
  };
}

async function extractPackingListConsigneeGroq(documentText: string): Promise<ConsigneeInfo> {
  console.log('[Groq] Extracting consignee information...');
  
  const schema = `{
  "name": "Consignee company name",
  "address": "Full address",
  "email": "Email address",
  "phone": "Phone number",
  "mobile": "Mobile number",
  "poBox": "PO Box number"
}`;

  const instruction = `Extract CONSIGNEE/BUYER info: name, address, email, phone, mobile, PO BOX.`;

  const result = await groq.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Groq] Consignee extracted:', result.name);
    return {
      name: result.name || null,
      address: result.address || null,
      email: result.email || null,
      phone: result.phone || null,
      mobile: result.mobile || null,
      poBox: result.poBox || null
    };
  }
  
  return {
    name: null, address: null, email: null,
    phone: null, mobile: null, poBox: null
  };
}

async function extractPackingListBankDetailsGroq(documentText: string): Promise<BankDetails> {
  console.log('[Groq] Extracting bank details...');
  
  const schema = `{
  "bankName": "Bank name",
  "bankAddress": "Bank address",
  "usdAccount": "USD Account number",
  "euroAccount": "EURO Account number",
  "ifscCode": "IFSC Code",
  "swiftCode": "SWIFT Code",
  "branchCode": "Branch Code",
  "adCode": "AD Code",
  "bsrCode": "BSR Code"
}`;

  const instruction = `Extract BANK details: name, address, USD/EURO accounts, IFSC, SWIFT, branch, AD, BSR codes.`;

  const result = await groq.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Groq] Bank details extracted:', result.bankName);
    return {
      bankName: result.bankName || null,
      bankAddress: result.bankAddress || null,
      usdAccount: result.usdAccount || null,
      euroAccount: result.euroAccount || null,
      ifscCode: result.ifscCode || null,
      swiftCode: result.swiftCode || null,
      branchCode: result.branchCode || null,
      adCode: result.adCode || null,
      bsrCode: result.bsrCode || null
    };
  }
  
  return {
    bankName: null, bankAddress: null, usdAccount: null, euroAccount: null,
    ifscCode: null, swiftCode: null, branchCode: null, adCode: null, bsrCode: null
  };
}

async function extractPackingListShippingInfoGroq(documentText: string): Promise<ShipmentDetails> {
  console.log('[Groq] Extracting shipping information...');
  
  const schema = `{
  "countryOfOrigin": "Country of origin",
  "countryOfDestination": "Country of destination",
  "preCarriageBy": "Pre-carriage by (N.A, TRUCK, RAIL)",
  "placeOfReceipt": "Place of receipt",
  "deliveryTerms": "ONLY first word: CIF, FOB, or EXW",
  "hsnCode": "HSN Code",
  "vesselFlightNo": "Vessel/flight number",
  "portOfLoading": "Port of loading",
  "portOfDischarge": "Port of discharge",
  "finalDestination": "Final destination",
  "freightTerms": "PREPAID or COLLECT"
}`;

  const instruction = `Extract shipping info. 
CRITICAL: For deliveryTerms, extract ONLY the first word (CIF, FOB, EXW) without any location.
Example: "CIF MUMBAI" → "CIF", "FOB DELHI" → "FOB"`;

  const result = await groq.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Groq] Shipping info extracted');
    
    // Post-process deliveryTerms to ensure only first word
    let deliveryTerms = result.deliveryTerms || null;
    if (deliveryTerms) {
      const firstWord = deliveryTerms.trim().split(/\s+/)[0].toUpperCase();
      const validIncoterms = ['CIF', 'FOB', 'EXW', 'FCA', 'CPT', 'CIP', 'DAT', 'DAP', 'DDP', 'FAS', 'CFR'];
      
      if (validIncoterms.includes(firstWord)) {
        deliveryTerms = firstWord;
      } else {
        deliveryTerms = firstWord;
      }
    }
    
    return {
      countryOfOrigin: result.countryOfOrigin || null,
      countryOfDestination: result.countryOfDestination || null,
      preCarriageBy: result.preCarriageBy || null,
      placeOfReceipt: result.placeOfReceipt || null,
      deliveryTerms: deliveryTerms,
      hsnCode: result.hsnCode || null,
      vesselFlightNo: result.vesselFlightNo || null,
      portOfLoading: result.portOfLoading || null,
      portOfDischarge: result.portOfDischarge || null,
      finalDestination: result.finalDestination || null,
      freightTerms: result.freightTerms || null
    };
  }
  
  return {
    countryOfOrigin: null, countryOfDestination: null, preCarriageBy: null,
    placeOfReceipt: null, deliveryTerms: null, hsnCode: null,
    vesselFlightNo: null, portOfLoading: null, portOfDischarge: null,
    finalDestination: null, freightTerms: null
  };
}

async function extractPackingListBoxDetailsGroq(documentText: string): Promise<{
  boxDetails: BoxDetail[];
  totalGrossWeight: string | null;
  totalNetWeight: string | null;
  totalBoxWeight: string | null;
}> {
  console.log('[Groq] Extracting box details...');
  
  const schema = `{
  "boxDetails": [
    {
      "boxNumber": "Box number (A 342, A 343)",
      "size": "Dimensions (31\\" X31\\" X38\\")",
      "grossWeight": "Gross weight (200 KGS)",
      "boxWeight": "Box weight (055 KGS)",
      "netWeight": "Net weight (145 KGS)",
      "contents": "Contents description"
    }
  ],
  "totalGrossWeight": "Total gross weight",
  "totalNetWeight": "Total net weight",
  "totalBoxWeight": "Total box weight"
}`;

  const instruction = `Extract ALL boxes/cartons from the packing list.
IMPORTANT: Extract EVERY box listed. Look for:
- BOX NO, CARTON NO (A 342, A 343, etc.)
- SIZE & WT DETAILS (31" X31" X38")
- GROSS WT, BOX WT, NET WT
- Contents/items in each box
- TOTAL weights at the end`;

  const result = await groq.extractJSON(documentText, schema, instruction);
  
  if (result && result.boxDetails && Array.isArray(result.boxDetails)) {
    console.log(`[Groq] Extracted ${result.boxDetails.length} boxes`);
    
    const cleanedBoxes: BoxDetail[] = result.boxDetails.map((box: any) => ({
      boxNumber: box.boxNumber || null,
      size: box.size || null,
      grossWeight: box.grossWeight || null,
      boxWeight: box.boxWeight || null,
      netWeight: box.netWeight || null,
      contents: box.contents || null
    }));
    
    return {
      boxDetails: cleanedBoxes,
      totalGrossWeight: result.totalGrossWeight || null,
      totalNetWeight: result.totalNetWeight || null,
      totalBoxWeight: result.totalBoxWeight || null
    };
  }
  
  console.log('[Groq] No box details found');
  return {
    boxDetails: [],
    totalGrossWeight: null,
    totalNetWeight: null,
    totalBoxWeight: null
  };
}

async function extractPackingListAdditionalInfoGroq(documentText: string): Promise<{
  marksAndNos: string | null;
  descriptionOfGoods: string | null;
  certificationStatement: string | null;
  packageType: string | null;
}> {
  console.log('[Groq] Extracting additional information...');
  
  const schema = `{
  "marksAndNos": "Marks and numbers (shipping marks)",
  "descriptionOfGoods": "General goods description",
  "certificationStatement": "Certification statement",
  "packageType": "Package type (WOODEN BOXES, CARTONS)"
}`;

  const instruction = `Extract: MARKS & NOS, DESCRIPTION OF GOODS, NO. & KIND OF PKGS, and certification statements.`;

  const result = await groq.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Groq] Additional info extracted');
    return {
      marksAndNos: result.marksAndNos || null,
      descriptionOfGoods: result.descriptionOfGoods || null,
      certificationStatement: result.certificationStatement || null,
      packageType: result.packageType || null
    };
  }
  
  return {
    marksAndNos: null,
    descriptionOfGoods: null,
    certificationStatement: null,
    packageType: null
  };
}

// ============================================
// MAIN EXTRACTION FUNCTION
// ============================================

export async function extractAndValidatePackingList(
  documentText: string
): Promise<PackingListValidationResult> {
  console.log('═══════════════════════════════════════');
  console.log('[Extraction] Starting Groq-powered packing list extraction');
  console.log('[Extraction] Text length:', documentText.length);
  console.log('[Extraction] Using model:', GROQ_CONFIG.model);
  console.log('═══════════════════════════════════════');
  
  const extractedData: PackingListData = {
    packingListNumber: null,
    packingListDate: null,
    referenceNo: null,
    proformaInvoiceNo: null,
    exporter: {
      name: null, address: null, email: null, phone: null,
      mobile: null, pan: null, gstin: null, iec: null
    },
    consignee: {
      name: null, address: null, email: null,
      phone: null, mobile: null, poBox: null
    },
    bankDetails: {
      bankName: null, bankAddress: null, usdAccount: null, euroAccount: null,
      ifscCode: null, swiftCode: null, branchCode: null, adCode: null, bsrCode: null
    },
    shipmentDetails: {
      countryOfOrigin: null, countryOfDestination: null, preCarriageBy: null,
      placeOfReceipt: null, deliveryTerms: null, hsnCode: null,
      vesselFlightNo: null, portOfLoading: null, portOfDischarge: null,
      finalDestination: null, freightTerms: null
    },
    marksAndNos: null,
    invoiceNumber: null,
    invoiceDate: null,
    boxDetails: [],
    totalBoxes: 0,
    totalGrossWeight: null,
    totalNetWeight: null,
    totalBoxWeight: null,
    packageType: null,
    descriptionOfGoods: null,
    certificationStatement: null
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Extract all sections in parallel
 const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Extract sequentially with delays to respect rate limits
    console.log('[Extraction] Phase 1: Basic info & parties...');
    
    const basicInfo = await extractPackingListBasicInfoGroq(documentText);
    await delay(GROQ_CONFIG.requestDelay);
    
    const exporterInfo = await extractPackingListExporterGroq(documentText);
    await delay(GROQ_CONFIG.requestDelay);
    
    const consigneeInfo = await extractPackingListConsigneeGroq(documentText);
    await delay(GROQ_CONFIG.requestDelay);
    
    console.log('[Extraction] Phase 2: Financial & shipping details...');
    
    const bankInfo = await extractPackingListBankDetailsGroq(documentText);
    await delay(GROQ_CONFIG.requestDelay);
    
    const shippingInfo = await extractPackingListShippingInfoGroq(documentText);
    await delay(GROQ_CONFIG.requestDelay);
    
    console.log('[Extraction] Phase 3: Box details & additional info...');
    
    const boxInfo = await extractPackingListBoxDetailsGroq(documentText);
    await delay(GROQ_CONFIG.requestDelay);
    
    const additionalInfo = await extractPackingListAdditionalInfoGroq(documentText);

    // Populate extracted data
    extractedData.packingListNumber = basicInfo.packingListNumber;
    extractedData.packingListDate = basicInfo.packingListDate;
    extractedData.referenceNo = basicInfo.referenceNo;
    extractedData.proformaInvoiceNo = basicInfo.proformaInvoiceNo;
    extractedData.invoiceNumber = basicInfo.invoiceNumber;
    extractedData.invoiceDate = basicInfo.invoiceDate;

    extractedData.exporter = exporterInfo;
    extractedData.consignee = consigneeInfo;
    extractedData.bankDetails = bankInfo;
    extractedData.shipmentDetails = shippingInfo;

    extractedData.marksAndNos = additionalInfo.marksAndNos;
    extractedData.descriptionOfGoods = additionalInfo.descriptionOfGoods;
    extractedData.certificationStatement = additionalInfo.certificationStatement;
    extractedData.packageType = additionalInfo.packageType;

    extractedData.boxDetails = boxInfo.boxDetails;
    extractedData.totalBoxes = boxInfo.boxDetails.length;
    extractedData.totalGrossWeight = boxInfo.totalGrossWeight;
    extractedData.totalNetWeight = boxInfo.totalNetWeight;
    extractedData.totalBoxWeight = boxInfo.totalBoxWeight;

    console.log('[Extraction] Packing list extracted:', {
      plNumber: extractedData.packingListNumber,
      exporter: extractedData.exporter.name,
      consignee: extractedData.consignee.name,
      totalBoxes: extractedData.totalBoxes,
      hsnCode: extractedData.shipmentDetails.hsnCode
    });

    // ============================================
    // VALIDATION
    // ============================================
    console.log('═══════════════════════════════════════');
    console.log('[Validation] Checking required fields');
    
    // Critical validations (errors)
    if (!extractedData.packingListNumber) errors.push('PL NO. is required');
    if (!extractedData.packingListDate) errors.push('DATE is required');
    if (!extractedData.exporter.name) errors.push('Exporter name is required');
    if (!extractedData.consignee.name) errors.push('Consignee name is required');
    if (extractedData.boxDetails.length === 0) errors.push('BOX details are required - no boxes found');
    
    // Important fields (warnings)
    if (!extractedData.invoiceNumber) warnings.push('INVOICE NO. not found');
    if (!extractedData.invoiceDate) warnings.push('Invoice DATE not found');
    if (!extractedData.referenceNo && !extractedData.proformaInvoiceNo) {
      warnings.push('Reference/Proforma Invoice number not found');
    }
    
    // Exporter validations
    if (!extractedData.exporter.address) warnings.push('Exporter address is missing');
    if (!extractedData.exporter.email) warnings.push('Exporter email is missing');
    if (!extractedData.exporter.pan) warnings.push('Exporter PAN is missing');
    if (!extractedData.exporter.gstin) warnings.push('Exporter GSTIN is missing');
    if (!extractedData.exporter.iec) warnings.push('Exporter IEC is missing');
    
    // Consignee validations
    if (!extractedData.consignee.address) warnings.push('Consignee address is missing');
    if (!extractedData.consignee.email) warnings.push('Consignee email is missing');
    if (!extractedData.consignee.phone && !extractedData.consignee.mobile) {
      warnings.push('Consignee contact number is missing');
    }
    
    // Bank validations
    if (!extractedData.bankDetails.bankName) warnings.push('Bank name is missing');
    if (!extractedData.bankDetails.usdAccount && !extractedData.bankDetails.euroAccount) {
      warnings.push('Bank account details are missing');
    }
    if (!extractedData.bankDetails.swiftCode) warnings.push('SWIFT code is missing');
    if (!extractedData.bankDetails.ifscCode) warnings.push('IFSC code is missing');
    
    // Box details validation
    if (extractedData.boxDetails.length > 0) {
      extractedData.boxDetails.forEach((box, index) => {
        if (!box.boxNumber) warnings.push(`Box ${index + 1}: Missing BOX NO`);
        if (!box.size) warnings.push(`Box ${index + 1}: Missing SIZE/DIMENSIONS`);
        if (!box.grossWeight && !box.netWeight) {
          warnings.push(`Box ${index + 1}: Missing WEIGHT DETAILS`);
        }
        if (!box.contents) warnings.push(`Box ${index + 1}: Missing CONTENTS`);
      });
    }
    
    // Shipping validations
    if (!extractedData.shipmentDetails.countryOfOrigin) {
      warnings.push('Country of Origin not found');
    }
    if (!extractedData.shipmentDetails.countryOfDestination) {
      warnings.push('Country of Destination not found');
    }
    if (!extractedData.shipmentDetails.portOfLoading) {
      warnings.push('Port of Loading not found');
    }
    if (!extractedData.shipmentDetails.portOfDischarge) {
      warnings.push('Port of Discharge not found');
    }
    if (!extractedData.shipmentDetails.deliveryTerms) {
      warnings.push('Delivery terms (Incoterms) not found');
    }
    if (!extractedData.shipmentDetails.hsnCode) {
      warnings.push('HSN Code not found');
    }
    if (!extractedData.shipmentDetails.vesselFlightNo) {
      warnings.push('Vessel/Flight number not found');
    }
    if (!extractedData.shipmentDetails.freightTerms) {
      warnings.push('Freight terms not found');
    }
    
    // Weight totals validation
    if (extractedData.boxDetails.length > 0 && !extractedData.totalGrossWeight) {
      warnings.push('Total Gross Weight not found - verify totals');
    }
    if (extractedData.boxDetails.length > 0 && !extractedData.totalNetWeight) {
      warnings.push('Total Net Weight not found - verify totals');
    }
    
    // Additional fields validation
    if (!extractedData.marksAndNos) warnings.push('Marks & Numbers not found');
    if (!extractedData.descriptionOfGoods) warnings.push('Description of Goods not found');
    if (!extractedData.packageType) warnings.push('Package type not found');
    if (!extractedData.certificationStatement) {
      warnings.push('Certification statement not found');
    }

    // Date consistency check
    if (extractedData.packingListDate && extractedData.invoiceDate) {
      try {
        const plDate = new Date(extractedData.packingListDate.split(/[./]/).reverse().join('-'));
        const invDate = new Date(extractedData.invoiceDate.split(/[./]/).reverse().join('-'));
        
        if (plDate < invDate) {
          warnings.push('Packing List date is before Invoice date - verify');
        }
        
        const daysDiff = Math.abs((plDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 30) {
          warnings.push(`Packing List is ${Math.round(daysDiff)} days from Invoice - verify timing`);
        }
      } catch (error) {
        console.error('[Validation] Date comparison error:', error);
      }
    }

    // Calculate completeness
    const allFields = [
      // Core fields (high priority)
      extractedData.packingListNumber,
      extractedData.packingListDate,
      extractedData.exporter.name,
      extractedData.consignee.name,
      extractedData.boxDetails.length > 0,
      
      // Important fields (medium priority)
      extractedData.invoiceNumber,
      extractedData.exporter.address,
      extractedData.exporter.email,
      extractedData.exporter.pan,
      extractedData.exporter.gstin,
      extractedData.exporter.iec,
      extractedData.consignee.address,
      extractedData.consignee.email,
      extractedData.bankDetails.bankName,
      extractedData.bankDetails.usdAccount || extractedData.bankDetails.euroAccount,
      extractedData.bankDetails.swiftCode,
      extractedData.bankDetails.ifscCode,
      extractedData.shipmentDetails.countryOfOrigin,
      extractedData.shipmentDetails.countryOfDestination,
      extractedData.shipmentDetails.portOfLoading,
      extractedData.shipmentDetails.portOfDischarge,
      extractedData.shipmentDetails.deliveryTerms,
      extractedData.shipmentDetails.hsnCode,
      extractedData.totalGrossWeight,
      extractedData.totalNetWeight,
      extractedData.descriptionOfGoods,
      
      // Optional fields (lower priority)
      extractedData.referenceNo || extractedData.proformaInvoiceNo,
      extractedData.exporter.phone || extractedData.exporter.mobile,
      extractedData.consignee.phone || extractedData.consignee.mobile,
      extractedData.bankDetails.bankAddress,
      extractedData.bankDetails.branchCode,
      extractedData.shipmentDetails.vesselFlightNo,
      extractedData.shipmentDetails.freightTerms,
      extractedData.marksAndNos,
      extractedData.packageType,
      extractedData.certificationStatement
    ];
    
    const filled = allFields.filter(f => f).length;
    const completeness = Math.round((filled / allFields.length) * 100);

    console.log('[Validation] Packing list completeness:', completeness + '%');
    console.log('[Validation] Total boxes:', extractedData.totalBoxes);
    console.log('[Validation] Exporter:', extractedData.exporter.name || 'N/A');
    console.log('[Validation] Consignee:', extractedData.consignee.name || 'N/A');
    console.log('[Validation] HSN Code:', extractedData.shipmentDetails.hsnCode || 'N/A');
    console.log('[Validation] Errors:', errors.length || 'None');
    console.log('[Validation] Warnings:', warnings.length || 'None');
    console.log('═══════════════════════════════════════');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      extractedData,
      completeness
    };

  } catch (error) {
    console.error('[Extraction] Error:', error);
    errors.push('Failed to parse packing list: ' + (error as Error).message);
    
    return {
      isValid: false,
      errors,
      warnings,
      extractedData,
      completeness: 0
    };
  }
}

// ============================================
// UTILITY: Test Groq Connection
// ============================================

export async function testGroqConnection(): Promise<{ 
  success: boolean; 
  message: string; 
  model: string 
}> {
  try {
    console.log('[Groq] Testing connection...');
    
    if (!GROQ_CONFIG.apiKey) {
      return {
        success: false,
        message: 'Groq API key is missing. Set GROQ_API_KEY environment variable.',
        model: GROQ_CONFIG.model
      };
    }

    const response = await groq.generate('Respond with "OK"', 'You are a test assistant.');
    
    if (response && response.includes('OK')) {
      return {
        success: true,
        message: `Connected to Groq successfully. Using model: ${GROQ_CONFIG.model}`,
        model: GROQ_CONFIG.model
      };
    } else {
      return {
        success: false,
        message: 'Groq connection test failed - unexpected response',
        model: GROQ_CONFIG.model
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to connect to Groq: ${error.message}`,
      model: GROQ_CONFIG.model
    };
  }
}


 