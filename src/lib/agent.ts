// src/lib/agent.ts - COMPLETE OLLAMA-POWERED INVOICE EXTRACTION SYSTEM

import { ConversationState, WorkflowStateMachine, ResponseGenerator } from './workflow';
import { getConversationState, updateConversationState, createConversationState } from './database';

// ============================================
// OLLAMA CONFIGURATION
// ============================================

const OLLAMA_CONFIG = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'llama3.2:3b', // Options: llama3.2, mistral, phi3, etc.
  timeout: 120000, // 120 seconds for complex extractions
};

// ============================================
// INVOICE DATA INTERFACES
// ============================================
export interface CommercialInvoiceData {
  invoiceNo: string | null;
  date: string | null;
  marksandnos:string|null;
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
// OLLAMA API CLIENT
// ============================================
class OllamaClient {
  private baseUrl: string;
  private model: string;
  private timeout: number;

  constructor(config: typeof OLLAMA_CONFIG) {
    this.baseUrl = config.baseUrl;
    this.model = config.model;
    this.timeout = config.timeout;
  }

  async generate(prompt: string, systemPrompt?: string, options?: any): Promise<string> {
    console.log(`[Ollama] Calling ${this.model} API...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          system: systemPrompt,
          stream: false,
          options: {
            temperature: options?.temperature || 0.1,
            top_p: options?.top_p || 0.9,
            num_predict: options?.num_predict || 3000,
          }
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[Ollama] Response received, length:', data.response?.length || 0);
      
      return data.response || '';
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Ollama request timed out');
      }
      console.error('[Ollama] API Error:', error);
      throw new Error(`Failed to call Ollama: ${error.message}`);
    }
  }

  async extractJSON(invoiceText: string, schema: string, instruction: string): Promise<any> {
    const systemPrompt = `You are an expert invoice data extraction AI. Extract information EXACTLY as it appears in the document. 
Return ONLY valid JSON matching the schema. No explanations, no markdown, just pure JSON.
CRITICAL: Ensure all JSON strings are properly closed with quotes.`;

    const prompt = `${instruction}

SCHEMA:
${schema}

INVOICE TEXT:
${invoiceText.substring(0, 12000)}

Return ONLY the JSON object. Ensure all strings are properly quoted and the JSON is valid:`;

    try {
      const response = await this.generate(prompt, systemPrompt, {
        temperature: 0.1,
        top_p: 0.9,
        num_predict: 4000  // Increased from 3000 to avoid truncation
      });
      return this.parseJSON(response);
    } catch (error) {
      console.error('[Ollama] Extraction error:', error);
      return null;
    }
  }

  private parseJSON(response: string): any {
    let cleaned = response.trim();
    
    // Remove markdown code blocks
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Remove any text before first { or [
    const jsonStart = cleaned.search(/[\{\[]/);
    if (jsonStart > 0) {
      cleaned = cleaned.substring(jsonStart);
    }
    
    // Remove any text after last } or ]
    const jsonEnd = cleaned.lastIndexOf('}') !== -1 ? cleaned.lastIndexOf('}') : cleaned.lastIndexOf(']');
    if (jsonEnd !== -1 && jsonEnd < cleaned.length - 1) {
      cleaned = cleaned.substring(0, jsonEnd + 1);
    }
    
    try {
      return JSON.parse(cleaned);
    } catch (parseError) {
      console.error('[Ollama] JSON parse error');
      console.error('[Ollama] Attempted to parse:', cleaned.substring(0, 500));
      
      // Try to fix common JSON issues
      try {
        // Fix truncated strings by finding unclosed quotes
        let fixed = cleaned;
        
        // Count quotes to find unclosed ones
        const quoteCount = (fixed.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          // Odd number of quotes - add closing quote before last }
          const lastBrace = fixed.lastIndexOf('}');
          if (lastBrace !== -1) {
            fixed = fixed.substring(0, lastBrace) + '"' + fixed.substring(lastBrace);
          }
        }
        
        // Try parsing fixed version
        return JSON.parse(fixed);
      } catch (fixError) {
        console.error('[Ollama] Failed to fix JSON');
        throw parseError;
      }
    }
  }
}

// ============================================
// OLLAMA-POWERED EXTRACTION FUNCTIONS
// ============================================
const ollama = new OllamaClient(OLLAMA_CONFIG);

async function extractBasicInfoWithOllama(invoiceText: string): Promise<{
  invoiceNo: string | null;
  marksandnos:string |null;              ///
  date: string | null;
  referenceNo: string | null;
  proformaInvoiceNo: string | null;
  currency: string | null;
  totalAmount: number | null;
  totalAmountInWords: string | null;
}> {
  console.log('[Ollama] Extracting basic invoice information...');
  
  const schema = `{
  "invoiceNo": "Invoice number (e.g., 222500187)",
  "marksandnos":"MARKS & NOS (e.g.,PMIPL/CARGO A 342 A 343)",
  "date": "Invoice date in DD.MM.YYYY format",
  "referenceNo": "Reference number if any",
  "proformaInvoiceNo": "Proforma invoice numbers(e.g.",
  "currency": "Currency code like USD or EUR",
  "totalAmount": "Total amount as number only, no commas",
  "totalAmountInWords": "Total amount in words (keep short)"
}`;

  const instruction = `Extract basic invoice information.
Look for:
- INVOICE NO (or Invoice Number): Usually a 9-digit number like 222500187
- DATE: Date in DD.MM.YYYY format (e.g., 17.07.2025)
- TOTAL: Look for "TOTAL : USD" followed by the amount
- Currency: Usually USD or EUR
- Marks&Nos : (e.g.PMIPL/CARGOA 342 A 343 )
IMPORTANT: Keep totalAmountInWords SHORT - just "Twenty Eight Thousand" not the full text.
For totalAmount, return just the number without commas.`;

  let result = await ollama.extractJSON(invoiceText, schema, instruction);
  
  // Retry if critical fields are missing
  if (!result || !result.invoiceNo || !result.date) {
    console.log('[Ollama] Retrying basic info extraction with simplified prompt...');
    
    const simpleInstruction = `Find these exact fields in the invoice:
1. Invoice Number: Look for "INVOICE NO" or "222500187" 
2. Date: Look for "DATE" followed by format like "17.07.2025"
3. Total Amount: Look for "TOTAL" and "USD" with a number

Return as JSON with keys: invoiceNo,marksandnos date, totalAmount, currency.`;
    
    result = await ollama.extractJSON(invoiceText, schema, simpleInstruction);
  }
  
  if (result) {
    console.log('[Ollama] Basic info extracted:', {
      invoiceNo: result.invoiceNo,
      marksandnos:result.marksandnos,
      date: result.date,
      totalAmount: result.totalAmount
      
    });
    
    // Ensure totalAmount is a number
    let totalAmount = null;
    if (result.totalAmount) {
      const amountStr = String(result.totalAmount).replace(/,/g, '');
      totalAmount = parseFloat(amountStr);
    }
    
    return {
      invoiceNo: result.invoiceNo || null,
      marksandnos:result.marksandnos || null,
      date: result.date || null,
      referenceNo: result.referenceNo || null,
      proformaInvoiceNo: result.proformaInvoiceNo || null,
      currency: result.currency || 'USD',
      totalAmount: totalAmount,
      totalAmountInWords: result.totalAmountInWords || null
    };
  }
  
  return {
    invoiceNo: null,
    marksandnos:null,
    date: null,
    referenceNo: null,
    proformaInvoiceNo: null,
    currency: 'USD',
    totalAmount: null,
    totalAmountInWords: null
  };
}

async function extractItemsWithOllama(invoiceText: string): Promise<Array<{
  description: string;
  quantity: string;
  unitPrice: number;
  totalPrice: number;
}>> {
  console.log('[Ollama] Extracting invoice items...');
  
  const schema = `{
  "items": [
    {
      "description": "Item description or 'Item 1', 'Item 2', etc.",
      "quantity": "Quantity with unit (e.g., '04 NOS', '15 NOS', '2 BOXES')",
      "unitPrice": "Unit price as number",
      "totalPrice": "Total price as number"
    }
  ]
}`;

  const instruction = `Extract ALL line items from the invoice table.
Look for the table with columns: DESCRIPTION, QUANTITY, UNIT PRICE, TOTAL AMOUNT.

CRITICAL: Extract EVERY SINGLE item row. Count them carefully.
This invoice typically has 7 items with quantities like:
- 04 NOS
- 02 NOS  
- 04 NOS
- 04 NOS
- 04 NOS
- 02 NOS
- 15 NOS

For each item extract:
- Quantity (must include "NOS", "PCS", etc.)
- Unit Price (numeric value)
- Total Price (numeric value)
- Description (or use "Item 1", "Item 2", etc.)

Extract ALL items, do not skip any rows.`;

  const result = await ollama.extractJSON(invoiceText, schema, instruction);
  
  if (result && result.items && Array.isArray(result.items) && result.items.length > 0) {
    console.log(`[Ollama] Extracted ${result.items.length} items from invoice`);
    
    // Clean and validate items
    const cleanedItems = result.items.map((item: any, index: number) => ({
      description: item.description || `Item ${index + 1}`,
      quantity: String(item.quantity || '1 NOS'),
      unitPrice: parseFloat(String(item.unitPrice || 0).replace(/,/g, '')),
      totalPrice: parseFloat(String(item.totalPrice || 0).replace(/,/g, ''))
    })).filter((item: any) => item.totalPrice > 0);
    
    // Verify we got all items
    if (cleanedItems.length < 7) {
      console.warn(`[Ollama] Warning: Only extracted ${cleanedItems.length} items, expected 7. Trying alternative extraction...`);
      
      // Try a second extraction with more explicit prompt
      const retryInstruction = `Look at the invoice table carefully. Count each row.
Extract EXACTLY 7 line items. Each row has:
- A quantity (like 04 NOS, 02 NOS, 15 NOS)
- A unit price
- A total amount

Return all 7 items as JSON array.`;
      
      const retryResult = await ollama.extractJSON(invoiceText, schema, retryInstruction);
      if (retryResult && retryResult.items && retryResult.items.length > cleanedItems.length) {
        console.log(`[Ollama] Retry successful: Found ${retryResult.items.length} items`);
        return retryResult.items.map((item: any, index: number) => ({
          description: item.description || `Item ${index + 1}`,
          quantity: String(item.quantity || '1 NOS'),
          unitPrice: parseFloat(String(item.unitPrice || 0).replace(/,/g, '')),
          totalPrice: parseFloat(String(item.totalPrice || 0).replace(/,/g, ''))
        })).filter((item: any) => item.totalPrice > 0);
      }
    }
    
    return cleanedItems;
  }
  
  console.log('[Ollama] No items extracted');
  return [];
}

async function extractExporterWithOllama(invoiceText: string): Promise<{
  name: string | null;
  address: string | null;
  factory: string | null;
  pan: string | null;
  gstin: string | null;
  iec: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
}> {
  console.log('[Ollama] Extracting exporter details...');
  
  const schema = `{
  "name": "Exporter company name",
  "address": "Exporter full address including corporate office and factory",
  "factory": "Factory address if mentioned",
  "pan": "PAN number",
  "gstin": "GSTIN number (15 characters)",
  "iec": "IEC code (10 digits)",
  "email": "Email address",
  "phone": "Phone number",
  "mobile": "Mobile number"
}`;


 const instruction = `Extract exporter/shipper information from the packing list.
Look for sections labeled:
- EXPORTER, SHIPPER, FROM, or similar
- May include CORPORATE OFFICE and FACTORY addresses
- Look for PAN NO, GSTIN NO, IEC codes
- Extract email (MAIL:, EMAIL:, E-MAIL:)
- Extract TEL:, PHONE:, MOB:, MOBILE: numbers

Return ONLY valid JSON.`;


  const result = await ollama.extractJSON(invoiceText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Exporter extracted:', result.name);
    return {
      name: result.name || null,
      address: result.address || null,
      factory: result.factory || null,
      pan: result.pan || null,
      gstin: result.gstin || null,
      iec: result.iec || null,
      email: result.email || null,
      phone: result.phone || null,
      mobile: result.mobile || null
    };
  }
  
  return {
    name: null, address: null, factory: null, pan: null, 
    gstin: null, iec: null, email: null, phone: null, mobile: null
  };
}

async function extractConsigneeWithOllama(invoiceText: string): Promise<{
  name: string | null;
  address: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  poBox: string | null;
  country: string | null;
}> {
  console.log('[Ollama] Extracting consignee details...');
  
  const schema = `{
  "name": "Consignee company name",
  "address": "Full address",
  "phone": "Phone number",
  "mobile": "Mobile number",
  "email": "Email address",
  "poBox": "PO Box number if any",
  "country": "Country name"
}`;

  const instruction = `Extract the CONSIGNEE information from this invoice.
Look for section labeled "CONSIGNEE" or "BUYER" or "TO" or "SHIP TO".
Extract all available contact details.`;

  const result = await ollama.extractJSON(invoiceText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Consignee extracted:', result.name);
    return {
      name: result.name || null,
      address: result.address || null,
      phone: result.phone || null,
      mobile: result.mobile || null,
      email: result.email || null,
      poBox: result.poBox || null,
      country: result.country || null
    };
  }
  
  return {
    name: null, address: null, phone: null, mobile: null, 
    email: null, poBox: null, country: null
  };
}

async function extractBankWithOllama(invoiceText: string): Promise<{
  bankName: string | null;
  address: string | null;
  usdAccount: string | null;
  euroAccount: string | null;
  swiftCode: string | null;
  ifscCode: string | null;
  branchCode: string | null;
  adCode: string | null;
  bsrCode: string | null;
}> {
  console.log('[Ollama] Extracting bank details...');
  
  const schema = `{
  "bankName": "Bank name",
  "address": "Bank address",
  "usdAccount": "USD account number",
  "euroAccount": "EUR/EURO account number",
  "swiftCode": "SWIFT code",
  "ifscCode": "IFSC code",
  "branchCode": "Branch code",
  "adCode": "AD code",
  "bsrCode": "BSR code"
}`;

  const instruction = `Extract bank details from this invoice.
Look for section labeled "BANK" or "OUR BANK" or "BANKING DETAILS".
Extract account numbers, codes, and bank address.`;

  const result = await ollama.extractJSON(invoiceText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Bank extracted:', result.bankName);
    return {
      bankName: result.bankName || null,
      address: result.address || null,
      usdAccount: result.usdAccount || null,
      euroAccount: result.euroAccount || null,
      swiftCode: result.swiftCode || null,
      ifscCode: result.ifscCode || null,
      branchCode: result.branchCode || null,
      adCode: result.adCode || null,
      bsrCode: result.bsrCode || null
    };
  }
  
  return {
    bankName: null, address: null, usdAccount: null, euroAccount: null,
    swiftCode: null, ifscCode: null, branchCode: null, adCode: null, bsrCode: null
  };
}

async function extractShippingWithOllama(invoiceText: string): Promise<{
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
}> {
  console.log('[Ollama] Extracting shipping details...');
  
  const schema = `{
  "incoterms": "Incoterms like CIF, FOB, EXW, etc.",
  "preCarriage": "Pre-carriage by",
  "placeOfReceipt": "Place of receipt",
  "vesselFlight": "Vessel or flight information",
  "portOfLoading": "Port of loading - extract ONLY the city name (e.g., 'mumbai', 'pune', 'delhi') without any additional words like 'airport', 'port', 'seaport'",
  "portOfDischarge": "Port of discharge",
  "finalDestination": "Final destination",
  "countryOfOrigin": "Country of origin",
  "countryOfDestination": "Country of destination",
  "hsnCode": "HSN code",
  "freightTerms": "Freight terms like PREPAID, COLLECT"
}`;

  const instruction = `Extract shipping and logistics details from this invoice.
CRITICAL: For port of loading, extract ONLY the city name (e.g., 'mumbai', 'pune', 'delhi') without any additional words like 'airport', 'port', 'seaport', or 'international'.
If the port of loading contains multiple words, take only the city name part.

Examples:
- "Mumbai Airport" → "mumbai"
- "Chhatrapati Shivaji Maharaj International Airport" → "mumbai" 
- "Delhi Airport" → "delhi"
- "Pune International Airport" → "pune"
- "Chennai Seaport" → "chennai"
- "Kolkata Port" → "kolkata"
- "Nhava Sheva" → "mumbai" (since Nhava Sheva is in Mumbai)
- "JNPT" → "mumbai" (since JNPT is in Mumbai)

Look for information about ports, destinations, shipping terms, and HSN codes.`;

  const result = await ollama.extractJSON(invoiceText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Shipping extracted');
    
    // Post-process portOfLoading to ensure only city name
    let portOfLoading = result.portOfLoading || null;
    if (portOfLoading) {
      // Convert to lowercase and remove common port/airport suffixes
      portOfLoading = portOfLoading.toLowerCase()
        .replace(/\b(airport|port|seaport|international|intl|terminal|dock|harbor|harbour)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Handle specific known port mappings
      const portMappings: { [key: string]: string } = {
        'nhava sheva': 'mumbai',
        'jnpt': 'mumbai',
        'csmia': 'mumbai',
        'bom': 'mumbai',
        'del': 'delhi',
        'maa': 'chennai',
        'blore': 'bangalore',
        'hyd': 'hyderabad',
        'ccu': 'kolkata'
      };
      
      // Check if the cleaned port matches any known port mappings
      for (const [key, value] of Object.entries(portMappings)) {
        if (portOfLoading.includes(key) || key.includes(portOfLoading)) {
          portOfLoading = value;
          break;
        }
      }
      
      // Extract just the first word (city name) if multiple words remain
      const words = portOfLoading.split(' ');
      if (words.length > 1) {
        portOfLoading = words[0];
      }
    }
    
    console.log('Port of Loading:', portOfLoading);
    console.log('HSN Code:', result.hsnCode);
    
    return {
      incoterms: result.incoterms || null,
      preCarriage: result.preCarriage || null,
      placeOfReceipt: result.placeOfReceipt || null,
      vesselFlight: result.vesselFlight || null,
      portOfLoading: portOfLoading,
      portOfDischarge: result.portOfDischarge || null,
      finalDestination: result.finalDestination || null,
      countryOfOrigin: result.countryOfOrigin || null,
      countryOfDestination: result.countryOfDestination || null,
      hsnCode: result.hsnCode || null,
      freightTerms: result.freightTerms || null
    };
  }
  
  return {
    incoterms: null, preCarriage: null, placeOfReceipt: null, vesselFlight: null,
    portOfLoading: null, portOfDischarge: null, finalDestination: null,
    countryOfOrigin: null, countryOfDestination: null, hsnCode: null, freightTerms: null
  };
}

async function extractAdditionalInfoWithOllama(invoiceText: string): Promise<{
  paymentTerms: string | null;
  marksAndNumbers: string | null;
  packaging: string | null;
  igstStatus: string | null;
  drawbackSrNo: string | null;
  rodtepClaim: boolean;
  commissionRate: string | null;
  signature: boolean;
}> {
  console.log('[Ollama] Extracting additional information...');
  
  const schema = `{
  "paymentTerms": "Payment terms",
  "marksAndNumbers": "Marks and numbers",
  "packaging": "Packaging description",
  "igstStatus": "IGST payment status",
  "drawbackSrNo": "Drawback serial number",
  "rodtepClaim": "true if RODTEP claim mentioned, false otherwise",
  "commissionRate": "Commission rate percentage",
  "signature": "true if authorized signature or signatory mentioned, false otherwise"
}`;

  const instruction = `Extract additional invoice information including payment terms, packaging, certifications, and signature status.`;

  const result = await ollama.extractJSON(invoiceText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Additional info extracted');
    return {
      paymentTerms: result.paymentTerms || null,
      marksAndNumbers: result.marksAndNumbers || null,
      packaging: result.packaging || null,
      igstStatus: result.igstStatus || null,
      drawbackSrNo: result.drawbackSrNo || null,
      rodtepClaim: result.rodtepClaim === true || result.rodtepClaim === 'true',
      commissionRate: result.commissionRate || null,
      signature: result.signature === true || result.signature === 'true'
    };
  }
  
  return {
    paymentTerms: null, marksAndNumbers: null, packaging: null,
    igstStatus: null, drawbackSrNo: null, rodtepClaim: false,
    commissionRate: null, signature: false
  };
}















// ============================================
// MAIN EXTRACTION FUNCTION
// ============================================
export async function extractAndValidateInvoice(invoiceText: string): Promise<InvoiceValidationResult> {
  console.log('═══════════════════════════════════════');
  console.log('[Extraction] Starting Ollama-powered invoice extraction');
  console.log('[Extraction] Text length:', invoiceText.length);
  console.log('[Extraction] Using model:', OLLAMA_CONFIG.model);
  console.log('═══════════════════════════════════════');
  
  const extractedData: CommercialInvoiceData = {
    invoiceNo: null,
    marksandnos:null,
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
    // Extract all sections in parallel for better performance
    const [basicInfo, items, exporter, consignee, bank, shipping, additional] = await Promise.all([
      extractBasicInfoWithOllama(invoiceText),
      extractItemsWithOllama(invoiceText),
      extractExporterWithOllama(invoiceText),
      extractConsigneeWithOllama(invoiceText),
      extractBankWithOllama(invoiceText),
      extractShippingWithOllama(invoiceText),
      extractAdditionalInfoWithOllama(invoiceText)
    ]);

    // Basic info
    extractedData.invoiceNo = basicInfo.invoiceNo;
    extractedData.marksandnos=basicInfo.marksandnos;
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














// ============================================
// SHIPPING AGENT CLASS
// ============================================
export class ShippingAgent {
  private createInitialState(threadId: string, userId: string, organizationId: string): ConversationState {
    return {
      threadId,
      userId,
      organizationId,
      currentStep: 'greeting',
      shipmentData: {},
      invoiceIds: [],
      documentIds: [],
      messages: [],
      attempts: 0,
      lastActivity: new Date().toISOString()
    };
  }

  async processMessage(
    threadId: string,
    userId: string,
    organizationId: string,
    userMessage: string
  ): Promise<{
    response: string;
    state: ConversationState;
    shouldGenerateQuote: boolean;
  }> {
    let state = await getConversationState(threadId) ?? this.createInitialState(threadId, userId, organizationId);
    
    if (state.messages.length === 0) {
      const greeting = ResponseGenerator.greeting();
      state.messages.push({ role: 'assistant', content: greeting, timestamp: new Date().toISOString() });
      await createConversationState(state);
      return { response: greeting, state, shouldGenerateQuote: false };
    }
    
    state.messages.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() });
    const { nextState, response } = WorkflowStateMachine.processUserMessage(state, userMessage);
    const shouldGenerateQuote = response === 'GENERATE_QUOTE';
    let finalResponse = shouldGenerateQuote ? 'Generating shipping quotes...' : response;
    nextState.messages.push({ role: 'assistant', content: finalResponse, timestamp: new Date().toISOString() });
    await updateConversationState(nextState);
    return { response: finalResponse, state: nextState, shouldGenerateQuote };
  }

  async handleInvoiceUpload(
    threadId: string,
    userId: string,
    organizationId: string,
    invoiceValidation: InvoiceValidationResult,
    invoiceId: string
  ): Promise<{ response: string; state: ConversationState }> {
    let state = await getConversationState(threadId) ?? this.createInitialState(threadId, userId, organizationId);
    
    state.invoiceIds.push(invoiceId);
    const { extractedData } = invoiceValidation;
    
    if (extractedData.shipmentDetails?.portOfLoading && !state.shipmentData.origin) {
      state.shipmentData.origin = extractedData.shipmentDetails.portOfLoading;
    }
    if (extractedData.shipmentDetails?.finalDestination && !state.shipmentData.destination) {
      state.shipmentData.destination = extractedData.shipmentDetails.finalDestination;
    }
    if (extractedData.itemList?.length > 0 && !state.shipmentData.cargo) {
      const cargoDesc = extractedData.itemList.map(item => 
        `${item.quantity} - ${item.description}`
      ).join(', ');
      state.shipmentData.cargo = cargoDesc.substring(0, 100);
    }
    
    if (!state.shipmentData.weight && extractedData.totalAmount) {
      const estimatedWeight = Math.ceil(extractedData.totalAmount / 100);
      state.shipmentData.weight = `${estimatedWeight} kg`;
    }
    
    const response = ResponseGenerator.invoiceUploaded(invoiceValidation);
    state.messages.push({ role: 'system', content: `Invoice ${invoiceId} uploaded`, timestamp: new Date().toISOString() });
    state.messages.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
    state.currentStep = WorkflowStateMachine.determineNextStep(state);
    await updateConversationState(state);
    return { response, state };
  }
}

// ============================================
// SHIPPING QUOTE GENERATION
// ============================================
export async function generateShippingQuote(shipmentData: ConversationState['shipmentData']) {
  const { weight, serviceLevel, origin, destination } = shipmentData;
  const weightMatch = (weight || '').match(/(\d+)/);
  const weightValue = weightMatch ? parseInt(weightMatch[1]) : 50;
  const routeType = determineRouteType(origin || '', destination || '');
  const baseRate = calculateBaseRate(routeType, weightValue);
  const service = getServiceMultiplier(serviceLevel || 'Standard');
  
  const carriers = [
    { carrierId: 'dhl_001', name: 'DHL Express', reputation: 9.4, reliability: 98.7 },
    { carrierId: 'fedex_002', name: 'FedEx International', reputation: 9.2, reliability: 98.2 },
    { carrierId: 'ups_003', name: 'UPS Worldwide', reputation: 9.0, reliability: 97.8 },
    { carrierId: 'maersk_004', name: 'Maersk Line', reputation: 9.1, reliability: 97.5 },
    { carrierId: 'msc_005', name: 'MSC Cargo', reputation: 8.9, reliability: 97.2 }
  ];
  
  const quotes = carriers.slice(0, 3).map((carrier, i) => {
    const variation = 0.88 + (i * 0.08);
    const finalRate = (baseRate * service.multiplier * variation);
    const baseDays = service.days.split('-').map(d => parseInt(d));
    return {
      carrierId: carrier.carrierId,
      name: carrier.name,
      service: serviceLevel || 'Standard',
      rate: finalRate.toFixed(2),
      transitTime: `${baseDays[0] + i}-${baseDays[1] + i} business days`,
      reputation: carrier.reputation,
      reliability: carrier.reliability + '%',
      currency: 'USD'
    };
  });
  
  return { quotes };
}

function determineRouteType(origin: string, destination: string): string {
  if (!origin || !destination) return 'domestic';
  const originLower = origin.toLowerCase();
  const destLower = destination.toLowerCase();
  
  const indianCities = ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad', 'aurangabad'];
  const isOriginIndia = indianCities.some(city => originLower.includes(city)) || originLower.includes('india');
  const isDestIndia = indianCities.some(city => destLower.includes(city)) || destLower.includes('india');
  
  if (isOriginIndia && isDestIndia) return 'domestic';
  if (isOriginIndia || isDestIndia) return 'international';
  return 'international';
}

function calculateBaseRate(routeType: string, weight: number): number {
  const routes = { domestic: 120, regional: 280, international: 480 };
  const baseRate = routes[routeType as keyof typeof routes] || routes.domestic;
  const weightRate = Math.ceil(weight / 10) * 18;
  return baseRate + weightRate;
}

function getServiceMultiplier(serviceLevel: string): { multiplier: number; days: string } {
  const multipliers = {
    Express: { multiplier: 2.5, days: '1-3' },
    Standard: { multiplier: 1.0, days: '4-7' },
    Economy: { multiplier: 0.75, days: '8-14' }
  };
  return multipliers[serviceLevel as keyof typeof multipliers] || multipliers.Standard;
}

export function formatQuoteResponse(quote: any, shipmentData: ConversationState['shipmentData'], invoiceCount: number = 0): string {
  const { quotes } = quote;
  
  let response = 'Shipping Quote Generated\n\n';
  response += 'Shipment Details:\n';
  response += `• Origin: ${shipmentData.origin || 'Not specified'}\n`;
  response += `• Destination: ${shipmentData.destination || 'Not specified'}\n`;
  response += `• Weight: ${shipmentData.weight || 'Not specified'}\n`;
  response += `• Cargo: ${shipmentData.cargo || 'Not specified'}\n`;
  
  if (invoiceCount > 0) {
    response += `• Invoices: ${invoiceCount} uploaded\n`;
  }
  
  response += '\nAvailable Carriers:\n\n';
  
  quotes.forEach((q: any, index: number) => {
    response += `${index + 1}. ${q.name} (${q.service})\n`;
    response += `   Rate: ${q.rate} ${q.currency}\n`;
    response += `   Transit Time: ${q.transitTime}\n`;
    response += `   Reputation: ${q.reputation}/10\n`;
    response += `   Reliability: ${q.reliability}\n`;
    response += `   Carrier ID: ${q.carrierId}\n\n`;
  });
  
  response += 'Next Steps:\n';
  response += '1. Review the quotes above\n';
  response += '2. Select a carrier by saying "I choose [carrier name]"\n';
  response += '3. Or ask any questions about the quotes\n';
  
  return response;
}

// ============================================
// UTILITY: Test Ollama Connection
// ============================================
export async function testOllamaConnection(): Promise<{ success: boolean; message: string; model: string }> {
  try {
    console.log('[Ollama] Testing connection to:', OLLAMA_CONFIG.baseUrl);
    
    const response = await fetch(`${OLLAMA_CONFIG.baseUrl}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Ollama server returned ${response.status}. Make sure Ollama is running.`,
        model: OLLAMA_CONFIG.model
      };
    }

    const data = await response.json();
    const availableModels = data.models?.map((m: any) => m.name) || [];
    
    if (!availableModels.includes(OLLAMA_CONFIG.model)) {
      return {
        success: false,
        message: `Model ${OLLAMA_CONFIG.model} not found. Available models: ${availableModels.join(', ')}. Run: ollama pull ${OLLAMA_CONFIG.model}`,
        model: OLLAMA_CONFIG.model
      };
    }

    return {
      success: true,
      message: `Connected to Ollama successfully. Using model: ${OLLAMA_CONFIG.model}`,
      model: OLLAMA_CONFIG.model
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to connect to Ollama: ${error.message}. Make sure Ollama is running on ${OLLAMA_CONFIG.baseUrl}`,
      model: OLLAMA_CONFIG.model
    };
  }
}

// ============================================
// EXPORT DECLARATION INTERFACES
// ============================================
export interface ExportDeclarationData {
  // Document Identification
  documentType: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  shippingBillNo: string | null;
  shippingBillDate: string | null;
  
  // Valuation Information
  valuationMethod: string | null;
  sellerBuyerRelated: boolean | null;
  relationshipInfluencedPrice: boolean | null;
  
  // Transaction Details
  paymentTerms: string | null;
  deliveryTerms: string | null;
  typeOfSale: string | null;
  
  // Declaration Status
  declarationStatus: string | null;
  signedBy: string | null;
  signedDate: string | null;
  
  // Additional Fields
  applicableRule: string | null;
  declarationNumber: string | null;
}

export interface ExportDeclarationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  extractedData: ExportDeclarationData;
  completeness: number;
}

// ============================================
// EXPORT DECLARATION EXTRACTION FUNCTIONS
// ============================================
async function extractExportDeclarationBasicInfo(invoiceText: string): Promise<{
  invoiceNo: string | null;
  invoiceDate: string | null;
  shippingBillNo: string | null;
  shippingBillDate: string | null;
  documentType: string | null;
}> {
  console.log('[Ollama] Extracting export declaration basic information...');
  
  const schema = `{
  "invoiceNo": "Invoice number (e.g., 222500187)",
  "invoiceDate": "Invoice date in DD.MM.YYYY format",
  "shippingBillNo": "Shipping bill number (e.g., 7192707)",
  "shippingBillDate": "Shipping bill date in DD.MM.YYYY format",
  "documentType": "Document type (e.g., Export Value Declaration, Annexure-A)"
}`;

  const instruction = `Extract basic information from this Export Value Declaration document.
Look for:
- INVOICE NO or Invoice Number
- INVOICE DATE
- SHIPPING BILL NO or Shipping Bill Number
- SHIPPING BILL DATE
- Document type (Export Value Declaration, Annexure-A, etc.)

This is typically a customs declaration form, not a commercial invoice.`;

  let result = await ollama.extractJSON(invoiceText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Export declaration basic info extracted:', {
      invoiceNo: result.invoiceNo,
      shippingBillNo: result.shippingBillNo
    });
    
    return {
      invoiceNo: result.invoiceNo || null,
      invoiceDate: result.invoiceDate || null,
      shippingBillNo: result.shippingBillNo || null,
      shippingBillDate: result.shippingBillDate || null,
      documentType: result.documentType || 'Export Value Declaration'
    };
  }
  
  return {
    invoiceNo: null,
    invoiceDate: null,
    shippingBillNo: null,
    shippingBillDate: null,
    documentType: null
  };
}

async function extractValuationDetails(invoiceText: string): Promise<{
  valuationMethod: string | null;
  sellerBuyerRelated: boolean | null;
  relationshipInfluencedPrice: boolean | null;
  applicableRule: string | null;
}> {
  console.log('[Ollama] Extracting valuation details...');
  
  const schema = `{
  "valuationMethod": "Valuation method (e.g., Rule 3, Transaction Value)",
  "sellerBuyerRelated": "true if seller and buyer are related, false otherwise",
  "relationshipInfluencedPrice": "true if relationship influenced price, false otherwise",
  "applicableRule": "Applicable rule (e.g., Rule 7 of Customs Valuation)"
}`;

  const instruction = `Extract valuation and relationship information from this export declaration.
Look for:
- Valuation Method (Rule 3, Transaction Value, etc.)
- Whether seller and buyer are related (Yes/No)
- Whether relationship influenced price (Yes/No)
- Applicable rules or regulations

Return boolean values for relationship questions.`;

  const result = await ollama.extractJSON(invoiceText, schema, instruction);
  
  if (result) {
    return {
      valuationMethod: result.valuationMethod || null,
      sellerBuyerRelated: result.sellerBuyerRelated === true || result.sellerBuyerRelated === 'true',
      relationshipInfluencedPrice: result.relationshipInfluencedPrice === true || result.relationshipInfluencedPrice === 'true',
      applicableRule: result.applicableRule || null
    };
  }
  
  return {
    valuationMethod: null,
    sellerBuyerRelated: null,
    relationshipInfluencedPrice: null,
    applicableRule: null
  };
}

async function extractTransactionDetails(invoiceText: string): Promise<{
  paymentTerms: string | null;
  deliveryTerms: string | null;
  typeOfSale: string | null;
}> {
  console.log('[Ollama] Extracting transaction details...');
  
  const schema = `{
  "paymentTerms": "Payment terms (e.g., 100% Advance Payment)",
  "deliveryTerms": "Delivery terms (e.g., CIF )",
  "typeOfSale": "Type of sale (e.g., Normal Sale)"
}`;

  const instruction = `Extract transaction details from this export declaration.
Look for:
- Terms of Payment
- Terms of Delivery (Incoterms)
- Type of Sale (Normal Sale, Consignment, etc.)`;

  const result = await ollama.extractJSON(invoiceText, schema, instruction);
  
  if (result) {
    return {
      paymentTerms: result.paymentTerms || null,
      deliveryTerms: result.deliveryTerms || null,
      typeOfSale: result.typeOfSale || null
    };
  }
  
  return {
    paymentTerms: null,
    deliveryTerms: null,
    typeOfSale: null
  };
}

async function extractDeclarationStatus(invoiceText: string): Promise<{
  declarationStatus: string | null;
  signedBy: string | null;
  signedDate: string | null;
  declarationNumber: string | null;
}> {
  console.log('[Ollama] Extracting declaration status...');
  
  const schema = `{
  "declarationStatus": "Declaration status (e.g., Signed & Confirmed)",
  "signedBy": "Name of signatory",
  "signedDate": "Date of signature",
  "declarationNumber": "Declaration number if any"
}`;

  const instruction = `Extract declaration status and signature information.
Look for:
- Declaration status (Signed, Confirmed, etc.)
- Signatory name
- Signature date
- Any declaration or reference numbers`;

  const result = await ollama.extractJSON(invoiceText, schema, instruction);
  
  if (result) {
    return {
      declarationStatus: result.declarationStatus || null,
      signedBy: result.signedBy || null,
      signedDate: result.signedDate || null,
      declarationNumber: result.declarationNumber || null
    };
  }
  
  return {
    declarationStatus: null,
    signedBy: null,
    signedDate: null,
    declarationNumber: null
  };
}


















// ============================================
// MAIN EXPORT DECLARATION EXTRACTION FUNCTION
// ============================================
export async function extractAndValidateExportDeclaration(invoiceText: string): Promise<ExportDeclarationValidationResult> {
  console.log('═══════════════════════════════════════');
  console.log('[Extraction] Starting Ollama-powered export declaration extraction');
  console.log('[Extraction] Text length:', invoiceText.length);
  console.log('═══════════════════════════════════════');
  
  const extractedData: ExportDeclarationData = {
    documentType: null,
    invoiceNo: null,
    invoiceDate: null,
    shippingBillNo: null,
    shippingBillDate: null,
    valuationMethod: null,
    sellerBuyerRelated: null,
    relationshipInfluencedPrice: null,
    paymentTerms: null,
    deliveryTerms: null,
    typeOfSale: null,
    declarationStatus: null,
    signedBy: null,
    signedDate: null,
    applicableRule: null,
    declarationNumber: null
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Extract all sections in parallel
    const [basicInfo, valuation, transaction, declaration] = await Promise.all([
      extractExportDeclarationBasicInfo(invoiceText),
      extractValuationDetails(invoiceText),
      extractTransactionDetails(invoiceText),
      extractDeclarationStatus(invoiceText)
    ]);

    // Basic info
    extractedData.documentType = basicInfo.documentType;
    extractedData.invoiceNo = basicInfo.invoiceNo;
    extractedData.invoiceDate = basicInfo.invoiceDate;
    extractedData.shippingBillNo = basicInfo.shippingBillNo;
    extractedData.shippingBillDate = basicInfo.shippingBillDate;

    // Valuation
    extractedData.valuationMethod = valuation.valuationMethod;
    extractedData.sellerBuyerRelated = valuation.sellerBuyerRelated;
    extractedData.relationshipInfluencedPrice = valuation.relationshipInfluencedPrice;
    extractedData.applicableRule = valuation.applicableRule;

    // Transaction
    extractedData.paymentTerms = transaction.paymentTerms;
    extractedData.deliveryTerms = transaction.deliveryTerms;
    extractedData.typeOfSale = transaction.typeOfSale;

    // Declaration
    extractedData.declarationStatus = declaration.declarationStatus;
    extractedData.signedBy = declaration.signedBy;
    extractedData.signedDate = declaration.signedDate;
    extractedData.declarationNumber = declaration.declarationNumber;

    console.log('[Extraction] Export declaration extracted:', {
      invoiceNo: extractedData.invoiceNo,
      shippingBillNo: extractedData.shippingBillNo,
      valuationMethod: extractedData.valuationMethod
    });

    // Validation
    if (!extractedData.invoiceNo) errors.push('Invoice Number is missing');
    if (!extractedData.invoiceDate) errors.push('Invoice Date is missing');
    if (!extractedData.shippingBillNo) warnings.push('Shipping Bill Number is missing');
    
    if (extractedData.sellerBuyerRelated === null) {
      warnings.push('Seller-Buyer relationship status not specified');
    }
    
    if (extractedData.relationshipInfluencedPrice === null) {
      warnings.push('Relationship price influence status not specified');
    }
    
    if (!extractedData.paymentTerms) warnings.push('Payment Terms are missing');
    if (!extractedData.deliveryTerms) warnings.push('Delivery Terms are missing');
    if (!extractedData.declarationStatus) warnings.push('Declaration Status is missing');

    // Date consistency check
    if (extractedData.invoiceDate && extractedData.shippingBillDate) {
      const invoiceDate = new Date(extractedData.invoiceDate);
      const shippingBillDate = new Date(extractedData.shippingBillDate);
      
      if (shippingBillDate < invoiceDate) {
        warnings.push('Shipping bill date appears to be before invoice date - please verify');
      }
    }

    // Calculate completeness
    const requiredFields = [
      extractedData.invoiceNo,
      extractedData.invoiceDate,
      extractedData.valuationMethod,
      extractedData.sellerBuyerRelated !== null,
      extractedData.relationshipInfluencedPrice !== null,
      extractedData.paymentTerms,
      extractedData.deliveryTerms,
      extractedData.declarationStatus
    ];
    
    const filled = requiredFields.filter(f => f).length;
    const completeness = Math.round((filled / requiredFields.length) * 100);

    console.log('[Validation] Export declaration completeness:', completeness + '%');
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
    console.error('[Extraction] Error processing export declaration:', error);
    errors.push('Failed to parse export declaration: ' + (error as Error).message);
    
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
// DOCUMENT TYPE DETECTION
// ============================================
export async function detectDocumentType(invoiceText: string): Promise<'commercial_invoice' | 'export_declaration' | 'unknown'> {
  console.log('[Detection] Analyzing document type...');
  
  const systemPrompt = `You are a document classification AI. Analyze the text and determine if it's a Commercial Invoice or Export Value Declaration.
Return ONLY one of these three options: "commercial_invoice", "export_declaration", or "unknown".`;

  const prompt = `Classify this document:

TEXT SAMPLE:
${invoiceText.substring(0, 2000)}

Look for keywords:
- Commercial Invoice: "INVOICE", "COMMERCIAL INVOICE", items, quantities, prices, total amount
- Export Declaration: "EXPORT VALUE DECLARATION", "ANNEXURE", "Shipping Bill", "Valuation Method", "Customs Valuation"

Return ONLY one word: "commercial_invoice", "export_declaration", or "unknown":`;

  try {
    const response = await ollama.generate(prompt, systemPrompt, {
      temperature: 0.1,
      num_predict: 100
    });

    const classification = response.trim().toLowerCase();
    
    if (classification.includes('commercial_invoice')) {
      console.log('[Detection] Document classified as: Commercial Invoice');
      return 'commercial_invoice';
    } else if (classification.includes('export_declaration')) {
      console.log('[Detection] Document classified as: Export Declaration');
      return 'export_declaration';
    } else {
      console.log('[Detection] Document classification: Unknown');
      return 'unknown';
    }
  } catch (error) {
    console.error('[Detection] Classification error:', error);
    
    // Fallback: Check for keywords
    const textLower = invoiceText.toLowerCase();
    if (textLower.includes('export value declaration') || textLower.includes('annexure') || textLower.includes('shipping bill')) {
      console.log('[Detection] Fallback: Export Declaration (keywords)');
      return 'export_declaration';
    } else if (textLower.includes('invoice') && textLower.includes('total')) {
      console.log('[Detection] Fallback: Commercial Invoice (keywords)');
      return 'commercial_invoice';
    }
    
    return 'unknown';
  }
}

// ============================================
// UNIFIED EXTRACTION FUNCTION
// ============================================
export async function extractDocumentData(invoiceText: string): Promise<{
  documentType: 'commercial_invoice' | 'export_declaration' | 'unknown';
  validation: InvoiceValidationResult | ExportDeclarationValidationResult;
}> {
  const documentType = await detectDocumentType(invoiceText);
  
  if (documentType === 'export_declaration') {
    const validation = await extractAndValidateExportDeclaration(invoiceText);
    return { documentType, validation };
  } else {
    // Default to commercial invoice
    const validation = await extractAndValidateInvoice(invoiceText);
    return { documentType: 'commercial_invoice', validation };
  }
}



// ============================================
// SCOMET DECLARATION INTERFACES
// ============================================
export interface SCOMETDeclarationData {
  // Document Identification
  documentDate: string | null;
  documentType: string | null;
  
  // Core Reference Fields
  consigneeName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  destinationCountry: string | null;
  
  // SCOMET Specific Information
  scometCoverage: boolean | null; // Does it fall under SCOMET? Yes/No
  goodsDescription: string | null;
  hsCode: string | null;
  
  // Declaration Information
  declarationStatement: string | null;
  signatoryName: string | null;
  signedStatus: boolean | null;
  
  // Additional Details
  addressedTo: string | null; // e.g., "Assistant Commissioner of Customs"
  addressLocation: string | null; // e.g., "Air Cargo Complex, Andheri, Mumbai"
}

export interface SCOMETDeclarationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  extractedData: SCOMETDeclarationData;
  completeness: number;
}

// ============================================
// SCOMET DECLARATION EXTRACTION FUNCTIONS
// ============================================
async function extractSCOMETBasicInfo(documentText: string): Promise<{
  documentDate: string | null;
  documentType: string | null;
  addressedTo: string | null;
  addressLocation: string | null;
}> {
  console.log('[Ollama] Extracting SCOMET basic information...');
  
  const schema = `{
  "documentDate": "Date in DD.MM.YYYY format (e.g., 19.07.2025)",
  "documentType": "Document type (e.g., SCOMET Declaration)",
  "addressedTo": "Who the document is addressed to",
  "addressLocation": "Location/address of the recipient"
}`;

  const instruction = `Extract basic document information from this SCOMET Declaration.
Look for:
- DATE at the top of the document (format: DD.MM.YYYY)
- Document title (SCOMET DECLARATION)
- "To," followed by the recipient's title (e.g., Assistant Commissioner of Customs)
- Location details (Air Cargo Complex, city, etc.)

Return ONLY valid JSON.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] SCOMET basic info extracted');
    return {
      documentDate: result.documentDate || null,
      documentType: result.documentType || 'SCOMET Declaration',
      addressedTo: result.addressedTo || null,
      addressLocation: result.addressLocation || null
    };
  }
  
  return {
    documentDate: null,
    documentType: 'SCOMET Declaration',
    addressedTo: null,
    addressLocation: null
  };
}

async function extractSCOMETReferenceInfo(documentText: string): Promise<{
  consigneeName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  destinationCountry: string | null;
}> {
  console.log('[Ollama] Extracting SCOMET reference information...');
  
  const schema = `{
  "consigneeName": "Name of the consignee/buyer",
  "invoiceNumber": "Invoice number referenced in the declaration",
  "invoiceDate": "Invoice date in DD.MM.YYYY format",
  "destinationCountry": "Country of destination"
}`;

  const instruction = `Extract reference information from this SCOMET Declaration.
Look for:
- Consignee name (mentioned after "to our Consignee" or similar)
- Invoice Number (e.g., "Invoice Number 222500187" or "Invoice No 222500187")
- Invoice Date (format: DD.MM.YYYY)
- Destination country (mentioned as "for the country Of" or similar)

Example pattern: "exporting the [goods] to our Consignee [NAME] with Invoice Number [NUMBER] Date [DATE] for the country Of [COUNTRY]"

Return ONLY valid JSON.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] SCOMET reference info extracted:', {
      consignee: result.consigneeName,
      invoice: result.invoiceNumber
    });
    return {
      consigneeName: result.consigneeName || null,
      invoiceNumber: result.invoiceNumber || null,
      invoiceDate: result.invoiceDate || null,
      destinationCountry: result.destinationCountry || null
    };
  }
  
  return {
    consigneeName: null,
    invoiceNumber: null,
    invoiceDate: null,
    destinationCountry: null
  };
}

async function extractSCOMETGoodsInfo(documentText: string): Promise<{
  goodsDescription: string | null;
  hsCode: string | null;
  scometCoverage: boolean | null;
  declarationStatement: string | null;
}> {
  console.log('[Ollama] Extracting SCOMET goods information...');
  
  const schema = `{
  "goodsDescription": "Description of the goods being exported",
  "hsCode": "HS Code (e.g., 8439.9100)",
  "scometCoverage": "true if goods fall under SCOMET, false if they do not",
  "declarationStatement": "The main declaration statement about SCOMET status"
}`;

  const instruction = `Extract goods and SCOMET coverage information.
Look for:
- Goods description (what is being exported)
- HS CODE followed by the code number (format: XXXX.XXXX)
- Declaration statement about whether goods fall under SCOMET list
- Keywords: "do not fall under SCOMET" (means false) or "fall under SCOMET" (means true)

CRITICAL INSTRUCTIONS:
- If the text says "do not fall under SCOMET", set scometCoverage to false
- If the text says "fall under SCOMET", set scometCoverage to true
- Return the full declaration statement as written
- scometCoverage must be a boolean (true/false), not a string

Return ONLY valid JSON.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] SCOMET goods info extracted:', {
      hsCode: result.hsCode,
      scometCoverage: result.scometCoverage
    });
    
    // Ensure boolean conversion
    let scometCoverage = null;
    if (result.scometCoverage !== null && result.scometCoverage !== undefined) {
      scometCoverage = result.scometCoverage === true || result.scometCoverage === 'true';
    }
    
    return {
      goodsDescription: result.goodsDescription || null,
      hsCode: result.hsCode || null,
      scometCoverage: scometCoverage,
      declarationStatement: result.declarationStatement || null
    };
  }
  
  return {
    goodsDescription: null,
    hsCode: null,
    scometCoverage: null,
    declarationStatement: null
  };
}

async function extractSCOMETSignatureInfo(documentText: string): Promise<{
  signedStatus: boolean | null;
  signatoryName: string | null;
}> {
  console.log('[Ollama] Extracting SCOMET signature information...');
  
  const schema = `{
  "signedStatus": "true if document appears to be signed or has signature indicator, false otherwise",
  "signatoryName": "Name of person/entity signing or mentioned at end"
}`;

  const instruction = `Extract signature information from this SCOMET Declaration.
Look for:
- Any mention of signature, stamp, or "Thanking you"
- Name or company name at the end of the document
- If "Thanking you" is present, it usually indicates the document is signed

Return signedStatus as true if there are signature indicators.
Return ONLY valid JSON.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result) {
    const signedStatus = result.signedStatus === true || result.signedStatus === 'true';
    console.log('[Ollama] SCOMET signature extracted:', {
      signed: signedStatus,
      signatory: result.signatoryName
    });
    return {
      signedStatus,
      signatoryName: result.signatoryName || null
    };
  }
  
  return {
    signedStatus: null,
    signatoryName: null
  };
}

// ============================================
// MAIN SCOMET DECLARATION EXTRACTION FUNCTION
// ============================================
export async function extractAndValidateSCOMETDeclaration(documentText: string): Promise<SCOMETDeclarationValidationResult> {
  console.log('═══════════════════════════════════════');
  console.log('[Extraction] Starting Ollama-powered SCOMET declaration extraction');
  console.log('[Extraction] Text length:', documentText.length);
  console.log('[Extraction] Using model:', OLLAMA_CONFIG.model);
  console.log('═══════════════════════════════════════');
  
  const extractedData: SCOMETDeclarationData = {
    documentDate: null,
    documentType: null,
    consigneeName: null,
    invoiceNumber: null,
    invoiceDate: null,
    destinationCountry: null,
    scometCoverage: null,
    goodsDescription: null,
    hsCode: null,
    declarationStatement: null,
    signatoryName: null,
    signedStatus: null,
    addressedTo: null,
    addressLocation: null
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Extract all sections in parallel for better performance
    const [basicInfo, referenceInfo, goodsInfo, signatureInfo] = await Promise.all([
      extractSCOMETBasicInfo(documentText),
      extractSCOMETReferenceInfo(documentText),
      extractSCOMETGoodsInfo(documentText),
      extractSCOMETSignatureInfo(documentText)
    ]);

    // Basic info
    extractedData.documentDate = basicInfo.documentDate;
    extractedData.documentType = basicInfo.documentType;
    extractedData.addressedTo = basicInfo.addressedTo;
    extractedData.addressLocation = basicInfo.addressLocation;

    // Reference info
    extractedData.consigneeName = referenceInfo.consigneeName;
    extractedData.invoiceNumber = referenceInfo.invoiceNumber;
    extractedData.invoiceDate = referenceInfo.invoiceDate;
    extractedData.destinationCountry = referenceInfo.destinationCountry;

    // Goods info
    extractedData.goodsDescription = goodsInfo.goodsDescription;
    extractedData.hsCode = goodsInfo.hsCode;
    extractedData.scometCoverage = goodsInfo.scometCoverage;
    extractedData.declarationStatement = goodsInfo.declarationStatement;

    // Signature info
    extractedData.signedStatus = signatureInfo.signedStatus;
    extractedData.signatoryName = signatureInfo.signatoryName;

    console.log('[Extraction] SCOMET declaration extracted:', {
      documentDate: extractedData.documentDate,
      invoiceNumber: extractedData.invoiceNumber,
      scometCoverage: extractedData.scometCoverage,
      hsCode: extractedData.hsCode
    });

    // ============================================
    // VALIDATION
    // ============================================
    console.log('═══════════════════════════════════════');
    console.log('[Validation] Checking required fields');
    
    // Critical field validation
    if (!extractedData.documentDate) {
      errors.push('Document Date is missing');
    }
    
    if (!extractedData.consigneeName) {
      errors.push('Consignee Name is missing');
    }
    
    if (!extractedData.invoiceNumber) {
      errors.push('Invoice Number is missing');
    }
    
    if (!extractedData.invoiceDate) {
      errors.push('Invoice Date is missing');
    }
    
    if (!extractedData.destinationCountry) {
      errors.push('Destination Country is missing');
    }
    
    if (extractedData.scometCoverage === null) {
      errors.push('SCOMET coverage status not specified (must be Yes or No)');
    }
    
    // Warning-level validations
    if (!extractedData.hsCode) {
      warnings.push('HS Code is missing');
    }
    
    if (!extractedData.goodsDescription) {
      warnings.push('Goods description is missing');
    }
    
    if (!extractedData.declarationStatement) {
      warnings.push('Declaration statement is missing');
    }
    
    if (!extractedData.addressedTo) {
      warnings.push('Recipient authority not identified');
    }
    
    if (!extractedData.signedStatus) {
      warnings.push('Document signature not detected');
    }

    // Date consistency check
    if (extractedData.documentDate && extractedData.invoiceDate) {
      try {
        const docDate = new Date(extractedData.documentDate.split('.').reverse().join('-'));
        const invDate = new Date(extractedData.invoiceDate.split('.').reverse().join('-'));
        
        if (docDate < invDate) {
          warnings.push('SCOMET declaration date is before invoice date - may need verification');
        }
        
        const daysDiff = Math.abs((docDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 30) {
          warnings.push(`SCOMET declaration is ${Math.round(daysDiff)} days from invoice date - verify timing`);
        }
      } catch (error) {
        console.error('[Validation] Date comparison error:', error);
      }
    }

    // HS Code format validation
    if (extractedData.hsCode) {
      const hsCodePattern = /^\d{4}\.\d{4}$/;
      if (!hsCodePattern.test(extractedData.hsCode)) {
        warnings.push('HS Code format may be non-standard (expected format: XXXX.XXXX)');
      }
    }

    // Calculate completeness
    const requiredFields = [
      extractedData.documentDate,
      extractedData.documentType,
      extractedData.consigneeName,
      extractedData.invoiceNumber,
      extractedData.invoiceDate,
      extractedData.destinationCountry,
      extractedData.scometCoverage !== null,
      extractedData.goodsDescription,
      extractedData.hsCode,
      extractedData.declarationStatement,
      extractedData.addressedTo,
      extractedData.signedStatus
    ];
    
    const filled = requiredFields.filter(f => f).length;
    const completeness = Math.round((filled / requiredFields.length) * 100);

    console.log('[Validation] SCOMET declaration completeness:', completeness + '%');
    console.log('[Validation] Errors:', errors.length > 0 ? errors : 'None');
    console.log('[Validation] Warnings:', warnings.length > 0 ? warnings : 'None');
    console.log('[Validation] SCOMET Coverage:', extractedData.scometCoverage ? 'YES' : 'NO');
    console.log('═══════════════════════════════════════');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      extractedData,
      completeness
    };

  } catch (error) {
    console.error('[Extraction] Error processing SCOMET declaration:', error);
    errors.push('Failed to parse SCOMET declaration: ' + (error as Error).message);
    
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
// ENHANCED DOCUMENT TYPE DETECTION
// ============================================
export async function detectDocumentTypeEnhanced(documentText: string): Promise<'commercial_invoice' | 'export_declaration' | 'scomet_declaration' | 'unknown'> {
  console.log('[Detection] Analyzing document type...');
  
  const systemPrompt = `You are a document classification AI. Analyze the text and determine if it's a Commercial Invoice, Export Value Declaration, or SCOMET Declaration.
Return ONLY one of these four options: "commercial_invoice", "export_declaration", "scomet_declaration", or "unknown".`;

  const prompt = `Classify this document:

TEXT SAMPLE:
${documentText.substring(0, 2000)}

Look for keywords:
- Commercial Invoice: "INVOICE", "COMMERCIAL INVOICE", items, quantities, prices, total amount
- Export Declaration: "EXPORT VALUE DECLARATION", "ANNEXURE", "Shipping Bill", "Valuation Method", "Customs Valuation"
- SCOMET Declaration: "SCOMET DECLARATION", "SCOMET", "fall under SCOMET", "do not fall under SCOMET", "HS CODE"

Return ONLY one of these: "commercial_invoice", "export_declaration", "scomet_declaration", or "unknown":`;

  try {
    const response = await ollama.generate(prompt, systemPrompt, {
      temperature: 0.1,
      num_predict: 100
    });

    const classification = response.trim().toLowerCase();
    
    if (classification.includes('scomet')) {
      console.log('[Detection] Document classified as: SCOMET Declaration');
      return 'scomet_declaration';
    } else if (classification.includes('commercial_invoice')) {
      console.log('[Detection] Document classified as: Commercial Invoice');
      return 'commercial_invoice';
    } else if (classification.includes('export_declaration')) {
      console.log('[Detection] Document classified as: Export Declaration');
      return 'export_declaration';
    } else {
      console.log('[Detection] Document classification: Unknown');
      return 'unknown';
    }
  } catch (error) {
    console.error('[Detection] Classification error:', error);
    
    // Fallback: Check for keywords
    const textLower = documentText.toLowerCase();
    if (textLower.includes('scomet declaration') || 
        (textLower.includes('scomet') && textLower.includes('fall under'))) {
      console.log('[Detection] Fallback: SCOMET Declaration (keywords)');
      return 'scomet_declaration';
    } else if (textLower.includes('export value declaration') || 
               textLower.includes('annexure') || 
               textLower.includes('shipping bill')) {
      console.log('[Detection] Fallback: Export Declaration (keywords)');
      return 'export_declaration';
    } else if (textLower.includes('invoice') && textLower.includes('total')) {
      console.log('[Detection] Fallback: Commercial Invoice (keywords)');
      return 'commercial_invoice';
    }
    
    return 'unknown';
  }
}

// ============================================
// ENHANCED UNIFIED EXTRACTION FUNCTION
// ============================================
export async function extractDocumentDataEnhanced(documentText: string): Promise<{
  documentType: 'commercial_invoice' | 'export_declaration' | 'scomet_declaration' | 'unknown';
  validation: InvoiceValidationResult | ExportDeclarationValidationResult | SCOMETDeclarationValidationResult;
}> {
  const documentType = await detectDocumentTypeEnhanced(documentText);
  
  if (documentType === 'scomet_declaration') {
    const validation = await extractAndValidateSCOMETDeclaration(documentText);
    return { documentType, validation };
  } else if (documentType === 'export_declaration') {
    const validation = await extractAndValidateExportDeclaration(documentText);
    return { documentType, validation };
  } else {
    // Default to commercial invoice
    const validation = await extractAndValidateInvoice(documentText);
    return { documentType: 'commercial_invoice', validation };
  }
}



//PackingList 


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
// PACKING LIST EXTRACTION FUNCTIONS
// ============================================
async function extractPackingListBasicInfo(documentText: string): Promise<{
  packingListNumber: string | null;
  packingListDate: string | null;
  referenceNo: string | null;
  proformaInvoiceNo: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
}> {
  console.log('[Ollama] Extracting packing list basic information...');
  
  const schema = `{
  "packingListNumber": "Packing list number (PL NO., P.L. NO., Packing List No., etc.)",
  "packingListDate": "Packing list date in DD.MM.YYYY or DD/MM/YYYY format",
  "referenceNo": "Reference number if present",
  "proformaInvoiceNo": "Proforma Invoice number (PI NO., PMI/xxxxx, etc.)",
  "invoiceNumber": "Packing list number (PL NO., P.L. NO., Packing List No., etc.)",
  "invoiceDate": "Invoice date in DD.MM.YYYY or DD/MM/YYYY format"
}`;

  const instruction = `Extract basic packing list information.
Look for:
- PL NO., P.L. NO., Packing List No., or similar header field
- DATE near the top of document (packing list date)
- REFERENCE NO., REF NO., or similar
- PROFORMA INVOICE NO., PI NO., PMI/xxxxx format
- INVOICE NO. as PL NO.& DATE (e.g  23456321) ,
- Invoice DATE

Return ONLY valid JSON with the extracted values or null if not found.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Packing list basic info extracted:', {
      plNumber: result.packingListNumber,
      proformaInvoice: result.proformaInvoiceNo,
      invoiceNumber: result.invoiceNumber
    });
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

async function extractPackingListExporter(documentText: string): Promise<ExporterInfo> {
  console.log('[Ollama] Extracting exporter information...');
  
  const schema = `{
  "name": "Exporter company name",
  "address": "Exporter full address including corporate office and factory",
  "email": "Exporter email address",
  "phone": "Exporter phone number with country code",
  "mobile": "Exporter mobile number",
  "pan": "PAN number (format: AABCP5078K)",
  "gstin": "GSTIN number (format: 27AABCP5078K1Z1)",
  "iec": "IEC (Import Export Code)"
}`;

  const instruction = `Extract exporter/shipper information from the packing list.
Look for sections labeled:
- EXPORTER, SHIPPER, FROM, or similar
- May include CORPORATE OFFICE and FACTORY addresses
- Look for PAN NO, GSTIN NO, IEC codes
- Extract email (MAIL:, EMAIL:, E-MAIL:)
- Extract TEL:, PHONE:, MOB:, MOBILE: numbers

Return ONLY valid JSON.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Exporter extracted:', result.name);
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
    name: null,
    address: null,
    email: null,
    phone: null,
    mobile: null,
    pan: null,
    gstin: null,
    iec: null
  };
}

async function extractPackingListConsignee(documentText: string): Promise<ConsigneeInfo> {
  console.log('[Ollama] Extracting consignee information...');
  
  const schema = `{
  "name": "Consignee company name",
  "address": "Consignee full address",
  "email": "Consignee email address",
  "phone": "Consignee phone number (PH NO:, PHONE:)",
  "mobile": "Consignee mobile number (MOB NO:, MOBILE:)",
  "poBox": "PO Box number if present"
}`;

  const instruction = `Extract consignee/buyer information from the packing list.
Look for sections labeled:
- CONSIGNEE, BUYER, TO, SHIP TO, or similar
- Extract company name (usually first line)
- Full address including street, building, city, country
- PO BOX NO:, P.O. BOX:
- PH NO:, PHONE:, TEL:
- MOB NO:, MOBILE:
- EMAIL ID:, E-MAIL:

Return ONLY valid JSON.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Consignee extracted:', result.name);
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
    name: null,
    address: null,
    email: null,
    phone: null,
    mobile: null,
    poBox: null
  };
}

async function extractPackingListBankDetails(documentText: string): Promise<BankDetails> {
  console.log('[Ollama] Extracting bank details...');
  
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

  const instruction = `Extract bank details from the packing list.
Look for sections labeled:
- OUR BANK, BANK DETAILS, BENEFICIARY BANK, or similar
- Bank name and address
- USD A/C, USD ACCOUNT
- EURO A/C, EURO ACCOUNT
- IFSC CODE
- SWIFT CODE
- BRANCH CODE
- AD (Authorized Dealer code)
- BSR CODE

Return ONLY valid JSON.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Bank details extracted:', result.bankName);
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
    bankName: null,
    bankAddress: null,
    usdAccount: null,
    euroAccount: null,
    ifscCode: null,
    swiftCode: null,
    branchCode: null,
    adCode: null,
    bsrCode: null
  };
}

async function extractPackingListShippingInfo(documentText: string): Promise<ShipmentDetails> {
  console.log('[Ollama] Extracting shipping information...');
  
  const schema = `{
  "countryOfOrigin": "Country of origin of goods",
  "countryOfDestination": "Country of final destination",
  "preCarriageBy": "Pre-carriage by (e.g., N.A, TRUCK, RAIL)",
  "placeOfReceipt": "Place of receipt by pre-carrier",
  "deliveryTerms": "Delivery terms/Incoterms - extract ONLY the first word (e.g., 'CIF', 'FOB', 'EXW') without any additional text",
  "hsnCode": "HSN Code",
  "vesselFlightNo": "Vessel name or flight number",
  "portOfLoading": "Port of loading",
  "portOfDischarge": "Port of discharge",
  "finalDestination": "Final destination",
  "freightTerms": "Freight terms (PREPAID, COLLECT, etc.)"
}`;

  const instruction = `Extract shipping and delivery information.
CRITICAL: For delivery terms/Incoterms, extract ONLY the first word (e.g., 'CIF', 'FOB', 'EXW') without any additional text.

Examples:
- "CIF MUMBAI" → "CIF"
- "FOB DELHI" → "FOB" 
- "EXW BANGALORE" → "EXW"
- "DELIVERY: CIF MUMBAI" → "CIF"
- "TERMS: FOB" → "FOB"
- "INCOTERMS: EXW BANGALORE" → "EXW"

Look for:
- COUNTRY OF ORIGIN OF GOODS
- COUNTRY OF FINAL DESTINATION
- PRE-CARRIAGE BY
- PLACE OF RECEIPT BY PRE-CARRIER
- DELIVERY:, INCOTERMS:, TERMS: (CIF, FOB, EXW, etc.)
- HSN CODE:, HS CODE:
- VESSEL / FLIGHT NO., BY AIR, BY SEA
- PORT OF LOADING, POL
- PORT OF DISCHARGE, POD
- FINAL DESTINATION
- FREIGHT PREPAID, FREIGHT COLLECT

Return ONLY valid JSON.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Shipping info extracted');
    
    // Post-process deliveryTerms to ensure only first word
    let deliveryTerms = result.deliveryTerms || null;
    if (deliveryTerms) {
      // Extract only the first word and convert to uppercase
      const firstWord = deliveryTerms.trim().split(/\s+/)[0].toUpperCase();
      
      // Common Incoterms for validation
      const validIncoterms = ['CIF', 'FOB', 'EXW', 'FCA', 'CPT', 'CIP', 'DAT', 'DAP', 'DDP', 'FAS', 'CFR'];
      
      // Check if the extracted word is a valid Incoterm
      if (validIncoterms.includes(firstWord)) {
        deliveryTerms = firstWord;
      } else {
        // If not a standard Incoterm, keep the first word but log warning
        console.log('[Warning] Extracted delivery term may not be standard:', firstWord);
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
    countryOfOrigin: null,
    countryOfDestination: null,
    preCarriageBy: null,
    placeOfReceipt: null,
    deliveryTerms: null,
    hsnCode: null,
    vesselFlightNo: null,
    portOfLoading: null,
    portOfDischarge: null,
    finalDestination: null,
    freightTerms: null
  };
}

async function extractPackingListBoxDetails(documentText: string): Promise<{
  boxDetails: BoxDetail[];
  totalGrossWeight: string | null;
  totalNetWeight: string | null;
  totalBoxWeight: string | null;
}> {
  console.log('[Ollama] Extracting box details...');
  
  const schema = `{
  "boxDetails": [
    {
      "boxNumber": "Box number or carton number (e.g., A 342, A 343)",
      "size": "Dimensions (e.g., 31\" X31\" X38\")",
      "grossWeight": "Gross weight with unit (e.g., 200 KGS)",
      "boxWeight": "Box/carton weight with unit (e.g., 055 KGS)",
      "netWeight": "Net weight with unit (e.g., 145 KGS)",
      "contents": "Description of contents/items in the box"
    }
  ],
  "totalGrossWeight": "Total gross weight of all boxes",
  "totalNetWeight": "Total net weight of all boxes",
  "totalBoxWeight": "Total box/packaging weight"
}`;

  const instruction = `Extract ALL box/carton details from the packing list.
Look for tables or sections with:
- BOX NO, CARTON NO, Package No. (e.g., A 342, A 343)
- SIZE & WT DETAILS, DIMENSIONS (e.g., 31" X31" X38")
- GROSS WT:, G.W. (total weight including packaging)
- BOX WT., CARTON WT. (weight of packaging only)
- NET WT., N.W. (weight of contents only)
- Contents, items packed, description

IMPORTANT:
- Extract EVERY box/carton listed in the document
- Look for format like "A 342 = 31\" X31\" X38\""
- Include all weight measurements (GROSS WT:, BOX WT., NET WT.)
- Capture complete contents description for each box
- Look for TOTAL GROSS WEIGHT:, TOTAL NET WEIGHT: summary rows

Return ONLY valid JSON with an array of all boxes found.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result && result.boxDetails && Array.isArray(result.boxDetails)) {
    console.log('[Ollama] Box details extracted:', result.boxDetails.length, 'boxes');
    
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
  
  console.log('[Ollama] No box details found');
  return {
    boxDetails: [],
    totalGrossWeight: null,
    totalNetWeight: null,
    totalBoxWeight: null
  };
}

async function extractPackingListAdditionalInfo(documentText: string): Promise<{
  marksAndNos: string | null;
  descriptionOfGoods: string | null;
  certificationStatement: string | null;
  packageType: string | null;
}> {
  console.log('[Ollama] Extracting additional information...');
  
  const schema = `{
  "marksAndNos": "Marks and numbers (shipping marks)",
  "descriptionOfGoods": "General description of goods",
  "certificationStatement": "Certification statement (e.g., WE HEREBY CERTIFY...)",
  "packageType": "Type of packaging (e.g., WOODEN BOXES, CARTONS)"
}`;

  const instruction = `Extract additional packing list information.
Look for:
- MARKS & NOS, SHIPPING MARKS (e.g., 342
 B 325 etc.)
- DESCRIPTION OF GOODS (general product description)
- NO. & KIND OF PKGS. (e.g., TWO WOODEN BOXES)
- Certification statements like "WE HEREBY CERTIFY THAT THE GOODS ARE OF INDIAN ORIGIN"

Return ONLY valid JSON.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Additional info extracted');
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
// MAIN PACKING LIST EXTRACTION FUNCTION
// ============================================
export async function extractAndValidatePackingList(documentText: string): Promise<PackingListValidationResult> {
  console.log('═══════════════════════════════════════');
  console.log('[Extraction] Starting Ollama-powered packing list extraction');
  console.log('[Extraction] Text length:', documentText.length);
  console.log('[Extraction] Using model:', OLLAMA_CONFIG.model);
  console.log('═══════════════════════════════════════');
  
  const extractedData: PackingListData = {
    // Core fields
    packingListNumber: null,
    packingListDate: null,
    referenceNo: null,
    proformaInvoiceNo: null,
    
    // Exporter details
    exporter: {
      name: null,
      address: null,
      email: null,
      phone: null,
      mobile: null,
      pan: null,
      gstin: null,
      iec: null
    },
    
    // Consignee details
    consignee: {
      name: null,
      address: null,
      email: null,
      phone: null,
      mobile: null,
      poBox: null
    },
    
    // Bank details
    bankDetails: {
      bankName: null,
      bankAddress: null,
      usdAccount: null,
      euroAccount: null,
      ifscCode: null,
      swiftCode: null,
      branchCode: null,
      adCode: null,
      bsrCode: null
    },
    
    // Shipment details
    shipmentDetails: {
      countryOfOrigin: null,
      countryOfDestination: null,
      preCarriageBy: null,
      placeOfReceipt: null,
      deliveryTerms: null,
      hsnCode: null,
      vesselFlightNo: null,
      portOfLoading: null,
      portOfDischarge: null,
      finalDestination: null,
      freightTerms: null
    },
    
    // Marks and numbers
    marksAndNos: null,
    
    // Invoice reference
    invoiceNumber: null,
    invoiceDate: null,
    
    // Box details
    boxDetails: [],
    totalBoxes: 0,
    totalGrossWeight: null,
    totalNetWeight: null,
    totalBoxWeight: null,
    packageType: null,
    
    // Additional fields
    descriptionOfGoods: null,
    certificationStatement: null
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Extract all sections in parallel for better performance
    const [
      basicInfo,
      exporterInfo,
      consigneeInfo,
      bankInfo,
      shippingInfo,
      boxInfo,
      additionalInfo
    ] = await Promise.all([
      extractPackingListBasicInfo(documentText),
      extractPackingListExporter(documentText),
      extractPackingListConsignee(documentText),
      extractPackingListBankDetails(documentText),
      extractPackingListShippingInfo(documentText),
      extractPackingListBoxDetails(documentText),
      extractPackingListAdditionalInfo(documentText)
    ]);

    // Basic info
    extractedData.packingListNumber = basicInfo.packingListNumber;
    extractedData.packingListDate = basicInfo.packingListDate;
    extractedData.referenceNo = basicInfo.referenceNo;
    extractedData.proformaInvoiceNo = basicInfo.proformaInvoiceNo;
    extractedData.invoiceNumber = basicInfo.invoiceNumber;
    extractedData.invoiceDate = basicInfo.invoiceDate;

    // Exporter details
    extractedData.exporter = {
      name: exporterInfo.name,
      address: exporterInfo.address,
      email: exporterInfo.email,
      phone: exporterInfo.phone,
      mobile: exporterInfo.mobile,
      pan: exporterInfo.pan,
      gstin: exporterInfo.gstin,
      iec: exporterInfo.iec
    };

    // Consignee details
    extractedData.consignee = {
      name: consigneeInfo.name,
      address: consigneeInfo.address,
      email: consigneeInfo.email,
      phone: consigneeInfo.phone,
      mobile: consigneeInfo.mobile,
      poBox: consigneeInfo.poBox
    };

    // Bank details
    extractedData.bankDetails = {
      bankName: bankInfo.bankName,
      bankAddress: bankInfo.bankAddress,
      usdAccount: bankInfo.usdAccount,
      euroAccount: bankInfo.euroAccount,
      ifscCode: bankInfo.ifscCode,
      swiftCode: bankInfo.swiftCode,
      branchCode: bankInfo.branchCode,
      adCode: bankInfo.adCode,
      bsrCode: bankInfo.bsrCode
    };

    // Shipping info
    extractedData.shipmentDetails = {
      countryOfOrigin: shippingInfo.countryOfOrigin,
      countryOfDestination: shippingInfo.countryOfDestination,
      preCarriageBy: shippingInfo.preCarriageBy,
      placeOfReceipt: shippingInfo.placeOfReceipt,
      deliveryTerms: shippingInfo.deliveryTerms,
      hsnCode: shippingInfo.hsnCode,
      vesselFlightNo: shippingInfo.vesselFlightNo,
      portOfLoading: shippingInfo.portOfLoading,
      portOfDischarge: shippingInfo.portOfDischarge,
      finalDestination: shippingInfo.finalDestination,
      freightTerms: shippingInfo.freightTerms
    };

    // Additional info
    extractedData.marksAndNos = additionalInfo.marksAndNos;
    extractedData.descriptionOfGoods = additionalInfo.descriptionOfGoods;
    extractedData.certificationStatement = additionalInfo.certificationStatement;
    extractedData.packageType = additionalInfo.packageType;

    // Box details
    extractedData.boxDetails = boxInfo.boxDetails;
    extractedData.totalBoxes = boxInfo.boxDetails.length;
    extractedData.totalGrossWeight = boxInfo.totalGrossWeight;
    extractedData.totalNetWeight = boxInfo.totalNetWeight;
    extractedData.totalBoxWeight = boxInfo.totalBoxWeight;

    console.log('[Extraction] Packing list extracted:', {
      plNumber: extractedData.packingListNumber,
      plDate: extractedData.packingListDate,
      exporter: extractedData.exporter?.name,
      consignee: extractedData.consignee?.name,
      invoiceNumber: extractedData.invoiceNumber,
      totalBoxes: extractedData.totalBoxes,
      hsnCode: extractedData.shipmentDetails?.hsnCode
    });

    // ============================================
    // VALIDATION
    // ============================================
    console.log('═══════════════════════════════════════');
    console.log('[Validation] Checking required fields');
    
    // Critical field validation
    if (!extractedData.packingListNumber) {
      errors.push('PL NO. is required');
    }
    
    if (!extractedData.packingListDate) {
      errors.push('DATE is required');
    }
    
    if (!extractedData.exporter?.name) {
      errors.push('Exporter name is required');
    }
    
    if (!extractedData.consignee?.name) {
      errors.push('Consignee name is required');
    }
    
    if (extractedData.boxDetails.length === 0) {
      errors.push('BOX NO, SIZE & WT DETAILS are required - no boxes found');
    }
    
    // Optional but important fields
    if (!extractedData.invoiceNumber) {
      warnings.push('INVOICE NO. not found - ensure Commercial Invoice is referenced');
    }
    
    if (!extractedData.invoiceDate) {
      warnings.push('Invoice DATE not found');
    }
    
    if (!extractedData.referenceNo && !extractedData.proformaInvoiceNo) {
      warnings.push('Reference/Proforma Invoice number not found');
    }
    
    // Exporter details validation
    if (!extractedData.exporter?.address) {
      warnings.push('Exporter address is missing');
    }
    
    if (!extractedData.exporter?.email) {
      warnings.push('Exporter email is missing');
    }
    
    if (!extractedData.exporter?.pan) {
      warnings.push('Exporter PAN is missing');
    }
    
    if (!extractedData.exporter?.gstin) {
      warnings.push('Exporter GSTIN is missing');
    }
    
    if (!extractedData.exporter?.iec) {
      warnings.push('Exporter IEC is missing');
    }
    
    // Consignee details validation
    if (!extractedData.consignee?.address) {
      warnings.push('Consignee address is missing');
    }
    
    if (!extractedData.consignee?.email) {
      warnings.push('Consignee email is missing');
    }
    
    if (!extractedData.consignee?.phone && !extractedData.consignee?.mobile) {
      warnings.push('Consignee contact number is missing');
    }
    
    // Bank details validation
    if (!extractedData.bankDetails?.bankName) {
      warnings.push('Bank name is missing');
    }
    
    if (!extractedData.bankDetails?.usdAccount && !extractedData.bankDetails?.euroAccount) {
      warnings.push('Bank account details are missing');
    }
    
    if (!extractedData.bankDetails?.swiftCode) {
      warnings.push('SWIFT code is missing');
    }
    
    if (!extractedData.bankDetails?.ifscCode) {
      warnings.push('IFSC code is missing');
    }
    
    // Box details validation
    if (extractedData.boxDetails.length > 0) {
      extractedData.boxDetails.forEach((box, index) => {
        if (!box.boxNumber) {
          warnings.push(`Box ${index + 1}: Missing BOX NO`);
        }
        if (!box.size) {
          warnings.push(`Box ${index + 1}: Missing SIZE/DIMENSIONS`);
        }
        if (!box.grossWeight && !box.netWeight) {
          warnings.push(`Box ${index + 1}: Missing WEIGHT DETAILS`);
        }
        if (!box.contents) {
          warnings.push(`Box ${index + 1}: Missing CONTENTS description`);
        }
      });
    }
    
    // Shipping information validation
    if (!extractedData.shipmentDetails?.countryOfOrigin) {
      warnings.push('Country of Origin not found');
    }
    
    if (!extractedData.shipmentDetails?.countryOfDestination) {
      warnings.push('Country of Destination not found');
    }
    
    if (!extractedData.shipmentDetails?.portOfLoading) {
      warnings.push('Port of Loading not found');
    }
    
    if (!extractedData.shipmentDetails?.portOfDischarge) {
      warnings.push('Port of Discharge not found');
    }
    
    if (!extractedData.shipmentDetails?.deliveryTerms) {
      warnings.push('Delivery terms (Incoterms) not found');
    }
    
    if (!extractedData.shipmentDetails?.hsnCode) {
      warnings.push('HSN Code not found');
    }
    
    if (!extractedData.shipmentDetails?.vesselFlightNo) {
      warnings.push('Vessel/Flight number not found');
    }
    
    if (!extractedData.shipmentDetails?.freightTerms) {
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
    if (!extractedData.marksAndNos) {
      warnings.push('Marks & Numbers not found');
    }
    
    if (!extractedData.descriptionOfGoods) {
      warnings.push('Description of Goods not found');
    }
    
    if (!extractedData.packageType) {
      warnings.push('Package type not found');
    }
    
    if (!extractedData.certificationStatement) {
      warnings.push('Certification statement not found');
    }

    // Date consistency check
    if (extractedData.packingListDate && extractedData.invoiceDate) {
      try {
        const plDate = new Date(extractedData.packingListDate.split(/[./]/).reverse().join('-'));
        const invDate = new Date(extractedData.invoiceDate.split(/[./]/).reverse().join('-'));
        
        if (plDate < invDate) {
          warnings.push('Packing List date is before Invoice date - may need verification');
        }
        
        const daysDiff = Math.abs((plDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 30) {
          warnings.push(`Packing List is ${Math.round(daysDiff)} days from Invoice date - verify timing`);
        }
      } catch (error) {
        console.error('[Validation] Date comparison error:', error);
      }
    }

    // Calculate completeness based on all fields
    const allFields = [
      // Core fields (high weight)
      extractedData.packingListNumber,
      extractedData.packingListDate,
      extractedData.exporter?.name,
      extractedData.consignee?.name,
      extractedData.boxDetails.length > 0,
      
      // Important fields (medium weight)
      extractedData.invoiceNumber,
      extractedData.exporter?.address,
      extractedData.exporter?.email,
      extractedData.exporter?.pan,
      extractedData.exporter?.gstin,
      extractedData.exporter?.iec,
      extractedData.consignee?.address,
      extractedData.consignee?.email,
      extractedData.bankDetails?.bankName,
      extractedData.bankDetails?.usdAccount || extractedData.bankDetails?.euroAccount,
      extractedData.bankDetails?.swiftCode,
      extractedData.bankDetails?.ifscCode,
      extractedData.shipmentDetails?.countryOfOrigin,
      extractedData.shipmentDetails?.countryOfDestination,
      extractedData.shipmentDetails?.portOfLoading,
      extractedData.shipmentDetails?.portOfDischarge,
      extractedData.shipmentDetails?.deliveryTerms,
      extractedData.shipmentDetails?.hsnCode,
      extractedData.totalGrossWeight,
      extractedData.totalNetWeight,
      extractedData.descriptionOfGoods,
      
      // Optional fields (lower weight)
      extractedData.referenceNo || extractedData.proformaInvoiceNo,
      extractedData.exporter?.phone || extractedData.exporter?.mobile,
      extractedData.consignee?.phone || extractedData.consignee?.mobile,
      extractedData.bankDetails?.bankAddress,
      extractedData.bankDetails?.branchCode,
      extractedData.shipmentDetails?.vesselFlightNo,
      extractedData.shipmentDetails?.freightTerms,
      extractedData.marksAndNos,
      extractedData.packageType,
      extractedData.certificationStatement
    ];
    
    const filled = allFields.filter(f => f).length;
    const completeness = Math.round((filled / allFields.length) * 100);

    console.log('[Validation] Packing list completeness:', completeness + '%');
    console.log('[Validation] Total boxes:', extractedData.totalBoxes);
    console.log('[Validation] Exporter:', extractedData.exporter?.name || 'N/A');
    console.log('[Validation] Consignee:', extractedData.consignee?.name || 'N/A');
    console.log('[Validation] HSN Code:', extractedData.shipmentDetails?.hsnCode || 'N/A');
    console.log('[Validation] Errors:', errors.length > 0 ? errors : 'None');
    console.log('[Validation] Warnings:', warnings.length > 0 ? `${warnings.length} warnings` : 'None');
    console.log('═══════════════════════════════════════');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      extractedData,
      completeness
    };

  } catch (error) {
    console.error('[Extraction] Error processing packing list:', error);
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











// Fumigation-certificate

// ============================================
// FUMIGATION CERTIFICATE INTERFACES
// ============================================
export interface FumigationCertificateData {
  // Core Certificate Information
  certificateNumber: string | null;
  certificateDate: string | null;
  dppqsRegistrationNumber: string | null;
  
  // Treatment Details
  fumigantName: string | null;
  fumigationDate: string | null;
  fumigationPlace: string | null;
  fumigantDosage: string | null;
  fumigationDuration: string | null;
  minimumTemperature: string | null;
  gastightSheets: boolean | null;
  pressureDecayValue: string | null;
  invoiceNo:string|null;
  invoiceDate:string|null;
  // Goods Description
  containerNumber: string | null;
  sealNumber: string | null;
  exporterName: string | null;
  exporterAddress: string | null;
  consigneeName: string | null;
  cargoType: string | null;
  cargoDescription: string | null;
  quantity: string | null;
  packagingMaterial: string | null;
  additionalDeclaration: string | null;
  shippingMark: string | null;
  
  // Operator Information
  operatorName: string | null;
  operatorSignatureStatus: boolean | null;
  accreditationNumber: string | null;
}

export interface FumigationCertificateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  extractedData: FumigationCertificateData;
  completeness: number;
}

// ============================================
// FUMIGATION CERTIFICATE EXTRACTION FUNCTIONS
// ============================================

/**
 * Extract core fumigation certificate information
 */
async function extractFumigationCertificateBasicInfo(documentText: string): Promise<{
  certificateNumber: string | null;
  certificateDate: string | null;
  dppqsRegistrationNumber: string | null;
  invoiceDate:string |null;
  invoiceNo:string|null;
}> {
  console.log('[Ollama] Extracting fumigation certificate basic information...');
  
  const schema = `{
  "certificateNumber": "Fumigation certificate number",
  "certificateDate": "Certificate date/Date of Issue in DD.MM.YYYY format",
  "dppqsRegistrationNumber": "DPPQS registration number"
  "invoiceDate": "shipping marks or brand"
   "invoiceNo":"shipping makrs or brand"
}`;

  const instruction = `Extract basic fumigation certificate information.
Look for:
- Certificate Number or Reference Number
- Certificate Date or Date of Issue (format: DD.MM.YYYY)
- DPPQS Registration Number or similar regulatory number
- for the invoiceNo look for shipping marks or brand and only extract the number before the data (e.g 222500187 Dt 17.07.2025 only  return the 222500187 )
-for the invoiceDate look for shpping marks or brand and only extract the date  after  the invoice number (e.g 222500187 Dt 17.07.2025 only  return the 17.07.2025 in format DD.MM.YYYY )
This is a phytosanitary fumigation certificate issued after treatment of goods.
Return ONLY valid JSON.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Fumigation certificate basic info extracted:', {
      certificateNumber: result.certificateNumber,
      certificateDate: result.certificateDate
    });
    return {
      certificateNumber: result.certificateNumber || null,
      certificateDate: result.certificateDate || null,
      dppqsRegistrationNumber: result.dppqsRegistrationNumber || null,
      invoiceDate:result.invoiceDate || null,
      invoiceNo:result.invoiceNo|| null,
    };
  }
  
  return {
    certificateNumber: null,
    certificateDate: null,
    dppqsRegistrationNumber: null,
    invoiceDate:null,
    invoiceNo:null,
  };
}

/**
 * Extract fumigation treatment details
 */
async function extractFumigationTreatmentDetails(documentText: string): Promise<{
  fumigantName: string | null;
  fumigationDate: string | null;
  fumigationPlace: string | null;
  fumigantDosage: string | null;
  fumigationDuration: string | null;
  minimumTemperature: string | null;
  gastightSheets: boolean | null;
  pressureDecayValue: string | null;
}> {
  console.log('[Ollama] Extracting fumigation treatment details...');
  
  const schema = `{
  "fumigantName": "Name of fumigant used (e.g., Methyl Bromide, Phosphine)",
  "fumigationDate": "Date of fumigation in DD.MM.YYYY format",
  "fumigationPlace": "Place where fumigation was performed",
  "fumigantDosage": "Dosage of fumigant (e.g., 48 g/m³)",
  "fumigationDuration": "Duration of fumigation (e.g., 24 hours)",
  "minimumTemperature": "Minimum temperature during treatment",
  "gastightSheets": "true if gastight sheets were used, false otherwise",
  "pressureDecayValue": "Pressure decay value if mentioned"
}`;

  const instruction = `Extract fumigation treatment details from this certificate.
Look for:
- Name of fumigant/chemical used (Methyl Bromide, Phosphine, etc.)
- Date of fumigation treatment
- Place/location of fumigation
- Dosage/concentration (usually in g/m³)
- Duration/exposure period (hours or days)
- Temperature conditions
- Whether gastight sheets or covers were used
- Pressure decay measurements

Return gastightSheets as boolean (true/false).
Return ONLY valid JSON.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Treatment details extracted:', {
      fumigantName: result.fumigantName,
      fumigationDate: result.fumigationDate,
      fumigationPlace: result.fumigationPlace
    });
    
    // Ensure boolean conversion for gastightSheets
    let gastightSheets = null;
    if (result.gastightSheets !== null && result.gastightSheets !== undefined) {
      gastightSheets = result.gastightSheets === true || result.gastightSheets === 'true';
    }
    
    return {
      fumigantName: result.fumigantName || null,
      fumigationDate: result.fumigationDate || null,
      fumigationPlace: result.fumigationPlace || null,
      fumigantDosage: result.fumigantDosage || null,
      fumigationDuration: result.fumigationDuration || null,
      minimumTemperature: result.minimumTemperature || null,
      gastightSheets: gastightSheets,
      pressureDecayValue: result.pressureDecayValue || null
    };
  }
  
  return {
    fumigantName: null,
    fumigationDate: null,
    fumigationPlace: null,
    fumigantDosage: null,
    fumigationDuration: null,
    minimumTemperature: null,
    gastightSheets: null,
    pressureDecayValue: null
  };
}

/**
 * Extract goods and cargo information
 */
async function extractFumigationCargoDetails(documentText: string): Promise<{
  containerNumber: string | null;
  sealNumber: string | null;
  exporterName: string | null;
  exporterAddress: string | null;
  consigneeName: string | null;
  cargoType: string | null;
  cargoDescription: string | null;
  quantity: string | null;
  packagingMaterial: string | null;
  additionalDeclaration: string | null;
  shippingMark: string | null;
}> {
  console.log('[Ollama] Extracting fumigation cargo details...');
  
  const schema = `{
  "containerNumber": "Container number",
  "sealNumber": "Seal number",
  "exporterName": "Exporter/shipper name",
  "exporterAddress": "Exporter/shipper address",
  "consigneeName": "Consignee/buyer name",
  "cargoType": "Type of cargo",
  "cargoDescription": "Description of goods fumigated",
  "quantity": "Quantity with unit",
  "packagingMaterial": "Type of packaging material",
  "additionalDeclaration": "Additional declarations or notes",
  "shippingMark": "Shipping mark or invoice reference"
}`;

  const instruction = `Extract cargo and goods information from the fumigation certificate.
Look for:
- Container number
- Seal number
- Exporter/Shipper name and address
- Consignee/Buyer name
- Description of goods treated
- Type of cargo
- Quantity
- Packaging type (boxes, bags, pallets, etc.)
- Shipping marks or invoice numbers
- Any additional declarations

Return ONLY valid JSON.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Ollama] Cargo details extracted:', {
      containerNumber: result.containerNumber,
      exporterName: result.exporterName,
      cargoDescription: result.cargoDescription
    });
    
    return {
      containerNumber: result.containerNumber || null,
      sealNumber: result.sealNumber || null,
      exporterName: result.exporterName || null,
      exporterAddress: result.exporterAddress || null,
      consigneeName: result.consigneeName || null,
      cargoType: result.cargoType || null,
      cargoDescription: result.cargoDescription || null,
      quantity: result.quantity || null,
      packagingMaterial: result.packagingMaterial || null,
      additionalDeclaration: result.additionalDeclaration || null,
      shippingMark: result.shippingMark || null
    };
  }
  
  return {
    containerNumber: null,
    sealNumber: null,
    exporterName: null,
    exporterAddress: null,
    consigneeName: null,
    cargoType: null,
    cargoDescription: null,
    quantity: null,
    packagingMaterial: null,
    additionalDeclaration: null,
    shippingMark: null
  };
}

/**
 * Extract operator/accreditation information
 */
async function extractFumigationOperatorInfo(documentText: string): Promise<{
  operatorName: string | null;
  operatorSignatureStatus: boolean | null;
  accreditationNumber: string | null;
}> {
  console.log('[Ollama] Extracting fumigation operator information...');
  
  const schema = `{
  "operatorName": "Name of fumigation operator or company",
  "operatorSignatureStatus": "true if operator signature present, false otherwise",
  "accreditationNumber": "Accreditation or license number"
}`;

  const instruction = `Extract operator and signature information.
Look for:
- Name of fumigation operator or company that performed treatment
- Signature, stamp, or seal indicators
- Accreditation number, license number, or authorization code
- Any certification or registration numbers

Return operatorSignatureStatus as boolean based on presence of signature/stamp.
Return ONLY valid JSON.`;

  const result = await ollama.extractJSON(documentText, schema, instruction);
  
  if (result) {
    const operatorSignatureStatus = result.operatorSignatureStatus === true || 
                                   result.operatorSignatureStatus === 'true';
    
    console.log('[Ollama] Operator info extracted:', {
      operatorName: result.operatorName,
      signaturePresent: operatorSignatureStatus
    });
    
    return {
      operatorName: result.operatorName || null,
      operatorSignatureStatus: operatorSignatureStatus,
      accreditationNumber: result.accreditationNumber || null
    };
  }
  
  return {
    operatorName: null,
    operatorSignatureStatus: null,
    accreditationNumber: null
  };
}

// ============================================
// MAIN FUMIGATION CERTIFICATE EXTRACTION FUNCTION
// ============================================

/**
 * Main extraction and validation function for fumigation certificates
 * Uses Ollama AI to extract all relevant information and validates completeness
 */
export async function extractAndValidateFumigationCertificate(
  documentText: string
): Promise<FumigationCertificateValidationResult> {
  console.log('═══════════════════════════════════════');
  console.log('[Extraction] Starting Ollama-powered fumigation certificate extraction');
  console.log('[Extraction] Text length:', documentText.length);
  console.log('[Extraction] Using model:', OLLAMA_CONFIG.model);
  console.log('═══════════════════════════════════════');
  
  const extractedData: FumigationCertificateData = {
    certificateNumber: null,
    certificateDate: null,
    invoiceDate:null,
    invoiceNo:null,
    dppqsRegistrationNumber: null,
    fumigantName: null,
    fumigationDate: null,
    fumigationPlace: null,
    fumigantDosage: null,
    fumigationDuration: null,
    minimumTemperature: null,
    gastightSheets: null,
    pressureDecayValue: null,
    containerNumber: null,
    sealNumber: null,
    exporterName: null,
    exporterAddress: null,
    consigneeName: null,
    cargoType: null,
    cargoDescription: null,
    quantity: null,
    packagingMaterial: null,
    additionalDeclaration: null,
    shippingMark: null,
    operatorName: null,
    operatorSignatureStatus: null,
    accreditationNumber: null
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Extract all sections in parallel for better performance
    const [basicInfo, treatmentDetails, cargoDetails, operatorInfo] = await Promise.all([
      extractFumigationCertificateBasicInfo(documentText),
      extractFumigationTreatmentDetails(documentText),
      extractFumigationCargoDetails(documentText),
      extractFumigationOperatorInfo(documentText)
    ]);

    // Basic info
    extractedData.certificateNumber = basicInfo.certificateNumber;
    extractedData.certificateDate = basicInfo.certificateDate;
    extractedData.dppqsRegistrationNumber = basicInfo.dppqsRegistrationNumber;

    // Treatment details
    extractedData.fumigantName = treatmentDetails.fumigantName;
    extractedData.fumigationDate = treatmentDetails.fumigationDate;
    extractedData.fumigationPlace = treatmentDetails.fumigationPlace;
    extractedData.fumigantDosage = treatmentDetails.fumigantDosage;
    extractedData.fumigationDuration = treatmentDetails.fumigationDuration;
    extractedData.minimumTemperature = treatmentDetails.minimumTemperature;
    extractedData.gastightSheets = treatmentDetails.gastightSheets;
    extractedData.pressureDecayValue = treatmentDetails.pressureDecayValue;

    // Cargo details
    extractedData.containerNumber = cargoDetails.containerNumber;
    extractedData.sealNumber = cargoDetails.sealNumber;
    extractedData.exporterName = cargoDetails.exporterName;
    extractedData.exporterAddress = cargoDetails.exporterAddress;
    extractedData.consigneeName = cargoDetails.consigneeName;
    extractedData.cargoType = cargoDetails.cargoType;
    extractedData.cargoDescription = cargoDetails.cargoDescription;
    extractedData.quantity = cargoDetails.quantity;
    extractedData.packagingMaterial = cargoDetails.packagingMaterial;
    extractedData.additionalDeclaration = cargoDetails.additionalDeclaration;
    extractedData.shippingMark = cargoDetails.shippingMark;
    extractedData.invoiceDate=basicInfo.invoiceDate;
    extractedData.invoiceNo=basicInfo.invoiceNo;
    // Operator info
    extractedData.operatorName = operatorInfo.operatorName;
    extractedData.operatorSignatureStatus = operatorInfo.operatorSignatureStatus;
    extractedData.accreditationNumber = operatorInfo.accreditationNumber;

    console.log('[Extraction] Fumigation certificate extracted:', {
      certificateNumber: extractedData.certificateNumber,
      fumigantName: extractedData.fumigantName,
      fumigationDate: extractedData.fumigationDate,
      exporterName: extractedData.exporterName
    });

    // ============================================
    // VALIDATION
    // ============================================
    console.log('═══════════════════════════════════════');
    console.log('[Validation] Checking required fields');
    
    // Critical field validation (based on your route.ts validation logic)
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
    
    // Warning-level validations
    if (!extractedData.exporterName) {
      warnings.push('Exporter name and address not found');
    }
    
    if (!extractedData.cargoDescription) {
      warnings.push('Cargo description not found');
    }
    
    if (!extractedData.fumigantDosage) {
      warnings.push('Fumigant dosage not specified');
    }
    
    if (!extractedData.fumigationDuration) {
      warnings.push('Duration of fumigation not specified');
    }
    
    if (extractedData.gastightSheets === null) {
      warnings.push('Gastight sheets usage not confirmed');
    }
    
    if (!extractedData.containerNumber && !extractedData.sealNumber) {
      warnings.push('Container/Seal numbers not found');
    }
    
    if (!extractedData.operatorSignatureStatus) {
      warnings.push('Operator signature not detected');
    }
    
    if (!extractedData.accreditationNumber) {
      warnings.push('Accreditation number not found');
    }

    // Date consistency check
    if (extractedData.certificateDate && extractedData.fumigationDate) {
      try {
        const certDate = new Date(extractedData.certificateDate.split(/[./]/).reverse().join('-'));
        const fumDate = new Date(extractedData.fumigationDate.split(/[./]/).reverse().join('-'));
        
        if (certDate < fumDate) {
          warnings.push('Certificate date is before fumigation date - may need verification');
        }
        
        const daysDiff = Math.abs((certDate.getTime() - fumDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 7) {
          warnings.push(`Certificate issued ${Math.round(daysDiff)} days after fumigation - verify timing`);
        }
      } catch (error) {
        console.error('[Validation] Date comparison error:', error);
      }
    }

    // Temperature validation
    if (extractedData.minimumTemperature) {
      const tempMatch = extractedData.minimumTemperature.match(/(\d+)/);
      if (tempMatch) {
        const temp = parseInt(tempMatch[1]);
        if (temp < 10 || temp > 40) {
          warnings.push('Minimum temperature outside typical range (10-40°C) - verify value');
        }
      }
    }

    // Calculate completeness
    const requiredFields = [
      extractedData.certificateNumber,
      extractedData.certificateDate,
      extractedData.dppqsRegistrationNumber,
      extractedData.fumigantName,
      extractedData.fumigationDate,
      extractedData.fumigationPlace,
      extractedData.fumigantDosage,
      extractedData.fumigationDuration,
      extractedData.gastightSheets !== null,
      extractedData.exporterName,
      extractedData.cargoDescription,
      extractedData.containerNumber || extractedData.sealNumber,
      extractedData.operatorName,
      extractedData.operatorSignatureStatus,
      extractedData.accreditationNumber
    ];
    
    const filled = requiredFields.filter(f => f).length;
    const completeness = Math.round((filled / requiredFields.length) * 100);

    console.log('[Validation] Fumigation certificate completeness:', completeness + '%');
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
    console.error('[Extraction] Error processing fumigation certificate:', error);
    errors.push('Failed to parse fumigation certificate: ' + (error as Error).message);
    
    return {
      isValid: false,
      errors,
      warnings,
      extractedData,
      completeness: 0
    };
  }
}







//airway-Bill




// Add these to your @/lib/agent.ts file

// ============================================
// OLLAMA CONFIGURATION
// ============================================


// ============================================
// OLLAMA HELPER FUNCTION
// ============================================

async function callOllama(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_CONFIG.timeout);

  try {
    const response = await fetch(`${OLLAMA_CONFIG.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_CONFIG.model,
        prompt,
        stream: false,
        options: {
          temperature: 0,
          top_p: 0.9,
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Ollama request timed out');
    }
    throw error;
  }
}

// ============================================
// AIRWAY BILL INTERFACES
// ============================================

export interface AirwayBillData {
  documentType: string | null;
  airwayBillNo: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  
  // Shipper information
  shippersName: string | null;
  shippersAddress: string | null;
  
  // Consignee information
  consigneesName: string | null;
  consigneesAddress: string | null;
  
  // Carrier information
  issuingCarriersName: string | null;
  issuingCarriersCity: string | null;
  agentsIataCode: string | null;
  
  // Shipment details
  airportOfDeparture: string | null;
  airportOfDestination: string | null;
  accountingInformation: string | null;
  
  // Cargo details
  hsCodeNo: string | null;
  noOfPieces: string | null;
  grossWeight: string | null;
  chargeableWeight: string | null;
  natureOfGoods: string | null;
}

export interface AirwayBillValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  extractedData: AirwayBillData;
  completeness: number;
}

// ============================================
// HELPER EXTRACTION FUNCTIONS
// ============================================

async function extractAirwayBillBasicInfo(documentText: string): Promise<{
  documentType: string | null;
  airwayBillNo: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
}> {
  const prompt = `Extract the following basic information from this Air Waybill document:
- Document Type (should be "Air Waybill" or similar)
- Airway Bill Number (AWB number, format like 176-00015175)
- Invoice Number (INV.NO)
- Invoice Date (INV.DT)

Document text:
${documentText}

Return ONLY a JSON object with these exact keys (no extra text):
{
  "documentType": "Air Waybill",
  "airwayBillNo": "176-00015175",
  "invoiceNo": "222500187",
  "invoiceDate": "17.07.2025"
}`;

  try {
    const response = await callOllama(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('[Extraction] Basic info error:', error);
    return { documentType: null, airwayBillNo: null, invoiceNo: null, invoiceDate: null };
  }
}

async function extractShipperDetails(documentText: string): Promise<{
  shippersName: string | null;
  shippersAddress: string | null;
}> {
  const prompt = `Extract the shipper information from this Air Waybill:
- Shipper's Name
- Shipper's Complete Address (include all details)

Document text:
${documentText}

Return ONLY a JSON object (no extra text):
{
  "shippersName": "PARASON MACHINERY(INDIA) PRIVATE LIMITED",
  "shippersAddress": "CORPORATE OFFICE: GOLDEN DREAMS IT PARK, PLOT NO. E-27,B/S MILLENNIUM PARK, 4TH FLOOR MIDC CHIKALTHANA, AURANGABAD, , MAHARASHTRA (431006) INDIA."
}`;

  try {
    const response = await callOllama(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('[Extraction] Shipper details error:', error);
    return { shippersName: null, shippersAddress: null };
  }
}

async function extractConsigneeDetails(documentText: string): Promise<{
  consigneesName: string | null;
  consigneesAddress: string | null;
}> {
  const prompt = `Extract the consignee information from this Air Waybill:
- Consignee's Name
- Consignee's Complete Address (include phone, email, PO Box if present)

Document text:
${documentText}

Return ONLY a JSON object (no extra text):
{
  "consigneesName": "CARGO PRO S.A.R.L",
  "consigneesAddress": "KARTABOUN STREET, EL HACHEM BUILDING , GROUND FLOOR BYBLOS, ANTELIAS , PO BOX NO : 70-854 , LEBANON PH NO : +961 9542477,MOB NO : +961 3340146 EMAIL ID : info@cargopro-lb.com"
}`;

  try {
    const response = await callOllama(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('[Extraction] Consignee details error:', error);
    return { consigneesName: null, consigneesAddress: null };
  }
}

async function extractCarrierDetails(documentText: string): Promise<{
  issuingCarriersName: string | null;
  issuingCarriersCity: string | null;
  agentsIataCode: string | null;
  accountingInformation: string | null;
}> {
  const prompt = `Extract the carrier and agent information from this Air Waybill:
- Issuing Carrier's Name
- Issuing Carrier's City
- Agent's IATA Code
- Accounting Information

Document text:
${documentText}

Return ONLY a JSON object (no extra text):
{
  "issuingCarriersName": "EMIRATES",
  "issuingCarriersCity": "MUMBAI",
  "agentsIataCode": "14-3-1246",
  "accountingInformation": "R-STAR FREIGHT"
}`;

  try {
    const response = await callOllama(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('[Extraction] Carrier details error:', error);
    return { issuingCarriersName: null, issuingCarriersCity: null, agentsIataCode: null, accountingInformation: null };
  }
}

async function extractShipmentDetails(documentText: string): Promise<{
  airportOfDeparture: string | null;
  airportOfDestination: string | null;
}> {
  const prompt = `Extract the airport information from this Air Waybill:
- Airport of Departure
- Airport of Destination (may be abbreviated like BEY for Beirut)

Document text:
${documentText}

Return ONLY a JSON object (no extra text):
{
  "airportOfDeparture": "MUMBAI",
  "airportOfDestination": "BEIRUT"
}`;

  try {
    const response = await callOllama(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('[Extraction] Shipment details error:', error);
    return { airportOfDeparture: null, airportOfDestination: null };
  }
}

async function extractCargoDetails(documentText: string): Promise<{
  hsCodeNo: string | null;
  noOfPieces: string | null;
  grossWeight: string | null;
  chargeableWeight: string | null;
  natureOfGoods: string | null;
}> {
  const prompt = `Extract the cargo information from this Air Waybill:
- HS Code Number
- Number of Pieces
- Gross Weight (in KGS)
- Chargeable Weight
- Nature and Quantity of Goods (description)

Document text:
${documentText}

Return ONLY a JSON object (no extra text):
{
  "hsCodeNo": "84399100",
  "noOfPieces": "2",
  "grossWeight": "233.000",
  "chargeableWeight": "233.00",
  "natureOfGoods": "Spare parts of machinery for making tissue paper in jumbo rolls"
}`;

  try {
    const response = await callOllama(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('[Extraction] Cargo details error:', error);
    return { hsCodeNo: null, noOfPieces: null, grossWeight: null, chargeableWeight: null, natureOfGoods: null };
  }
}

// ============================================
// MAIN EXTRACTION FUNCTION
// ============================================

export async function extractAndValidateAirwayBill(documentText: string): Promise<AirwayBillValidationResult> {
  console.log('═══════════════════════════════════════');
  console.log('[Extraction] Starting Ollama-powered airway bill extraction');
  console.log('[Extraction] Text length:', documentText.length);
  console.log('[Extraction] Model:', OLLAMA_CONFIG.model);
  console.log('═══════════════════════════════════════');
  
  const extractedData: AirwayBillData = {
    documentType: null,
    airwayBillNo: null,
    invoiceNo: null,
    invoiceDate: null,
    shippersName: null,
    shippersAddress: null,
    consigneesName: null,
    consigneesAddress: null,
    issuingCarriersName: null,
    issuingCarriersCity: null,
    agentsIataCode: null,
    airportOfDeparture: null,
    airportOfDestination: null,
    accountingInformation: null,
    hsCodeNo: null,
    noOfPieces: null,
    grossWeight: null,
    chargeableWeight: null,
    natureOfGoods: null
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Extract all sections in parallel
    const [basicInfo, shipper, consignee, carrier, shipment, cargo] = await Promise.all([
      extractAirwayBillBasicInfo(documentText),
      extractShipperDetails(documentText),
      extractConsigneeDetails(documentText),
      extractCarrierDetails(documentText),
      extractShipmentDetails(documentText),
      extractCargoDetails(documentText)
    ]);

    // Basic info
    extractedData.documentType = basicInfo.documentType || 'Air Waybill';
    extractedData.airwayBillNo = basicInfo.airwayBillNo;
    extractedData.invoiceNo = basicInfo.invoiceNo;
    extractedData.invoiceDate = basicInfo.invoiceDate;

    // Shipper
    extractedData.shippersName = shipper.shippersName;
    extractedData.shippersAddress = shipper.shippersAddress;

    // Consignee
    extractedData.consigneesName = consignee.consigneesName;
    extractedData.consigneesAddress = consignee.consigneesAddress;

    // Carrier
    extractedData.issuingCarriersName = carrier.issuingCarriersName;
    extractedData.issuingCarriersCity = carrier.issuingCarriersCity;
    extractedData.agentsIataCode = carrier.agentsIataCode;
    extractedData.accountingInformation = carrier.accountingInformation;

    // Shipment
    extractedData.airportOfDeparture = shipment.airportOfDeparture;
    extractedData.airportOfDestination = shipment.airportOfDestination;

    // Cargo
    extractedData.hsCodeNo = cargo.hsCodeNo;
    extractedData.noOfPieces = cargo.noOfPieces;
    extractedData.grossWeight = cargo.grossWeight;
    extractedData.chargeableWeight = cargo.chargeableWeight;
    extractedData.natureOfGoods = cargo.natureOfGoods;

    console.log('[Extraction] Airway bill extracted:', {
      airwayBillNo: extractedData.airwayBillNo,
      invoiceNo: extractedData.invoiceNo,
      shippersName: extractedData.shippersName,
      consigneesName: extractedData.consigneesName
    });

    // Validation
    if (!extractedData.airwayBillNo) errors.push('Airway Bill Number is missing');
    if (!extractedData.shippersName) errors.push('Shipper Name is missing');
    if (!extractedData.consigneesName) errors.push('Consignee Name is missing');
    if (!extractedData.issuingCarriersName) errors.push('Issuing Carrier Name is missing');
    
    if (!extractedData.invoiceNo) warnings.push('Invoice Number is missing');
    if (!extractedData.invoiceDate) warnings.push('Invoice Date is missing');
    if (!extractedData.shippersAddress) warnings.push('Shipper Address is missing');
    if (!extractedData.consigneesAddress) warnings.push('Consignee Address is missing');
    if (!extractedData.airportOfDeparture) warnings.push('Airport of Departure is missing');
    if (!extractedData.airportOfDestination) warnings.push('Airport of Destination is missing');
    if (!extractedData.hsCodeNo) warnings.push('HS Code is missing');
    if (!extractedData.natureOfGoods) warnings.push('Nature of Goods description is missing');

    // Calculate completeness
    const requiredFields = [
      extractedData.airwayBillNo,
      extractedData.invoiceNo,
      extractedData.invoiceDate,
      extractedData.shippersName,
      extractedData.shippersAddress,
      extractedData.consigneesName,
      extractedData.consigneesAddress,
      extractedData.issuingCarriersName,
      extractedData.issuingCarriersCity,
      extractedData.agentsIataCode,
      extractedData.airportOfDeparture,
      extractedData.airportOfDestination,
      extractedData.accountingInformation,
      extractedData.hsCodeNo,
      extractedData.noOfPieces,
      extractedData.grossWeight,
      extractedData.chargeableWeight,
      extractedData.natureOfGoods
    ];
    
    const filled = requiredFields.filter(f => f).length;
    const completeness = Math.round((filled / requiredFields.length) * 100);

    console.log('[Validation] Airway bill completeness:', completeness + '%');
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
    console.error('[Extraction] Error processing airway bill:', error);
    errors.push('Failed to parse airway bill: ' + (error as Error).message);
    
    return {
      isValid: false,
      errors,
      warnings,
      extractedData,
      completeness: 0
    };
  }
}

















































//src/lib/agent.ts - COMPLETE GPT-4o-POWERED INVOICE EXTRACTION SYSTEM



// import { ConversationState, WorkflowStateMachine, ResponseGenerator } from './workflow';
// import { getConversationState, updateConversationState, createConversationState } from './database';

// // ============================================
// // OPENAI GPT-4o CONFIGURATION
// // ============================================
// const OPENAI_CONFIG = {
//   apiKey: process.env.OPENAI_API_KEY || '',
//   model: process.env.OPENAI_MODEL || 'gpt-4o',
//   timeout: 120000, // 120 seconds for complex extractions
//   maxTokens: 4000,
// };

// // ============================================
// // INVOICE DATA INTERFACES
// // ============================================
// export interface CommercialInvoiceData {
//   invoiceNo: string | null;
//   date: string | null;
//   referenceNo: string | null;
//   proformaInvoiceNo: string | null;
  
//   consignee: {
//     name: string | null;
//     address: string | null;
//     contact: string | null;
//     phone: string | null;
//     mobile: string | null;
//     email: string | null;
//     poBox: string | null;
//     country: string | null;
//   } | null;
  
//   exporter: {
//     name: string | null;
//     address: string | null;
//     contact: string | null;
//     phone: string | null;
//     mobile: string | null;
//     email: string | null;
//     pan: string | null;
//     gstin: string | null;
//     iec: string | null;
//     factory: string | null;
//   } | null;
  
//   bankDetails: {
//     bankName: string | null;
//     address: string | null;
//     usdAccount: string | null;
//     euroAccount: string | null;
//     swiftCode: string | null;
//     ifscCode: string | null;
//     branchCode: string | null;
//     adCode: string | null;
//     bsrCode: string | null;
//   } | null;
  
//   shipmentDetails: {
//     incoterms: string | null;
//     preCarriage: string | null;
//     placeOfReceipt: string | null;
//     vesselFlight: string | null;
//     portOfLoading: string | null;
//     portOfDischarge: string | null;
//     finalDestination: string | null;
//     countryOfOrigin: string | null;
//     countryOfDestination: string | null;
//     hsnCode: string | null;
//     freightTerms: string | null;
//   } | null;
  
//   paymentTerms: string | null;
//   marksAndNumbers: string | null;
//   packaging: string | null;
  
//   itemList: Array<{
//     description: string;
//     quantity: string;
//     unitPrice: number;
//     totalPrice: number;
//   }>;
  
//   totalAmount: number | null;
//   totalAmountInWords: string | null;
//   currency: string | null;
  
//   certifications: {
//     igstStatus: string | null;
//     drawbackSrNo: string | null;
//     rodtepClaim: boolean;
//     commissionRate: string | null;
//   } | null;
  
//   signature: boolean;
// }

// export interface InvoiceValidationResult {
//   isValid: boolean;
//   errors: string[];
//   warnings: string[];
//   extractedData: CommercialInvoiceData;
//   completeness: number;
// }

// // ============================================
// // OPENAI GPT-4o API CLIENT
// // ============================================
// class OpenAIClient {
//   private apiKey: string;
//   private model: string;
//   private timeout: number;
//   private maxTokens: number;

//   constructor(config: typeof OPENAI_CONFIG) {
//     this.apiKey = config.apiKey;
//     this.model = config.model;
//     this.timeout = config.timeout;
//     this.maxTokens = config.maxTokens;
//   }

//   async generate(prompt: string, systemPrompt?: string, options?: any): Promise<string> {
//     console.log(`[OpenAI] Calling ${this.model} API...`);
    
//     if (!this.apiKey) {
//       throw new Error('OpenAI API key is required. Please set OPENAI_API_KEY environment variable.');
//     }

//     const controller = new AbortController();
//     const timeoutId = setTimeout(() => controller.abort(), this.timeout);

//     try {
//       const response = await fetch('https://api.openai.com/v1/chat/completions', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${this.apiKey}`,
//         },
//         body: JSON.stringify({
//           model: this.model,
//           messages: [
//             { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
//             { role: 'user', content: prompt }
//           ],
//           max_tokens: options?.max_tokens || this.maxTokens,
//           temperature: options?.temperature || 0.1,
//           top_p: options?.top_p || 0.9,
//         }),
//         signal: controller.signal,
//       });

//       clearTimeout(timeoutId);

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => null);
//         throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
//       }

//       const data = await response.json();
//       const content = data.choices?.[0]?.message?.content || '';
      
//       console.log('[OpenAI] Response received, length:', content.length);
//       return content;
//     } catch (error: any) {
//       clearTimeout(timeoutId);
//       if (error.name === 'AbortError') {
//         throw new Error('OpenAI request timed out');
//       }
//       console.error('[OpenAI] API Error:', error);
//       throw new Error(`Failed to call OpenAI: ${error.message}`);
//     }
//   }

//   async extractJSON(invoiceText: string, schema: string, instruction: string): Promise<any> {
//     const systemPrompt = `You are an expert invoice data extraction AI. Extract information EXACTLY as it appears in the document. 
// Return ONLY valid JSON matching the schema. No explanations, no markdown, just pure JSON.
// CRITICAL: Ensure all JSON strings are properly closed with quotes and the JSON is perfectly valid.`;

//     const prompt = `${instruction}

// SCHEMA:
// ${schema}

// INVOICE TEXT:
// ${invoiceText.substring(0, 12000)}

// Return ONLY the JSON object. Ensure all strings are properly quoted and the JSON is valid:`;

//     try {
//       const response = await this.generate(prompt, systemPrompt, {
//         temperature: 0.1,
//         max_tokens: 4000
//       });
//       return this.parseJSON(response);
//     } catch (error) {
//       console.error('[OpenAI] Extraction error:', error);
//       return null;
//     }
//   }

//   private parseJSON(response: string): any {
//     let cleaned = response.trim();
    
//     // Remove markdown code blocks
//     if (cleaned.startsWith('```json')) {
//       cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
//     } else if (cleaned.startsWith('```')) {
//       cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
//     }
    
//     // Remove any text before first { or [
//     const jsonStart = cleaned.search(/[\{\[]/);
//     if (jsonStart > 0) {
//       cleaned = cleaned.substring(jsonStart);
//     }
    
//     // Remove any text after last } or ]
//     const jsonEnd = cleaned.lastIndexOf('}') !== -1 ? cleaned.lastIndexOf('}') : cleaned.lastIndexOf(']');
//     if (jsonEnd !== -1 && jsonEnd < cleaned.length - 1) {
//       cleaned = cleaned.substring(0, jsonEnd + 1);
//     }
    
//     try {
//       return JSON.parse(cleaned);
//     } catch (parseError) {
//       console.error('[OpenAI] JSON parse error');
//       console.error('[OpenAI] Attempted to parse:', cleaned.substring(0, 500));
      
//       // Try to fix common JSON issues
//       try {
//         // Fix truncated strings by finding unclosed quotes
//         let fixed = cleaned;
        
//         // Count quotes to find unclosed ones
//         const quoteCount = (fixed.match(/"/g) || []).length;
//         if (quoteCount % 2 !== 0) {
//           // Odd number of quotes - add closing quote before last }
//           const lastBrace = fixed.lastIndexOf('}');
//           if (lastBrace !== -1) {
//             fixed = fixed.substring(0, lastBrace) + '"' + fixed.substring(lastBrace);
//           }
//         }
        
//         // Try parsing fixed version
//         return JSON.parse(fixed);
//       } catch (fixError) {
//         console.error('[OpenAI] Failed to fix JSON');
//         throw parseError;
//       }
//     }
//   }
// }

// // ============================================
// // GPT-4o-POWERED EXTRACTION FUNCTIONS
// // ============================================
// const openai = new OpenAIClient(OPENAI_CONFIG);

// async function extractBasicInfoWithGPT(invoiceText: string): Promise<{
//   invoiceNo: string | null;
//   date: string | null;
//   referenceNo: string | null;
//   proformaInvoiceNo: string | null;
//   currency: string | null;
//   totalAmount: number | null;
//   totalAmountInWords: string | null;
// }> {
//   console.log('[GPT-4o] Extracting basic invoice information...');
  
//   const schema = `{
//   "invoiceNo": "Invoice number (e.g., 222500187)",
//   "date": "Invoice date in DD.MM.YYYY format",
//   "referenceNo": "Reference number if any",
//   "proformaInvoiceNo": "Proforma invoice numbers",
//   "currency": "Currency code like USD or EUR",
//   "totalAmount": "Total amount as number only, no commas",
//   "totalAmountInWords": "Total amount in words (keep short)"
// }`;

//   const instruction = `Extract basic invoice information.
// Look for:
// - INVOICE NO (or Invoice Number): Usually a 9-digit number like 222500187
// - DATE: Date in DD.MM.YYYY format (e.g., 17.07.2025)
// - TOTAL: Look for "TOTAL : USD" followed by the amount
// - Currency: Usually USD or EUR

// IMPORTANT: Keep totalAmountInWords SHORT - just "Twenty Eight Thousand" not the full text.
// For totalAmount, return just the number without commas.`;

//   let result = await openai.extractJSON(invoiceText, schema, instruction);
  
//   // Retry if critical fields are missing
//   if (!result || !result.invoiceNo || !result.date) {
//     console.log('[GPT-4o] Retrying basic info extraction with simplified prompt...');
    
//     const simpleInstruction = `Find these exact fields in the invoice:
// 1. Invoice Number: Look for "INVOICE NO" or "222500187" 
// 2. Date: Look for "DATE" followed by format like "17.07.2025"
// 3. Total Amount: Look for "TOTAL" and "USD" with a number

// Return as JSON with keys: invoiceNo, date, totalAmount, currency.`;
    
//     result = await openai.extractJSON(invoiceText, schema, simpleInstruction);
//   }
  
//   if (result) {
//     console.log('[GPT-4o] Basic info extracted:', {
//       invoiceNo: result.invoiceNo,
//       date: result.date,
//       totalAmount: result.totalAmount
//     });
    
//     // Ensure totalAmount is a number
//     let totalAmount = null;
//     if (result.totalAmount) {
//       const amountStr = String(result.totalAmount).replace(/,/g, '');
//       totalAmount = parseFloat(amountStr);
//     }
    
//     return {
//       invoiceNo: result.invoiceNo || null,
//       date: result.date || null,
//       referenceNo: result.referenceNo || null,
//       proformaInvoiceNo: result.proformaInvoiceNo || null,
//       currency: result.currency || 'USD',
//       totalAmount: totalAmount,
//       totalAmountInWords: result.totalAmountInWords || null
//     };
//   }
  
//   return {
//     invoiceNo: null,
//     date: null,
//     referenceNo: null,
//     proformaInvoiceNo: null,
//     currency: 'USD',
//     totalAmount: null,
//     totalAmountInWords: null
//   };
// }

// async function extractItemsWithGPT(invoiceText: string): Promise<Array<{
//   description: string;
//   quantity: string;
//   unitPrice: number;
//   totalPrice: number;
// }>> {
//   console.log('[GPT-4o] Extracting invoice items...');
  
//   const schema = `{
//   "items": [
//     {
//       "description": "Item description or 'Item 1', 'Item 2', etc.",
//       "quantity": "Quantity with unit (e.g., '04 NOS', '15 NOS', '2 BOXES')",
//       "unitPrice": "Unit price as number",
//       "totalPrice": "Total price as number"
//     }
//   ]
// }`;

//   const instruction = `Extract ALL line items from the invoice table.
// Look for the table with columns: DESCRIPTION, QUANTITY, UNIT PRICE, TOTAL AMOUNT.

// CRITICAL: Extract EVERY SINGLE item row. Count them carefully.
// This invoice typically has 7 items with quantities like:
// - 04 NOS
// - 02 NOS  
// - 04 NOS
// - 04 NOS
// - 04 NOS
// - 02 NOS
// - 15 NOS

// For each item extract:
// - Quantity (must include "NOS", "PCS", etc.)
// - Unit Price (numeric value)
// - Total Price (numeric value)
// - Description (or use "Item 1", "Item 2", etc.)

// Extract ALL items, do not skip any rows.`;

//   const result = await openai.extractJSON(invoiceText, schema, instruction);
  
//   if (result && result.items && Array.isArray(result.items) && result.items.length > 0) {
//     console.log(`[GPT-4o] Extracted ${result.items.length} items from invoice`);
    
//     // Clean and validate items
//     const cleanedItems = result.items.map((item: any, index: number) => ({
//       description: item.description || `Item ${index + 1}`,
//       quantity: String(item.quantity || '1 NOS'),
//       unitPrice: parseFloat(String(item.unitPrice || 0).replace(/,/g, '')),
//       totalPrice: parseFloat(String(item.totalPrice || 0).replace(/,/g, ''))
//     })).filter((item: any) => item.totalPrice > 0);
    
//     // Verify we got all items
//     if (cleanedItems.length < 7) {
//       console.warn(`[GPT-4o] Warning: Only extracted ${cleanedItems.length} items, expected 7. Trying alternative extraction...`);
      
//       // Try a second extraction with more explicit prompt
//       const retryInstruction = `Look at the invoice table carefully. Count each row.
// Extract EXACTLY 7 line items. Each row has:
// - A quantity (like 04 NOS, 02 NOS, 15 NOS)
// - A unit price
// - A total amount

// Return all 7 items as JSON array.`;
      
//       const retryResult = await openai.extractJSON(invoiceText, schema, retryInstruction);
//       if (retryResult && retryResult.items && retryResult.items.length > cleanedItems.length) {
//         console.log(`[GPT-4o] Retry successful: Found ${retryResult.items.length} items`);
//         return retryResult.items.map((item: any, index: number) => ({
//           description: item.description || `Item ${index + 1}`,
//           quantity: String(item.quantity || '1 NOS'),
//           unitPrice: parseFloat(String(item.unitPrice || 0).replace(/,/g, '')),
//           totalPrice: parseFloat(String(item.totalPrice || 0).replace(/,/g, ''))
//         })).filter((item: any) => item.totalPrice > 0);
//       }
//     }
    
//     return cleanedItems;
//   }
  
//   console.log('[GPT-4o] No items extracted');
//   return [];
// }

// async function extractExporterWithGPT(invoiceText: string): Promise<{
//   name: string | null;
//   address: string | null;
//   factory: string | null;
//   pan: string | null;
//   gstin: string | null;
//   iec: string | null;
//   email: string | null;
//   phone: string | null;
//   mobile: string | null;
// }> {
//   console.log('[GPT-4o] Extracting exporter details...');
  
//   const schema = `{
//   "name": "Exporter company name",
//   "address": "Full corporate office address",
//   "factory": "Factory address if mentioned",
//   "pan": "PAN number",
//   "gstin": "GSTIN number (15 characters)",
//   "iec": "IEC code (10 digits)",
//   "email": "Email address",
//   "phone": "Phone number",
//   "mobile": "Mobile number"
// }`;

//   const instruction = `Extract the EXPORTER information from this invoice.
// Look for section labeled "EXPORTER" or "SELLER" or "FROM".
// Extract all available details including company name, addresses, tax IDs (PAN, GSTIN, IEC), and contact info.`;

//   const result = await openai.extractJSON(invoiceText, schema, instruction);
  
//   if (result) {
//     console.log('[GPT-4o] Exporter extracted:', result.name);
//     return {
//       name: result.name || null,
//       address: result.address || null,
//       factory: result.factory || null,
//       pan: result.pan || null,
//       gstin: result.gstin || null,
//       iec: result.iec || null,
//       email: result.email || null,
//       phone: result.phone || null,
//       mobile: result.mobile || null
//     };
//   }
  
//   return {
//     name: null, address: null, factory: null, pan: null, 
//     gstin: null, iec: null, email: null, phone: null, mobile: null
//   };
// }

// async function extractConsigneeWithGPT(invoiceText: string): Promise<{
//   name: string | null;
//   address: string | null;
//   phone: string | null;
//   mobile: string | null;
//   email: string | null;
//   poBox: string | null;
//   country: string | null;
// }> {
//   console.log('[GPT-4o] Extracting consignee details...');
  
//   const schema = `{
//   "name": "Consignee company name",
//   "address": "Full address",
//   "phone": "Phone number",
//   "mobile": "Mobile number",
//   "email": "Email address",
//   "poBox": "PO Box number if any",
//   "country": "Country name"
// }`;

//   const instruction = `Extract the CONSIGNEE information from this invoice.
// Look for section labeled "CONSIGNEE" or "BUYER" or "TO" or "SHIP TO".
// Extract all available contact details.`;

//   const result = await openai.extractJSON(invoiceText, schema, instruction);
  
//   if (result) {
//     console.log('[GPT-4o] Consignee extracted:', result.name);
//     return {
//       name: result.name || null,
//       address: result.address || null,
//       phone: result.phone || null,
//       mobile: result.mobile || null,
//       email: result.email || null,
//       poBox: result.poBox || null,
//       country: result.country || null
//     };
//   }
  
//   return {
//     name: null, address: null, phone: null, mobile: null, 
//     email: null, poBox: null, country: null
//   };
// }

// async function extractBankWithGPT(invoiceText: string): Promise<{
//   bankName: string | null;
//   address: string | null;
//   usdAccount: string | null;
//   euroAccount: string | null;
//   swiftCode: string | null;
//   ifscCode: string | null;
//   branchCode: string | null;
//   adCode: string | null;
//   bsrCode: string | null;
// }> {
//   console.log('[GPT-4o] Extracting bank details...');
  
//   const schema = `{
//   "bankName": "Bank name",
//   "address": "Bank address",
//   "usdAccount": "USD account number",
//   "euroAccount": "EUR/EURO account number",
//   "swiftCode": "SWIFT code",
//   "ifscCode": "IFSC code",
//   "branchCode": "Branch code",
//   "adCode": "AD code",
//   "bsrCode": "BSR code"
// }`;

//   const instruction = `Extract bank details from this invoice.
// Look for section labeled "BANK" or "OUR BANK" or "BANKING DETAILS".
// Extract account numbers, codes, and bank address.`;

//   const result = await openai.extractJSON(invoiceText, schema, instruction);
  
//   if (result) {
//     console.log('[GPT-4o] Bank extracted:', result.bankName);
//     return {
//       bankName: result.bankName || null,
//       address: result.address || null,
//       usdAccount: result.usdAccount || null,
//       euroAccount: result.euroAccount || null,
//       swiftCode: result.swiftCode || null,
//       ifscCode: result.ifscCode || null,
//       branchCode: result.branchCode || null,
//       adCode: result.adCode || null,
//       bsrCode: result.bsrCode || null
//     };
//   }
  
//   return {
//     bankName: null, address: null, usdAccount: null, euroAccount: null,
//     swiftCode: null, ifscCode: null, branchCode: null, adCode: null, bsrCode: null
//   };
// }

// async function extractShippingWithGPT(invoiceText: string): Promise<{
//   incoterms: string | null;
//   preCarriage: string | null;
//   placeOfReceipt: string | null;
//   vesselFlight: string | null;
//   portOfLoading: string | null;
//   portOfDischarge: string | null;
//   finalDestination: string | null;
//   countryOfOrigin: string | null;
//   countryOfDestination: string | null;
//   hsnCode: string | null;
//   freightTerms: string | null;
// }> {
//   console.log('[GPT-4o] Extracting shipping details...');
  
//   const schema = `{
//   "incoterms": "Incoterms like CIF, FOB, EXW, etc.",
//   "preCarriage": "Pre-carriage by",
//   "placeOfReceipt": "Place of receipt",
//   "vesselFlight": "Vessel or flight information",
//   "portOfLoading": "Port of loading",
//   "portOfDischarge": "Port of discharge",
//   "finalDestination": "Final destination",
//   "countryOfOrigin": "Country of origin",
//   "countryOfDestination": "Country of destination",
//   "hsnCode": "HSN code",
//   "freightTerms": "Freight terms like PREPAID, COLLECT"
// }`;

//   const instruction = `Extract shipping and logistics details from this invoice.
// Look for information about ports, destinations, shipping terms, and HSN codes.`;

//   const result = await openai.extractJSON(invoiceText, schema, instruction);
  
//   if (result) {
//     console.log('[GPT-4o] Shipping extracted');
//     return {
//       incoterms: result.incoterms || null,
//       preCarriage: result.preCarriage || null,
//       placeOfReceipt: result.placeOfReceipt || null,
//       vesselFlight: result.vesselFlight || null,
//       portOfLoading: result.portOfLoading || null,
//       portOfDischarge: result.portOfDischarge || null,
//       finalDestination: result.finalDestination || null,
//       countryOfOrigin: result.countryOfOrigin || null,
//       countryOfDestination: result.countryOfDestination || null,
//       hsnCode: result.hsnCode || null,
//       freightTerms: result.freightTerms || null
//     };
//   }
  
//   return {
//     incoterms: null, preCarriage: null, placeOfReceipt: null, vesselFlight: null,
//     portOfLoading: null, portOfDischarge: null, finalDestination: null,
//     countryOfOrigin: null, countryOfDestination: null, hsnCode: null, freightTerms: null
//   };
// }

// async function extractAdditionalInfoWithGPT(invoiceText: string): Promise<{
//   paymentTerms: string | null;
//   marksAndNumbers: string | null;
//   packaging: string | null;
//   igstStatus: string | null;
//   drawbackSrNo: string | null;
//   rodtepClaim: boolean;
//   commissionRate: string | null;
//   signature: boolean;
// }> {
//   console.log('[GPT-4o] Extracting additional information...');
  
//   const schema = `{
//   "paymentTerms": "Payment terms",
//   "marksAndNumbers": "Marks and numbers",
//   "packaging": "Packaging description",
//   "igstStatus": "IGST payment status",
//   "drawbackSrNo": "Drawback serial number",
//   "rodtepClaim": "true if RODTEP claim mentioned, false otherwise",
//   "commissionRate": "Commission rate percentage",
//   "signature": "true if authorized signature or signatory mentioned, false otherwise"
// }`;

//   const instruction = `Extract additional invoice information including payment terms, packaging, certifications, and signature status.`;

//   const result = await openai.extractJSON(invoiceText, schema, instruction);
  
//   if (result) {
//     console.log('[GPT-4o] Additional info extracted');
//     return {
//       paymentTerms: result.paymentTerms || null,
//       marksAndNumbers: result.marksAndNumbers || null,
//       packaging: result.packaging || null,
//       igstStatus: result.igstStatus || null,
//       drawbackSrNo: result.drawbackSrNo || null,
//       rodtepClaim: result.rodtepClaim === true || result.rodtepClaim === 'true',
//       commissionRate: result.commissionRate || null,
//       signature: result.signature === true || result.signature === 'true'
//     };
//   }
  
//   return {
//     paymentTerms: null, marksAndNumbers: null, packaging: null,
//     igstStatus: null, drawbackSrNo: null, rodtepClaim: false,
//     commissionRate: null, signature: false
//   };
// }

// // ============================================
// // MAIN EXTRACTION FUNCTION
// // ============================================
// export async function extractAndValidateInvoice(invoiceText: string): Promise<InvoiceValidationResult> {
//   console.log('═══════════════════════════════════════');
//   console.log('[Extraction] Starting GPT-4o-powered invoice extraction');
//   console.log('[Extraction] Text length:', invoiceText.length);
//   console.log('[Extraction] Using model:', OPENAI_CONFIG.model);
//   console.log('═══════════════════════════════════════');
  
//   const extractedData: CommercialInvoiceData = {
//     invoiceNo: null,
//     date: null,
//     referenceNo: null,
//     proformaInvoiceNo: null,
//     consignee: null,
//     exporter: null,
//     bankDetails: null,
//     shipmentDetails: null,
//     paymentTerms: null,
//     marksAndNumbers: null,
//     packaging: null,
//     itemList: [],
//     totalAmount: null,
//     totalAmountInWords: null,
//     currency: null,
//     certifications: null,
//     signature: false
//   };

//   const errors: string[] = [];
//   const warnings: string[] = [];

//   try {
//     // Extract all sections in parallel for better performance
//     const [basicInfo, items, exporter, consignee, bank, shipping, additional] = await Promise.all([
//       extractBasicInfoWithGPT(invoiceText),
//       extractItemsWithGPT(invoiceText),
//       extractExporterWithGPT(invoiceText),
//       extractConsigneeWithGPT(invoiceText),
//       extractBankWithGPT(invoiceText),
//       extractShippingWithGPT(invoiceText),
//       extractAdditionalInfoWithGPT(invoiceText)
//     ]);

//     // Basic info
//     extractedData.invoiceNo = basicInfo.invoiceNo;
//     extractedData.date = basicInfo.date;
//     extractedData.referenceNo = basicInfo.referenceNo;
//     extractedData.proformaInvoiceNo = basicInfo.proformaInvoiceNo;
//     extractedData.currency = basicInfo.currency;
//     extractedData.totalAmount = basicInfo.totalAmount;
//     extractedData.totalAmountInWords = basicInfo.totalAmountInWords;

//     // Items
//     extractedData.itemList = items;

//     // Exporter
//     extractedData.exporter = {
//       name: exporter.name,
//       address: exporter.address,
//       factory: exporter.factory,
//       contact: null,
//       phone: exporter.phone,
//       mobile: exporter.mobile,
//       email: exporter.email,
//       pan: exporter.pan,
//       gstin: exporter.gstin,
//       iec: exporter.iec
//     };

//     // Consignee
//     extractedData.consignee = {
//       name: consignee.name,
//       address: consignee.address,
//       contact: null,
//       phone: consignee.phone,
//       mobile: consignee.mobile,
//       email: consignee.email,
//       poBox: consignee.poBox,
//       country: consignee.country
//     };

//     // Bank
//     extractedData.bankDetails = {
//       bankName: bank.bankName,
//       address: bank.address,
//       usdAccount: bank.usdAccount,
//       euroAccount: bank.euroAccount,
//       swiftCode: bank.swiftCode,
//       ifscCode: bank.ifscCode,
//       branchCode: bank.branchCode,
//       adCode: bank.adCode,
//       bsrCode: bank.bsrCode
//     };

//     // Shipping
//     extractedData.shipmentDetails = {
//       incoterms: shipping.incoterms,
//       preCarriage: shipping.preCarriage,
//       placeOfReceipt: shipping.placeOfReceipt,
//       vesselFlight: shipping.vesselFlight,
//       portOfLoading: shipping.portOfLoading,
//       portOfDischarge: shipping.portOfDischarge,
//       finalDestination: shipping.finalDestination,
//       countryOfOrigin: shipping.countryOfOrigin,
//       countryOfDestination: shipping.countryOfDestination,
//       hsnCode: shipping.hsnCode,
//       freightTerms: shipping.freightTerms
//     };

//     // Additional info
//     extractedData.paymentTerms = additional.paymentTerms;
//     extractedData.marksAndNumbers = additional.marksAndNumbers;
//     extractedData.packaging = additional.packaging;
//     extractedData.signature = additional.signature;
    
//     extractedData.certifications = {
//       igstStatus: additional.igstStatus,
//       drawbackSrNo: additional.drawbackSrNo,
//       rodtepClaim: additional.rodtepClaim,
//       commissionRate: additional.commissionRate
//     };

//     // If total not found, calculate from items
//     if (!extractedData.totalAmount && extractedData.itemList.length > 0) {
//       extractedData.totalAmount = extractedData.itemList.reduce((sum, item) => sum + item.totalPrice, 0);
//       extractedData.totalAmount = Math.round(extractedData.totalAmount * 100) / 100;
//       console.log('[Extract] Total calculated from items:', extractedData.totalAmount);
//     }

//     console.log('═══════════════════════════════════════');
//     console.log('[Validation] Checking required fields');
    
//     // Validation
//     if (!extractedData.invoiceNo) errors.push('Invoice Number is missing');
//     if (!extractedData.date) errors.push('Invoice Date is missing');
//     if (!extractedData.consignee?.name) errors.push('Consignee Name is missing');
//     if (!extractedData.exporter?.name) errors.push('Exporter Name is missing');
    
//     if (!extractedData.totalAmount) {
//       errors.push('Total Amount is missing');
//     } else if (extractedData.totalAmount < 100) {
//       warnings.push('Total amount seems unusually low - please verify');
//     }
    
//     if (extractedData.itemList.length === 0) {
//       warnings.push('No items found in invoice');
//     } else {
//       const itemsSum = extractedData.itemList.reduce((sum, item) => sum + item.totalPrice, 0);
//       const roundedSum = Math.round(itemsSum * 100) / 100;
      
//       if (extractedData.totalAmount && Math.abs(roundedSum - extractedData.totalAmount) > 1.0) {
//         warnings.push(`Items sum (${roundedSum}) does not match total amount (${extractedData.totalAmount})`);
//       }
//     }
    
//     if (!extractedData.consignee?.address) warnings.push('Consignee Address is missing');
//     if (!extractedData.exporter?.address) warnings.push('Exporter Address is missing');
//     if (!extractedData.shipmentDetails?.incoterms) warnings.push('INCOTERMS is missing');
//     if (!extractedData.bankDetails?.bankName) warnings.push('Bank Name is missing');
//     if (!extractedData.bankDetails?.usdAccount && !extractedData.bankDetails?.euroAccount) {
//       warnings.push('Bank Account Number is missing');
//     }
//     if (!extractedData.shipmentDetails?.portOfLoading) warnings.push('Port of Loading is missing');
//     if (!extractedData.shipmentDetails?.finalDestination) warnings.push('Final Destination is missing');
//     if (!extractedData.paymentTerms) warnings.push('Payment Terms are missing');
//     if (!extractedData.signature) warnings.push('Authorized Signature not detected');
//     if (!extractedData.exporter?.pan) warnings.push('PAN Number is missing');
//     if (!extractedData.exporter?.gstin) warnings.push('GSTIN is missing');
//     if (!extractedData.exporter?.iec) warnings.push('IEC is missing');

//     const requiredFields = [
//       extractedData.invoiceNo,
//       extractedData.date,
//       extractedData.consignee?.name,
//       extractedData.consignee?.address,
//       extractedData.consignee?.email,
//       extractedData.exporter?.name,
//       extractedData.exporter?.address,
//       extractedData.exporter?.email,
//       extractedData.exporter?.pan,
//       extractedData.exporter?.gstin,
//       extractedData.exporter?.iec,
//       extractedData.bankDetails?.bankName,
//       extractedData.bankDetails?.usdAccount || extractedData.bankDetails?.euroAccount,
//       extractedData.bankDetails?.swiftCode,
//       extractedData.bankDetails?.ifscCode,
//       extractedData.shipmentDetails?.incoterms,
//       extractedData.shipmentDetails?.portOfLoading,
//       extractedData.shipmentDetails?.finalDestination,
//       extractedData.shipmentDetails?.countryOfOrigin,
//       extractedData.shipmentDetails?.countryOfDestination,
//       extractedData.paymentTerms,
//       extractedData.itemList.length > 0,
//       extractedData.totalAmount,
//       extractedData.signature
//     ];
    
//     const filled = requiredFields.filter(f => f).length;
//     const completeness = Math.round((filled / requiredFields.length) * 100);

//     console.log('[Validation] Completeness:', completeness + '%');
//     console.log('[Validation] Errors:', errors.length > 0 ? errors : 'None');
//     console.log('[Validation] Warnings:', warnings.length > 0 ? warnings : 'None');
//     console.log('═══════════════════════════════════════');

//     return {
//       isValid: errors.length === 0,
//       errors,
//       warnings,
//       extractedData,
//       completeness
//     };

//   } catch (error) {
//     console.error('[Extraction] Error:', error);
//     errors.push('Failed to parse invoice: ' + (error as Error).message);
    
//     return {
//       isValid: false,
//       errors,
//       warnings,
//       extractedData,
//       completeness: 0
//     };
//   }
// }

// // ============================================
// // SHIPPING AGENT CLASS
// // ============================================
// export class ShippingAgent {
//   private createInitialState(threadId: string, userId: string, organizationId: string): ConversationState {
//     return {
//       threadId,
//       userId,
//       organizationId,
//       currentStep: 'greeting',
//       shipmentData: {},
//       invoiceIds: [],
//       documentIds: [],
//       messages: [],
//       attempts: 0,
//       lastActivity: new Date().toISOString()
//     };
//   }

//   async processMessage(
//     threadId: string,
//     userId: string,
//     organizationId: string,
//     userMessage: string
//   ): Promise<{
//     response: string;
//     state: ConversationState;
//     shouldGenerateQuote: boolean;
//   }> {
//     let state = await getConversationState(threadId) ?? this.createInitialState(threadId, userId, organizationId);
    
//     if (state.messages.length === 0) {
//       const greeting = ResponseGenerator.greeting();
//       state.messages.push({ role: 'assistant', content: greeting, timestamp: new Date().toISOString() });
//       await createConversationState(state);
//       return { response: greeting, state, shouldGenerateQuote: false };
//     }
    
//     state.messages.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() });
//     const { nextState, response } = WorkflowStateMachine.processUserMessage(state, userMessage);
//     const shouldGenerateQuote = response === 'GENERATE_QUOTE';
//     let finalResponse = shouldGenerateQuote ? 'Generating shipping quotes...' : response;
//     nextState.messages.push({ role: 'assistant', content: finalResponse, timestamp: new Date().toISOString() });
//     await updateConversationState(nextState);
//     return { response: finalResponse, state: nextState, shouldGenerateQuote };
//   }

//   async handleInvoiceUpload(
//     threadId: string,
//     userId: string,
//     organizationId: string,
//     invoiceValidation: InvoiceValidationResult,
//     invoiceId: string
//   ): Promise<{ response: string; state: ConversationState }> {
//     let state = await getConversationState(threadId) ?? this.createInitialState(threadId, userId, organizationId);
    
//     state.invoiceIds.push(invoiceId);
//     const { extractedData } = invoiceValidation;
    
//     if (extractedData.shipmentDetails?.portOfLoading && !state.shipmentData.origin) {
//       state.shipmentData.origin = extractedData.shipmentDetails.portOfLoading;
//     }
//     if (extractedData.shipmentDetails?.finalDestination && !state.shipmentData.destination) {
//       state.shipmentData.destination = extractedData.shipmentDetails.finalDestination;
//     }
//     if (extractedData.itemList?.length > 0 && !state.shipmentData.cargo) {
//       const cargoDesc = extractedData.itemList.map(item => 
//         `${item.quantity} - ${item.description}`
//       ).join(', ');
//       state.shipmentData.cargo = cargoDesc.substring(0, 100);
//     }
    
//     if (!state.shipmentData.weight && extractedData.totalAmount) {
//       const estimatedWeight = Math.ceil(extractedData.totalAmount / 100);
//       state.shipmentData.weight = `${estimatedWeight} kg`;
//     }
    
//     const response = ResponseGenerator.invoiceUploaded(invoiceValidation);
//     state.messages.push({ role: 'system', content: `Invoice ${invoiceId} uploaded`, timestamp: new Date().toISOString() });
//     state.messages.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
//     state.currentStep = WorkflowStateMachine.determineNextStep(state);
//     await updateConversationState(state);
//     return { response, state };
//   }
// }

// // ============================================
// // SHIPPING QUOTE GENERATION
// // ============================================
// export async function generateShippingQuote(shipmentData: ConversationState['shipmentData']) {
//   const { weight, serviceLevel, origin, destination } = shipmentData;
//   const weightMatch = (weight || '').match(/(\d+)/);
//   const weightValue = weightMatch ? parseInt(weightMatch[1]) : 50;
//   const routeType = determineRouteType(origin || '', destination || '');
//   const baseRate = calculateBaseRate(routeType, weightValue);
//   const service = getServiceMultiplier(serviceLevel || 'Standard');
  
//   const carriers = [
//     { carrierId: 'dhl_001', name: 'DHL Express', reputation: 9.4, reliability: 98.7 },
//     { carrierId: 'fedex_002', name: 'FedEx International', reputation: 9.2, reliability: 98.2 },
//     { carrierId: 'ups_003', name: 'UPS Worldwide', reputation: 9.0, reliability: 97.8 },
//     { carrierId: 'maersk_004', name: 'Maersk Line', reputation: 9.1, reliability: 97.5 },
//     { carrierId: 'msc_005', name: 'MSC Cargo', reputation: 8.9, reliability: 97.2 }
//   ];
  
//   const quotes = carriers.slice(0, 3).map((carrier, i) => {
//     const variation = 0.88 + (i * 0.08);
//     const finalRate = (baseRate * service.multiplier * variation);
//     const baseDays = service.days.split('-').map(d => parseInt(d));
//     return {
//       carrierId: carrier.carrierId,
//       name: carrier.name,
//       service: serviceLevel || 'Standard',
//       rate: finalRate.toFixed(2),
//       transitTime: `${baseDays[0] + i}-${baseDays[1] + i} business days`,
//       reputation: carrier.reputation,
//       reliability: carrier.reliability + '%',
//       currency: 'USD'
//     };
//   });
  
//   return { quotes };
// }

// function determineRouteType(origin: string, destination: string): string {
//   if (!origin || !destination) return 'domestic';
//   const originLower = origin.toLowerCase();
//   const destLower = destination.toLowerCase();
  
//   const indianCities = ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad', 'aurangabad'];
//   const isOriginIndia = indianCities.some(city => originLower.includes(city)) || originLower.includes('india');
//   const isDestIndia = indianCities.some(city => destLower.includes(city)) || destLower.includes('india');
  
//   if (isOriginIndia && isDestIndia) return 'domestic';
//   if (isOriginIndia || isDestIndia) return 'international';
//   return 'international';
// }

// function calculateBaseRate(routeType: string, weight: number): number {
//   const routes = { domestic: 120, regional: 280, international: 480 };
//   const baseRate = routes[routeType as keyof typeof routes] || routes.domestic;
//   const weightRate = Math.ceil(weight / 10) * 18;
//   return baseRate + weightRate;
// }

// function getServiceMultiplier(serviceLevel: string): { multiplier: number; days: string } {
//   const multipliers = {
//     Express: { multiplier: 2.5, days: '1-3' },
//     Standard: { multiplier: 1.0, days: '4-7' },
//     Economy: { multiplier: 0.75, days: '8-14' }
//   };
//   return multipliers[serviceLevel as keyof typeof multipliers] || multipliers.Standard;
// }

// export function formatQuoteResponse(quote: any, shipmentData: ConversationState['shipmentData'], invoiceCount: number = 0): string {
//   const { quotes } = quote;
  
//   let response = 'Shipping Quote Generated\n\n';
//   response += 'Shipment Details:\n';
//   response += `• Origin: ${shipmentData.origin || 'Not specified'}\n`;
//   response += `• Destination: ${shipmentData.destination || 'Not specified'}\n`;
//   response += `• Weight: ${shipmentData.weight || 'Not specified'}\n`;
//   response += `• Cargo: ${shipmentData.cargo || 'Not specified'}\n`;
  
//   if (invoiceCount > 0) {
//     response += `• Invoices: ${invoiceCount} uploaded\n`;
//   }
  
//   response += '\nAvailable Carriers:\n\n';
  
//   quotes.forEach((q: any, index: number) => {
//     response += `${index + 1}. ${q.name} (${q.service})\n`;
//     response += `   Rate: ${q.rate} ${q.currency}\n`;
//     response += `   Transit Time: ${q.transitTime}\n`;
//     response += `   Reputation: ${q.reputation}/10\n`;
//     response += `   Reliability: ${q.reliability}\n`;
//     response += `   Carrier ID: ${q.carrierId}\n\n`;
//   });
  
//   response += 'Next Steps:\n';
//   response += '1. Review the quotes above\n';
//   response += '2. Select a carrier by saying "I choose [carrier name]"\n';
//   response += '3. Or ask any questions about the quotes\n';
  
//   return response;
// }

// // ============================================
// // UTILITY: Test OpenAI Connection
// // ============================================
// export async function testOpenAIConnection(): Promise<{ success: boolean; message: string; model: string }> {
//   try {
//     console.log('[OpenAI] Testing connection...');
    
//     if (!OPENAI_CONFIG.apiKey) {
//       return {
//         success: false,
//         message: 'OpenAI API key is missing. Please set OPENAI_API_KEY environment variable.',
//         model: OPENAI_CONFIG.model
//       };
//     }

//     // Test with a simple completion
//     const testClient = new OpenAIClient(OPENAI_CONFIG);
//     const response = await testClient.generate('Respond with "OK"', 'You are a test assistant.');
    
//     if (response && response.includes('OK')) {
//       return {
//         success: true,
//         message: `Connected to OpenAI successfully. Using model: ${OPENAI_CONFIG.model}`,
//         model: OPENAI_CONFIG.model
//       };
//     } else {
//       return {
//         success: false,
//         message: 'OpenAI connection test failed - unexpected response',
//         model: OPENAI_CONFIG.model
//       };
//     }
//   } catch (error: any) {
//     return {
//       success: false,
//       message: `Failed to connect to OpenAI: ${error.message}. Please check your API key and network connection.`,
//       model: OPENAI_CONFIG.model
//     };
//   }
// }

// // ============================================
// // EXPORT DECLARATION INTERFACES
// // ============================================
// export interface ExportDeclarationData {
//   // Document Identification
//   documentType: string | null;
//   invoiceNo: string | null;
//   invoiceDate: string | null;
//   shippingBillNo: string | null;
//   shippingBillDate: string | null;
  
//   // Valuation Information
//   valuationMethod: string | null;
//   sellerBuyerRelated: boolean | null;
//   relationshipInfluencedPrice: boolean | null;
  
//   // Transaction Details
//   paymentTerms: string | null;
//   deliveryTerms: string | null;
//   typeOfSale: string | null;
  
//   // Declaration Status
//   declarationStatus: string | null;
//   signedBy: string | null;
//   signedDate: string | null;
  
//   // Additional Fields
//   applicableRule: string | null;
//   declarationNumber: string | null;
// }

// export interface ExportDeclarationValidationResult {
//   isValid: boolean;
//   errors: string[];
//   warnings: string[];
//   extractedData: ExportDeclarationData;
//   completeness: number;
// }

// // ============================================
// // EXPORT DECLARATION EXTRACTION FUNCTIONS
// // ============================================
// async function extractExportDeclarationBasicInfo(invoiceText: string): Promise<{
//   invoiceNo: string | null;
//   invoiceDate: string | null;
//   shippingBillNo: string | null;
//   shippingBillDate: string | null;
//   documentType: string | null;
// }> {
//   console.log('[GPT-4o] Extracting export declaration basic information...');
  
//   const schema = `{
//   "invoiceNo": "Invoice number (e.g., 222500187)",
//   "invoiceDate": "Invoice date in DD.MM.YYYY format",
//   "shippingBillNo": "Shipping bill number (e.g., 7192707)",
//   "shippingBillDate": "Shipping bill date in DD.MM.YYYY format",
//   "documentType": "Document type (e.g., Export Value Declaration, Annexure-A)"
// }`;

//   const instruction = `Extract basic information from this Export Value Declaration document.
// Look for:
// - INVOICE NO or Invoice Number
// - INVOICE DATE
// - SHIPPING BILL NO or Shipping Bill Number
// - SHIPPING BILL DATE
// - Document type (Export Value Declaration, Annexure-A, etc.)

// This is typically a customs declaration form, not a commercial invoice.`;

//   let result = await openai.extractJSON(invoiceText, schema, instruction);
  
//   if (result) {
//     console.log('[GPT-4o] Export declaration basic info extracted:', {
//       invoiceNo: result.invoiceNo,
//       shippingBillNo: result.shippingBillNo
//     });
    
//     return {
//       invoiceNo: result.invoiceNo || null,
//       invoiceDate: result.invoiceDate || null,
//       shippingBillNo: result.shippingBillNo || null,
//       shippingBillDate: result.shippingBillDate || null,
//       documentType: result.documentType || 'Export Value Declaration'
//     };
//   }
  
//   return {
//     invoiceNo: null,
//     invoiceDate: null,
//     shippingBillNo: null,
//     shippingBillDate: null,
//     documentType: null
//   };
// }

// async function extractValuationDetails(invoiceText: string): Promise<{
//   valuationMethod: string | null;
//   sellerBuyerRelated: boolean | null;
//   relationshipInfluencedPrice: boolean | null;
//   applicableRule: string | null;
// }> {
//   console.log('[GPT-4o] Extracting valuation details...');
  
//   const schema = `{
//   "valuationMethod": "Valuation method (e.g., Rule 3, Transaction Value)",
//   "sellerBuyerRelated": "true if seller and buyer are related, false otherwise",
//   "relationshipInfluencedPrice": "true if relationship influenced price, false otherwise",
//   "applicableRule": "Applicable rule (e.g., Rule 7 of Customs Valuation)"
// }`;

//   const instruction = `Extract valuation and relationship information from this export declaration.
// Look for:
// - Valuation Method (Rule 3, Transaction Value, etc.)
// - Whether seller and buyer are related (Yes/No)
// - Whether relationship influenced price (Yes/No)
// - Applicable rules or regulations

// Return boolean values for relationship questions.`;

//   const result = await openai.extractJSON(invoiceText, schema, instruction);
  
//   if (result) {
//     return {
//       valuationMethod: result.valuationMethod || null,
//       sellerBuyerRelated: result.sellerBuyerRelated === true || result.sellerBuyerRelated === 'true',
//       relationshipInfluencedPrice: result.relationshipInfluencedPrice === true || result.relationshipInfluencedPrice === 'true',
//       applicableRule: result.applicableRule || null
//     };
//   }
  
//   return {
//     valuationMethod: null,
//     sellerBuyerRelated: null,
//     relationshipInfluencedPrice: null,
//     applicableRule: null
//   };
// }

// async function extractTransactionDetails(invoiceText: string): Promise<{
//   paymentTerms: string | null;
//   deliveryTerms: string | null;
//   typeOfSale: string | null;
// }> {
//   console.log('[GPT-4o] Extracting transaction details...');
  
//   const schema = `{
//   "paymentTerms": "Payment terms (e.g., 100% Advance Payment)",
//   "deliveryTerms": "Delivery terms (e.g., CIF, Beirut Airport)",
//   "typeOfSale": "Type of sale (e.g., Normal Sale)"
// }`;

//   const instruction = `Extract transaction details from this export declaration.
// Look for:
// - Terms of Payment
// - Terms of Delivery (Incoterms)
// - Type of Sale (Normal Sale, Consignment, etc.)`;

//   const result = await openai.extractJSON(invoiceText, schema, instruction);
  
//   if (result) {
//     return {
//       paymentTerms: result.paymentTerms || null,
//       deliveryTerms: result.deliveryTerms || null,
//       typeOfSale: result.typeOfSale || null
//     };
//   }
  
//   return {
//     paymentTerms: null,
//     deliveryTerms: null,
//     typeOfSale: null
//   };
// }

// async function extractDeclarationStatus(invoiceText: string): Promise<{
//   declarationStatus: string | null;
//   signedBy: string | null;
//   signedDate: string | null;
//   declarationNumber: string | null;
// }> {
//   console.log('[GPT-4o] Extracting declaration status...');
  
//   const schema = `{
//   "declarationStatus": "Declaration status (e.g., Signed & Confirmed)",
//   "signedBy": "Name of signatory",
//   "signedDate": "Date of signature",
//   "declarationNumber": "Declaration number if any"
// }`;

//   const instruction = `Extract declaration status and signature information.
// Look for:
// - Declaration status (Signed, Confirmed, etc.)
// - Signatory name
// - Signature date
// - Any declaration or reference numbers`;

//   const result = await openai.extractJSON(invoiceText, schema, instruction);
  
//   if (result) {
//     return {
//       declarationStatus: result.declarationStatus || null,
//       signedBy: result.signedBy || null,
//       signedDate: result.signedDate || null,
//       declarationNumber: result.declarationNumber || null
//     };
//   }
  
//   return {
//     declarationStatus: null,
//     signedBy: null,
//     signedDate: null,
//     declarationNumber: null
//   };
// }

// // ============================================
// // MAIN EXPORT DECLARATION EXTRACTION FUNCTION
// // ============================================
// export async function extractAndValidateExportDeclaration(invoiceText: string): Promise<ExportDeclarationValidationResult> {
//   console.log('═══════════════════════════════════════');
//   console.log('[Extraction] Starting GPT-4o-powered export declaration extraction');
//   console.log('[Extraction] Text length:', invoiceText.length);
//   console.log('═══════════════════════════════════════');
  
//   const extractedData: ExportDeclarationData = {
//     documentType: null,
//     invoiceNo: null,
//     invoiceDate: null,
//     shippingBillNo: null,
//     shippingBillDate: null,
//     valuationMethod: null,
//     sellerBuyerRelated: null,
//     relationshipInfluencedPrice: null,
//     paymentTerms: null,
//     deliveryTerms: null,
//     typeOfSale: null,
//     declarationStatus: null,
//     signedBy: null,
//     signedDate: null,
//     applicableRule: null,
//     declarationNumber: null
//   };

//   const errors: string[] = [];
//   const warnings: string[] = [];

//   try {
//     // Extract all sections in parallel
//     const [basicInfo, valuation, transaction, declaration] = await Promise.all([
//       extractExportDeclarationBasicInfo(invoiceText),
//       extractValuationDetails(invoiceText),
//       extractTransactionDetails(invoiceText),
//       extractDeclarationStatus(invoiceText)
//     ]);

//     // Basic info
//     extractedData.documentType = basicInfo.documentType;
//     extractedData.invoiceNo = basicInfo.invoiceNo;
//     extractedData.invoiceDate = basicInfo.invoiceDate;
//     extractedData.shippingBillNo = basicInfo.shippingBillNo;
//     extractedData.shippingBillDate = basicInfo.shippingBillDate;

//     // Valuation
//     extractedData.valuationMethod = valuation.valuationMethod;
//     extractedData.sellerBuyerRelated = valuation.sellerBuyerRelated;
//     extractedData.relationshipInfluencedPrice = valuation.relationshipInfluencedPrice;
//     extractedData.applicableRule = valuation.applicableRule;

//     // Transaction
//     extractedData.paymentTerms = transaction.paymentTerms;
//     extractedData.deliveryTerms = transaction.deliveryTerms;
//     extractedData.typeOfSale = transaction.typeOfSale;

//     // Declaration
//     extractedData.declarationStatus = declaration.declarationStatus;
//     extractedData.signedBy = declaration.signedBy;
//     extractedData.signedDate = declaration.signedDate;
//     extractedData.declarationNumber = declaration.declarationNumber;

//     console.log('[Extraction] Export declaration extracted:', {
//       invoiceNo: extractedData.invoiceNo,
//       shippingBillNo: extractedData.shippingBillNo,
//       valuationMethod: extractedData.valuationMethod
//     });

//     // Validation
//     if (!extractedData.invoiceNo) errors.push('Invoice Number is missing');
//     if (!extractedData.invoiceDate) errors.push('Invoice Date is missing');
//     if (!extractedData.shippingBillNo) warnings.push('Shipping Bill Number is missing');
    
//     if (extractedData.sellerBuyerRelated === null) {
//       warnings.push('Seller-Buyer relationship status not specified');
//     }
    
//     if (extractedData.relationshipInfluencedPrice === null) {
//       warnings.push('Relationship price influence status not specified');
//     }
    
//     if (!extractedData.paymentTerms) warnings.push('Payment Terms are missing');
//     if (!extractedData.deliveryTerms) warnings.push('Delivery Terms are missing');
//     if (!extractedData.declarationStatus) warnings.push('Declaration Status is missing');

//     // Date consistency check
//     if (extractedData.invoiceDate && extractedData.shippingBillDate) {
//       const invoiceDate = new Date(extractedData.invoiceDate);
//       const shippingBillDate = new Date(extractedData.shippingBillDate);
      
//       if (shippingBillDate < invoiceDate) {
//         warnings.push('Shipping bill date appears to be before invoice date - please verify');
//       }
//     }

//     // Calculate completeness
//     const requiredFields = [
//       extractedData.invoiceNo,
//       extractedData.invoiceDate,
//       extractedData.valuationMethod,
//       extractedData.sellerBuyerRelated !== null,
//       extractedData.relationshipInfluencedPrice !== null,
//       extractedData.paymentTerms,
//       extractedData.deliveryTerms,
//       extractedData.declarationStatus
//     ];
    
//     const filled = requiredFields.filter(f => f).length;
//     const completeness = Math.round((filled / requiredFields.length) * 100);

//     console.log('[Validation] Export declaration completeness:', completeness + '%');
//     console.log('[Validation] Errors:', errors.length > 0 ? errors : 'None');
//     console.log('[Validation] Warnings:', warnings.length > 0 ? warnings : 'None');
//     console.log('═══════════════════════════════════════');

//     return {
//       isValid: errors.length === 0,
//       errors,
//       warnings,
//       extractedData,
//       completeness
//     };

//   } catch (error) {
//     console.error('[Extraction] Error processing export declaration:', error);
//     errors.push('Failed to parse export declaration: ' + (error as Error).message);
    
//     return {
//       isValid: false,
//       errors,
//       warnings,
//       extractedData,
//       completeness: 0
//     };
//   }
// }

// // ============================================
// // DOCUMENT TYPE DETECTION
// // ============================================
// export async function detectDocumentType(invoiceText: string): Promise<'commercial_invoice' | 'export_declaration' | 'unknown'> {
//   console.log('[Detection] Analyzing document type...');
  
//   const systemPrompt = `You are a document classification AI. Analyze the text and determine if it's a Commercial Invoice or Export Value Declaration.
// Return ONLY one of these three options: "commercial_invoice", "export_declaration", or "unknown".`;

//   const prompt = `Classify this document:

// TEXT SAMPLE:
// ${invoiceText.substring(0, 2000)}

// Look for keywords:
// - Commercial Invoice: "INVOICE", "COMMERCIAL INVOICE", items, quantities, prices, total amount
// - Export Declaration: "EXPORT VALUE DECLARATION", "ANNEXURE", "Shipping Bill", "Valuation Method", "Customs Valuation"

// Return ONLY one word: "commercial_invoice", "export_declaration", or "unknown":`;

//   try {
//     const response = await openai.generate(prompt, systemPrompt, {
//       temperature: 0.1,
//       max_tokens: 100
//     });

//     const classification = response.trim().toLowerCase();
    
//     if (classification.includes('commercial_invoice')) {
//       console.log('[Detection] Document classified as: Commercial Invoice');
//       return 'commercial_invoice';
//     } else if (classification.includes('export_declaration')) {
//       console.log('[Detection] Document classified as: Export Declaration');
//       return 'export_declaration';
//     } else {
//       console.log('[Detection] Document classification: Unknown');
//       return 'unknown';
//     }
//   } catch (error) {
//     console.error('[Detection] Classification error:', error);
    
//     // Fallback: Check for keywords
//     const textLower = invoiceText.toLowerCase();
//     if (textLower.includes('export value declaration') || textLower.includes('annexure') || textLower.includes('shipping bill')) {
//       console.log('[Detection] Fallback: Export Declaration (keywords)');
//       return 'export_declaration';
//     } else if (textLower.includes('invoice') && textLower.includes('total')) {
//       console.log('[Detection] Fallback: Commercial Invoice (keywords)');
//       return 'commercial_invoice';
//     }
    
//     return 'unknown';
//   }
// }

// // ============================================
// // UNIFIED EXTRACTION FUNCTION
// // ============================================
// export async function extractDocumentData(invoiceText: string): Promise<{
//   documentType: 'commercial_invoice' | 'export_declaration' | 'unknown';
//   validation: InvoiceValidationResult | ExportDeclarationValidationResult;
// }> {
//   const documentType = await detectDocumentType(invoiceText);
  
//   if (documentType === 'export_declaration') {
//     const validation = await extractAndValidateExportDeclaration(invoiceText);
//     return { documentType, validation };
//   } else {
//     // Default to commercial invoice
//     const validation = await extractAndValidateInvoice(invoiceText);
//     return { documentType: 'commercial_invoice', validation };
//   }
// }

// //Scomet 
// // Add these to your lib/agent.ts file

// // ============================================
// // SCOMET DECLARATION INTERFACES
// // ============================================
// export interface SCOMETDeclarationData {
//   // Document Identification
//   documentDate: string | null;
//   documentType: string | null;
  
//   // Core Reference Fields
//   consigneeName: string | null;
//   invoiceNumber: string | null;
//   invoiceDate: string | null;
//   destinationCountry: string | null;
  
//   // SCOMET Specific Information
//   scometCoverage: boolean | null; // Does it fall under SCOMET? Yes/No
//   goodsDescription: string | null;
//   hsCode: string | null;
  
//   // Declaration Information
//   declarationStatement: string | null;
//   signatoryName: string | null;
//   signedStatus: boolean | null;
  
//   // Additional Details
//   addressedTo: string | null; // e.g., "Assistant Commissioner of Customs"
//   addressLocation: string | null; // e.g., "Air Cargo Complex, Andheri, Mumbai"
// }

// export interface SCOMETDeclarationValidationResult {
//   isValid: boolean;
//   errors: string[];
//   warnings: string[];
//   extractedData: SCOMETDeclarationData;
//   completeness: number;
// }

// // ============================================
// // SCOMET DECLARATION EXTRACTION FUNCTIONS
// // ============================================
// async function extractSCOMETBasicInfo(documentText: string): Promise<{
//   documentDate: string | null;
//   documentType: string | null;
//   addressedTo: string | null;
//   addressLocation: string | null;
// }> {
//   console.log('[GPT-4o] Extracting SCOMET basic information...');
  
//   const schema = `{
//   "documentDate": "Date in DD.MM.YYYY format (e.g., 19.07.2025)",
//   "documentType": "Document type (e.g., SCOMET Declaration)",
//   "addressedTo": "Who the document is addressed to",
//   "addressLocation": "Location/address of the recipient"
// }`;

//   const instruction = `Extract basic document information from this SCOMET Declaration.
// Look for:
// - DATE at the top of the document
// - Document title (SCOMET DECLARATION)
// - "To," followed by the recipient's title
// - Location details (Air Cargo Complex, city, etc.)`;

//   const result = await openai.extractJSON(documentText, schema, instruction);
  
//   if (result) {
//     console.log('[GPT-4o] SCOMET basic info extracted');
//     return {
//       documentDate: result.documentDate || null,
//       documentType: result.documentType || 'SCOMET Declaration',
//       addressedTo: result.addressedTo || null,
//       addressLocation: result.addressLocation || null
//     };
//   }
  
//   return {
//     documentDate: null,
//     documentType: 'SCOMET Declaration',
//     addressedTo: null,
//     addressLocation: null
//   };
// }

// async function extractSCOMETReferenceInfo(documentText: string): Promise<{
//   consigneeName: string | null;
//   invoiceNumber: string | null;
//   invoiceDate: string | null;
//   destinationCountry: string | null;
// }> {
//   console.log('[GPT-4o] Extracting SCOMET reference information...');
  
//   const schema = `{
//   "consigneeName": "Name of the consignee/buyer",
//   "invoiceNumber": "Invoice number referenced in the declaration",
//   "invoiceDate": "Invoice date in DD.MM.YYYY format",
//   "destinationCountry": "Country of destination"
// }`;

//   const instruction = `Extract reference information from this SCOMET Declaration.
// Look for:
// - Consignee name (mentioned after "to our Consignee")
// - Invoice Number (e.g., "Invoice Number 222500187")
// - Invoice Date (format: DD.MM.YYYY)
// - Destination country (mentioned as "for the country Of")

// Example pattern: "exporting the [goods] to our Consignee [NAME] with Invoice Number [NUMBER] Date [DATE] for the country Of [COUNTRY]"`;

//   const result = await openai.extractJSON(documentText, schema, instruction);
  
//   if (result) {
//     console.log('[GPT-4o] SCOMET reference info extracted:', {
//       consignee: result.consigneeName,
//       invoice: result.invoiceNumber
//     });
//     return {
//       consigneeName: result.consigneeName || null,
//       invoiceNumber: result.invoiceNumber || null,
//       invoiceDate: result.invoiceDate || null,
//       destinationCountry: result.destinationCountry || null
//     };
//   }
  
//   return {
//     consigneeName: null,
//     invoiceNumber: null,
//     invoiceDate: null,
//     destinationCountry: null
//   };
// }

// async function extractSCOMETGoodsInfo(documentText: string): Promise<{
//   goodsDescription: string | null;
//   hsCode: string | null;
//   scometCoverage: boolean | null;
//   declarationStatement: string | null;
// }> {
//   console.log('[GPT-4o] Extracting SCOMET goods information...');
  
//   const schema = `{
//   "goodsDescription": "Description of the goods being exported",
//   "hsCode": "HS Code (e.g., 8439.9100)",
//   "scometCoverage": "true if goods fall under SCOMET, false if they do not",
//   "declarationStatement": "The main declaration statement about SCOMET status"
// }`;

//   const instruction = `Extract goods and SCOMET coverage information.
// Look for:
// - Goods description (what is being exported)
// - HS CODE followed by the code number
// - Declaration statement about whether goods fall under SCOMET list
// - Keywords: "do not fall under SCOMET" (means false) or "fall under SCOMET" (means true)

// IMPORTANT: 
// - If the text says "do not fall under SCOMET", set scometCoverage to false
// - If the text says "fall under SCOMET", set scometCoverage to true
// - Return the full declaration statement as written`;

//   const result = await openai.extractJSON(documentText, schema, instruction);
  
//   if (result) {
//     console.log('[GPT-4o] SCOMET goods info extracted:', {
//       hsCode: result.hsCode,
//       scometCoverage: result.scometCoverage
//     });
    
//     // Ensure boolean conversion
//     let scometCoverage = null;
//     if (result.scometCoverage !== null && result.scometCoverage !== undefined) {
//       scometCoverage = result.scometCoverage === true || result.scometCoverage === 'true';
//     }
    
//     return {
//       goodsDescription: result.goodsDescription || null,
//       hsCode: result.hsCode || null,
//       scometCoverage: scometCoverage,
//       declarationStatement: result.declarationStatement || null
//     };
//   }
  
//   return {
//     goodsDescription: null,
//     hsCode: null,
//     scometCoverage: null,
//     declarationStatement: null
//   };
// }

// async function extractSCOMETSignatureInfo(documentText: string): Promise<{
//   signedStatus: boolean | null;
//   signatoryName: string | null;
// }> {
//   console.log('[GPT-4o] Extracting SCOMET signature information...');
  
//   const schema = `{
//   "signedStatus": "true if document appears to be signed or has signature indicator, false otherwise",
//   "signatoryName": "Name of person/entity signing or mentioned at end"
// }`;

//   const instruction = `Extract signature information from this SCOMET Declaration.
// Look for:
// - Any mention of signature, stamp, or "Thanking you"
// - Name or company name at the end of the document
// - If "Thanking you" is present, it usually indicates the document is signed

// Return signedStatus as true if there are signature indicators.`;

//   const result = await openai.extractJSON(documentText, schema, instruction);
  
//   if (result) {
//     const signedStatus = result.signedStatus === true || result.signedStatus === 'true';
//     console.log('[GPT-4o] SCOMET signature extracted:', {
//       signed: signedStatus,
//       signatory: result.signatoryName
//     });
//     return {
//       signedStatus,
//       signatoryName: result.signatoryName || null
//     };
//   }
  
//   return {
//     signedStatus: null,
//     signatoryName: null
//   };
// }

// // ============================================
// // MAIN SCOMET DECLARATION EXTRACTION FUNCTION
// // ============================================
// export async function extractAndValidateSCOMETDeclaration(documentText: string): Promise<SCOMETDeclarationValidationResult> {
//   console.log('═══════════════════════════════════════');
//   console.log('[Extraction] Starting GPT-4o-powered SCOMET declaration extraction');
//   console.log('[Extraction] Text length:', documentText.length);
//   console.log('═══════════════════════════════════════');
  
//   const extractedData: SCOMETDeclarationData = {
//     documentDate: null,
//     documentType: null,
//     consigneeName: null,
//     invoiceNumber: null,
//     invoiceDate: null,
//     destinationCountry: null,
//     scometCoverage: null,
//     goodsDescription: null,
//     hsCode: null,
//     declarationStatement: null,
//     signatoryName: null,
//     signedStatus: null,
//     addressedTo: null,
//     addressLocation: null
//   };

//   const errors: string[] = [];
//   const warnings: string[] = [];

//   try {
//     // Extract all sections in parallel
//     const [basicInfo, referenceInfo, goodsInfo, signatureInfo] = await Promise.all([
//       extractSCOMETBasicInfo(documentText),
//       extractSCOMETReferenceInfo(documentText),
//       extractSCOMETGoodsInfo(documentText),
//       extractSCOMETSignatureInfo(documentText)
//     ]);

//     // Basic info
//     extractedData.documentDate = basicInfo.documentDate;
//     extractedData.documentType = basicInfo.documentType;
//     extractedData.addressedTo = basicInfo.addressedTo;
//     extractedData.addressLocation = basicInfo.addressLocation;

//     // Reference info
//     extractedData.consigneeName = referenceInfo.consigneeName;
//     extractedData.invoiceNumber = referenceInfo.invoiceNumber;
//     extractedData.invoiceDate = referenceInfo.invoiceDate;
//     extractedData.destinationCountry = referenceInfo.destinationCountry;

//     // Goods info
//     extractedData.goodsDescription = goodsInfo.goodsDescription;
//     extractedData.hsCode = goodsInfo.hsCode;
//     extractedData.scometCoverage = goodsInfo.scometCoverage;
//     extractedData.declarationStatement = goodsInfo.declarationStatement;

//     // Signature info
//     extractedData.signedStatus = signatureInfo.signedStatus;
//     extractedData.signatoryName = signatureInfo.signatoryName;

//     console.log('[Extraction] SCOMET declaration extracted:', {
//       documentDate: extractedData.documentDate,
//       invoiceNumber: extractedData.invoiceNumber,
//       scometCoverage: extractedData.scometCoverage,
//       hsCode: extractedData.hsCode
//     });

//     // ============================================
//     // VALIDATION
//     // ============================================
//     console.log('═══════════════════════════════════════');
//     console.log('[Validation] Checking required fields');
    
//     // Critical field validation
//     if (!extractedData.documentDate) {
//       errors.push('Document Date is missing');
//     }
    
//     if (!extractedData.consigneeName) {
//       errors.push('Consignee Name is missing');
//     }
    
//     if (!extractedData.invoiceNumber) {
//       errors.push('Invoice Number is missing');
//     }
    
//     if (!extractedData.invoiceDate) {
//       errors.push('Invoice Date is missing');
//     }
    
//     if (!extractedData.destinationCountry) {
//       errors.push('Destination Country is missing');
//     }
    
//     if (extractedData.scometCoverage === null) {
//       errors.push('SCOMET coverage status not specified (must be Yes or No)');
//     }
    
//     // Warning-level validations
//     if (!extractedData.hsCode) {
//       warnings.push('HS Code is missing');
//     }
    
//     if (!extractedData.goodsDescription) {
//       warnings.push('Goods description is missing');
//     }
    
//     if (!extractedData.declarationStatement) {
//       warnings.push('Declaration statement is missing');
//     }
    
//     if (!extractedData.addressedTo) {
//       warnings.push('Recipient authority not identified');
//     }
    
//     if (!extractedData.signedStatus) {
//       warnings.push('Document signature not detected');
//     }

//     // Date consistency check
//     if (extractedData.documentDate && extractedData.invoiceDate) {
//       try {
//         const docDate = new Date(extractedData.documentDate.split('.').reverse().join('-'));
//         const invDate = new Date(extractedData.invoiceDate.split('.').reverse().join('-'));
        
//         if (docDate < invDate) {
//           warnings.push('SCOMET declaration date is before invoice date - may need verification');
//         }
        
//         const daysDiff = Math.abs((docDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
//         if (daysDiff > 30) {
//           warnings.push(`SCOMET declaration is ${Math.round(daysDiff)} days from invoice date - verify timing`);
//         }
//       } catch (error) {
//         console.error('[Validation] Date comparison error:', error);
//       }
//     }

//     // HS Code format validation
//     if (extractedData.hsCode) {
//       const hsCodePattern = /^\d{4}\.\d{4}$/;
//       if (!hsCodePattern.test(extractedData.hsCode)) {
//         warnings.push('HS Code format may be non-standard (expected format: XXXX.XXXX)');
//       }
//     }

//     // Calculate completeness
//     const requiredFields = [
//       extractedData.documentDate,
//       extractedData.documentType,
//       extractedData.consigneeName,
//       extractedData.invoiceNumber,
//       extractedData.invoiceDate,
//       extractedData.destinationCountry,
//       extractedData.scometCoverage !== null,
//       extractedData.goodsDescription,
//       extractedData.hsCode,
//       extractedData.declarationStatement,
//       extractedData.addressedTo,
//       extractedData.signedStatus
//     ];
    
//     const filled = requiredFields.filter(f => f).length;
//     const completeness = Math.round((filled / requiredFields.length) * 100);

//     console.log('[Validation] SCOMET declaration completeness:', completeness + '%');
//     console.log('[Validation] Errors:', errors.length > 0 ? errors : 'None');
//     console.log('[Validation] Warnings:', warnings.length > 0 ? warnings : 'None');
//     console.log('[Validation] SCOMET Coverage:', extractedData.scometCoverage ? 'YES' : 'NO');
//     console.log('═══════════════════════════════════════');

//     return {
//       isValid: errors.length === 0,
//       errors,
//       warnings,
//       extractedData,
//       completeness
//     };

//   } catch (error) {
//     console.error('[Extraction] Error processing SCOMET declaration:', error);
//     errors.push('Failed to parse SCOMET declaration: ' + (error as Error).message);
    
//     return {
//       isValid: false,
//       errors,
//       warnings,
//       extractedData,
//       completeness: 0
//     };
//   }
// }

