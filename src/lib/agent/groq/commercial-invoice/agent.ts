import Groq from "groq-sdk";

// ============================================
// GROQ CONFIGURATION
// ============================================
const GROQ_CONFIG = {
  apiKey: process.env.GROQ_API_KEY || '', // Set your API key
  model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant'  , 
  // Alternative options with 15k+ TPM:
  // 'llama-3.2-3b-preview' - 15,000 TPM (smaller, faster)
  // 'gemma2-9b-it' - 15,000 TPM (good quality)
  // 'llama-3.3-70b-versatile' - 6,000 TPM (best quality but lower limit)
  temperature: 0.1, // Low temperature for consistent extraction
  maxTokens: 4096
};

const groq = new Groq({
  apiKey: GROQ_CONFIG.apiKey
});

// ============================================
// INVOICE DATA INTERFACES
// ============================================
export interface CommercialInvoiceData {
  invoiceNo: string | null;
  date: string | null;
  marksandnos: string | null;
  referenceNo: string | null;
  proformaInvoiceNo: string | null;
  
  consignee: {
    name: string | null;
    address: string | null;
    contact: string | null;
    phone: string | null;
    mobile: string | null;
    email: string | null;
    poBox: string | null;
    country: string | null;
  } | null;
  
  exporter: {
    name: string | null;
    address: string | null;
    contact: string | null;
    phone: string | null;
    mobile: string | null;
    email: string | null;
    pan: string | null;
    gstin: string | null;
    iec: string | null;
    factory: string | null;
  } | null;
  
  bankDetails: {
    bankName: string | null;
    address: string | null;
    usdAccount: string | null;
    euroAccount: string | null;
    swiftCode: string | null;
    ifscCode: string | null;
    branchCode: string | null;
    adCode: string | null;
    bsrCode: string | null;
  } | null;
  
  shipmentDetails: {
    incoterms: string | null;
    preCarriage: string | null;
    placeOfReceipt: string | null;
    vesselFlight: string | null;
    portOfLoading: string | null;
    portOfDischarge: string | null;
    finalDestination: string | null;
    countryOfOrigin: string | null;
    countryOfDestination: string | null;
    hsnCode: string | null;
    freightTerms: string | null;
  } | null;
  
  paymentTerms: string | null;
  marksAndNumbers: string | null;
  packaging: string | null;
  
  itemList: Array<{
    description: string;
    quantity: string;
    unitPrice: number;
    totalPrice: number;
  }>;
  
  totalAmount: number | null;
  totalAmountInWords: string | null;
  currency: string | null;
  
  certifications: {
    igstStatus: string | null;
    drawbackSrNo: string | null;
    rodtepClaim: boolean;
    commissionRate: string | null;
  } | null;
  
  signature: boolean;
}

export interface InvoiceValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  extractedData: CommercialInvoiceData;
  completeness: number;
}

// ============================================
// GROQ HELPER FUNCTION WITH RETRY LOGIC
// ============================================
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGroq(prompt: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting structured data from commercial invoices. Always return valid JSON without any markdown formatting or explanation."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: GROQ_CONFIG.model,
        temperature: GROQ_CONFIG.temperature,
        max_tokens: GROQ_CONFIG.maxTokens,
      });

      const response = completion.choices[0]?.message?.content || '';
      
      // Clean up response - remove markdown code blocks if present
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/```\n?/g, '');
      }
      
      return cleaned.trim();
    } catch (error: any) {
      const isRateLimitError = error?.status === 429 || error?.error?.code === 'rate_limit_exceeded';
      
      if (isRateLimitError && attempt < retries) {
        // Extract wait time from error message or use exponential backoff
        const waitTime = error?.error?.message?.match(/try again in ([\d.]+)s/)?.[1];
        const delay = waitTime ? parseFloat(waitTime) * 1000 : Math.pow(2, attempt) * 1000;
        
        console.log(`[Groq] Rate limit hit. Waiting ${delay/1000}s before retry ${attempt}/${retries}...`);
        await sleep(delay + 500); // Add 500ms buffer
        continue;
      }
      
      console.error('[Groq] API Error:', error);
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
}

// ============================================
// EXTRACTION FUNCTIONS
// ============================================
async function extractBasicInfoWithGroq(text: string) {
  const prompt = `Extract the following basic information from this invoice text and return ONLY a JSON object:
{
  "invoiceNo": "invoice number",
  "marksandnos": "marks and numbers",
  "date": "invoice date",
  "referenceNo": "reference number",
  "proformaInvoiceNo": "proforma invoice number",
  "currency": "currency (USD/EUR/INR etc)",
  "totalAmount": numeric value,
  "totalAmountInWords": "amount in words"
}

Invoice text:
${text.substring(0, 3000)}`;

  const response = await callGroq(prompt);
  return JSON.parse(response);
}

async function extractItemsWithGroq(text: string) {
  const prompt = `Extract all items/products from this invoice and return ONLY a JSON array:
[
  {
    "description": "item description",
    "quantity": "quantity with unit",
    "unitPrice": numeric value,
    "totalPrice": numeric value
  }
]

Invoice text:
${text.substring(0, 3000)}`;

  const response = await callGroq(prompt);
  const items = JSON.parse(response);
  return Array.isArray(items) ? items : [];
}

async function extractExporterWithGroq(text: string) {
  const prompt = `Extract exporter/seller information and return ONLY a JSON object:
{
  "name": "company name",
  "address": "full address",
  "factory": "factory address if different",
  "phone": "phone number",
  "mobile": "mobile number",
  "email": "email address",
  "pan": "PAN number",
  "gstin": "GSTIN number",
  "iec": "IEC code"
}

Invoice text:
${text.substring(0, 3000)}`;

  const response = await callGroq(prompt);
  return JSON.parse(response);
}

async function extractConsigneeWithGroq(text: string) {
  const prompt = `Extract consignee/buyer information and return ONLY a JSON object:
{
  "name": "company/person name",
  "address": "full address",
  "phone": "phone number",
  "mobile": "mobile number",
  "email": "email address",
  "poBox": "PO Box if available",
  "country": "country"
}

Invoice text:
${text.substring(0, 3000)}`;

  const response = await callGroq(prompt);
  return JSON.parse(response);
}

async function extractBankWithGroq(text: string) {
  const prompt = `Extract bank details and return ONLY a JSON object:
{
  "bankName": "bank name",
  "address": "bank address",
  "usdAccount": "USD account number",
  "euroAccount": "EUR account number",
  "swiftCode": "SWIFT code",
  "ifscCode": "IFSC code",
  "branchCode": "branch code",
  "adCode": "AD code",
  "bsrCode": "BSR code"
}

Invoice text:
${text.substring(0, 3000)}`;

  const response = await callGroq(prompt);
  return JSON.parse(response);
}

async function extractShippingWithGroq(text: string) {
  const prompt = `Extract shipping/logistics information and return ONLY a JSON object:
{
  "incoterms": "INCOTERMS (FOB/CIF/etc)",
  "preCarriage": "pre-carriage by",
  "placeOfReceipt": "place of receipt",
  "vesselFlight": "vessel/flight number",
  "portOfLoading": "port of loading",
  "portOfDischarge": "port of discharge",
  "finalDestination": "final destination",
  "countryOfOrigin": "country of origin",
  "countryOfDestination": "country of destination",
  "hsnCode": "HSN code",
  "freightTerms": "freight terms"
}

Invoice text:
${text.substring(0, 3000)}`;

  const response = await callGroq(prompt);
  return JSON.parse(response);
}

async function extractAdditionalInfoWithGroq(text: string) {
  const prompt = `Extract additional information and return ONLY a JSON object:
{
  "paymentTerms": "payment terms description",
  "marksAndNumbers": "marks and numbers",
  "packaging": "packaging details",
  "signature": true/false (whether authorized signature is present),
  "igstStatus": "IGST status",
  "drawbackSrNo": "drawback serial number",
  "rodtepClaim": true/false,
  "commissionRate": "commission rate"
}

Invoice text:
${text.substring(0, 3000)}`;

  const response = await callGroq(prompt);
  return JSON.parse(response);
}

// ============================================
// MAIN EXTRACTION FUNCTION
// ============================================
export async function extractAndValidateInvoice(invoiceText: string): Promise<InvoiceValidationResult> {
  console.log('═══════════════════════════════════════');
  console.log('[Extraction] Starting Groq-powered invoice extraction');
  console.log('[Extraction] Text length:', invoiceText.length);
  console.log('[Extraction] Using model:', GROQ_CONFIG.model);
  console.log('═══════════════════════════════════════');
  
  const extractedData: CommercialInvoiceData = {
    invoiceNo: null,
    marksandnos: null,
    date: null,
    referenceNo: null,
    proformaInvoiceNo: null,
    consignee: null,
    exporter: null,
    bankDetails: null,
    shipmentDetails: null,
    paymentTerms: null,
    marksAndNumbers: null,
    packaging: null,
    itemList: [],
    totalAmount: null,
    totalAmountInWords: null,
    currency: null,
    certifications: null,
    signature: false
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // SEQUENTIAL extraction to avoid rate limits (instead of parallel)
    console.log('[Extract] Step 1/7: Basic info...');
    const basicInfo = await extractBasicInfoWithGroq(invoiceText);
    
    console.log('[Extract] Step 2/7: Items...');
    const items = await extractItemsWithGroq(invoiceText);
    
    console.log('[Extract] Step 3/7: Exporter...');
    const exporter = await extractExporterWithGroq(invoiceText);
    
    console.log('[Extract] Step 4/7: Consignee...');
    const consignee = await extractConsigneeWithGroq(invoiceText);
    
    console.log('[Extract] Step 5/7: Bank details...');
    const bank = await extractBankWithGroq(invoiceText);
    
    console.log('[Extract] Step 6/7: Shipping...');
    const shipping = await extractShippingWithGroq(invoiceText);
    
    console.log('[Extract] Step 7/7: Additional info...');
    const additional = await extractAdditionalInfoWithGroq(invoiceText);

    // Basic info
    extractedData.invoiceNo = basicInfo.invoiceNo;
    extractedData.marksandnos = basicInfo.marksandnos;
    extractedData.date = basicInfo.date;
    extractedData.referenceNo = basicInfo.referenceNo;
    extractedData.proformaInvoiceNo = basicInfo.proformaInvoiceNo;
    extractedData.currency = basicInfo.currency;
    extractedData.totalAmount = basicInfo.totalAmount;
    extractedData.totalAmountInWords = basicInfo.totalAmountInWords;

    // Items
    extractedData.itemList = items;

    // Exporter
    extractedData.exporter = {
      name: exporter.name,
      address: exporter.address,
      factory: exporter.factory,
      contact: null,
      phone: exporter.phone,
      mobile: exporter.mobile,
      email: exporter.email,
      pan: exporter.pan,
      gstin: exporter.gstin,
      iec: exporter.iec
    };

    // Consignee
    extractedData.consignee = {
      name: consignee.name,
      address: consignee.address,
      contact: null,
      phone: consignee.phone,
      mobile: consignee.mobile,
      email: consignee.email,
      poBox: consignee.poBox,
      country: consignee.country
    };

    // Bank
    extractedData.bankDetails = {
      bankName: bank.bankName,
      address: bank.address,
      usdAccount: bank.usdAccount,
      euroAccount: bank.euroAccount,
      swiftCode: bank.swiftCode,
      ifscCode: bank.ifscCode,
      branchCode: bank.branchCode,
      adCode: bank.adCode,
      bsrCode: bank.bsrCode
    };

    // Shipping
    extractedData.shipmentDetails = {
      incoterms: shipping.incoterms,
      preCarriage: shipping.preCarriage,
      placeOfReceipt: shipping.placeOfReceipt,
      vesselFlight: shipping.vesselFlight,
      portOfLoading: shipping.portOfLoading,
      portOfDischarge: shipping.portOfDischarge,
      finalDestination: shipping.finalDestination,
      countryOfOrigin: shipping.countryOfOrigin,
      countryOfDestination: shipping.countryOfDestination,
      hsnCode: shipping.hsnCode,
      freightTerms: shipping.freightTerms
    };

    // Additional info
    extractedData.paymentTerms = additional.paymentTerms;
    extractedData.marksAndNumbers = additional.marksAndNumbers;
    extractedData.packaging = additional.packaging;
    extractedData.signature = additional.signature;
    
    extractedData.certifications = {
      igstStatus: additional.igstStatus,
      drawbackSrNo: additional.drawbackSrNo,
      rodtepClaim: additional.rodtepClaim,
      commissionRate: additional.commissionRate
    };

    // If total not found, calculate from items
    if (!extractedData.totalAmount && extractedData.itemList.length > 0) {
      extractedData.totalAmount = extractedData.itemList.reduce((sum, item) => sum + item.totalPrice, 0);
      extractedData.totalAmount = Math.round(extractedData.totalAmount * 100) / 100;
      console.log('[Extract] Total calculated from items:', extractedData.totalAmount);
    }

    console.log('═══════════════════════════════════════');
    console.log('[Validation] Checking required fields');
    
    // Validation
    if (!extractedData.invoiceNo) errors.push('Invoice Number is missing');
    if (!extractedData.date) errors.push('Invoice Date is missing');
    if (!extractedData.consignee?.name) errors.push('Consignee Name is missing');
    if (!extractedData.exporter?.name) errors.push('Exporter Name is missing');
    
    if (!extractedData.totalAmount) {
      errors.push('Total Amount is missing');
    } else if (extractedData.totalAmount < 100) {
      warnings.push('Total amount seems unusually low - please verify');
    }
    
    if (extractedData.itemList.length === 0) {
      warnings.push('No items found in invoice');
    } else {
      const itemsSum = extractedData.itemList.reduce((sum, item) => sum + item.totalPrice, 0);
      const roundedSum = Math.round(itemsSum * 100) / 100;
      
      if (extractedData.totalAmount && Math.abs(roundedSum - extractedData.totalAmount) > 1.0) {
        warnings.push(`Items sum (${roundedSum}) does not match total amount (${extractedData.totalAmount})`);
      }
    }
    
    if (!extractedData.consignee?.address) warnings.push('Consignee Address is missing');
    if (!extractedData.exporter?.address) warnings.push('Exporter Address is missing');
    if (!extractedData.shipmentDetails?.incoterms) warnings.push('INCOTERMS is missing');
    if (!extractedData.bankDetails?.bankName) warnings.push('Bank Name is missing');
    if (!extractedData.bankDetails?.usdAccount && !extractedData.bankDetails?.euroAccount) {
      warnings.push('Bank Account Number is missing');
    }
    if (!extractedData.shipmentDetails?.portOfLoading) warnings.push('Port of Loading is missing');
    if (!extractedData.shipmentDetails?.finalDestination) warnings.push('Final Destination is missing');
    if (!extractedData.paymentTerms) warnings.push('Payment Terms are missing');
    if (!extractedData.signature) warnings.push('Authorized Signature not detected');
    if (!extractedData.exporter?.pan) warnings.push('PAN Number is missing');
    if (!extractedData.exporter?.gstin) warnings.push('GSTIN is missing');
    if (!extractedData.exporter?.iec) warnings.push('IEC is missing');

    const requiredFields = [
      extractedData.invoiceNo,
      extractedData.date,
      extractedData.consignee?.name,
      extractedData.consignee?.address,
      extractedData.consignee?.email,
      extractedData.exporter?.name,
      extractedData.exporter?.address,
      extractedData.exporter?.email,
      extractedData.exporter?.pan,
      extractedData.exporter?.gstin,
      extractedData.exporter?.iec,
      extractedData.bankDetails?.bankName,
      extractedData.bankDetails?.usdAccount || extractedData.bankDetails?.euroAccount,
      extractedData.bankDetails?.swiftCode,
      extractedData.bankDetails?.ifscCode,
      extractedData.shipmentDetails?.incoterms,
      extractedData.shipmentDetails?.portOfLoading,
      extractedData.shipmentDetails?.finalDestination,
      extractedData.shipmentDetails?.countryOfOrigin,
      extractedData.shipmentDetails?.countryOfDestination,
      extractedData.paymentTerms,
      extractedData.itemList.length > 0,
      extractedData.totalAmount,
      extractedData.signature
    ];
    
    const filled = requiredFields.filter(f => f).length;
    const completeness = Math.round((filled / requiredFields.length) * 100);

    console.log('[Validation] Completeness:', completeness + '%');
    console.log('[Validation] Errors:', errors.length > 0 ? errors : 'None');
    console.log('[Validation] Warnings:', warnings.length > 0 ? warnings : 'None');
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
    errors.push('Failed to parse invoice: ' + (error as Error).message);
    
    return {
      isValid: false,
      errors,
      warnings,
      extractedData,
      completeness: 0
    };
  }
}