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
// GROQ CONFIGURATION FOR SCOMET EXTRACTION
// ============================================
const GROQ_CONFIG = {
  apiKey: process.env.GROQ_API_KEY || '',
  model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  baseUrl: 'https://api.groq.com/openai/v1',
  timeout: 120000,
  maxTokens: 8000,
  maxRetries: 3,
};

// ============================================
// GROQ CLIENT WITH RETRY LOGIC
// ============================================
class GroqClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private timeout: number;
  private maxTokens: number;
  private maxRetries: number;

  constructor(config: typeof GROQ_CONFIG) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout;
    this.maxTokens = config.maxTokens;
    this.maxRetries = config.maxRetries;
  }

  async generate(
    prompt: string, 
    systemPrompt?: string, 
    options?: any,
    retryCount: number = 0
  ): Promise<string> {
    console.log(`[Groq] Calling ${this.model} API... (Attempt ${retryCount + 1}/${this.maxRetries + 1})`);
    
    if (!this.apiKey) {
      throw new Error('Groq API key is required. Please set GROQ_API_KEY environment variable.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const requestTokens = options?.max_tokens || this.maxTokens;
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
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
          max_tokens: requestTokens,
          temperature: options?.temperature || 0.1,
          top_p: options?.top_p || 0.9,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error?.message || response.statusText;
        
        // Check for token overflow errors
        if (this.isTokenOverflowError(errorMessage) && retryCount < this.maxRetries) {
          console.warn(`[Groq] Token overflow detected. Reducing content and retrying...`);
          
          // Reduce token limit by 20% for retry
          const reducedTokens = Math.floor(requestTokens * 0.8);
          
          // Truncate prompt if it's too long
          const truncatedPrompt = this.truncatePrompt(prompt, reducedTokens);
          
          // Wait before retry (exponential backoff)
          await this.sleep(Math.pow(2, retryCount) * 1000);
          
          return this.generate(
            truncatedPrompt, 
            systemPrompt, 
            { ...options, max_tokens: reducedTokens },
            retryCount + 1
          );
        }
        
        throw new Error(`Groq API error: ${response.status} ${errorMessage}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      console.log('[Groq] Response received, length:', content.length);
      
      // Check if response was truncated due to token limit
      if (data.choices?.[0]?.finish_reason === 'length' && retryCount < this.maxRetries) {
        console.warn('[Groq] Response truncated. Retrying with increased token limit...');
        
        const increasedTokens = Math.min(requestTokens * 1.5, 32000);
        await this.sleep(1000);
        
        return this.generate(
          prompt, 
          systemPrompt, 
          { ...options, max_tokens: increasedTokens },
          retryCount + 1
        );
      }
      
      return content;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        if (retryCount < this.maxRetries) {
          console.warn('[Groq] Request timed out. Retrying...');
          await this.sleep(Math.pow(2, retryCount) * 1000);
          return this.generate(prompt, systemPrompt, options, retryCount + 1);
        }
        throw new Error('Groq request timed out after multiple retries');
      }
      
      console.error('[Groq] API Error:', error);
      
      // Retry on network errors
      if (this.isRetryableError(error) && retryCount < this.maxRetries) {
        console.warn(`[Groq] Retryable error detected. Retrying... (${retryCount + 1}/${this.maxRetries})`);
        await this.sleep(Math.pow(2, retryCount) * 1000);
        return this.generate(prompt, systemPrompt, options, retryCount + 1);
      }
      
      throw new Error(`Failed to call Groq: ${error.message}`);
    }
  }

  private isTokenOverflowError(errorMessage: string): boolean {
    const tokenErrors = [
      'token limit',
      'context length',
      'maximum context',
      'too many tokens',
      'context_length_exceeded'
    ];
    return tokenErrors.some(err => errorMessage.toLowerCase().includes(err));
  }

  private isRetryableError(error: any): boolean {
    // Network errors, rate limits, server errors
    const retryablePatterns = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'rate limit',
      '429',
      '500',
      '502',
      '503',
      '504'
    ];
    const errorString = error.toString().toLowerCase();
    return retryablePatterns.some(pattern => errorString.includes(pattern.toLowerCase()));
  }

  private truncatePrompt(prompt: string, targetTokens: number): string {
    // Rough estimate: 1 token ≈ 4 characters
    const targetChars = targetTokens * 3; // Conservative estimate
    
    if (prompt.length <= targetChars) {
      return prompt;
    }
    
    console.log(`[Groq] Truncating prompt from ${prompt.length} to ~${targetChars} characters`);
    
    // Try to preserve the instruction part and truncate the content
    const parts = prompt.split('DOCUMENT TEXT:');
    if (parts.length === 2) {
      const instruction = parts[0];
      const content = parts[1];
      const availableChars = targetChars - instruction.length - 100; // Buffer
      
      if (availableChars > 0) {
        return instruction + 'DOCUMENT TEXT:\n' + content.substring(0, availableChars) + '\n[...truncated]';
      }
    }
    
    // Fallback: simple truncation
    return prompt.substring(0, targetChars) + '\n[...truncated]';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async extractJSON(documentText: string, schema: string, instruction: string): Promise<any> {
    const systemPrompt = `You are an expert document data extraction AI. Extract information EXACTLY as it appears in the document. 
Return ONLY valid JSON matching the schema. No explanations, no markdown, just pure JSON.
CRITICAL: Ensure all JSON strings are properly closed with quotes and the JSON is perfectly valid.`;

    const prompt = `${instruction}

SCHEMA:
${schema}

DOCUMENT TEXT:
${documentText.substring(0, 12000)}

Return ONLY the JSON object. Ensure all strings are properly quoted and the JSON is valid:`;

    try {
      const response = await this.generate(prompt, systemPrompt, {
        temperature: 0.1,
        max_tokens: 4000
      });
      return this.parseJSON(response);
    } catch (error) {
      console.error('[Groq] Extraction error:', error);
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
      console.error('[Groq] JSON parse error');
      console.error('[Groq] Attempted to parse:', cleaned.substring(0, 500));
      
      // Try to fix common JSON issues
      try {
        let fixed = cleaned;
        
        // Count quotes to find unclosed ones
        const quoteCount = (fixed.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          const lastBrace = fixed.lastIndexOf('}');
          if (lastBrace !== -1) {
            fixed = fixed.substring(0, lastBrace) + '"' + fixed.substring(lastBrace);
          }
        }
        
        return JSON.parse(fixed);
      } catch (fixError) {
        console.error('[Groq] Failed to fix JSON');
        throw parseError;
      }
    }
  }
}

// ============================================
// SCOMET EXTRACTION FUNCTIONS WITH GROQ
// ============================================
const groq = new GroqClient(GROQ_CONFIG);

async function extractSCOMETBasicInfoGroq(documentText: string): Promise<{
  documentDate: string | null;
  documentType: string | null;
  addressedTo: string | null;
  addressLocation: string | null;
}> {
  console.log('[Groq] Extracting SCOMET basic information...');
  
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

  const result = await groq.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Groq] SCOMET basic info extracted');
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

async function extractSCOMETReferenceInfoGroq(documentText: string): Promise<{
  consigneeName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  destinationCountry: string | null;
}> {
  console.log('[Groq] Extracting SCOMET reference information...');
  
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

  const result = await groq.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Groq] SCOMET reference info extracted:', {
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

async function extractSCOMETGoodsInfoGroq(documentText: string): Promise<{
  goodsDescription: string | null;
  hsCode: string | null;
  scometCoverage: boolean | null;
  declarationStatement: string | null;
}> {
  console.log('[Groq] Extracting SCOMET goods information...');
  
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

  const result = await groq.extractJSON(documentText, schema, instruction);
  
  if (result) {
    console.log('[Groq] SCOMET goods info extracted:', {
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

async function extractSCOMETSignatureInfoGroq(documentText: string): Promise<{
  signedStatus: boolean | null;
  signatoryName: string | null;
}> {
  console.log('[Groq] Extracting SCOMET signature information...');
  
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

  const result = await groq.extractJSON(documentText, schema, instruction);
  
  if (result) {
    const signedStatus = result.signedStatus === true || result.signedStatus === 'true';
    console.log('[Groq] SCOMET signature extracted:', {
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
// MAIN EXTRACTION FUNCTION WITH RETRY LOGIC
// ============================================
export async function extractAndValidateSCOMETDeclaration(
  documentText: string
): Promise<SCOMETDeclarationValidationResult> {
  console.log('═══════════════════════════════════════');
  console.log('[Extraction] Starting Groq-powered SCOMET declaration extraction');
  console.log('[Extraction] Text length:', documentText.length);
  console.log('[Extraction] Using model:', GROQ_CONFIG.model);
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
      extractSCOMETBasicInfoGroq(documentText),
      extractSCOMETReferenceInfoGroq(documentText),
      extractSCOMETGoodsInfoGroq(documentText),
      extractSCOMETSignatureInfoGroq(documentText)
    ]);

    // Populate extracted data
    extractedData.documentDate = basicInfo.documentDate;
    extractedData.documentType = basicInfo.documentType;
    extractedData.addressedTo = basicInfo.addressedTo;
    extractedData.addressLocation = basicInfo.addressLocation;
    extractedData.consigneeName = referenceInfo.consigneeName;
    extractedData.invoiceNumber = referenceInfo.invoiceNumber;
    extractedData.invoiceDate = referenceInfo.invoiceDate;
    extractedData.destinationCountry = referenceInfo.destinationCountry;
    extractedData.goodsDescription = goodsInfo.goodsDescription;
    extractedData.hsCode = goodsInfo.hsCode;
    extractedData.scometCoverage = goodsInfo.scometCoverage;
    extractedData.declarationStatement = goodsInfo.declarationStatement;
    extractedData.signedStatus = signatureInfo.signedStatus;
    extractedData.signatoryName = signatureInfo.signatoryName;

    console.log('[Extraction] SCOMET declaration extracted:', {
      documentDate: extractedData.documentDate,
      invoiceNumber: extractedData.invoiceNumber,
      scometCoverage: extractedData.scometCoverage,
      hsCode: extractedData.hsCode
    });

    // Validation
    console.log('═══════════════════════════════════════');
    console.log('[Validation] Checking required fields');
    
    if (!extractedData.documentDate) errors.push('Document Date is missing');
    if (!extractedData.consigneeName) errors.push('Consignee Name is missing');
    if (!extractedData.invoiceNumber) errors.push('Invoice Number is missing');
    if (!extractedData.invoiceDate) errors.push('Invoice Date is missing');
    if (!extractedData.destinationCountry) errors.push('Destination Country is missing');
    if (extractedData.scometCoverage === null) errors.push('SCOMET coverage status not specified (must be Yes or No)');
    
    if (!extractedData.hsCode) warnings.push('HS Code is missing');
    if (!extractedData.goodsDescription) warnings.push('Goods description is missing');
    if (!extractedData.declarationStatement) warnings.push('Declaration statement is missing');
    if (!extractedData.addressedTo) warnings.push('Recipient authority not identified');
    if (!extractedData.signedStatus) warnings.push('Document signature not detected');

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
        message: 'Groq API key is missing. Please set GROQ_API_KEY environment variable.',
        model: GROQ_CONFIG.model
      };
    }

    const testClient = new GroqClient(GROQ_CONFIG);
    const response = await testClient.generate('Respond with "OK"', 'You are a test assistant.');
    
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