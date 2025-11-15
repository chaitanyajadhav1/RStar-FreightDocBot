// src/app/api/documents/user-documents/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyUserToken, getUserById } from '@/lib/auth'; // Changed from verifyToken to verifyUserToken
import {
  getUserInvoices,
  getUserSCOMETDeclarations,
  getUserPackingLists,
  getUserFumigationCertificates,
  getUserExportDeclarations
} from '@/lib/database';


function safeParseJSON(value: any, defaultValue: any = []): any {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error('JSON parse error:', e);
      return defaultValue;
    }
  }
  return defaultValue;
}



export async function GET(request: NextRequest) {
  console.log('[API] GET /api/documents/user-documents - Fetching user documents');

  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = await verifyUserToken(token); // Changed to await and use verifyUserToken

    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Check if admin is requesting documents for a specific user
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    
    let userId = decoded.userId;
    
    // If admin requests a specific user's documents, verify admin role and organization
    if (requestedUserId && requestedUserId !== decoded.userId) {
      const currentUser = await getUserById(decoded.userId);
      if (!currentUser || currentUser.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Admin role required to view other users\' documents' },
          { status: 403 }
        );
      }
      
      // Verify requested user is in same organization
      const requestedUser = await getUserById(requestedUserId);
      if (!requestedUser || requestedUser.organization_id !== decoded.organizationId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Cannot access users outside your organization' },
          { status: 403 }
        );
      }
      
      userId = requestedUserId;
    }
    
    console.log('[API] Fetching documents for user:', userId);

    const userRecord = await getUserById(userId);

    if (!userRecord || !userRecord.is_active) {
      return NextResponse.json(
        { success: false, error: 'User not found or inactive' },
        { status: 404 }
      );
    }

    let userMetadata: any = userRecord.metadata || {};
    if (typeof userMetadata === 'string') {
      try {
        userMetadata = JSON.parse(userMetadata);
      } catch (error) {
        console.warn('[API] Failed to parse user metadata, defaulting to empty object');
        userMetadata = {};
      }
    }

    const adminNotes = Array.isArray(userMetadata.admin_notes) ? userMetadata.admin_notes : [];
    const lastAdminMessage = userMetadata.last_admin_message || null;

    // Fetch all document types for the user in parallel
    const [
      invoices,
      scometDeclarations,
      packingLists,
      fumigationCertificates,
      exportDeclarations
    ] = await Promise.all([
      getUserInvoices(userId),
      getUserSCOMETDeclarations(userId),
      getUserPackingLists(userId),
      getUserFumigationCertificates(userId),
      getUserExportDeclarations(userId)
    ]);

    console.log('[API] Documents found:', {
      invoices: invoices.length,
      scomet: scometDeclarations.length,
      packingLists: packingLists.length,
      fumigationCertificates: fumigationCertificates.length,
      exportDeclarations: exportDeclarations.length
    });

    // Get the most recent document of each type
    const mostRecentInvoice = invoices.length > 0 ? invoices[0] : null;
    const mostRecentSCOMET = scometDeclarations.length > 0 ? scometDeclarations[0] : null;
    const mostRecentPackingList = packingLists.length > 0 ? packingLists[0] : null;
    const mostRecentFumigation = fumigationCertificates.length > 0 ? fumigationCertificates[0] : null;
    const mostRecentExportDeclaration = exportDeclarations.length > 0 ? exportDeclarations[0] : null;

    // Transform the data to match frontend expectations
    const transformedData: any = {};

    // Transform Commercial Invoice
    // Transform Commercial Invoice
if (mostRecentInvoice) {
  // Parse items if it's a string
  let items = mostRecentInvoice.items;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch (e) {
      console.error('Error parsing items:', e);
      items = [];
    }
  }

  // Parse validation errors/warnings
  let validationErrors = mostRecentInvoice.validation_errors;
  if (typeof validationErrors === 'string') {
    try {
      validationErrors = JSON.parse(validationErrors);
    } catch (e) {
      validationErrors = [];
    }
  }

  let validationWarnings = mostRecentInvoice.validation_warnings;
  if (typeof validationWarnings === 'string') {
    try {
      validationWarnings = JSON.parse(validationWarnings);
    } catch (e) {
      validationWarnings = [];
    }
  }

  transformedData.invoice = {
    invoiceId: mostRecentInvoice.invoice_id,
    filename: mostRecentInvoice.filename,
    fileUrl: mostRecentInvoice.filepath,
    invoice_no: mostRecentInvoice.invoice_no,
    invoice_date: mostRecentInvoice.invoice_date,
    reference_no: mostRecentInvoice.reference_no,
    proforma_invoice_no: mostRecentInvoice.proforma_invoice_no,
    marks_and_nos: mostRecentInvoice.marks_and_nos || null,
    currency: mostRecentInvoice.currency,
    total_amount: mostRecentInvoice.total_amount,
    item_count: mostRecentInvoice.item_count,
    
    consignee_name: mostRecentInvoice.consignee_name,
    consignee_address: mostRecentInvoice.consignee_address,
    consignee_email: mostRecentInvoice.consignee_email,
    consignee_phone: mostRecentInvoice.consignee_phone,
    consignee_country: mostRecentInvoice.consignee_country,
    
    exporter_name: mostRecentInvoice.exporter_name,
    exporter_address: mostRecentInvoice.exporter_address,
    exporter_email: mostRecentInvoice.exporter_email,
    exporter_phone: mostRecentInvoice.exporter_phone,
    exporter_pan: mostRecentInvoice.exporter_pan,
    exporter_gstin: mostRecentInvoice.exporter_gstin,
    exporter_iec: mostRecentInvoice.exporter_iec,
    
    incoterms: mostRecentInvoice.incoterms,
    place_of_receipt: mostRecentInvoice.place_of_receipt,
    port_of_loading: mostRecentInvoice.port_of_loading,
    port_of_discharge: mostRecentInvoice.port_of_discharge,
    final_destination: mostRecentInvoice.final_destination,
    country_of_origin: mostRecentInvoice.country_of_origin,
    country_of_destination: mostRecentInvoice.country_of_destination,
    hsn_code: mostRecentInvoice.hsn_code,
    
    bank_name: mostRecentInvoice.bank_name,
    bank_account: mostRecentInvoice.bank_account,
    bank_swift_code: mostRecentInvoice.bank_swift_code,
    bank_ifsc_code: mostRecentInvoice.bank_ifsc_code,
    payment_terms: mostRecentInvoice.payment_terms,
    
    has_signature: mostRecentInvoice.has_signature,
    verification_status: mostRecentInvoice.verification_status,
    completeness: mostRecentInvoice.completeness,
    validation_errors: Array.isArray(validationErrors) ? validationErrors : [],
    validation_warnings: Array.isArray(validationWarnings) ? validationWarnings : [],
    
    items: Array.isArray(items) ? items : [] // ✅ Ensure it's an array
  };
}

    // Transform SCOMET Declaration
    if (mostRecentSCOMET) {
      transformedData.scomet = {
        declarationId: mostRecentSCOMET.scomet_declaration_id,
        filename: mostRecentSCOMET.filename,
        fileUrl: mostRecentSCOMET.filepath,
        documentDate: mostRecentSCOMET.document_date,
        documentType: mostRecentSCOMET.document_type,
        consigneeName: mostRecentSCOMET.consignee_name,
        invoiceNumber: mostRecentSCOMET.invoice_number,
        invoiceDate: mostRecentSCOMET.invoice_date,
        destinationCountry: mostRecentSCOMET.destination_country,
        scometCoverage: mostRecentSCOMET.scomet_coverage,
        hsCode: mostRecentSCOMET.hs_code,
        goodsDescription: mostRecentSCOMET.goods_description,
        declarationStatement: mostRecentSCOMET.declaration_statement,
        signedStatus: mostRecentSCOMET.signed_status,
        signatoryName: mostRecentSCOMET.signatory_name,
        is_valid: mostRecentSCOMET.is_valid,
        completeness: mostRecentSCOMET.completeness,
        validation_errors: mostRecentSCOMET.validation_errors,
        validation_warnings: mostRecentSCOMET.validation_warnings
      };
    }

    // Transform Packing List
   // Transform Packing List
if (mostRecentPackingList) {
  // Parse boxDetails if it's a string
  let boxDetails = mostRecentPackingList.box_details;
  if (typeof boxDetails === 'string') {
    try {
      boxDetails = JSON.parse(boxDetails);
    } catch (e) {
      console.error('Error parsing box_details:', e);
      boxDetails = [];
    }
  }
  
  transformedData.packingList = {
    packingListId: mostRecentPackingList.packing_list_id,
    filename: mostRecentPackingList.filename,
    fileUrl: mostRecentPackingList.filepath,
    packingListNumber: mostRecentPackingList.packing_list_number,
    packingListDate: mostRecentPackingList.packing_list_date,
    referenceNo: mostRecentPackingList.reference_no,
    proformaInvoiceNo: mostRecentPackingList.proforma_invoice_no,
    invoiceNumber: mostRecentPackingList.invoice_number,
    invoiceDate: mostRecentPackingList.invoice_date,
    
    exporterName: mostRecentPackingList.exporter_name,
    exporterAddress: mostRecentPackingList.exporter_address,
    exporterEmail: mostRecentPackingList.exporter_email,
    exporterPhone: mostRecentPackingList.exporter_phone,
    exporterMobile: mostRecentPackingList.exporter_mobile,
    exporterPan: mostRecentPackingList.exporter_pan,
    exporterGstin: mostRecentPackingList.exporter_gstin,
    exporterIec: mostRecentPackingList.exporter_iec,
    
    consigneeName: mostRecentPackingList.consignee_name,
    consigneeAddress: mostRecentPackingList.consignee_address,
    consigneeEmail: mostRecentPackingList.consignee_email,
    consigneePhone: mostRecentPackingList.consignee_phone,
    consigneeMobile: mostRecentPackingList.consignee_mobile,
    consigneePoBox: mostRecentPackingList.consignee_po_box,
    
    bankName: mostRecentPackingList.bank_name,
    bankAddress: mostRecentPackingList.bank_address,
    bankAccountUsd: mostRecentPackingList.bank_account_usd,
    bankAccountEuro: mostRecentPackingList.bank_account_euro,
    bankIfscCode: mostRecentPackingList.bank_ifsc_code,
    bankSwiftCode: mostRecentPackingList.bank_swift_code,
    bankBranchCode: mostRecentPackingList.bank_branch_code,
    bankAdCode: mostRecentPackingList.bank_ad_code,
    bankBsrCode: mostRecentPackingList.bank_bsr_code,
    
    marksAndNos: mostRecentPackingList.marks_and_nos,
    countryOfOrigin: mostRecentPackingList.country_of_origin,
    countryOfDestination: mostRecentPackingList.country_of_destination,
    preCarriageBy: mostRecentPackingList.pre_carriage_by,
    placeOfReceipt: mostRecentPackingList.place_of_receipt,
    deliveryTerms: mostRecentPackingList.delivery_terms,
    hsnCode: mostRecentPackingList.hsn_code,
    vesselFlightNo: mostRecentPackingList.vessel_flight_no,
    portOfLoading: mostRecentPackingList.port_of_loading,
    portOfDischarge: mostRecentPackingList.port_of_discharge,
    finalDestination: mostRecentPackingList.final_destination,
    freightTerms: mostRecentPackingList.freight_terms,
    
    boxDetails: Array.isArray(boxDetails) ? boxDetails : [], // ✅ Ensure it's an array
    totalBoxes: mostRecentPackingList.total_boxes,
    totalGrossWeight: mostRecentPackingList.total_gross_weight,
    totalNetWeight: mostRecentPackingList.total_net_weight,
    totalBoxWeight: mostRecentPackingList.total_box_weight,
    packageType: mostRecentPackingList.package_type,
    
    descriptionOfGoods: mostRecentPackingList.description_of_goods,
    certificationStatement: mostRecentPackingList.certification_statement,
    
    is_valid: mostRecentPackingList.is_valid,
    completeness: mostRecentPackingList.completeness,
    validation_errors: mostRecentPackingList.validation_errors,
    validation_warnings: mostRecentPackingList.validation_warnings,
    invoiceMatchVerified: mostRecentPackingList.invoice_match_verified,
    amountsMatchVerified: mostRecentPackingList.amounts_match_verified
  };
}

    // Transform Fumigation Certificate
    if (mostRecentFumigation) {
      transformedData.fumigationCertificate = {
        fumigationCertificateId: mostRecentFumigation.fumigation_certificate_id,
        filename: mostRecentFumigation.filename,
        fileUrl: mostRecentFumigation.filepath,
        certificateNumber: mostRecentFumigation.certificate_number,
        certificateDate: mostRecentFumigation.certificate_date,
        dppqsRegistrationNumber: mostRecentFumigation.dppqs_registration_number,
        
        fumigantName: mostRecentFumigation.fumigant_name,
        fumigationDate: mostRecentFumigation.fumigation_date,
        fumigationPlace: mostRecentFumigation.fumigation_place,
        fumigantDosage: mostRecentFumigation.fumigant_dosage,
        fumigationDuration: mostRecentFumigation.fumigation_duration,
        minimumTemperature: mostRecentFumigation.minimum_temperature,
        gastightSheets: mostRecentFumigation.gastight_sheets,
        pressureDecayValue: mostRecentFumigation.pressure_decay_value,
        
        containerNumber: mostRecentFumigation.container_number,
        sealNumber: mostRecentFumigation.seal_number,
        exporterName: mostRecentFumigation.exporter_name,
        exporterAddress: mostRecentFumigation.exporter_address,
        consigneeName: mostRecentFumigation.consignee_name,
        cargoType: mostRecentFumigation.cargo_type,
        cargoDescription: mostRecentFumigation.cargo_description,
        quantity: mostRecentFumigation.quantity,
        packagingMaterial: mostRecentFumigation.packaging_material,
        additionalDeclaration: mostRecentFumigation.additional_declaration,
        shippingMark: mostRecentFumigation.shipping_mark,
        
        invoiceNumber: mostRecentFumigation.invoice_number,
        invoiceDate: mostRecentFumigation.invoice_date,
        
        operatorName: mostRecentFumigation.operator_name,
        operatorSignatureStatus: mostRecentFumigation.operator_signature_status,
        accreditationNumber: mostRecentFumigation.accreditation_number,
        
        is_valid: mostRecentFumigation.is_valid,
        completeness: mostRecentFumigation.completeness,
        validation_errors: mostRecentFumigation.validation_errors,
        validation_warnings: mostRecentFumigation.validation_warnings,
        invoiceMatchVerified: mostRecentFumigation.invoice_match_verified
      };
    }

    // Transform Export Declaration
    if (mostRecentExportDeclaration) {
      transformedData.exportDeclaration = {
        declarationId: mostRecentExportDeclaration.declaration_id,
        filename: mostRecentExportDeclaration.filename,
        fileUrl: mostRecentExportDeclaration.filepath,
        documentType: mostRecentExportDeclaration.document_type || 'Export Value Declaration',
        
        invoiceNo: mostRecentExportDeclaration.invoice_no,
        invoiceDate: mostRecentExportDeclaration.invoice_date,
        shippingBillNo: mostRecentExportDeclaration.shipping_bill_no,
        shippingBillDate: mostRecentExportDeclaration.shipping_bill_date,
        
        valuationMethod: mostRecentExportDeclaration.valuation_method,
        sellerBuyerRelated: mostRecentExportDeclaration.seller_buyer_related,
        relationshipInfluencedPrice: mostRecentExportDeclaration.relationship_influenced_price,
        applicableRule: mostRecentExportDeclaration.applicable_rule,
        
        paymentTerms: mostRecentExportDeclaration.payment_terms,
        deliveryTerms: mostRecentExportDeclaration.delivery_terms,
        typeOfSale: mostRecentExportDeclaration.type_of_sale,
        
        declarationStatus: mostRecentExportDeclaration.declaration_status,
        signedBy: mostRecentExportDeclaration.signed_by,
        signedDate: mostRecentExportDeclaration.signed_date,
        declarationNumber: mostRecentExportDeclaration.declaration_number,
        
        is_valid: mostRecentExportDeclaration.is_valid,
        completeness: mostRecentExportDeclaration.completeness,
        validation_errors: mostRecentExportDeclaration.validation_errors,
        validation_warnings: mostRecentExportDeclaration.validation_warnings,
        invoiceMatchVerified: mostRecentExportDeclaration.invoice_match_verified
      };
    }

    return NextResponse.json({
      success: true,
      data: transformedData,
      user: {
        userId: userRecord.user_id,
        role: userRecord.role,
        metadata: userMetadata,
        adminNotes,
        lastAdminMessage
      },
      summary: {
        totalInvoices: invoices.length,
        totalSCOMET: scometDeclarations.length,
        totalPackingLists: packingLists.length,
        totalFumigationCertificates: fumigationCertificates.length,
        totalExportDeclarations: exportDeclarations.length
      }
    });

  } catch (error: any) {
    console.error('[API] Error fetching user documents:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user documents',
        details: error.message
      },
      { status: 500 }
    );
  }
}