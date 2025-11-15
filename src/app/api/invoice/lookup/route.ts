// src/app/api/invoice/lookup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getInvoiceById } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Accept multiple parameter names for flexibility
    const invoiceNo = searchParams.get('invoiceNo') || 
                     searchParams.get('q') || 
                     searchParams.get('query') || 
                     searchParams.get('number') || 
                     searchParams.get('search');
    const invoiceId = searchParams.get('invoiceId') || searchParams.get('id');

    console.log(`[Invoice Lookup] All parameters:`, Object.fromEntries(searchParams.entries()));
    console.log(`[Invoice Lookup] Resolved:`, { invoiceNo, invoiceId });

    if (!invoiceNo && !invoiceId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invoice number or invoice ID is required. Use invoiceNo, q, query, number, or search parameter for invoice number, or invoiceId/id for invoice ID.' 
        },
        { status: 400 }
      );
    }

    let invoice;

    // Search by invoice ID first (more specific)
    if (invoiceId) {
      console.log(`[DB] Searching by invoice ID: ${invoiceId}`);
      invoice = await getInvoiceById(invoiceId);
      if (invoice) {
        console.log('[Invoice Lookup] Invoice found by ID:', {
          invoice_id: invoice.invoice_id,
          invoice_no: invoice.invoice_no,
          filename: invoice.filename,
          status: invoice.status,
          is_valid: invoice.is_valid
        });
      } else {
        console.log('[Invoice Lookup] No invoice found by ID:', invoiceId);
      }
    }
    
    // If not found by ID, search by invoice number
    if (!invoice && invoiceNo) {
      console.log(`[DB] Searching by invoice number: ${invoiceNo}`);
      const invoices = await getInvoicesByNumber(invoiceNo);
      console.log(`[DB] Found ${invoices?.length || 0} invoices by number:`, invoices?.map((inv: any) => ({
        invoice_id: inv.invoice_id,
        invoice_no: inv.invoice_no,
        filename: inv.filename,
        status: inv.status,
        is_valid: inv.is_valid
      })));
      
      if (invoices && invoices.length > 0) {
        // Get the most recent invoice with this number
        invoice = invoices[0];
        console.log('[Invoice Lookup] Selected most recent invoice:', {
          invoice_id: invoice.invoice_id,
          invoice_no: invoice.invoice_no,
          filename: invoice.filename,
          uploaded_at: invoice.uploaded_at
        });
      } else {
        console.log('[Invoice Lookup] No invoices found by number:', invoiceNo);
      }
    }

    if (!invoice) {
      console.log('[Invoice Lookup] Invoice not found for:', { invoiceNo, invoiceId });
      return NextResponse.json(
        { 
          success: false,
          error: `Invoice not found: ${invoiceNo || invoiceId}` 
        },
        { status: 404 }
      );
    }

    // Log the complete invoice data from database
    console.log('[Invoice Lookup] Raw invoice data from database:', {
      invoice_id: invoice.invoice_id,
      invoice_no: invoice.invoice_no,
      filename: invoice.filename,
      filepath: invoice.filepath,
      uploaded_at: invoice.uploaded_at,
      processed_at: invoice.processed_at,
      status: invoice.status,
      invoice_date: invoice.invoice_date,
      consignee_name: invoice.consignee_name,
      exporter_name: invoice.exporter_name,
      incoterms: invoice.incoterms,
      port_of_loading: invoice.port_of_loading,
      final_destination: invoice.final_destination,
      bank_name: invoice.bank_name,
      bank_account: invoice.bank_account,
      item_count: invoice.item_count,
      total_amount: invoice.total_amount,
      currency: invoice.currency,
      is_valid: invoice.is_valid,
      completeness: invoice.completeness,
      has_signature: invoice.has_signature,
      items: typeof invoice.items === 'string' ? 'STRING (needs parsing)' : invoice.items,
      validation_errors: typeof invoice.validation_errors === 'string' ? 'STRING (needs parsing)' : invoice.validation_errors,
      validation_warnings: typeof invoice.validation_warnings === 'string' ? 'STRING (needs parsing)' : invoice.validation_warnings
    });

    // Parse JSON fields safely
    let items = [];
    let validation_errors = [];
    let validation_warnings = [];

    try {
      items = invoice.items ? (typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items) : [];
      console.log('[Invoice Lookup] Parsed items:', {
        count: items.length,
        sample: items.length > 0 ? items[0] : 'No items'
      });
    } catch (e) {
      console.error('[Invoice Lookup] Error parsing items:', e, 'Raw items:', invoice.items);
    }

    try {
      validation_errors = invoice.validation_errors ? (typeof invoice.validation_errors === 'string' ? JSON.parse(invoice.validation_errors) : invoice.validation_errors) : [];
      console.log('[Invoice Lookup] Parsed validation_errors:', {
        count: validation_errors.length,
        errors: validation_errors
      });
    } catch (e) {
      console.error('[Invoice Lookup] Error parsing validation_errors:', e, 'Raw validation_errors:', invoice.validation_errors);
    }

    try {
      validation_warnings = invoice.validation_warnings ? (typeof invoice.validation_warnings === 'string' ? JSON.parse(invoice.validation_warnings) : invoice.validation_warnings) : [];
      console.log('[Invoice Lookup] Parsed validation_warnings:', {
        count: validation_warnings.length,
        warnings: validation_warnings
      });
    } catch (e) {
      console.error('[Invoice Lookup] Error parsing validation_warnings:', e, 'Raw validation_warnings:', invoice.validation_warnings);
    }

    // Normalize items to frontend schema
    const normalizedItems = normalizeInvoiceItems(items);

    // Calculate totals after normalization
    const calculatedTotal = calculateTotalFromItems(normalizedItems);
    console.log('[Invoice Lookup] Amount calculation:', {
      stored_total: invoice.total_amount,
      calculated_total: calculatedTotal,
      used_total: invoice.total_amount || calculatedTotal
    });

    // Determine resolved totals/counts
    const resolvedItemCount = typeof invoice.item_count === 'number'
      ? invoice.item_count
      : normalizedItems.length;

    const resolvedTotalAmount = isValidNumber(invoice.total_amount)
      ? Number(invoice.total_amount)
      : calculatedTotal;

    const formattedInvoice = {
      invoiceId: invoice.invoice_id,
      filename: invoice.filename || '',
      fileUrl: invoice.filepath || '',
      uploaded_at: invoice.uploaded_at || null,
      processed_at: invoice.processed_at || null,
      status: invoice.status || 'processed',
      document_type: invoice.document_type || 'Commercial Invoice',

      invoice_no: invoice.invoice_no || '',
      invoice_date: invoice.invoice_date || '',
      reference_no: invoice.reference_no || '',
      proforma_invoice_no: invoice.proforma_invoice_no || '',
      marks_and_nos: invoice.marks_and_nos || '',

      consignee_name: invoice.consignee_name || '',
      consignee_address: invoice.consignee_address || '',
      consignee_email: invoice.consignee_email || '',
      consignee_phone: invoice.consignee_phone || '',
      consignee_country: invoice.consignee_country || '',

      exporter_name: invoice.exporter_name || '',
      exporter_address: invoice.exporter_address || '',
      exporter_email: invoice.exporter_email || '',
      exporter_phone: invoice.exporter_phone || '',
      exporter_pan: invoice.exporter_pan || '',
      exporter_gstin: invoice.exporter_gstin || '',
      exporter_iec: invoice.exporter_iec || '',

      incoterms: invoice.incoterms || '',
      place_of_receipt: invoice.place_of_receipt || '',
      port_of_loading: invoice.port_of_loading || '',
      port_of_discharge: invoice.port_of_discharge || '',
      final_destination: invoice.final_destination || '',
      country_of_origin: invoice.country_of_origin || '',
      country_of_destination: invoice.country_of_destination || '',
      hsn_code: invoice.hsn_code || '',

      bank_name: invoice.bank_name || '',
      bank_account: invoice.bank_account || '',
      bank_swift_code: invoice.bank_swift_code || '',
      bank_ifsc_code: invoice.bank_ifsc_code || '',
      payment_terms: invoice.payment_terms || '',

      currency: invoice.currency || 'USD',
      total_amount: resolvedTotalAmount,
      item_count: resolvedItemCount,
      items: normalizedItems,

      igst_status: invoice.igst_status || '',
      drawback_sr_no: invoice.drawback_sr_no || '',
      rodtep_claim: coerceBoolean(invoice.rodtep_claim),
      commission_rate: invoice.commission_rate ?? '',

      has_signature: coerceBoolean(invoice.has_signature),
      verification_status: invoice.verification_status || 'pending',
      verification_data: invoice.verification_data || null,

      is_valid: coerceBoolean(invoice.is_valid),
      completeness: isValidNumber(invoice.completeness) ? Number(invoice.completeness) : 0,
      validation_errors,
      validation_warnings
    };

    console.log('[Invoice Lookup] Final response keys:', Object.keys(formattedInvoice));

    return NextResponse.json({
      success: true,
      data: formattedInvoice,
      metadata: {
        invoiceId: invoice.invoice_id,
        userId: invoice.user_id || null,
        organizationId: invoice.organization_id || null,
        threadId: invoice.thread_id || null,
        source: invoiceId ? 'invoiceId' : 'invoiceNo'
      }
    });

  } catch (error: any) {
    console.error('[Invoice Lookup] Error:', error);
    console.error('[Invoice Lookup] Error stack:', error.stack);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to lookup invoice',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Helper function to calculate total from items if not stored separately
function calculateTotalFromItems(items: any[]): number {
  if (!items || !Array.isArray(items)) {
    console.log('[Calculate Total] No items or not an array');
    return 0;
  }
  
  console.log('[Calculate Total] Calculating from', items.length, 'items');
  
  const total = items.reduce((total, item, index) => {
    const itemTotal = parseFloat(item.totalPrice) || parseFloat(item.amount) || 0;
    console.log(`[Calculate Total] Item ${index}:`, {
      description: item.description,
      totalPrice: item.totalPrice,
      amount: item.amount,
      parsedTotal: itemTotal
    });
    return total + itemTotal;
  }, 0);
  
  console.log('[Calculate Total] Final total:', total);
  return total;
}

function normalizeInvoiceItems(items: any[]): any[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => {
    const description =
      item?.description ??
      item?.itemDescription ??
      item?.productDescription ??
      item?.goodsDescription ??
      '';

    const quantity = toNumber(
      item?.quantity ??
      item?.qty ??
      item?.quantityValue
    );

    const unit =
      item?.unit ??
      item?.unitOfMeasure ??
      item?.uom ??
      '';

    const unitPrice = toNumber(
      item?.unitPrice ??
      item?.unit_price ??
      item?.pricePerUnit ??
      item?.rate
    );

    const totalPrice = toNumber(
      item?.totalPrice ??
      item?.total_price ??
      item?.amount ??
      item?.lineTotal ??
      (quantity * unitPrice)
    );

    const hsCode =
      item?.hsCode ??
      item?.hs_code ??
      item?.hsnCode ??
      item?.hsn_code ??
      '';

    return {
      ...item,
      description,
      quantity,
      unit,
      unitPrice,
      totalPrice,
      hsCode,
      lineNumber: item?.lineNumber ?? index + 1
    };
  });
}

function toNumber(value: any, fallback = 0): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const numericValue = typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : value;
  const parsed = Number(numericValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isValidNumber(value: any): boolean {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function coerceBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return false;
}

// Helper function to search invoices by number
async function getInvoicesByNumber(invoiceNo: string) {
  const { supabaseAdmin } = await import('@/lib/config');
  
  console.log('[DB] Searching invoices by number:', invoiceNo);
  
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('invoice_no', invoiceNo)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('[DB] Error searching invoices by number:', error);
    console.error('[DB] Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    throw error;
  }

  console.log('[DB] Found invoices by number:', data?.length || 0);
  
  if (data && data.length > 0) {
    console.log('[DB] Sample invoice from search:', {
      invoice_id: data[0].invoice_id,
      invoice_no: data[0].invoice_no,
      filename: data[0].filename,
      status: data[0].status,
      uploaded_at: data[0].uploaded_at
    });
  }
  
  return data || [];
}