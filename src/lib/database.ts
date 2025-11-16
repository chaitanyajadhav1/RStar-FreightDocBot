// src/lib/database.ts - Database operations with Supabase

import { supabaseAdmin } from './config';
import { ConversationState } from './workflow';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


// ========== CONVERSATION STATE MANAGEMENT ==========

export async function createConversationState(state: ConversationState) {
  const { data, error } = await supabaseAdmin
    .from('conversation_states')
    .insert([{
      thread_id: state.threadId,
      user_id: state.userId,
      organization_id: state.organizationId,
      current_step: state.currentStep,
      shipment_data: state.shipmentData,
      invoice_ids: state.invoiceIds,
      document_ids: state.documentIds,
      messages: state.messages,
      attempts: state.attempts,
      last_activity: state.lastActivity,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single();
  
  if (error) {
    console.error('[DB] Error creating conversation state:', error);
    throw error;
  }
  return data;
}

export async function getConversationState(threadId: string): Promise<ConversationState | null> {
  const { data, error } = await supabaseAdmin
    .from('conversation_states')
    .select('*')
    .eq('thread_id', threadId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[DB] Error fetching conversation state:', error);
    throw error;
  }

  if (!data) return null;

  return {
    threadId: data.thread_id,
    userId: data.user_id,
    organizationId: data.organization_id,
    currentStep: data.current_step,
    shipmentData: data.shipment_data || {},
    invoiceIds: data.invoice_ids || [],
    documentIds: data.document_ids || [],
    messages: data.messages || [],
    attempts: data.attempts || 0,
    lastActivity: data.last_activity
  };
}

export async function updateConversationState(state: ConversationState) {
  const { data, error } = await supabaseAdmin
    .from('conversation_states')
    .update({
      current_step: state.currentStep,
      shipment_data: state.shipmentData,
      invoice_ids: state.invoiceIds,
      document_ids: state.documentIds,
      messages: state.messages.slice(-50),
      attempts: state.attempts,
      last_activity: state.lastActivity,
      updated_at: new Date().toISOString()
    })
    .eq('thread_id', state.threadId)
    .select()
    .single();
  
  if (error) {
    console.error('[DB] Error updating conversation state:', error);
    throw error;
  }
  return data;
}

export async function deleteConversationState(threadId: string) {
  const { error } = await supabaseAdmin
    .from('conversation_states')
    .delete()
    .eq('thread_id', threadId);
  
  if (error) {
    console.error('[DB] Error deleting conversation state:', error);
    throw error;
  }
}

export async function getUserConversations(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('conversation_states')
    .select('thread_id, current_step, last_activity, shipment_data')
    .eq('user_id', userId)
    .order('last_activity', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('[DB] Error fetching user conversations:', error);
    throw error;
  }
  return data || [];
}

// ========== DOCUMENT MANAGEMENT ==========

export async function createDocument(docData: {
  documentId: string;
  userId: string;
  organizationId?: string;
  filename: string;
  filepath?: string;
  collectionName: string;
  strategy: string;
}) {
  console.log('[DB] Creating document with data:', {
    document_id: docData.documentId,
    user_id: docData.userId,
    organization_id: docData.organizationId,
    filename: docData.filename
  });

  const { data, error } = await supabaseAdmin
    .from('documents')
    .insert([{
      document_id: docData.documentId,
      user_id: docData.userId,
      organization_id: docData.organizationId || null,
      filename: docData.filename,
      filepath: docData.filepath || null,
      collection_name: docData.collectionName,
      strategy: docData.strategy,
      uploaded_at: new Date().toISOString(),
      processed: false
    }])
    .select()
    .single();

  if (error) {
    console.error('[DB] Error creating document:', error);
    throw error;
  }

  console.log('[DB] Document created successfully:', data?.document_id);
  return data;
}

export async function getUserDocuments(userId: string) {
  console.log('[DB] Fetching documents for user:', userId);
  
  try {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching user documents:', error);
      throw error;
    }
    
    console.log('[DB] Found user documents:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[DB] Exception in getUserDocuments:', err);
    throw err;
  }
}

export async function getOrganizationDocuments(organizationId: string) {
  console.log('[DB] Fetching documents for organization:', organizationId);
  
  try {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('organization_id', organizationId)
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching organization documents:', error);
      throw error;
    }
    
    console.log('[DB] Found organization documents:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[DB] Exception in getOrganizationDocuments:', err);
    throw err;
  }
}

export async function getDocumentById(documentId: string) {
  console.log('[DB] Fetching document by ID:', documentId);
  
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('document_id', documentId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] Error fetching document:', error);
    throw error;
  }
  
  return data || null;
}

// ========== INVOICE MANAGEMENT ==========
export async function createInvoiceRecord(invoiceData: any) {
  console.log('[DB] Creating invoice record with data:', {
    invoice_id: invoiceData.invoice_id,
    thread_id: invoiceData.thread_id,
    invoice_no: invoiceData.invoice_no,
    organization_id: invoiceData.organization_id
  });

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .insert([{
      // Basic Info
      invoice_id: invoiceData.invoice_id,
      user_id: invoiceData.user_id,
      organization_id: invoiceData.organization_id,
      thread_id: invoiceData.thread_id,
      filename: invoiceData.filename,
      filepath: invoiceData.filepath,
      uploaded_at: invoiceData.uploaded_at,
      processed_at: invoiceData.processed_at,
      status: invoiceData.status,
      
      // Invoice Details
      invoice_no: invoiceData.invoice_no,
      invoice_date: invoiceData.invoice_date,
      reference_no: invoiceData.reference_no || null,
      proforma_invoice_no: invoiceData.proforma_invoice_no || null,
      marks_and_nos: invoiceData.marks_and_nos || null,  // ✅ ADDED: Was missing
      
      // Consignee Information
      consignee_name: invoiceData.consignee_name,
      consignee_address: invoiceData.consignee_address,
      consignee_email: invoiceData.consignee_email || null,
      consignee_phone: invoiceData.consignee_phone || null,
      consignee_country: invoiceData.consignee_country || null,
      
      // Exporter Information  
      exporter_name: invoiceData.exporter_name,
      exporter_address: invoiceData.exporter_address,
      exporter_email: invoiceData.exporter_email || null,
      exporter_phone :invoiceData.exporter_phone|| null,
      exporter_pan: invoiceData.exporter_pan || null,
      exporter_gstin: invoiceData.exporter_gstin || null,
      exporter_iec: invoiceData.exporter_iec || null,
      
      // Bank Details
      bank_name: invoiceData.bank_name || null,
      bank_account: invoiceData.bank_account || null,
      bank_swift_code: invoiceData.bank_swift_code || null,
      bank_ifsc_code: invoiceData.bank_ifsc_code || null,
      
      // Shipping Details
      incoterms: invoiceData.incoterms || null,
      place_of_receipt: invoiceData.place_of_receipt || null,
      port_of_loading: invoiceData.port_of_loading || null,
      port_of_discharge: invoiceData.port_of_discharge || null,
      final_destination: invoiceData.final_destination || null,
      country_of_origin: invoiceData.country_of_origin || null,
      hsn_code: invoiceData.hsn_code || null,  // ✅ ADDED: Was missing
      // country_of_destination - not in InvoiceMetadata interface
      
      // Financial Details
      total_amount: invoiceData.total_amount || null,
      currency: invoiceData.currency || 'USD',
      
      // Payment Terms (if exists in your schema)
      payment_terms: invoiceData.payment_terms || null,
      
      // Validation and Verification
      is_valid: invoiceData.is_valid,
      completeness: invoiceData.completeness,
      validation_errors: invoiceData.validation_errors || [],
      validation_warnings: invoiceData.validation_warnings || [],
      
      // Items and Signature
      item_count: invoiceData.item_count || 0,
      items: invoiceData.items || [],
      has_signature: invoiceData.has_signature || false,
      
      // Certifications (if exists in your schema)
      igst_status: invoiceData.igst_status || null,
      drawback_sr_no: invoiceData.drawback_sr_no || null,
      rodtep_claim: invoiceData.rodtep_claim || false,
      commission_rate: invoiceData.commission_rate || null,
      
      // Verification Status (if exists in your schema)
      verification_status: invoiceData.verification_status || 'pending',
      verification_data: invoiceData.verification_data || null,
      
      // Metadata
      extracted_text: invoiceData.extracted_text || null,
      document_type: invoiceData.document_type || 'invoice'
    }])
    .select()
    .single();

  if (error) {
    console.error('[DB] Error creating invoice:', error);
    throw error;
  }
  
  console.log('[DB] Invoice created successfully:', data?.invoice_id);
  return data;
}


export async function verifyInvoiceSaved(invoiceId: string) {
  console.log('[DB] Verifying invoice was saved:', invoiceId);
  
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('invoice_id, invoice_no, filepath, status, organization_id')
    .eq('invoice_id', invoiceId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('[DB] Invoice not found in database');
      return null;
    }
    console.error('[DB] Verification error:', error);
    return null;
  }

  console.log('[DB] ✅ Verification success:', {
    invoice_id: data.invoice_id,
    invoice_no: data.invoice_no,
    filepath: data.filepath,
    status: data.status,
    organization_id: data.organization_id
  });
  
  return data;
}

export async function getSessionInvoices(threadId: string) {
  console.log('[DB] Fetching invoices for thread:', threadId);
  
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('thread_id', threadId)
    .order('uploaded_at', { ascending: false});
  
  if (error) {
    console.error('[DB] Error fetching invoices:', error);
    throw error;
  }
  
  console.log('[DB] Found invoices:', data?.length || 0);
  return data || [];
}

export async function getUserInvoices(userId: string) {
  console.log('[DB] Fetching all invoices for user:', userId);
  
  try {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching user invoices:', error);
      throw error;
    }
    
    console.log('[DB] Found user invoices:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[DB] Exception in getUserInvoices:', err);
    throw err;
  }
}

// Export Declaration Database Functions
// src/lib/database.ts - Export Declaration Functions

// ============================================
// HELPER FUNCTION - Ensure proper type conversion
// ============================================
function sanitizeExportDeclarationData(data: any) {
  // Convert booleans to integers for database
  const convertBool = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (typeof val === 'string') {
      const normalized = val.toLowerCase().trim();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') return 1;
      if (normalized === 'false' || normalized === '0' || normalized === 'no') return 0;
      return null;
    }
    if (typeof val === 'number') return val !== 0 ? 1 : 0;
    return null;
  };

  return {
    declaration_id: data.declaration_id,
    user_id: data.user_id,
    organization_id: data.organization_id || null,
    thread_id: data.thread_id,
    filename: data.filename,
    filepath: data.filepath,
    uploaded_at: data.uploaded_at,
    processed_at: data.processed_at,
    status: data.status,
    
    // Core fields
    document_type: data.document_type || null,
    invoice_no: data.invoice_no || null,
    invoice_date: data.invoice_date || null,
    shipping_bill_no: data.shipping_bill_no || null,
    shipping_bill_date: data.shipping_bill_date || null,
    
    // Valuation fields - ENSURE INTEGER CONVERSION
    valuation_method: data.valuation_method || null,
    seller_buyer_related: convertBool(data.seller_buyer_related),
    relationship_influenced_price: convertBool(data.relationship_influenced_price),
    applicable_rule: data.applicable_rule || null,
    
    // Transaction fields
    payment_terms: data.payment_terms || null,
    delivery_terms: data.delivery_terms || null,
    type_of_sale: data.type_of_sale || null,
    
    // Declaration fields
    declaration_status: data.declaration_status || null,
    signed_by: data.signed_by || null,
    signed_date: data.signed_date || null,
    declaration_number: data.declaration_number || null,
    
    // Validation - is_valid stays as boolean for the database
    is_valid: Boolean(data.is_valid),
    completeness: Number(data.completeness) || 0,
    validation_errors: data.validation_errors || [],
    validation_warnings: data.validation_warnings || [],
    
    // Text extraction
    extracted_text: data.extracted_text || null
  };
}

// ============================================
// CREATE EXPORT DECLARATION RECORD
// ============================================
export async function createExportDeclarationRecord(declarationData: any) {
  // Sanitize data before insertion
  const sanitizedData = sanitizeExportDeclarationData(declarationData);
  
  console.log('[DB] Inserting sanitized data:', {
    seller_buyer_related: sanitizedData.seller_buyer_related,
    relationship_influenced_price: sanitizedData.relationship_influenced_price
  });
  
  const { data, error } = await supabaseAdmin
    .from('export_declarations')
    .insert([sanitizedData])
    .select()
    .single();

  if (error) {
    console.error('[DB] Export declaration insert error:', error);
    throw error;
  }

  return data;
}

// ============================================
// VERIFY EXPORT DECLARATION SAVED
// ============================================
export async function verifyExportDeclarationSaved(declarationId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('export_declarations')
    .select('declaration_id')
    .eq('declaration_id', declarationId)
    .single();

  if (error) {
    console.error('[DB] Verification error:', error);
    return false;
  }

  return !!data;
}



export async function getExportDeclaration(declarationId: string) {
  const { data, error } = await supabaseAdmin
    .from('export_declarations')
    .select('*')
    .eq('declaration_id', declarationId)
    .single();

  if (error) {
    console.error('[DB] Export declaration fetch error:', error);
    throw error;
  }

  return data;
}

export async function getUserExportDeclarations(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('export_declarations')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('[DB] User export declarations fetch error:', error);
    throw error;
  }

  return data;
}


export async function getUserAirwayBills(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('airway_bills')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('[DB] User export declarations fetch error:', error);
    throw error;
  }

  return data;
}

export async function getOrganizationInvoices(organizationId: string) {
  console.log('[DB] Fetching all invoices for organization:', organizationId);
  
  try {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('organization_id', organizationId)
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching organization invoices:', error);
      throw error;
    }
    
    console.log('[DB] Found organization invoices:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[DB] Exception in getOrganizationInvoices:', err);
    throw err;
  }
}






export async function getInvoiceById(invoiceId: string) {
  console.log('[DB] Fetching invoice by ID:', invoiceId);
  
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('invoice_id', invoiceId)
    .single();
  console.log(invoiceId);
  if (error && error.code !== 'PGRST116') {
    console.error('[DB] Error fetching invoice:', error);
    throw error;
  }
  
  return data || null;
}


export async function getInvoiceByIdAndUserId(invoiceId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('invoice_id', invoiceId)  // ← Using invoice_id
    .eq('user_id', userId)
    .single();

  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  
  return data;
}

export async function deleteInvoiceByIdAndUser(invoiceId: string, userId: string) {
  const { error } = await supabaseAdmin
    .from('invoices')
    .delete()
    .eq('invoice_id', invoiceId)
    .eq('user_id', userId);
  
  if (error) throw error;
}
// ========== SHIPPING MANAGEMENT ==========

export async function saveShippingQuote(sessionId: string, quoteData: any, userId: string, organizationId?: string) {
  const { data, error } = await supabaseAdmin
    .from('shipping_quotes')
    .insert([{
      session_id: sessionId,
      user_id: userId,
      organization_id: organizationId || null,
      quote_data: quoteData,
      created_at: new Date().toISOString()
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createShipmentTracking(bookingData: any) {
  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .insert([{
      tracking_number: bookingData.trackingNumber,
      booking_id: bookingData.bookingId,
      user_id: bookingData.userId,
      organization_id: bookingData.organizationId || null,
      session_id: bookingData.sessionId,
      carrier_id: bookingData.carrierId,
      service_level: bookingData.serviceLevel,
      origin: bookingData.origin,
      destination: bookingData.destination,
      status: 'pickup_scheduled',
      estimated_delivery: bookingData.estimatedDelivery,
      tracking_events: [],
      created_at: new Date().toISOString()
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getShipmentTracking(trackingNumber: string, userId?: string, organizationId?: string) {
  let query = supabaseAdmin
    .from('shipment_tracking')
    .select('*')
    .eq('tracking_number', trackingNumber);
  
  if (userId) query = query.eq('user_id', userId);
  if (organizationId) query = query.eq('organization_id', organizationId);
  
  const { data, error } = await query.single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function getUserShipments(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getOrganizationShipments(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ========== BANK DETAILS MANAGEMENT ==========

export async function createBankDetails(bankData: {
  userId: string;
  organizationId?: string;
  threadId: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  swiftOrIfsc: string;
}) {
  console.log('[DB] Creating bank details for thread:', bankData.threadId);

  const { data, error } = await supabaseAdmin
    .from('bank_details')
    .insert([{
      user_id: bankData.userId,
      organization_id: bankData.organizationId || null,
      thread_id: bankData.threadId,
      account_name: bankData.accountName,
      bank_name: bankData.bankName,
      account_number: bankData.accountNumber,
      swift_or_ifsc: bankData.swiftOrIfsc,
      verified: false,
      verification_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) {
    console.error('[DB] Error creating bank details:', error);
    throw error;
  }

  console.log('[DB] Bank details created successfully:', data?.bank_detail_id);
  return data;
}

export async function getBankDetailsByThread(threadId: string) {
  console.log('[DB] Fetching bank details for thread:', threadId);

  const { data, error } = await supabaseAdmin
    .from('bank_details')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('[DB] No bank details found for thread');
      return null;
    }
    console.error('[DB] Error fetching bank details:', error);
    throw error;
  }

  return data;
}

export async function getUserBankDetails(userId: string) {
  console.log('[DB] Fetching all bank details for user:', userId);

  const { data, error } = await supabaseAdmin
    .from('bank_details')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[DB] Error fetching user bank details:', error);
    throw error;
  }

  console.log('[DB] Found bank details:', data?.length || 0);
  return data || [];
}

export async function getOrganizationBankDetails(organizationId: string) {
  console.log('[DB] Fetching all bank details for organization:', organizationId);

  const { data, error } = await supabaseAdmin
    .from('bank_details')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[DB] Error fetching organization bank details:', error);
    throw error;
  }

  console.log('[DB] Found bank details:', data?.length || 0);
  return data || [];
}

export async function updateBankDetailsVerification(
  bankDetailId: string,
  verificationData: {
    verified: boolean;
    verificationStatus: string;
    verificationNotes: string;
  }
) {
  console.log('[DB] Updating bank details verification:', bankDetailId);

  const { data, error } = await supabaseAdmin
    .from('bank_details')
    .update({
      verified: verificationData.verified,
      verification_status: verificationData.verificationStatus,
      verification_notes: verificationData.verificationNotes,
      updated_at: new Date().toISOString()
    })
    .eq('bank_detail_id', bankDetailId)
    .select()
    .single();

  if (error) {
    console.error('[DB] Error updating bank details verification:', error);
    throw error;
  }

  console.log('[DB] Bank details verification updated successfully');
  return data;
}

export async function updateInvoiceVerification(
  invoiceId: string,
  verificationData: {
    verificationStatus: string;
    verificationData: any;
  }
) {
  console.log('[DB] Updating invoice verification:', invoiceId);

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .update({
      verification_status: verificationData.verificationStatus,
      verification_data: verificationData.verificationData
    })
    .eq('invoice_id', invoiceId)
    .select()
    .single();

  if (error) {
    console.error('[DB] Error updating invoice verification:', error);
    throw error;
  }

  console.log('[DB] Invoice verification updated successfully');
  return data;
}

export async function linkBankDetailsToShipment(
  trackingNumber: string,
  bankDetailId: string
) {
  console.log('[DB] Linking bank details to shipment:', trackingNumber);

  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .update({ bank_detail_id: bankDetailId })
    .eq('tracking_number', trackingNumber)
    .select()
    .single();

  if (error) {
    console.error('[DB] Error linking bank details to shipment:', error);
    throw error;
  }

  console.log('[DB] Bank details linked to shipment successfully');
  return data;
}

// ========== VERIFICATION FUNCTIONS ==========

export async function getVerificationSummary(threadId: string) {
  console.log('[DB] Fetching verification summary for thread:', threadId);

  const invoices = await getSessionInvoices(threadId);
  const bankDetails = await getBankDetailsByThread(threadId);
  
  const { data: shipment } = await supabaseAdmin
    .from('shipment_tracking')
    .select('*')
    .eq('session_id', threadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const invoiceStats = {
    total: invoices.length,
    verified: invoices.filter((inv: any) => inv.verification_status === 'verified').length,
    pending: invoices.filter((inv: any) => inv.verification_status === 'pending').length,
    failed: invoices.filter((inv: any) => inv.verification_status === 'failed').length
  };

  const allInvoicesVerified = invoiceStats.total > 0 && invoiceStats.verified === invoiceStats.total;
  const bankVerified = bankDetails?.verified || false;
  const readyForShipment = allInvoicesVerified && bankVerified;

  return {
    threadId,
    invoices: {
      ...invoiceStats,
      details: invoices.map((inv: any) => ({
        invoiceId: inv.invoice_id,
        filename: inv.filename,
        status: inv.verification_status,
        invoiceNo: inv.invoice_no
      }))
    },
    bankDetails: bankDetails ? {
      bankDetailId: bankDetails.bank_detail_id,
      verified: bankDetails.verified,
      status: bankDetails.verification_status,
      accountName: bankDetails.account_name,
      bankName: bankDetails.bank_name,
      notes: bankDetails.verification_notes
    } : null,
    shipment: shipment ? {
      trackingNumber: shipment.tracking_number,
      status: shipment.status,
      origin: shipment.origin,
      destination: shipment.destination
    } : null,
    overallStatus: calculateOverallStatus(allInvoicesVerified, bankVerified, !!shipment),
    readyForShipment,
    timestamp: new Date().toISOString()
  };
}

function calculateOverallStatus(
  allInvoicesVerified: boolean,
  bankVerified: boolean,
  hasShipment: boolean
): string {
  if (allInvoicesVerified && bankVerified) {
    return hasShipment ? 'ready_to_ship' : 'ready_for_booking';
  }
  if (bankVerified) return 'invoices_pending';
  if (allInvoicesVerified) return 'bank_details_pending';
  return 'verification_pending';
}

// ========== CROSS-VERIFICATION FUNCTIONS ==========

interface VerificationResult {
  verified: boolean;
  status: string;
  notes: string;
  invoiceData: {
    checks: {
      accountNameMatch: boolean;
      bankNameMatch: boolean;
      invoiceConsistency: boolean;
      amountReasonable: boolean;
    };
    passedChecks: number;
    totalChecks: number;
    invoices: Record<string, any>;
  };
}

export async function performCrossVerification(
  bankDetail: any,
  invoices: any[]
): Promise<VerificationResult> {
  const checks = {
    accountNameMatch: false,
    bankNameMatch: false,
    invoiceConsistency: false,
    amountReasonable: false
  };

  const notes: string[] = [];
  const invoiceData: Record<string, any> = {};

  if (invoices.length === 0) {
    return {
      verified: false,
      status: 'no_invoices',
      notes: 'No invoices found for verification',
      invoiceData: {
        checks,
        passedChecks: 0,
        totalChecks: 4,
        invoices: {}
      }
    };
  }

  for (const invoice of invoices) {
    if (invoice.consignee_name || invoice.exporter_name) {
      const invoiceName = (invoice.consignee_name || invoice.exporter_name || '').toLowerCase();
      const accountName = bankDetail.account_name.toLowerCase();
      
      const similarity = calculateSimilarity(invoiceName, accountName);
      if (similarity > 0.7) {
        checks.accountNameMatch = true;
        notes.push(`✓ Account name matches invoice (${Math.round(similarity * 100)}% match)`);
      } else {
        notes.push(`⚠ Account name mismatch: Invoice="${invoiceName}", Bank="${accountName}"`);
      }
    }

    if (invoice.bank_name) {
      const invoiceBank = invoice.bank_name.toLowerCase();
      const providedBank = bankDetail.bank_name.toLowerCase();
      
      if (invoiceBank.includes(providedBank) || providedBank.includes(invoiceBank)) {
        checks.bankNameMatch = true;
        notes.push('✓ Bank name matches invoice');
      } else {
        notes.push(`⚠ Bank name differs: Invoice="${invoiceBank}", Provided="${providedBank}"`);
      }
    }

    if (invoice.bank_account) {
      const invoiceAccount = String(invoice.bank_account).replace(/\s/g, '');
      const providedAccount = bankDetail.account_number.replace(/\s/g, '');
      
      if (invoiceAccount === providedAccount) {
        notes.push('✓ Account number matches invoice');
      } else {
        notes.push('⚠ Account number mismatch detected');
      }
    }

    if (invoice.items && Array.isArray(invoice.items)) {
      const totalAmount = invoice.items.reduce((sum: number, item: any) => {
        return sum + (parseFloat(item.amount) || 0);
      }, 0);
      
      if (totalAmount > 0 && totalAmount < 10000000) {
        checks.amountReasonable = true;
      }
    }

    invoiceData[invoice.invoice_id] = {
      invoice_no: invoice.invoice_no,
      invoice_date: invoice.invoice_date,
      consignee: invoice.consignee_name,
      exporter: invoice.exporter_name,
      item_count: invoice.item_count
    };
  }

  if (invoices.length > 1) {
    const consignees = invoices
      .map(inv => inv.consignee_name || inv.exporter_name)
      .filter(Boolean);
    
    const uniqueConsignees = new Set(consignees.map(c => c.toLowerCase()));
    checks.invoiceConsistency = uniqueConsignees.size === 1;
    
    if (checks.invoiceConsistency) {
      notes.push('✓ All invoices have consistent beneficiary information');
    } else {
      notes.push('⚠ Multiple beneficiaries found across invoices');
    }
  } else {
    checks.invoiceConsistency = true;
  }

  const passedChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;

  let verified = false;
  let status = 'needs_review';

  if (passedChecks === totalChecks) {
    verified = true;
    status = 'verified';
  } else if (passedChecks >= totalChecks * 0.7) {
    status = 'verified_with_warnings';
  } else {
    status = 'failed';
  }

  return {
    verified,
    status,
    notes: notes.join('\n'),
    invoiceData: {
      checks,
      passedChecks,
      totalChecks,
      invoices: invoiceData
    }
  };
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Add this to your database.ts file in the INVOICE MANAGEMENT section

export async function getInvoiceByNumber(invoiceNo: string) {
  console.log('[DB] Fetching invoice by number:', invoiceNo);
  
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('invoice_no', invoiceNo)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('[DB] Invoice not found by number:', invoiceNo);
      return null;
    }
    console.error('[DB] Error fetching invoice by number:', error);
    throw error;
  }
  
  return data;
}

export async function getInvoicesByNumber(invoiceNo: string) {
  console.log('[DB] Searching invoices by number:', invoiceNo);
  
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('invoice_no', invoiceNo)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('[DB] Error searching invoices by number:', error);
    throw error;
  }

  console.log('[DB] Found invoices by number:', data?.length || 0);
  return data || [];
}


// Add this function to your database.ts file in the INVOICE MANAGEMENT section

export async function updateInvoice(
  invoiceNo: string, // Changed from invoiceId
  userId: string,    // Added userId parameter
  updateData: {
    // Basic invoice info
    invoice_no?: string;
    invoice_date?: string;
    filename?: string;
    status?: string;
    
    // Consignee information
    consignee_name?: string;
    consignee_address?: string;
    consignee_email?: string;
    consignee_phone?: string;
    consignee_country?: string;
    
    // Exporter information
    exporter_name?: string;
    exporter_address?: string;
    exporter_email?: string;
    exporter_phone?: string;
    exporter_pan?: string;
    exporter_gstin?: string;
    exporter_iec?: string;
    
    // Shipping details
    incoterms?: string;
    place_of_receipt?: string;
    port_of_loading?: string;
    port_of_discharge?: string;
    final_destination?: string;
    country_of_origin?: string;
    country_of_destination?: string;
    
    // Bank details
    bank_name?: string;
    bank_account?: string;
    bank_swift_code?: string;
    bank_ifsc_code?: string;
    
    // Payment terms
    payment_terms?: string;
    
    // Validation
    is_valid?: boolean;
    completeness?: number;
    validation_errors?: any;
    validation_warnings?: any;
    
    // Items and totals
    item_count?: number;
    items?: any[];
    total_amount?: number;
    currency?: string;
    
    // Certifications
    igst_status?: string;
    drawback_sr_no?: string;
    rodtep_claim?: string;
    commission_rate?: number;
    
    // Verification
    has_signature?: boolean;
    verification_status?: string;
    verification_data?: any;
    
    // Additional fields
    reference_no?: string;
    proforma_invoice_no?: string;
    
    // Metadata (if you have this field)
    updated_at?: string;
  }
) {
  console.log('[DB] Updating invoice by invoice number and user ID:', { invoiceNo, userId });

  // Filter out undefined values to only update provided fields
  const updatePayload: any = {};
  Object.keys(updateData).forEach(key => {
    const value = updateData[key as keyof typeof updateData];
    if (value !== undefined) {
      updatePayload[key] = value;
    }
  });

  console.log('[DB] Update payload keys:', Object.keys(updatePayload));
  console.log('[DB] Update payload preview:', {
    invoice_no: updatePayload.invoice_no,
    invoice_date: updatePayload.invoice_date,
    total_amount: updatePayload.total_amount,
    currency: updatePayload.currency
  });

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .update(updatePayload)
    .eq('invoice_no', invoiceNo)  // Changed from invoice_id to invoice_no
    .eq('user_id', userId)        // Added user_id condition
    .select()
    .single();

  if (error) {
    console.error('[DB] Error updating invoice:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      invoiceNo,
      userId
    });
    throw error;
  }

  console.log('[DB] Invoice updated successfully:', data?.invoice_id);
  return data;
}
// ========== SHARED INVOICE MANAGEMENT ==========
export async function getInvoiceByInvoiceNoAndUserId(invoiceNo: string, userId: string) {
  console.log('[DB] Fetching invoice by invoice_no and user_id:', { invoiceNo, userId });
  
  try {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('invoice_no', invoiceNo)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        console.log('[DB] Invoice not found');
        return null;
      }
      console.error('[DB] Error fetching invoice:', error);
      throw error;
    }
    
    console.log('[DB] ✓ Invoice found:', {
      invoice_id: data.invoice_id,
      invoice_no: data.invoice_no,
      user_id: data.user_id
    });
    
    return data;
  } catch (err) {
    console.error('[DB] Exception in getInvoiceByInvoiceNoAndUserId:', err);
    throw err;
  }
}
export async function createSharedInvoice(invoiceId: string, shareData: {
  sharedBy: string;
  sharedWith?: string;
  expiresAt?: Date;
}) {
  const { data, error } = await supabaseAdmin
    .from('shared_invoices')
    .insert([{
      invoice_id: invoiceId,
      shared_by: shareData.sharedBy,
      shared_with: shareData.sharedWith,
      expires_at: shareData.expiresAt?.toISOString(),
      share_token: `share_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      created_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) {
    console.error('[DB] Error creating shared invoice:', error);
    throw error;
  }

  return data;
}

// Add these functions to your lib/database.ts file

// ========== SCOMET DECLARATION MANAGEMENT ==========

export async function createSCOMETDeclarationRecord(declarationData: any) {
  console.log('[DB] Creating SCOMET declaration record with data:', {
    scomet_declaration_id: declarationData.scomet_declaration_id,
    thread_id: declarationData.thread_id,
    invoice_number: declarationData.invoice_number,
    organization_id: declarationData.organization_id
  });

  const { data, error } = await supabaseAdmin
    .from('scomet_declarations')
    .insert([{
      scomet_declaration_id: declarationData.scomet_declaration_id,
      user_id: declarationData.user_id,
      organization_id: declarationData.organization_id,
      thread_id: declarationData.thread_id,
      filename: declarationData.filename,
      filepath: declarationData.filepath,
      uploaded_at: declarationData.uploaded_at,
      processed_at: declarationData.processed_at,
      status: declarationData.status,
      
      // Document info
      document_date: declarationData.document_date,
      document_type: declarationData.document_type,
      
      // Core fields
      consignee_name: declarationData.consignee_name,
      invoice_number: declarationData.invoice_number,
      invoice_date: declarationData.invoice_date,
      destination_country: declarationData.destination_country,
      
      // SCOMET specific
      scomet_coverage: declarationData.scomet_coverage,
      hs_code: declarationData.hs_code,
      goods_description: declarationData.goods_description,
      
      // Declaration fields
      declaration_statement: declarationData.declaration_statement,
      signed_status: declarationData.signed_status,
      signatory_name: declarationData.signatory_name,
      
      // Validation
      is_valid: declarationData.is_valid,
      completeness: declarationData.completeness,
      validation_errors: declarationData.validation_errors || [],
      validation_warnings: declarationData.validation_warnings || [],
      
      // Extracted text
      extracted_text: declarationData.extracted_text || null
    }])
    .select()
    .single();

  if (error) {
    console.error('[DB] Error creating SCOMET declaration:', error);
    throw error;
  }
  
  console.log('[DB] SCOMET declaration created successfully:', data?.scomet_declaration_id);
  return data;
}

export async function verifySCOMETDeclarationSaved(declarationId: string) {
  console.log('[DB] Verifying SCOMET declaration was saved:', declarationId);
  
  const { data, error } = await supabaseAdmin
    .from('scomet_declarations')
    .select('scomet_declaration_id, invoice_number, filepath, status, organization_id')
    .eq('scomet_declaration_id', declarationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('[DB] SCOMET declaration not found in database');
      return false;
    }
    console.error('[DB] Verification error:', error);
    return false;
  }

  console.log('[DB] ✅ Verification success:', {
    scomet_declaration_id: data.scomet_declaration_id,
    invoice_number: data.invoice_number,
    filepath: data.filepath,
    status: data.status,
    organization_id: data.organization_id
  });
  
  return true;
}

export async function getSCOMETDeclarationById(declarationId: string) {
  console.log('[DB] Fetching SCOMET declaration by ID:', declarationId);
  
  const { data, error } = await supabaseAdmin
    .from('scomet_declarations')
    .select('*')
    .eq('scomet_declaration_id', declarationId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[DB] Error fetching SCOMET declaration:', error);
    throw error;
  }
  
  return data || null;
}

export async function getSCOMETDeclarationsByInvoiceNumber(invoiceNumber: string) {
  console.log('[DB] Fetching SCOMET declarations by invoice number:', invoiceNumber);
  
  const { data, error } = await supabaseAdmin
    .from('scomet_declarations')
    .select('*')
    .eq('invoice_number', invoiceNumber)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('[DB] Error fetching SCOMET declarations by invoice number:', error);
    throw error;
  }
  
  console.log('[DB] Found SCOMET declarations:', data?.length || 0);
  return data || [];
}

export async function getSessionSCOMETDeclarations(threadId: string) {
  console.log('[DB] Fetching SCOMET declarations for thread:', threadId);
  
  const { data, error } = await supabaseAdmin
    .from('scomet_declarations')
    .select('*')
    .eq('thread_id', threadId)
    .order('uploaded_at', { ascending: false });
  
  if (error) {
    console.error('[DB] Error fetching SCOMET declarations:', error);
    throw error;
  }
  
  console.log('[DB] Found SCOMET declarations:', data?.length || 0);
  return data || [];
}

export async function getUserSCOMETDeclarations(userId: string) {
  console.log('[DB] Fetching all SCOMET declarations for user:', userId);
  
  try {
    const { data, error } = await supabaseAdmin
      .from('scomet_declarations')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching user SCOMET declarations:', error);
      throw error;
    }
    
    console.log('[DB] Found user SCOMET declarations:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[DB] Exception in getUserSCOMETDeclarations:', err);
    throw err;
  }
}

export async function getOrganizationSCOMETDeclarations(organizationId: string) {
  console.log('[DB] Fetching all SCOMET declarations for organization:', organizationId);
  
  try {
    const { data, error } = await supabaseAdmin
      .from('scomet_declarations')
      .select('*')
      .eq('organization_id', organizationId)
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching organization SCOMET declarations:', error);
      throw error;
    }
    
    console.log('[DB] Found organization SCOMET declarations:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[DB] Exception in getOrganizationSCOMETDeclarations:', err);
    throw err;
  }
}

export async function updateSCOMETDeclaration(declarationId: string, updateData: {
  // Document info
  document_date?: string;
  document_type?: string;
  
  // Core fields
  consignee_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  destination_country?: string;
  
  // SCOMET specific
  scomet_coverage?: boolean;
  hs_code?: string;
  goods_description?: string;
  
  // Declaration fields
  declaration_statement?: string;
  signed_status?: boolean;
  signatory_name?: string;
  
  // Validation
  is_valid?: boolean;
  completeness?: number;
  validation_errors?: any;
  validation_warnings?: any;
  status?: string;
}) {
  console.log('[DB] Updating SCOMET declaration:', declarationId);

  // Filter out undefined values
  const updatePayload: any = {};
  Object.keys(updateData).forEach(key => {
    const value = updateData[key as keyof typeof updateData];
    if (value !== undefined) {
      updatePayload[key] = value;
    }
  });

  console.log('[DB] Update payload keys:', Object.keys(updatePayload));

  const { data, error } = await supabaseAdmin
    .from('scomet_declarations')
    .update(updatePayload)
    .eq('scomet_declaration_id', declarationId)
    .select()
    .single();

  if (error) {
    console.error('[DB] Error updating SCOMET declaration:', {
      code: error.code,
      message: error.message,
      details: error.details,
      declarationId
    });
    throw error;
  }

  console.log('[DB] SCOMET declaration updated successfully:', data?.scomet_declaration_id);
  return data;
}

export async function deleteSCOMETDeclaration(declarationId: string) {
  console.log('[DB] Deleting SCOMET declaration:', declarationId);
  
  const { error } = await supabaseAdmin
    .from('scomet_declarations')
    .delete()
    .eq('scomet_declaration_id', declarationId);
  
  if (error) {
    console.error('[DB] Error deleting SCOMET declaration:', error);
    throw error;
  }
  
  console.log('[DB] SCOMET declaration deleted successfully');
}

// ========== CROSS-VERIFICATION WITH COMMERCIAL INVOICE ==========

interface SCOMETInvoiceVerificationResult {
  verified: boolean;
  status: string;
  notes: string;
  comparisonData: {
    checks: {
      invoiceNumberMatch: boolean;
      invoiceDateMatch: boolean;
      consigneeMatch: boolean;
      destinationMatch: boolean;
      hsCodeMatch: boolean;
    };
    passedChecks: number;
    totalChecks: number;
    invoiceData: any;
    scometData: any;
  };
}

export async function verifySCOMETAgainstInvoice(
  scometDeclaration: any,
  commercialInvoice: any
): Promise<SCOMETInvoiceVerificationResult> {
  console.log('[DB] Cross-verifying SCOMET declaration against commercial invoice');
  
  const checks = {
    invoiceNumberMatch: false,
    invoiceDateMatch: false,
    consigneeMatch: false,
    destinationMatch: false,
    hsCodeMatch: false
  };

  const notes: string[] = [];

  // Check Invoice Number
  if (scometDeclaration.invoice_number && commercialInvoice.invoice_no) {
    const scometInvoiceNo = String(scometDeclaration.invoice_number).trim();
    const invoiceNo = String(commercialInvoice.invoice_no).trim();
    
    if (scometInvoiceNo === invoiceNo) {
      checks.invoiceNumberMatch = true;
      notes.push(`✓ Invoice numbers match: ${invoiceNo}`);
    } else {
      notes.push(`✗ Invoice number mismatch: SCOMET="${scometInvoiceNo}", Invoice="${invoiceNo}"`);
    }
  } else {
    notes.push('⚠ Invoice number missing from one or both documents');
  }

  // Check Invoice Date
  if (scometDeclaration.invoice_date && commercialInvoice.invoice_date) {
    const scometDate = scometDeclaration.invoice_date;
    const invoiceDate = commercialInvoice.invoice_date;
    
    // Normalize dates for comparison
    const normalizedScometDate = scometDate.replace(/\./g, '-');
    const normalizedInvoiceDate = invoiceDate.replace(/\./g, '-');
    
    if (normalizedScometDate === normalizedInvoiceDate || 
        areDatesEqual(scometDate, invoiceDate)) {
      checks.invoiceDateMatch = true;
      notes.push(`✓ Invoice dates match: ${invoiceDate}`);
    } else {
      notes.push(`⚠ Invoice date differs: SCOMET="${scometDate}", Invoice="${invoiceDate}"`);
    }
  } else {
    notes.push('⚠ Invoice date missing from one or both documents');
  }

  // Check Consignee Name
  if (scometDeclaration.consignee_name && commercialInvoice.consignee_name) {
    const scometConsignee = scometDeclaration.consignee_name.toLowerCase();
    const invoiceConsignee = commercialInvoice.consignee_name.toLowerCase();
    
    const similarity = calculateSimilarity(scometConsignee, invoiceConsignee);
    
    if (similarity > 0.85) {
      checks.consigneeMatch = true;
      notes.push(`✓ Consignee names match (${Math.round(similarity * 100)}% similarity)`);
    } else if (similarity > 0.6) {
      notes.push(`⚠ Consignee names similar but not exact (${Math.round(similarity * 100)}% similarity)`);
    } else {
      notes.push(`✗ Consignee names differ significantly`);
    }
  } else {
    notes.push('⚠ Consignee name missing from one or both documents');
  }

  // Check Destination Country
  if (scometDeclaration.destination_country && commercialInvoice.country_of_destination) {
    const scometCountry = scometDeclaration.destination_country.toLowerCase().trim();
    const invoiceCountry = commercialInvoice.country_of_destination.toLowerCase().trim();
    
    if (scometCountry === invoiceCountry || 
        scometCountry.includes(invoiceCountry) || 
        invoiceCountry.includes(scometCountry)) {
      checks.destinationMatch = true;
      notes.push(`✓ Destination countries match: ${scometDeclaration.destination_country}`);
    } else {
      notes.push(`✗ Destination mismatch: SCOMET="${scometDeclaration.destination_country}", Invoice="${commercialInvoice.country_of_destination}"`);
    }
  } else {
    notes.push('⚠ Destination country missing from one or both documents');
  }

  // Check HS Code
  if (scometDeclaration.hs_code) {
    // Try to find matching HS code in invoice items or shipment details
    const scometHsCode = String(scometDeclaration.hs_code).replace(/\./g, '').trim();
    
    let invoiceHsCode = null;
    if (commercialInvoice.shipment_details?.hsn_code) {
      invoiceHsCode = String(commercialInvoice.shipment_details.hsn_code).replace(/\./g, '').trim();
    }
    
    if (invoiceHsCode) {
      // Compare first 4 or 6 digits (HS codes can vary in precision)
      const scometPrefix = scometHsCode.substring(0, 6);
      const invoicePrefix = invoiceHsCode.substring(0, 6);
      
      if (scometPrefix === invoicePrefix || scometHsCode === invoiceHsCode) {
        checks.hsCodeMatch = true;
        notes.push(`✓ HS Codes match: ${scometDeclaration.hs_code}`);
      } else {
        notes.push(`⚠ HS Code differs: SCOMET="${scometDeclaration.hs_code}", Invoice="${commercialInvoice.shipment_details.hsn_code}"`);
      }
    } else {
      notes.push('⚠ HS Code not found in commercial invoice');
    }
  }

  // Calculate results
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;

  let verified = false;
  let status = 'needs_review';

  if (passedChecks === totalChecks) {
    verified = true;
    status = 'verified';
    notes.push('✓ All checks passed - SCOMET declaration fully verified against commercial invoice');
  } else if (passedChecks >= totalChecks * 0.8) {
    verified = true;
    status = 'verified_with_warnings';
    notes.push('⚠ Most checks passed - Minor discrepancies detected');
  } else if (passedChecks >= totalChecks * 0.6) {
    status = 'partial_match';
    notes.push('⚠ Significant discrepancies detected - Manual review required');
  } else {
    status = 'failed';
    notes.push('✗ Verification failed - Major discrepancies between documents');
  }

  console.log('[DB] SCOMET verification complete:', {
    status,
    passedChecks,
    totalChecks,
    verified
  });

  return {
    verified,
    status,
    notes: notes.join('\n'),
    comparisonData: {
      checks,
      passedChecks,
      totalChecks,
      invoiceData: {
        invoice_no: commercialInvoice.invoice_no,
        invoice_date: commercialInvoice.invoice_date,
        consignee: commercialInvoice.consignee_name,
        destination: commercialInvoice.country_of_destination,
        hs_code: commercialInvoice.shipment_details?.hsn_code
      },
      scometData: {
        invoice_number: scometDeclaration.invoice_number,
        invoice_date: scometDeclaration.invoice_date,
        consignee: scometDeclaration.consignee_name,
        destination: scometDeclaration.destination_country,
        hs_code: scometDeclaration.hs_code,
        scomet_coverage: scometDeclaration.scomet_coverage
      }
    }
  };
}

// Helper function to check if dates are equal (handles different formats)
function areDatesEqual(date1: string, date2: string): boolean {
  try {
    // Try to parse dates in DD.MM.YYYY format
    const parse = (dateStr: string) => {
      const parts = dateStr.split(/[.\-\/]/);
      if (parts.length === 3) {
        // Assume DD.MM.YYYY or DD-MM-YYYY format
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
      return new Date(dateStr);
    };
    
    const d1 = parse(date1);
    const d2 = parse(date2);
    
    return d1.getTime() === d2.getTime();
  } catch (error) {
    return false;
  }
}

// Note: calculateSimilarity function already exists in your database.ts file












//Export-Declaration



// ========== EXPORT DECLARATION MANAGEMENT ==========

export async function getExportDeclarationById(declarationId: string) {
  console.log('[DB] Fetching export declaration by ID:', declarationId);
  
  const { data, error } = await supabaseAdmin
    .from('export_declarations')
    .select('*')
    .eq('declaration_id', declarationId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[DB] Error fetching export declaration:', error);
    throw error;
  }
  
  return data || null;
}

export async function updateExportDeclaration(declarationId: string, updateData: {
  // Basic Declaration Info
  declaration_no?: string;
  declaration_date?: string;
  declaration_type?: string;
  filename?: string;
  status?: string;
  reference_no?: string;
  
  // Exporter Information
  exporter_name?: string;
  exporter_address?: string;
  exporter_gstin?: string;
  exporter_iec?: string;
  exporter_pan?: string;
  exporter_email?: string;
  exporter_phone?: string;
  exporter_state?: string;
  exporter_city?: string;
  exporter_pincode?: string;
  
  // Consignee/Buyer Information
  consignee_name?: string;
  consignee_address?: string;
  consignee_country?: string;
  consignee_city?: string;
  consignee_email?: string;
  consignee_phone?: string;
  
  // Shipping Details
  port_of_loading?: string;
  port_of_discharge?: string;
  country_of_destination?: string;
  country_of_final_destination?: string;
  mode_of_shipment?: string;
  vessel_name?: string;
  shipping_bill_no?: string;
  shipping_bill_date?: string;
  container_no?: string;
  seal_no?: string;
  
  // Financial Details
  fob_value?: number;
  freight_value?: number;
  insurance_value?: number;
  total_invoice_value?: number;
  currency?: string;
  exchange_rate?: number;
  inr_value?: number;
  
  // Customs Details
  customs_office?: string;
  customs_officer?: string;
  customs_stamp?: boolean;
  let_export_order_no?: string;
  let_export_order_date?: string;
  duty_drawback_claim?: boolean;
  rodtep_claim?: boolean;
  meis_claim?: boolean;
  
  // Product Details
  items?: any[];
  item_count?: number;
  total_quantity?: number;
  total_weight?: number;
  net_weight?: number;
  gross_weight?: number;
  packaging_type?: string;
  no_of_packages?: number;
  
  // HSN and Classification
  hsn_code?: string;
  export_product_description?: string;
  statistical_code?: string;
  
  // Bank Details
  bank_name?: string;
  bank_account?: string;
  bank_swift_code?: string;
  bank_ad_code?: string;
  
  // Validation
  is_valid?: boolean;
  completeness?: number;
  validation_errors?: any;
  validation_warnings?: any;
  
  // Certification & Compliance
  certificate_of_origin?: boolean;
  phytosanitary_certificate?: boolean;
  quality_certificate?: boolean;
  has_signature?: boolean;
  verification_status?: string;
  verification_data?: any;
  verification_notes?: string;
  
  // Metadata
  updated_at?: string;
  deleted_at?: string;
}) {
  console.log('[DB] Updating export declaration:', declarationId);

  // Filter out undefined values to only update provided fields
  const updatePayload: any = {};
  Object.keys(updateData).forEach(key => {
    const value = updateData[key as keyof typeof updateData];
    if (value !== undefined) {
      updatePayload[key] = value;
    }
  });

  console.log('[DB] Update payload keys:', Object.keys(updatePayload));
  console.log('[DB] Update payload preview:', {
    declaration_no: updatePayload.declaration_no,
    declaration_date: updatePayload.declaration_date,
    status: updatePayload.status,
    total_invoice_value: updatePayload.total_invoice_value
  });

  const { data, error } = await supabaseAdmin
    .from('export_declarations')
    .update(updatePayload)
    .eq('declaration_id', declarationId)
    .select()
    .single();

  if (error) {
    console.error('[DB] Error updating export declaration:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      declarationId
    });
    throw error;
  }

  console.log('[DB] Export declaration updated successfully:', data?.declaration_id);
  return data;
}

export async function getExportDeclarationsByUser(userId: string) {
  console.log('[DB] Fetching all export declarations for user:', userId);
  
  try {
    const { data, error } = await supabaseAdmin
      .from('export_declarations')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'deleted')  // Exclude soft-deleted records
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching user export declarations:', error);
      throw error;
    }
    
    console.log('[DB] Found user export declarations:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[DB] Exception in getExportDeclarationsByUser:', err);
    throw err;
  }
}

export async function getExportDeclarationsByOrganization(organizationId: string) {
  console.log('[DB] Fetching all export declarations for organization:', organizationId);
  
  try {
    const { data, error } = await supabaseAdmin
      .from('export_declarations')
      .select('*')
      .eq('organization_id', organizationId)
      .neq('status', 'deleted')  // Exclude soft-deleted records
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching organization export declarations:', error);
      throw error;
    }
    
    console.log('[DB] Found organization export declarations:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[DB] Exception in getExportDeclarationsByOrganization:', err);
    throw err;
  }
}

export async function deleteExportDeclaration(declarationId: string) {
  console.log('[DB] Hard deleting export declaration:', declarationId);
  
  const { error } = await supabaseAdmin
    .from('export_declarations')
    .delete()
    .eq('declaration_id', declarationId);
  
  if (error) {
    console.error('[DB] Error deleting export declaration:', error);
    throw error;
  }
  
  console.log('[DB] Export declaration deleted successfully');
}



// Add these functions to your lib/database.ts file

// ========== PACKING LIST MANAGEMENT ==========
export async function createPackingListRecord(packingListData: any) {
  console.log('[DB] Creating packing list record with data:', {
    packing_list_id: packingListData.packing_list_id,
    thread_id: packingListData.thread_id,
    packing_list_number: packingListData.packing_list_number,
    organization_id: packingListData.organization_id
  });

  const { data, error } = await supabaseAdmin
    .from('packing_lists')
    .insert([{
      packing_list_id: packingListData.packing_list_id,
      user_id: packingListData.user_id,
      organization_id: packingListData.organization_id,
      thread_id: packingListData.thread_id,
      filename: packingListData.filename,
      filepath: packingListData.filepath,
      uploaded_at: packingListData.uploaded_at,
      processed_at: packingListData.processed_at,
      status: packingListData.status,
      
      // Core Packing List fields
      packing_list_number: packingListData.packing_list_number,
      packing_list_date: packingListData.packing_list_date,
      reference_no: packingListData.reference_no || null,
      proforma_invoice_no: packingListData.proforma_invoice_no || null,
      
      // Exporter details
      exporter_name: packingListData.exporter_name || null,
      exporter_address: packingListData.exporter_address || null,
      exporter_email: packingListData.exporter_email || null,
      exporter_phone: packingListData.exporter_phone || null,
      exporter_mobile: packingListData.exporter_mobile || null,
      exporter_pan: packingListData.exporter_pan || null,
      exporter_gstin: packingListData.exporter_gstin || null,
      exporter_iec: packingListData.exporter_iec || null,
      
      // Consignee details
      consignee_name: packingListData.consignee_name || null,
      consignee_address: packingListData.consignee_address || null,
      consignee_email: packingListData.consignee_email || null,
      consignee_phone: packingListData.consignee_phone || null,
      consignee_mobile: packingListData.consignee_mobile || null,
      consignee_po_box: packingListData.consignee_po_box || null,
      
      // Bank details
      bank_name: packingListData.bank_name || null,
      bank_address: packingListData.bank_address || null,
      bank_account_usd: packingListData.bank_account_usd || null,
      bank_account_euro: packingListData.bank_account_euro || null,
      bank_ifsc_code: packingListData.bank_ifsc_code || null,
      bank_swift_code: packingListData.bank_swift_code || null,
      bank_branch_code: packingListData.bank_branch_code || null,
      bank_ad_code: packingListData.bank_ad_code || null,
      bank_bsr_code: packingListData.bank_bsr_code || null,
      
      // Shipment details
      marks_and_nos: packingListData.marks_and_nos || null,
      country_of_origin: packingListData.country_of_origin || null,
      country_of_destination: packingListData.country_of_destination || null,
      pre_carriage_by: packingListData.pre_carriage_by || null,
      place_of_receipt: packingListData.place_of_receipt || null,
      delivery_terms: packingListData.delivery_terms || null,
      hsn_code: packingListData.hsn_code || null,
      vessel_flight_no: packingListData.vessel_flight_no || null,
      port_of_loading: packingListData.port_of_loading || null,
      port_of_discharge: packingListData.port_of_discharge || null,
      final_destination: packingListData.final_destination || null,
      freight_terms: packingListData.freight_terms || null,
      
      // Referenced Invoice
      invoice_number: packingListData.invoice_number,
      invoice_date: packingListData.invoice_date,
      
      // Box/Package Details
      box_details: packingListData.box_details,
      total_boxes: packingListData.total_boxes,
      total_gross_weight: packingListData.total_gross_weight,
      total_net_weight: packingListData.total_net_weight,
      total_box_weight: packingListData.total_box_weight || null,
      package_type: packingListData.package_type || null,
      
      // Additional fields
      description_of_goods: packingListData.description_of_goods || null,
      certification_statement: packingListData.certification_statement || null,
      
      // Validation
      is_valid: packingListData.is_valid,
      completeness: packingListData.completeness,
      validation_errors: packingListData.validation_errors || [],
      validation_warnings: packingListData.validation_warnings || [],
      invoice_match_verified: packingListData.invoice_match_verified || false,
      amounts_match_verified: packingListData.amounts_match_verified || false,
      
      // Extracted text
      extracted_text: packingListData.extracted_text || null
    }])
    .select()
    .single();

  if (error) {
    console.error('[DB] Error creating packing list:', error);
    throw error;
  }
  
  console.log('[DB] Packing list created successfully:', data?.packing_list_id);
  return data;
}

export async function verifyPackingListSaved(packingListId: string) {
  console.log('[DB] Verifying packing list was saved:', packingListId);
  
  const { data, error } = await supabaseAdmin
    .from('packing_lists')
    .select('packing_list_id, packing_list_number, filepath, status, organization_id')
    .eq('packing_list_id', packingListId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('[DB] Packing list not found in database');
      return false;
    }
    console.error('[DB] Verification error:', error);
    return false;
  }

  console.log('[DB] ✅ Verification success:', {
    packing_list_id: data.packing_list_id,
    packing_list_number: data.packing_list_number,
    filepath: data.filepath,
    status: data.status,
    organization_id: data.organization_id
  });
  
  return true;
}

export async function getPackingListById(packingListId: string) {
  console.log('[DB] Fetching packing list by ID:', packingListId);
  
  const { data, error } = await supabaseAdmin
    .from('packing_lists')
    .select('*')
    .eq('packing_list_id', packingListId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[DB] Error fetching packing list:', error);
    throw error;
  }
  
  return data || null;
}

export async function getPackingListByNumber(packingListNumber: string) {
  console.log('[DB] Fetching packing list by number:', packingListNumber);
  
  const { data, error } = await supabaseAdmin
    .from('packing_lists')
    .select('*')
    .eq('packing_list_number', packingListNumber)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('[DB] Packing list not found by number:', packingListNumber);
      return null;
    }
    console.error('[DB] Error fetching packing list by number:', error);
    throw error;
  }
  
  return data;
}

export async function getPackingListsByInvoiceNumber(invoiceNumber: string) {
  console.log('[DB] Fetching packing lists by invoice number:', invoiceNumber);
  
  const { data, error } = await supabaseAdmin
    .from('packing_lists')
    .select('*')
    .eq('invoice_number', invoiceNumber)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('[DB] Error fetching packing lists by invoice number:', error);
    throw error;
  }
  
  console.log('[DB] Found packing lists:', data?.length || 0);
  return data || [];
}

export async function getSessionPackingLists(threadId: string) {
  console.log('[DB] Fetching packing lists for thread:', threadId);
  
  const { data, error } = await supabaseAdmin
    .from('packing_lists')
    .select('*')
    .eq('thread_id', threadId)
    .order('uploaded_at', { ascending: false});
  
  if (error) {
    console.error('[DB] Error fetching packing lists:', error);
    throw error;
  }
  
  console.log('[DB] Found packing lists:', data?.length || 0);
  return data || [];
}

export async function getUserPackingLists(userId: string) {
  console.log('[DB] Fetching all packing lists for user:', userId);
  
  try {
    const { data, error } = await supabaseAdmin
      .from('packing_lists')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching user packing lists:', error);
      throw error;
    }
    
    console.log('[DB] Found user packing lists:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[DB] Exception in getUserPackingLists:', err);
    throw err;
  }
}

export async function getOrganizationPackingLists(organizationId: string) {
  console.log('[DB] Fetching all packing lists for organization:', organizationId);
  
  try {
    const { data, error } = await supabaseAdmin
      .from('packing_lists')
      .select('*')
      .eq('organization_id', organizationId)
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching organization packing lists:', error);
      throw error;
    }
    
    console.log('[DB] Found organization packing lists:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[DB] Exception in getOrganizationPackingLists:', err);
    throw err;
  }
}

export async function updatePackingList(packingListId: string, updateData: {
  // Core fields
  packing_list_number?: string;
  packing_list_date?: string;
  reference_no?: string;
  proforma_invoice_no?: string;
  filename?: string;
  status?: string;
  
  // Exporter
  exporter_name?: string;
  exporter_address?: string;
  exporter_email?: string;
  exporter_phone?: string;
  exporter_mobile?: string;
  exporter_pan?: string;
  exporter_gstin?: string;
  exporter_iec?: string;
  
  // Consignee
  consignee_name?: string;
  consignee_address?: string;
  consignee_email?: string;
  consignee_phone?: string;
  consignee_mobile?: string;
  consignee_po_box?: string;
  
  // Bank
  bank_name?: string;
  bank_address?: string;
  bank_account_usd?: string;
  bank_account_euro?: string;
  bank_ifsc_code?: string;
  bank_swift_code?: string;
  bank_branch_code?: string;
  bank_ad_code?: string;
  bank_bsr_code?: string;
  
  // Shipment
  marks_and_nos?: string;
  country_of_origin?: string;
  country_of_destination?: string;
  pre_carriage_by?: string;
  place_of_receipt?: string;
  delivery_terms?: string;
  hsn_code?: string;
  vessel_flight_no?: string;
  port_of_loading?: string;
  port_of_discharge?: string;
  final_destination?: string;
  freight_terms?: string;
  
  // Invoice reference
  invoice_number?: string;
  invoice_date?: string;
  
  // Box details
  box_details?: string;
  total_boxes?: number;
  total_gross_weight?: string;
  total_net_weight?: string;
  total_box_weight?: string;
  package_type?: string;
  
  // Additional
  description_of_goods?: string;
  certification_statement?: string;
  
  // Validation
  is_valid?: boolean;
  completeness?: number;
  validation_errors?: any;
  validation_warnings?: any;
  invoice_match_verified?: boolean;
  amounts_match_verified?: boolean;
}) {
  console.log('[DB] Updating packing list:', packingListId);

  const updatePayload: any = {};
  Object.keys(updateData).forEach(key => {
    const value = updateData[key as keyof typeof updateData];
    if (value !== undefined) {
      updatePayload[key] = value;
    }
  });

  console.log('[DB] Update payload keys:', Object.keys(updatePayload));

  const { data, error } = await supabaseAdmin
    .from('packing_lists')
    .update(updatePayload)
    .eq('packing_list_id', packingListId)
    .select()
    .single();

  if (error) {
    console.error('[DB] Error updating packing list:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      packingListId
    });
    throw error;
  }

  console.log('[DB] Packing list updated successfully:', data?.packing_list_id);
  return data;
}

export async function deletePackingList(packingListId: string) {
  console.log('[DB] Deleting packing list:', packingListId);
  
  const { error } = await supabaseAdmin
    .from('packing_lists')
    .delete()
    .eq('packing_list_id', packingListId);
  
  if (error) {
    console.error('[DB] Error deleting packing list:', error);
    throw error;
  }
  
  console.log('[DB] Packing list deleted successfully');
}

// ========== CROSS-VERIFICATION WITH COMMERCIAL INVOICE ==========

interface PackingListInvoiceVerificationResult {
  verified: boolean;
  status: string;
  notes: string;
  comparisonData: {
    checks: {
      invoiceNumberMatch: boolean;
      invoiceDateMatch: boolean;
      consigneeMatch: boolean;
      exporterMatch: boolean;
      hsnCodeMatch: boolean;
      countryOfOriginMatch: boolean;
      portOfLoadingMatch: boolean;
      boxCountReasonable: boolean;
      weightConsistency: boolean;
    };
    passedChecks: number;
    totalChecks: number;
    invoiceData: any;
    packingListData: any;
  };
}

export async function verifyPackingListAgainstInvoice(
  packingList: any,
  commercialInvoice: any
): Promise<PackingListInvoiceVerificationResult> {
  console.log('[DB] Cross-verifying packing list against commercial invoice');
  
  const checks = {
    invoiceNumberMatch: false,
    invoiceDateMatch: false,
    consigneeMatch: false,
    exporterMatch: false,
    hsnCodeMatch: false,
    countryOfOriginMatch: false,
    portOfLoadingMatch: false,
    boxCountReasonable: false,
    weightConsistency: false
  };

  const notes: string[] = [];

  // Check Invoice Number
  if (packingList.invoice_number && commercialInvoice.invoice_no) {
    const plInvoiceNo = String(packingList.invoice_number).trim();
    const invoiceNo = String(commercialInvoice.invoice_no).trim();
    
    if (plInvoiceNo === invoiceNo) {
      checks.invoiceNumberMatch = true;
      notes.push(`✓ Invoice numbers match: ${invoiceNo}`);
    } else {
      notes.push(`✗ Invoice number mismatch: PL="${plInvoiceNo}", Invoice="${invoiceNo}"`);
    }
  } else {
    notes.push('⚠ Invoice number missing from one or both documents');
  }

  // Check Invoice Date
  if (packingList.invoice_date && commercialInvoice.invoice_date) {
    const plDate = packingList.invoice_date;
    const invoiceDate = commercialInvoice.invoice_date;
    
    const normalizedPlDate = plDate.replace(/\./g, '-').replace(/\//g, '-');
    const normalizedInvoiceDate = invoiceDate.replace(/\./g, '-').replace(/\//g, '-');
    
    if (normalizedPlDate === normalizedInvoiceDate || 
        areDatesEqual(plDate, invoiceDate)) {
      checks.invoiceDateMatch = true;
      notes.push(`✓ Invoice dates match: ${invoiceDate}`);
    } else {
      notes.push(`⚠ Invoice date differs: PL="${plDate}", Invoice="${invoiceDate}"`);
    }
  } else {
    notes.push('⚠ Invoice date missing from one or both documents');
  }

  // Check Consignee Name
  if (packingList.consignee_name && commercialInvoice.consignee_name) {
    const plConsignee = packingList.consignee_name.toLowerCase();
    const invoiceConsignee = commercialInvoice.consignee_name.toLowerCase();
    
    const similarity = calculateSimilarity(plConsignee, invoiceConsignee);
    
    if (similarity > 0.85) {
      checks.consigneeMatch = true;
      notes.push(`✓ Consignee names match (${Math.round(similarity * 100)}% similarity)`);
    } else if (similarity > 0.6) {
      notes.push(`⚠ Consignee names similar but not exact (${Math.round(similarity * 100)}% similarity)`);
    } else {
      notes.push(`✗ Consignee names differ significantly`);
    }
  } else {
    notes.push('⚠ Consignee name missing from one or both documents');
  }

  // Check Exporter Name
  if (packingList.exporter_name && commercialInvoice.exporter_name) {
    const plExporter = packingList.exporter_name.toLowerCase();
    const invoiceExporter = commercialInvoice.exporter_name.toLowerCase();
    
    const similarity = calculateSimilarity(plExporter, invoiceExporter);
    
    if (similarity > 0.85) {
      checks.exporterMatch = true;
      notes.push(`✓ Exporter names match (${Math.round(similarity * 100)}% similarity)`);
    } else if (similarity > 0.6) {
      notes.push(`⚠ Exporter names similar but not exact (${Math.round(similarity * 100)}% similarity)`);
    } else {
      notes.push(`✗ Exporter names differ significantly`);
    }
  } else {
    notes.push('⚠ Exporter name missing from one or both documents');
  }

  // Check HSN Code
  if (packingList.hsn_code && commercialInvoice.hsn_code) {
    const plHsn = String(packingList.hsn_code).trim();
    const invoiceHsn = String(commercialInvoice.hsn_code).trim();
    
    if (plHsn === invoiceHsn) {
      checks.hsnCodeMatch = true;
      notes.push(`✓ HSN codes match: ${invoiceHsn}`);
    } else {
      notes.push(`⚠ HSN code differs: PL="${plHsn}", Invoice="${invoiceHsn}"`);
    }
  } else {
    notes.push('⚠ HSN code missing from one or both documents');
  }

  // Check Country of Origin
  if (packingList.country_of_origin && commercialInvoice.country_of_origin) {
    const plCountry = packingList.country_of_origin.toLowerCase();
    const invoiceCountry = commercialInvoice.country_of_origin.toLowerCase();
    
    if (plCountry === invoiceCountry) {
      checks.countryOfOriginMatch = true;
      notes.push(`✓ Country of origin matches: ${commercialInvoice.country_of_origin}`);
    } else {
      notes.push(`⚠ Country of origin differs: PL="${packingList.country_of_origin}", Invoice="${commercialInvoice.country_of_origin}"`);
    }
  } else {
    notes.push('⚠ Country of origin missing from one or both documents');
  }

  // Check Port of Loading
  if (packingList.port_of_loading && commercialInvoice.port_of_loading) {
    const plPort = packingList.port_of_loading.toLowerCase();
    const invoicePort = commercialInvoice.port_of_loading.toLowerCase();
    
    const similarity = calculateSimilarity(plPort, invoicePort);
    
    if (similarity > 0.85) {
      checks.portOfLoadingMatch = true;
      notes.push(`✓ Port of loading matches`);
    } else {
      notes.push(`⚠ Port of loading differs: PL="${packingList.port_of_loading}", Invoice="${commercialInvoice.port_of_loading}"`);
    }
  } else {
    notes.push('⚠ Port of loading missing from one or both documents');
  }

  // Check Box Count Reasonableness
  if (packingList.total_boxes) {
    const boxCount = packingList.total_boxes;
    const itemCount = commercialInvoice.item_count || 0;
    
    if (boxCount > 0 && boxCount <= itemCount * 3) {
      checks.boxCountReasonable = true;
      notes.push(`✓ Box count (${boxCount}) is reasonable for ${itemCount} items`);
    } else if (boxCount > itemCount * 3) {
      notes.push(`⚠ Box count (${boxCount}) seems high for ${itemCount} items`);
    } else {
      notes.push(`⚠ Box count validation inconclusive`);
    }
  } else {
    notes.push('⚠ Box count not specified in packing list');
  }

  // Check Weight Consistency
  if (packingList.total_gross_weight || packingList.total_net_weight) {
    const parseWeight = (weightStr: string): number | null => {
      if (!weightStr) return null;
      const match = weightStr.match(/(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : null;
    };
    
    const plGrossWeight = parseWeight(packingList.total_gross_weight || '');
    const plNetWeight = parseWeight(packingList.total_net_weight || '');
    
    if (plGrossWeight && plNetWeight) {
      if (plGrossWeight > plNetWeight) {
        checks.weightConsistency = true;
        notes.push(`✓ Weight consistency: Gross (${packingList.total_gross_weight}) > Net (${packingList.total_net_weight})`);
      } else {
        notes.push(`⚠ Weight inconsistency: Gross weight should exceed net weight`);
      }
    } else if (plGrossWeight || plNetWeight) {
      checks.weightConsistency = true;
      notes.push(`✓ Weight information present: ${packingList.total_gross_weight || packingList.total_net_weight}`);
    }
  } else {
    notes.push('⚠ Weight information not found in packing list');
  }

  // Calculate results
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;

  let verified = false;
  let status = 'needs_review';

  if (passedChecks === totalChecks) {
    verified = true;
    status = 'verified';
    notes.push('✓ All checks passed - Packing list fully verified against commercial invoice');
  } else if (passedChecks >= totalChecks * 0.8) {
    verified = true;
    status = 'verified_with_warnings';
    notes.push('⚠ Most checks passed - Minor discrepancies detected');
  } else if (passedChecks >= totalChecks * 0.6) {
    status = 'partial_match';
    notes.push('⚠ Significant discrepancies detected - Manual review required');
  } else {
    status = 'failed';
    notes.push('✗ Verification failed - Major discrepancies between documents');
  }

  console.log('[DB] Packing list verification complete:', {
    status,
    passedChecks,
    totalChecks,
    verified
  });

  return {
    verified,
    status,
    notes: notes.join('\n'),
    comparisonData: {
      checks,
      passedChecks,
      totalChecks,
      invoiceData: {
        invoice_no: commercialInvoice.invoice_no,
        invoice_date: commercialInvoice.invoice_date,
        consignee: commercialInvoice.consignee_name,
        exporter: commercialInvoice.exporter_name,
        hsn_code: commercialInvoice.hsn_code,
        country_of_origin: commercialInvoice.country_of_origin,
        port_of_loading: commercialInvoice.port_of_loading,
        item_count: commercialInvoice.item_count
      },
      packingListData: {
        packing_list_number: packingList.packing_list_number,
        packing_list_date: packingList.packing_list_date,
        invoice_number: packingList.invoice_number,
        invoice_date: packingList.invoice_date,
        consignee: packingList.consignee_name,
        exporter: packingList.exporter_name,
        hsn_code: packingList.hsn_code,
        country_of_origin: packingList.country_of_origin,
        port_of_loading: packingList.port_of_loading,
        total_boxes: packingList.total_boxes,
        total_gross_weight: packingList.total_gross_weight,
        total_net_weight: packingList.total_net_weight
      }
    }
  };
}








//Fumigation-certificate 

// Add these functions to your lib/database.ts file

// ========== FUMIGATION CERTIFICATE MANAGEMENT ==========

export async function createFumigationCertificateRecord(certificateData: any) {
  console.log('[DB] Creating fumigation certificate record with data:', {
    fumigation_certificate_id: certificateData.fumigation_certificate_id,
    thread_id: certificateData.thread_id,
    certificate_number: certificateData.certificate_number,
    organization_id: certificateData.organization_id
  });

  const { data, error } = await supabaseAdmin
    .from('fumigation_certificates')
    .insert([{
      fumigation_certificate_id: certificateData.fumigation_certificate_id,
      user_id: certificateData.user_id,
      organization_id: certificateData.organization_id,
      thread_id: certificateData.thread_id,
      filename: certificateData.filename,
      filepath: certificateData.filepath,
      uploaded_at: certificateData.uploaded_at,
      processed_at: certificateData.processed_at,
      status: certificateData.status,
      
      // Core Certificate fields
      certificate_number: certificateData.certificate_number,
      certificate_date: certificateData.certificate_date,
      dppqs_registration_number: certificateData.dppqs_registration_number,
      
      // Treatment Details
      fumigant_name: certificateData.fumigant_name,
      fumigation_date: certificateData.fumigation_date,
      fumigation_place: certificateData.fumigation_place,
      fumigant_dosage: certificateData.fumigant_dosage,
      fumigation_duration: certificateData.fumigation_duration,
      minimum_temperature: certificateData.minimum_temperature,
      gastight_sheets: certificateData.gastight_sheets,
      pressure_decay_value: certificateData.pressure_decay_value,
      
      // Goods Description
      container_number: certificateData.container_number,
      seal_number: certificateData.seal_number,
      exporter_name: certificateData.exporter_name,
      exporter_address: certificateData.exporter_address,
      consignee_name: certificateData.consignee_name,
      cargo_type: certificateData.cargo_type,
      cargo_description: certificateData.cargo_description,
      quantity: certificateData.quantity,
      packaging_material: certificateData.packaging_material,
      additional_declaration: certificateData.additional_declaration,
      shipping_mark: certificateData.shipping_mark,
      
      // Referenced Invoice
      invoice_number: certificateData.invoice_number,
      invoice_date: certificateData.invoice_date,
      
      // Operator Information
      operator_name: certificateData.operator_name,
      operator_signature_status: certificateData.operator_signature_status,
      accreditation_number: certificateData.accreditation_number,
      
      // Validation
      is_valid: certificateData.is_valid,
      completeness: certificateData.completeness,
      validation_errors: certificateData.validation_errors || [],
      validation_warnings: certificateData.validation_warnings || [],
      invoice_match_verified: certificateData.invoice_match_verified || false,
      
      // Extracted text
      extracted_text: certificateData.extracted_text || null
    }])
    .select()
    .single();

  if (error) {
    console.error('[DB] Error creating fumigation certificate:', error);
    throw error;
  }
  
  console.log('[DB] Fumigation certificate created successfully:', data?.fumigation_certificate_id);
  return data;
}

export async function verifyFumigationCertificateSaved(certificateId: string) {
  console.log('[DB] Verifying fumigation certificate was saved:', certificateId);
  
  const { data, error } = await supabaseAdmin
    .from('fumigation_certificates')
    .select('fumigation_certificate_id, certificate_number, filepath, status, organization_id')
    .eq('fumigation_certificate_id', certificateId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('[DB] Fumigation certificate not found in database');
      return false;
    }
    console.error('[DB] Verification error:', error);
    return false;
  }

  console.log('[DB] ✅ Verification success:', {
    fumigation_certificate_id: data.fumigation_certificate_id,
    certificate_number: data.certificate_number,
    filepath: data.filepath,
    status: data.status,
    organization_id: data.organization_id
  });
  
  return true;
}

export async function getFumigationCertificateById(certificateId: string) {
  console.log('[DB] Fetching fumigation certificate by ID:', certificateId);
  
  const { data, error } = await supabaseAdmin
    .from('fumigation_certificates')
    .select('*')
    .eq('fumigation_certificate_id', certificateId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[DB] Error fetching fumigation certificate:', error);
    throw error;
  }
  
  return data || null;
}

export async function getFumigationCertificateByCertificateNumber(certificateNumber: string) {
  console.log('[DB] Fetching fumigation certificate by certificate number:', certificateNumber);
  
  const { data, error } = await supabaseAdmin
    .from('fumigation_certificates')
    .select('*')
    .eq('certificate_number', certificateNumber)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('[DB] Fumigation certificate not found by number:', certificateNumber);
      return null;
    }
    console.error('[DB] Error fetching fumigation certificate by number:', error);
    throw error;
  }
  
  return data;
}

export async function getFumigationCertificatesByInvoiceNumber(invoiceNumber: string) {
  console.log('[DB] Fetching fumigation certificates by invoice number:', invoiceNumber);
  
  const { data, error } = await supabaseAdmin
    .from('fumigation_certificates')
    .select('*')
    .eq('invoice_number', invoiceNumber)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('[DB] Error fetching fumigation certificates by invoice number:', error);
    throw error;
  }
  
  console.log('[DB] Found fumigation certificates:', data?.length || 0);
  return data || [];
}

export async function getSessionFumigationCertificates(threadId: string) {
  console.log('[DB] Fetching fumigation certificates for thread:', threadId);
  
  const { data, error } = await supabaseAdmin
    .from('fumigation_certificates')
    .select('*')
    .eq('thread_id', threadId)
    .order('uploaded_at', { ascending: false});
  
  if (error) {
    console.error('[DB] Error fetching fumigation certificates:', error);
    throw error;
  }
  
  console.log('[DB] Found fumigation certificates:', data?.length || 0);
  return data || [];
}

export async function getUserFumigationCertificates(userId: string) {
  console.log('[DB] Fetching all fumigation certificates for user:', userId);
  
  try {
    const { data, error } = await supabaseAdmin
      .from('fumigation_certificates')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching user fumigation certificates:', error);
      throw error;
    }
    
    console.log('[DB] Found user fumigation certificates:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[DB] Exception in getUserFumigationCertificates:', err);
    throw err;
  }
}

export async function getOrganizationFumigationCertificates(organizationId: string) {
  console.log('[DB] Fetching all fumigation certificates for organization:', organizationId);
  
  try {
    const { data, error } = await supabaseAdmin
      .from('fumigation_certificates')
      .select('*')
      .eq('organization_id', organizationId)
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching organization fumigation certificates:', error);
      throw error;
    }
    
    console.log('[DB] Found organization fumigation certificates:', data?.length || 0);
    return data || [];
  } catch (err) {
    console.error('[DB] Exception in getOrganizationFumigationCertificates:', err);
    throw err;
  }
}

export async function updateFumigationCertificate(certificateId: string, updateData: {
  // Core Certificate fields
  certificate_number?: string;
  certificate_date?: string;
  dppqs_registration_number?: string;
  filename?: string;
  status?: string;
  
  // Treatment Details
  fumigant_name?: string;
  fumigation_date?: string;
  fumigation_place?: string;
  fumigant_dosage?: string;
  fumigation_duration?: string;
  minimum_temperature?: string;
  gastight_sheets?: boolean;
  pressure_decay_value?: string;
  
  // Goods Description
  container_number?: string;
  seal_number?: string;
  exporter_name?: string;
  exporter_address?: string;
  consignee_name?: string;
  cargo_type?: string;
  cargo_description?: string;
  quantity?: string;
  packaging_material?: string;
  additional_declaration?: string;
  shipping_mark?: string;
  
  // Referenced Invoice
  invoice_number?: string;
  invoice_date?: string;
  
  // Operator Information
  operator_name?: string;
  operator_signature_status?: boolean;
  accreditation_number?: string;
  
  // Validation
  is_valid?: boolean;
  completeness?: number;
  validation_errors?: any;
  validation_warnings?: any;
  invoice_match_verified?: boolean;
}) {
  console.log('[DB] Updating fumigation certificate:', certificateId);

  // Filter out undefined values to only update provided fields
  const updatePayload: any = {};
  Object.keys(updateData).forEach(key => {
    const value = updateData[key as keyof typeof updateData];
    if (value !== undefined) {
      updatePayload[key] = value;
    }
  });

  console.log('[DB] Update payload keys:', Object.keys(updatePayload));
  console.log('[DB] Update payload preview:', {
    certificate_number: updatePayload.certificate_number,
    certificate_date: updatePayload.certificate_date,
    fumigant_name: updatePayload.fumigant_name,
    fumigation_date: updatePayload.fumigation_date
  });

  const { data, error } = await supabaseAdmin
    .from('fumigation_certificates')
    .update(updatePayload)
    .eq('fumigation_certificate_id', certificateId)
    .select()
    .single();

  if (error) {
    console.error('[DB] Error updating fumigation certificate:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      certificateId
    });
    throw error;
  }

  console.log('[DB] Fumigation certificate updated successfully:', data?.fumigation_certificate_id);
  return data;
}

export async function deleteFumigationCertificate(certificateId: string) {
  console.log('[DB] Deleting fumigation certificate:', certificateId);
  
  const { error } = await supabaseAdmin
    .from('fumigation_certificates')
    .delete()
    .eq('fumigation_certificate_id', certificateId);
  
  if (error) {
    console.error('[DB] Error deleting fumigation certificate:', error);
    throw error;
  }
  
  console.log('[DB] Fumigation certificate deleted successfully');
}

// ========== CROSS-VERIFICATION WITH COMMERCIAL INVOICE ==========

interface FumigationInvoiceVerificationResult {
  verified: boolean;
  status: string;
  notes: string;
  comparisonData: {
    checks: {
      invoiceNumberMatch: boolean;
      invoiceDateMatch: boolean;
      consigneeMatch: boolean;
      exporterMatch: boolean;
      containerMatch: boolean;
      cargoConsistency: boolean;
    };
    passedChecks: number;
    totalChecks: number;
    invoiceData: any;
    certificateData: any;
  };
}

export async function verifyFumigationCertificateAgainstInvoice(
  fumigationCertificate: any,
  commercialInvoice: any
): Promise<FumigationInvoiceVerificationResult> {
  console.log('[DB] Cross-verifying fumigation certificate against commercial invoice');
  
  const checks = {
    invoiceNumberMatch: false,
    invoiceDateMatch: false,
    consigneeMatch: false,
    exporterMatch: false,
    containerMatch: false,
    cargoConsistency: false
  };

  const notes: string[] = [];

  // Check Invoice Number (from shipping mark or direct reference)
  if (fumigationCertificate.invoice_number && commercialInvoice.invoice_no) {
    const certInvoiceNo = String(fumigationCertificate.invoice_number).trim();
    const invoiceNo = String(commercialInvoice.invoice_no).trim();
    
    if (certInvoiceNo === invoiceNo) {
      checks.invoiceNumberMatch = true;
      notes.push(`✓ Invoice numbers match: ${invoiceNo}`);
    } else {
      notes.push(`✗ Invoice number mismatch: Certificate="${certInvoiceNo}", Invoice="${invoiceNo}"`);
    }
  } else if (fumigationCertificate.shipping_mark) {
    // Try to extract invoice number from shipping mark
    const invoiceMatch = fumigationCertificate.shipping_mark.match(/(\d{9,})/);
    if (invoiceMatch && commercialInvoice.invoice_no) {
      const extractedInvoiceNo = invoiceMatch[1];
      if (extractedInvoiceNo === String(commercialInvoice.invoice_no).trim()) {
        checks.invoiceNumberMatch = true;
        notes.push(`✓ Invoice number extracted from shipping mark matches: ${extractedInvoiceNo}`);
      } else {
        notes.push(`⚠ Shipping mark contains different invoice number: "${extractedInvoiceNo}" vs "${commercialInvoice.invoice_no}"`);
      }
    } else {
      notes.push('⚠ Invoice number not found in certificate or shipping mark');
    }
  } else {
    notes.push('⚠ Invoice number missing from fumigation certificate');
  }

  // Check Invoice Date
  if (fumigationCertificate.invoice_date && commercialInvoice.invoice_date) {
    const certDate = fumigationCertificate.invoice_date;
    const invoiceDate = commercialInvoice.invoice_date;
    
    // Normalize dates for comparison
    const normalizedCertDate = certDate.replace(/\./g, '-').replace(/\//g, '-');
    const normalizedInvoiceDate = invoiceDate.replace(/\./g, '-').replace(/\//g, '-');
    
    if (normalizedCertDate === normalizedInvoiceDate || 
        areDatesEqual(certDate, invoiceDate)) {
      checks.invoiceDateMatch = true;
      notes.push(`✓ Invoice dates match: ${invoiceDate}`);
    } else {
      notes.push(`⚠ Invoice date differs: Certificate="${certDate}", Invoice="${invoiceDate}"`);
    }
  } else {
    notes.push('⚠ Invoice date missing from one or both documents');
  }

  // Check Consignee Name
  if (fumigationCertificate.consignee_name && commercialInvoice.consignee_name) {
    const certConsignee = fumigationCertificate.consignee_name.toLowerCase();
    const invoiceConsignee = commercialInvoice.consignee_name.toLowerCase();
    
    const similarity = calculateSimilarity(certConsignee, invoiceConsignee);
    
    if (similarity > 0.85) {
      checks.consigneeMatch = true;
      notes.push(`✓ Consignee names match (${Math.round(similarity * 100)}% similarity)`);
    } else if (similarity > 0.6) {
      notes.push(`⚠ Consignee names similar but not exact (${Math.round(similarity * 100)}% similarity)`);
    } else {
      notes.push(`✗ Consignee names differ significantly`);
    }
  } else {
    notes.push('⚠ Consignee name missing from one or both documents');
  }

  // Check Exporter Name
  if (fumigationCertificate.exporter_name && commercialInvoice.exporter_name) {
    const certExporter = fumigationCertificate.exporter_name.toLowerCase();
    const invoiceExporter = commercialInvoice.exporter_name.toLowerCase();
    
    const similarity = calculateSimilarity(certExporter, invoiceExporter);
    
    if (similarity > 0.85) {
      checks.exporterMatch = true;
      notes.push(`✓ Exporter names match (${Math.round(similarity * 100)}% similarity)`);
    } else if (similarity > 0.6) {
      notes.push(`⚠ Exporter names similar but not exact (${Math.round(similarity * 100)}% similarity)`);
    } else {
      notes.push(`✗ Exporter names differ significantly`);
    }
  } else {
    notes.push('⚠ Exporter name missing from one or both documents');
  }

  // Check Container Number
  if (fumigationCertificate.container_number) {
    // Try to find matching container in invoice
    const certContainer = fumigationCertificate.container_number.toUpperCase().replace(/\s/g, '');
    
    // Check in shipping details or items
    let invoiceContainer = null;
    if (commercialInvoice.shipment_details?.container_number) {
      invoiceContainer = commercialInvoice.shipment_details.container_number.toUpperCase().replace(/\s/g, '');
    }
    
    if (invoiceContainer && certContainer === invoiceContainer) {
      checks.containerMatch = true;
      notes.push(`✓ Container numbers match: ${fumigationCertificate.container_number}`);
    } else if (invoiceContainer) {
      notes.push(`⚠ Container number differs: Certificate="${fumigationCertificate.container_number}", Invoice="${commercialInvoice.shipment_details.container_number}"`);
    } else {
      notes.push('⚠ Container number not found in commercial invoice');
    }
  }

  // Check Cargo Consistency
  if (fumigationCertificate.cargo_description && commercialInvoice.items) {
    const cargoDesc = fumigationCertificate.cargo_description.toLowerCase();
    
    // Check if cargo description relates to invoice items
    const invoiceItemDescriptions = commercialInvoice.items
      .map((item: any) => (item.description || '').toLowerCase())
      .filter(Boolean);
    
    if (invoiceItemDescriptions.length > 0) {
      // Check if any item description is contained in cargo description or vice versa
      const hasMatch = invoiceItemDescriptions.some((itemDesc: string) => 
        cargoDesc.includes(itemDesc) || itemDesc.includes(cargoDesc.split(' ')[0])
      );
      
      if (hasMatch) {
        checks.cargoConsistency = true;
        notes.push(`✓ Cargo description consistent with invoice items`);
      } else {
        notes.push(`⚠ Cargo description may not match invoice items`);
      }
    } else {
      notes.push('⚠ No item descriptions in invoice for comparison');
    }
  } else {
    notes.push('⚠ Cargo description or invoice items missing');
  }

  // Fumigation Date vs Invoice Date Check
  if (fumigationCertificate.fumigation_date && commercialInvoice.invoice_date) {
    try {
      const fumDate = new Date(fumigationCertificate.fumigation_date.split(/[.\-\/]/).reverse().join('-'));
      const invDate = new Date(commercialInvoice.invoice_date.split(/[.\-\/]/).reverse().join('-'));
      
      const daysDiff = Math.abs((fumDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 30) {
        notes.push(`✓ Fumigation date within reasonable timeframe of invoice (${Math.round(daysDiff)} days)`);
      } else {
        notes.push(`⚠ Fumigation date is ${Math.round(daysDiff)} days from invoice date - verify timing`);
      }
    } catch (error) {
      console.error('[DB] Date comparison error:', error);
    }
  }

  // Calculate results
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;

  let verified = false;
  let status = 'needs_review';

  if (passedChecks === totalChecks) {
    verified = true;
    status = 'verified';
    notes.push('✓ All checks passed - Fumigation certificate fully verified against commercial invoice');
  } else if (passedChecks >= totalChecks * 0.8) {
    verified = true;
    status = 'verified_with_warnings';
    notes.push('⚠ Most checks passed - Minor discrepancies detected');
  } else if (passedChecks >= totalChecks * 0.6) {
    status = 'partial_match';
    notes.push('⚠ Significant discrepancies detected - Manual review required');
  } else {
    status = 'failed';
    notes.push('✗ Verification failed - Major discrepancies between documents');
  }

  console.log('[DB] Fumigation certificate verification complete:', {
    status,
    passedChecks,
    totalChecks,
    verified
  });

  return {
    verified,
    status,
    notes: notes.join('\n'),
    comparisonData: {
      checks,
      passedChecks,
      totalChecks,
      invoiceData: {
        invoice_no: commercialInvoice.invoice_no,
        invoice_date: commercialInvoice.invoice_date,
        consignee: commercialInvoice.consignee_name,
        exporter: commercialInvoice.exporter_name,
        container: commercialInvoice.shipment_details?.container_number,
        items_count: commercialInvoice.items?.length || 0
      },
      certificateData: {
        certificate_number: fumigationCertificate.certificate_number,
        certificate_date: fumigationCertificate.certificate_date,
        fumigation_date: fumigationCertificate.fumigation_date,
        fumigation_place: fumigationCertificate.fumigation_place,
        fumigant_name: fumigationCertificate.fumigant_name,
        invoice_number: fumigationCertificate.invoice_number,
        invoice_date: fumigationCertificate.invoice_date,
        consignee: fumigationCertificate.consignee_name,
        exporter: fumigationCertificate.exporter_name,
        container: fumigationCertificate.container_number,
        cargo: fumigationCertificate.cargo_description,
        shipping_mark: fumigationCertificate.shipping_mark
      }
    }
  };
}



// Add these functions to your @/lib/database.ts file


// ============================================
// AIRWAY BILL DATABASE OPERATIONS
// ============================================

export async function createAirwayBillRecord(airwayBillData: any) {
  const { data, error } = await supabase
    .from('airway_bills')
    .insert({
      airway_bill_id: airwayBillData.airway_bill_id,
      user_id: airwayBillData.user_id,
      organization_id: airwayBillData.organization_id,
      thread_id: airwayBillData.thread_id,
      filename: airwayBillData.filename,
      filepath: airwayBillData.filepath,
      uploaded_at: airwayBillData.uploaded_at,
      processed_at: airwayBillData.processed_at,
      status: airwayBillData.status,
      
      // Core fields
      document_type: airwayBillData.document_type,
      airway_bill_no: airwayBillData.airway_bill_no,
      invoice_no: airwayBillData.invoice_no,
      invoice_date: airwayBillData.invoice_date,
      
      // Shipper information
      shippers_name: airwayBillData.shippers_name,
      shippers_address: airwayBillData.shippers_address,
      
      // Consignee information
      consignees_name: airwayBillData.consignees_name,
      consignees_address: airwayBillData.consignees_address,
      
      // Carrier information
      issuing_carriers_name: airwayBillData.issuing_carriers_name,
      issuing_carriers_city: airwayBillData.issuing_carriers_city,
      agents_iata_code: airwayBillData.agents_iata_code,
      
      // Shipment details
      airport_of_departure: airwayBillData.airport_of_departure,
      airport_of_destination: airwayBillData.airport_of_destination,
      accounting_information: airwayBillData.accounting_information,
      
      // Cargo details
      hs_code_no: airwayBillData.hs_code_no,
      no_of_pieces: airwayBillData.no_of_pieces,
      gross_weight: airwayBillData.gross_weight,
      chargeable_weight: airwayBillData.chargeable_weight,
      nature_of_goods: airwayBillData.nature_of_goods,
      
      // Validation
      is_valid: airwayBillData.is_valid,
      completeness: airwayBillData.completeness,
      validation_errors: airwayBillData.validation_errors,
      validation_warnings: airwayBillData.validation_warnings,
      
      extracted_text: airwayBillData.extracted_text
    });

  if (error) {
    console.error('[DB] Error creating airway bill record:', error);
    throw error;
  }

  return data;
}

export async function verifyAirwayBillSaved(airwayBillId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('airway_bills')
    .select('airway_bill_id')
    .eq('airway_bill_id', airwayBillId)
    .single();

  if (error || !data) {
    console.error('[DB] Airway bill verification failed:', error);
    return false;
  }

  return true;
}

export async function getAirwayBillById(airwayBillId: string) {
  const { data, error } = await supabase
    .from('airway_bills')
    .select('*')
    .eq('airway_bill_id', airwayBillId)
    .single();

  if (error) {
    console.error('[DB] Error fetching airway bill:', error);
    throw error;
  }

  return data;
}

export async function getAirwayBillsByThreadId(threadId: string) {
  const { data, error } = await supabase
    .from('airway_bills')
    .select('*')
    .eq('thread_id', threadId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('[DB] Error fetching airway bills by thread:', error);
    throw error;
  }

  return data;
}

export async function updateAirwayBillStatus(
  airwayBillId: string, 
  status: 'valid' | 'invalid' | 'pending'
) {
  const { data, error } = await supabase
    .from('airway_bills')
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .eq('airway_bill_id', airwayBillId);

  if (error) {
    console.error('[DB] Error updating airway bill status:', error);
    throw error;
  }

  return data;
}

export async function deleteAirwayBill(airwayBillId: string) {
  const { error } = await supabase
    .from('airway_bills')
    .delete()
    .eq('airway_bill_id', airwayBillId);

  if (error) {
    console.error('[DB] Error deleting airway bill:', error);
    throw error;
  }

  return true;
}



// Add this function to your lib/database.ts file in the INVOICE MANAGEMENT section
// Place it after the updateInvoice function

export async function deleteInvoice(invoiceId: string) {
  console.log('[DB] Deleting invoice:', invoiceId);
  
  const { error } = await supabaseAdmin
    .from('invoices')
    .delete()
    .eq('invoice_id', invoiceId);
  
  if (error) {
    console.error('[DB] Error deleting invoice:', error);
    throw error;
  }
  
  console.log('[DB] Invoice deleted successfully');
}

// Alternative: If you want to delete by invoice_no AND user_id for security
export async function deleteInvoiceByNoAndUser(invoiceNo: string, userId: string) {
  console.log('[DB] Deleting invoice by number and user:', { invoiceNo, userId });
  
  const { error } = await supabaseAdmin
    .from('invoices')
    .delete()
    .eq('invoice_no', invoiceNo)
    .eq('user_id', userId);
  
  if (error) {
    console.error('[DB] Error deleting invoice:', error);
    throw error;
  }
  
  console.log('[DB] Invoice deleted successfully');
}

// Alternative: Soft delete (mark as deleted without removing from database)
export async function softDeleteInvoice(invoiceId: string) {
  console.log('[DB] Soft deleting invoice:', invoiceId);
  
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .update({
      status: 'deleted',
      updated_at: new Date().toISOString()
    })
    .eq('invoice_id', invoiceId)
    .select()
    .single();

  if (error) {
    console.error('[DB] Error soft deleting invoice:', error);
    throw error;
  }

  console.log('[DB] Invoice soft deleted successfully');
  return data;
}