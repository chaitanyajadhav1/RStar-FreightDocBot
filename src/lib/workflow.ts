// src/lib/workflow.ts - Rule-based state machine with organization and document support

export interface ConversationState {
  threadId: string;
  userId: string;
  organizationId: string;
  currentStep: WorkflowStep;
  shipmentData: {
    origin?: string;
    destination?: string;
    cargo?: string;
    weight?: string;
    serviceLevel?: 'Express' | 'Standard' | 'Economy';
  };
  invoiceIds: string[];
  documentIds: string[];
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
  }>;
  attempts: number;
  lastActivity: string;
}

export type WorkflowStep =
  | 'greeting'
  | 'collect_origin'
  | 'collect_destination'
  | 'collect_cargo'
  | 'collect_weight'
  | 'collect_service_level'
  | 'ready_for_quote'
  | 'quote_generated'
  | 'document_query'
  | 'completed';

// Pattern matching for data extraction
export class DataExtractor {
  static extractIndianCity(text: string): string | null {
    const indianCities = [
      'Mumbai', 'Delhi', 'Bangalore', 'Bengaluru', 'Hyderabad', 'Chennai',
      'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow',
      'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam',
      'Pimpri', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra',
      'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Kalyan', 'Vasai',
      'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar',
      'Navi Mumbai', 'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore',
      'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai',
      'Raipur', 'Kota', 'Chandigarh', 'Guwahati', 'Solapur'
    ];

    const lowerText = text.toLowerCase();
    for (const city of indianCities) {
      if (lowerText.includes(city.toLowerCase())) {
        return city;
      }
    }
    return null;
  }

  static extractLocation(text: string): string | null {
    const locations = [
      'USA', 'United States', 'America', 'UK', 'United Kingdom', 'China',
      'Japan', 'Germany', 'France', 'Canada', 'Australia', 'Singapore',
      'UAE', 'Dubai', 'Saudi Arabia', 'Malaysia', 'Thailand', 'Vietnam',
      'New York', 'Los Angeles', 'London', 'Paris', 'Tokyo', 'Beijing',
      'Shanghai', 'Hong Kong', 'Singapore', 'Dubai', 'Sydney', 'Toronto'
    ];

    const indianCity = this.extractIndianCity(text);
    if (indianCity) return indianCity;

    const lowerText = text.toLowerCase();
    for (const location of locations) {
      if (lowerText.includes(location.toLowerCase())) {
        return location;
      }
    }

    const fromMatch = text.match(/from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (fromMatch) return fromMatch[1];

    const toMatch = text.match(/to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (toMatch) return toMatch[1];

    return null;
  }

  static extractWeight(text: string): string | null {
    const kgPattern = /(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?|kilograms?)/i;
    const kgMatch = text.match(kgPattern);
    if (kgMatch) {
      return `${kgMatch[1]} kg`;
    }

    const lbsPattern = /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)/i;
    const lbsMatch = text.match(lbsPattern);
    if (lbsMatch) {
      const kg = Math.round(parseFloat(lbsMatch[1]) * 0.453592);
      return `${kg} kg`;
    }

    const tonsPattern = /(\d+(?:\.\d+)?)\s*(?:tons?|tonnes?)/i;
    const tonsMatch = text.match(tonsPattern);
    if (tonsMatch) {
      const kg = Math.round(parseFloat(tonsMatch[1]) * 1000);
      return `${kg} kg`;
    }

    const numberPattern = /(\d+(?:\.\d+)?)/;
    const numberMatch = text.match(numberPattern);
    if (numberMatch) {
      const num = parseFloat(numberMatch[1]);
      if (num >= 1 && num <= 10000) {
        return `${num} kg`;
      }
    }

    return null;
  }

  static extractCargo(text: string): string | null {
    const cargoKeywords = [
      'electronics', 'textile', 'machinery', 'furniture', 'documents',
      'samples', 'garments', 'spare parts', 'raw materials', 'finished goods',
      'equipment', 'tools', 'boxes', 'packages', 'parcels', 'goods',
      'shipment', 'cargo', 'product', 'items', 'materials'
    ];

    const lowerText = text.toLowerCase();
    for (const keyword of cargoKeywords) {
      if (lowerText.includes(keyword)) {
        const contextPattern = new RegExp(`([\\w\\s]{0,30}${keyword}[\\w\\s]{0,30})`, 'i');
        const match = text.match(contextPattern);
        if (match) {
          return match[1].trim().substring(0, 100);
        }
        return keyword;
      }
    }

    if (text.length > 10 && text.length < 200) {
      const skipPhrases = ['yes', 'no', 'ok', 'sure', 'thanks', 'hello'];
      if (!skipPhrases.some(phrase => lowerText === phrase)) {
        return text.trim().substring(0, 100);
      }
    }

    return null;
  }

  static extractServiceLevel(text: string): 'Express' | 'Standard' | 'Economy' | null {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('express') || lowerText.includes('fast') || 
        lowerText.includes('urgent') || lowerText.includes('quick')) {
      return 'Express';
    }
    
    if (lowerText.includes('economy') || lowerText.includes('cheap') || 
        lowerText.includes('budget') || lowerText.includes('slow')) {
      return 'Economy';
    }
    
    if (lowerText.includes('standard') || lowerText.includes('normal') || 
        lowerText.includes('regular')) {
      return 'Standard';
    }
    
    return null;
  }

  static isDocumentQuery(text: string): boolean {
    const documentKeywords = [
      'document', 'pdf', 'file', 'invoice', 'what is in',
      'summarize', 'summary', 'tell me about', 'what does',
      'show me', 'read', 'analyze', 'extract', 'find'
    ];

    const lowerText = text.toLowerCase();
    return documentKeywords.some(keyword => lowerText.includes(keyword));
  }

  static smartExtract(text: string, currentData: ConversationState['shipmentData']): Partial<ConversationState['shipmentData']> {
    const extracted: Partial<ConversationState['shipmentData']> = {};

    if (!currentData.origin) {
      const location = this.extractLocation(text);
      if (location) extracted.origin = location;
    }

    if (currentData.origin && !currentData.destination) {
      const location = this.extractLocation(text);
      if (location && location !== currentData.origin) {
        extracted.destination = location;
      }
    }

    if (!currentData.weight) {
      const weight = this.extractWeight(text);
      if (weight) extracted.weight = weight;
    }

    if (!currentData.cargo) {
      const cargo = this.extractCargo(text);
      if (cargo) extracted.cargo = cargo;
    }

    if (!currentData.serviceLevel) {
      const service = this.extractServiceLevel(text);
      if (service) extracted.serviceLevel = service;
    }

    return extracted;
  }
}

// Response templates
export class ResponseGenerator {
  static greeting(): string {
    return `Hello! I'm your shipping assistant. I'll help you get freight quotes for your shipment.

To get started, please tell me:
- Where are you shipping FROM?
- Where are you shipping TO?

Example: "From Mumbai to New York" or "Mumbai to Dubai"

You can also:
- Upload commercial invoices anytime
- Upload documents and ask questions about them
- Type "help" for more options`;
  }

  static askOrigin(attempts: number): string {
    if (attempts === 0) {
      return `Great! Where is your shipment starting from? (City or Country)

Example: Mumbai, India or just "Mumbai"`;
    } else {
      return `I couldn't find a valid origin location. Please provide the city/country you're shipping FROM.

Examples:
- Mumbai
- Delhi, India  
- New York, USA`;
    }
  }

  static askDestination(origin: string, attempts: number): string {
    if (attempts === 0) {
      return `Perfect! Shipping from ${origin}. 

Now, where is the destination? (City or Country)`;
    } else {
      return `I need the destination location. Where should we deliver your shipment?

Current origin: ${origin}

Examples:
- New York
- Dubai, UAE
- London, UK`;
    }
  }

  static askCargo(attempts: number): string {
    if (attempts === 0) {
      return `What are you shipping? Please describe your cargo.

Examples:
- Electronics and components
- Textile samples
- Machinery parts
- Documents`;
    } else {
      return `Please describe what you're shipping. This helps us provide accurate quotes.

Examples: "Electronics", "Garments", "Machinery parts"`;
    }
  }

  static askWeight(attempts: number): string {
    if (attempts === 0) {
      return `What's the approximate weight of your shipment?

You can say:
- "50 kg"
- "100 kilos"
- "2 tons"`;
    } else {
      return `I need the weight to calculate shipping costs. Please provide:

- Weight in kg (e.g., "50 kg")
- Weight in lbs (e.g., "110 lbs")  
- Or approximate weight (e.g., "around 100 kg")`;
    }
  }

  static askServiceLevel(): string {
    return `What service level do you prefer?

- Express - Fastest delivery (1-3 days)
- Standard - Balanced speed & cost (4-7 days)
- Economy - Most affordable (8-14 days)

Type: Express, Standard, or Economy
(or just say "standard" for default)`;
  }

  static confirmDetails(data: ConversationState['shipmentData']): string {
    return `Let me confirm your shipment details:

From: ${data.origin || 'Not specified'}
To: ${data.destination || 'Not specified'}
Cargo: ${data.cargo || 'Not specified'}
Weight: ${data.weight || 'Not specified'}
Service: ${data.serviceLevel || 'Standard'}

Should I generate quotes for this shipment? (Type "yes" to proceed)`;
  }

  static invalidInput(): string {
    return `I didn't quite understand that. Could you please rephrase?`;
  }

  static invoiceUploaded(validation: any): string {
    let response = `✅ Invoice Validation Complete!\n\n`;
    response += `Completeness: ${validation.completeness}%\n\n`;

    if (validation.isValid) {
      response += `Status: Valid - All required fields present\n\n`;
      response += `I've extracted shipment details from your invoice. I'll use this to generate quotes.`;
    } else {
      response += `Status: Some required fields are missing\n\n`;
      if (validation.errors && validation.errors.length > 0) {
        response += `Issues found:\n`;
        validation.errors.forEach((err: string) => {
          response += `- ${err}\n`;
        });
      }
      response += `\nLet's continue with manual entry.`;
    }

    return response;
  }

  static documentUploaded(filename: string, processed: boolean): string {
    if (processed) {
      return `✅ Document uploaded and processed: ${filename}

You can now ask questions about this document, or continue with your shipment booking.`;
    } else {
      return `📄 Document uploaded: ${filename}

Processing... This may take 10-30 seconds. You can continue with your shipment booking, and I'll let you know when the document is ready for questions.`;
    }
  }

  static help(): string {
    return `Here's what I can do:

**Shipment Booking:**
- Get freight quotes
- Book shipments
- Track shipments

**Document Management:**
- Upload and process invoices
- Upload PDFs and ask questions
- Extract information from documents

**Commands:**
- "start over" - Reset conversation
- "help" - Show this message
- "status" - Show current shipment details

How can I help you today?`;
  }
}

// State machine logic
export class WorkflowStateMachine {
  static determineNextStep(state: ConversationState): WorkflowStep {
    const { shipmentData } = state;

    const hasOrigin = !!shipmentData.origin;
    const hasDestination = !!shipmentData.destination;
    const hasCargo = !!shipmentData.cargo;
    const hasWeight = !!shipmentData.weight;
    const hasService = !!shipmentData.serviceLevel;

    if (hasOrigin && hasDestination && hasCargo && hasWeight) {
      return 'ready_for_quote';
    }

    if (!hasOrigin) return 'collect_origin';
    if (!hasDestination) return 'collect_destination';
    if (!hasCargo) return 'collect_cargo';
    if (!hasWeight) return 'collect_weight';
    if (!hasService) return 'collect_service_level';

    return 'ready_for_quote';
  }

  static processUserMessage(
    state: ConversationState,
    userMessage: string
  ): {
    nextState: ConversationState;
    response: string;
    action?: 'GENERATE_QUOTE' | 'DOCUMENT_QUERY';
  } {
    const lowerMessage = userMessage.toLowerCase().trim();

    if (userMessage.includes('Invoice uploaded:') || userMessage.includes('Document uploaded:')) {
      return { nextState: state, response: '' };
    }

    if (lowerMessage === 'help' || lowerMessage === 'commands') {
      return {
        nextState: state,
        response: ResponseGenerator.help()
      };
    }

    if (lowerMessage === 'status' || lowerMessage === 'show details') {
      return {
        nextState: state,
        response: ResponseGenerator.confirmDetails(state.shipmentData)
      };
    }

    if (DataExtractor.isDocumentQuery(userMessage) && state.documentIds.length > 0) {
      return {
        nextState: state,
        response: '',
        action: 'DOCUMENT_QUERY'
      };
    }

    const extracted = DataExtractor.smartExtract(userMessage, state.shipmentData);
    const updatedData = { ...state.shipmentData, ...extracted };

    let response = '';
    let attempts = state.attempts;

    switch (state.currentStep) {
      case 'greeting':
        if (extracted.origin || extracted.destination) {
          response = extracted.origin 
            ? ResponseGenerator.askDestination(extracted.origin, 0)
            : ResponseGenerator.askOrigin(0);
        } else {
          response = ResponseGenerator.askOrigin(0);
        }
        attempts = 0;
        break;

      case 'collect_origin':
        if (extracted.origin) {
          response = ResponseGenerator.askDestination(extracted.origin, 0);
          attempts = 0;
        } else {
          attempts++;
          response = ResponseGenerator.askOrigin(attempts);
        }
        break;

      case 'collect_destination':
        if (extracted.destination) {
          response = ResponseGenerator.askCargo(0);
          attempts = 0;
        } else {
          attempts++;
          response = ResponseGenerator.askDestination(updatedData.origin!, attempts);
        }
        break;

      case 'collect_cargo':
        if (extracted.cargo) {
          response = ResponseGenerator.askWeight(0);
          attempts = 0;
        } else {
          attempts++;
          response = ResponseGenerator.askCargo(attempts);
        }
        break;

      case 'collect_weight':
        if (extracted.weight) {
          response = ResponseGenerator.askServiceLevel();
          attempts = 0;
        } else {
          attempts++;
          response = ResponseGenerator.askWeight(attempts);
        }
        break;

      case 'collect_service_level':
        if (extracted.serviceLevel) {
          response = ResponseGenerator.confirmDetails(updatedData);
          attempts = 0;
        } else {
          updatedData.serviceLevel = 'Standard';
          response = ResponseGenerator.confirmDetails(updatedData);
          attempts = 0;
        }
        break;

      case 'ready_for_quote':
        if (lowerMessage.includes('yes') || lowerMessage.includes('confirm') || 
            lowerMessage.includes('proceed') || lowerMessage.includes('generate')) {
          return {
            nextState: {
              ...state,
              currentStep: 'quote_generated',
              shipmentData: updatedData,
              attempts: 0,
              lastActivity: new Date().toISOString()
            },
            response: 'GENERATE_QUOTE',
            action: 'GENERATE_QUOTE'
          };
        } else if (lowerMessage.includes('no') || lowerMessage.includes('change')) {
          response = 'What would you like to change? (origin, destination, cargo, weight, service)';
        } else {
          response = ResponseGenerator.confirmDetails(updatedData);
        }
        break;

      default:
        response = ResponseGenerator.invalidInput();
    }

    const nextStep = this.determineNextStep({
      ...state,
      shipmentData: updatedData
    });

    const nextState: ConversationState = {
      ...state,
      currentStep: nextStep,
      shipmentData: updatedData,
      attempts,
      lastActivity: new Date().toISOString()
    };

    return { nextState, response };
  }
}

export function createInitialConversationState(
  threadId: string,
  userId: string,
  organizationId: string
): ConversationState {
  return {
    threadId,
    userId,
    organizationId,
    currentStep: 'greeting',
    shipmentData: {},
    invoiceIds: [],
    documentIds: [],
    messages: [{
      role: 'system',
      content: 'Conversation started',
      timestamp: new Date().toISOString()
    }],
    attempts: 0,
    lastActivity: new Date().toISOString()
  };
}