export interface ExportDeclarationData {
  declarationId: string
  filename: string
  fileUrl?: string
  uploaded_at?: string
  processed_at?: string
  status?: 'valid' | 'invalid' | 'pending'
  
  // Document Information
  documentType?: string
  
  // Core Fields
  invoiceNo?: string | null
  invoiceDate?: string | null
  shippingBillNo?: string | null
  shippingBillDate?: string | null
  
  // Valuation Fields
  valuationMethod?: string | null
  sellerBuyerRelated?: boolean | null
  relationshipInfluencedPrice?: boolean | null
  applicableRule?: string | null
  
  // Transaction Fields
  paymentTerms?: string | null
  deliveryTerms?: string | null
  typeOfSale?: string | null
  
  // Declaration Fields
  declarationStatus?: string | null
  signedBy?: string | null
  signedDate?: string | null
  declarationNumber?: string | null
  
  // Validation
  is_valid?: boolean
  completeness?: number
  validation_errors?: string[]
  validation_warnings?: string[]
  invoiceMatchVerified?: boolean
  validationDetails?: {
    invoiceNo?: { match: boolean; commercialValue?: string; documentValue?: string }
    invoiceDate?: { match: boolean; commercialValue?: string; documentValue?: string }
    shippingBillNo?: { match: boolean; commercialValue?: string; documentValue?: string }
    shippingBillDate?: { match: boolean; commercialValue?: string; documentValue?: string }
    declarationNumber?: { match: boolean; commercialValue?: string; documentValue?: string }
  }
  
  // Additional fields from backend
  extracted_text?: string
  user_id?: string
  organization_id?: string | null
  thread_id?: string
  filepath?: string
}

// Complete set of all document interfaces
export interface InvoiceItem {
  description: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  hsCode?: string
}

export interface InvoiceData {
  invoiceId: string
  filename: string
  fileUrl?: string
  invoice_no?: string
  marks_and_nos?: string
  invoice_date?: string
  reference_no?: string
  proforma_invoice_no?: string
  consignee_name?: string
  consignee_address?: string
  consignee_email?: string
  consignee_phone?: string
  consignee_country?: string
  exporter_name?: string
  exporter_address?: string
  exporter_email?: string
  exporter_phone?: string
  exporter_pan?: string
  exporter_gstin?: string
  exporter_iec?: string
  incoterms?: string
  place_of_receipt?: string
  port_of_loading?: string
  port_of_discharge?: string
  final_destination?: string
  country_of_origin?: string
  country_of_destination?: string
  hsn_code?: string
  bank_name?: string
  bank_account?: string
  bank_swift_code?: string
  bank_ifsc_code?: string
  payment_terms?: string
  is_valid?: boolean
  completeness?: number
  validation_errors?: string[]
  validation_warnings?: string[]
  item_count?: number
  items?: InvoiceItem[]
  total_amount?: number
  currency?: string
  has_signature?: boolean
  verification_status?: string
  document_type?: string
  status?: string
}

export interface SCOMETDeclarationData {
  declarationId: string
  filename: string
  fileUrl?: string
  documentDate?: string
  documentType?: string
  consigneeName?: string
  invoiceNumber?: string
  invoiceDate?: string
  destinationCountry?: string
  scometCoverage?: boolean
  hsCode?: string
  goodsDescription?: string
  declarationStatement?: string
  signedStatus?: boolean
  signatoryName?: string
  is_valid?: boolean
  completeness?: number
  validation_errors?: string[]
  validation_warnings?: string[]
  invoiceMatchVerified?: boolean
  validationDetails?: {
    invoiceNumber?: { match: boolean; commercialValue?: string; documentValue?: string }
    invoiceDate?: { match: boolean; commercialValue?: string; documentValue?: string }
    consigneeName?: { match: boolean; commercialValue?: string; documentValue?: string }
    destinationCountry?: { match: boolean; commercialValue?: string; documentValue?: string }
  }
}

export interface BoxDetail {
  boxNumber: string | null
  size: string | null
  grossWeight: string | null
  boxWeight: string | null
  netWeight: string | null
  contents: string | null
}

export interface PackingListData {
  packingListId: string
  filename: string
  fileUrl?: string
  packingListNumber?: string
  packingListDate?: string
  referenceNo?: string
  proformaInvoiceNo?: string
  exporterName?: string
  exporterAddress?: string
  exporterEmail?: string
  exporterPhone?: string
  exporterMobile?: string
  exporterPan?: string
  exporterGstin?: string
  exporterIec?: string
  consigneeName?: string
  consigneeAddress?: string
  consigneeEmail?: string
  consigneePhone?: string
  consigneeMobile?: string
  consigneePoBox?: string
  bankName?: string
  bankAddress?: string
  bankAccountUsd?: string
  bankAccountEuro?: string
  bankIfscCode?: string
  bankSwiftCode?: string
  bankBranchCode?: string
  bankAdCode?: string
  bankBsrCode?: string
  marksAndNos?: string
  countryOfOrigin?: string
  countryOfDestination?: string
  preCarriageBy?: string
  placeOfReceipt?: string
  deliveryTerms?: string
  hsnCode?: string
  vesselFlightNo?: string
  portOfLoading?: string
  portOfDischarge?: string
  finalDestination?: string
  freightTerms?: string
  invoiceNumber?: string
  invoiceDate?: string
  boxDetails?: BoxDetail[]
  totalBoxes?: number
  totalGrossWeight?: string
  totalNetWeight?: string
  totalBoxWeight?: string
  packageType?: string
  descriptionOfGoods?: string
  certificationStatement?: string
  is_valid?: boolean
  completeness?: number
  validation_errors?: string[]
  validation_warnings?: string[]
  invoiceMatchVerified?: boolean
  amountsMatchVerified?: boolean
  validationDetails?: {
    invoiceNumber?: { match: boolean; commercialValue?: string; documentValue?: string }
    invoiceDate?: { match: boolean; commercialValue?: string; documentValue?: string }
    exporterName?: { match: boolean; commercialValue?: string; documentValue?: string }
    consigneeName?: { match: boolean; commercialValue?: string; documentValue?: string }
  }
}

export interface FumigationCertificateData {
  certificateId: string
  filename: string
  fileUrl?: string
  invoiceDateFumigationCertificate:string
  invoiceNoFumigationCertificate:string
  certificateNumber?: string
  certificateDate?: string
  dppqsRegistrationNumber?: string
  fumigantName?: string
  fumigationDate?: string
  fumigationPlace?: string
  fumigantDosage?: string
  fumigationDuration?: string
  minimumTemperature?: string
  gastightSheets?: boolean
  pressureDecayValue?: string
  containerNumber?: string
  sealNumber?: string
  exporterName?: string
  exporterAddress?: string
  consigneeName?: string
  cargoType?: string
  cargoDescription?: string
  quantity?: string
  packagingMaterial?: string
  additionalDeclaration?: string
  shippingMark?: string
  invoiceNumber?: string
  invoiceDate?: string
  operatorName?: string
  operatorSignatureStatus?: boolean
  accreditationNumber?: string
  is_valid?: boolean
  completeness?: number
  validation_errors?: string[]
  validation_warnings?: string[]
  invoiceMatchVerified?: boolean
  validationDetails?: {
    invoiceNumber?: { match: boolean; commercialValue?: string; documentValue?: string }
    invoiceDate?: { match: boolean; commercialValue?: string; documentValue?: string }
    shippingMark?: { match: boolean; commercialValue?: string; documentValue?: string }
  }
}

// src/types/documents.ts - Add this interface to your existing file
export interface AirwayBillData {
  // Meta
  airway_bill_id: string
  user_id: string
  organization_id: string | null
  thread_id: string
  filename: string
  filepath: string
  fileUrl?: string
  uploaded_at: string
  processed_at: string
  status: 'valid' | 'invalid' | 'pending'
  
  // Document Information
  document_type: string | null
  airway_bill_no: string | null
  invoice_no: string | null
  invoice_date: string | null
  
  // Shipper Information
  shippers_name: string | null
  shippers_address: string | null
  
  // Consignee Information
  consignees_name: string | null
  consignees_address: string | null
  
  // Carrier Information
  issuing_carriers_name: string | null
  issuing_carriers_city: string | null
  agents_iata_code: string | null
  
  // Shipment Details
  airport_of_departure: string | null
  airport_of_destination: string | null
  accounting_information: string | null
  
  // Cargo Details
  hs_code_no: string | null
  no_of_pieces: string | null
  gross_weight: string | null
  chargeable_weight: string | null
  nature_of_goods: string | null
  
  // Validation
  is_valid: boolean
  completeness: number
  validation_errors: string[]
  validation_warnings: string[]
  invoiceMatchVerified?: boolean
  validationDetails?: {
    invoiceMatch?: {
      matched: boolean
      matchedFields: string[]
      mismatchedFields: string[]
      confidence: number
    }
    dataQuality?: {
      completeness: number
      accuracy: number
      consistency: number
    }
  }
  
  extracted_text: string
}