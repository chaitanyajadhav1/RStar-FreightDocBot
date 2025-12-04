import React from 'react'
import { FileText, Calendar, Hash, User, Globe, Building, Phone, Mail, MapPin, Banknote, Truck, Package, Scale, Info, Shield, CheckCircle, Edit, ChevronRight, X, AlertTriangle, Trash2 } from 'lucide-react'
import { PackingListData } from '../../../../types/documents'
import { ValidationBadge } from '../validation/ValidationBadge'
import { ValidationDetails } from '../validation/ValidationDetails'
import { DataField } from '../../common/DataField'
import { EditableField } from '../../common/EditableField'
import { PdfViewer } from '../../common/PdfViewer'

interface BoxDetail {
  boxNumber: string | null
  size: string | null
  grossWeight: string | null
  boxWeight: string | null
  netWeight: string | null
  contents: string | null
}

interface PackingListReviewProps {
  currentPackingList: PackingListData
  editPackingListMode: boolean
  packingListUpdating: boolean
  isPdfOpen: boolean
  token: string | null
  onTogglePdf: (step: string) => void
  onSetEditMode: (edit: boolean) => void
  onUpdatePackingList: () => void
  onUpdateField: (field: keyof PackingListData, value: any) => void
  
  // Add these three lines:
  onUpdatePackingListBox: (index: number, field: string, value: any) => void
  onRemovePackingListBox: (index: number) => void
  onAddPackingListBox: () => void
  
  onNextStep: () => void
  canEdit?: boolean
  onDeleteDocument?: () => void
}

export const PackingListReview: React.FC<PackingListReviewProps> = ({
  currentPackingList,
  editPackingListMode,
  packingListUpdating,
  isPdfOpen,
  token,
  onTogglePdf,
  onSetEditMode,
  onUpdatePackingList,
  onUpdateField,
  onNextStep,
  canEdit = true,
  onDeleteDocument
}) => {
  // EDIT MODE
  if (editPackingListMode) {
    return (
      <div className="h-full flex">
        {/* Left Section - Edit Form (compact when PDF is open) */}
        <div className={`${isPdfOpen ? 'w-1/2 pr-4' : 'w-full'} flex flex-col overflow-y-auto py-4 transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-700 to-teal-500 bg-clip-text text-transparent mb-1">
                Edit Packing List
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-400">Update the extracted packing list data as needed</p>
            </div>
            <button
              onClick={() => onTogglePdf('packinglist')}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-200 text-sm"
            >
              <FileText className="w-4 h-4" />
              {isPdfOpen ? 'Hide PDF' : 'View PDF'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{currentPackingList.filename}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full font-medium">
                  Editing Mode
                </span>
              </div>
            </div>

          {onDeleteDocument && (
            <div className="flex justify-end mb-4">
              <button
                onClick={onDeleteDocument}
                disabled={packingListUpdating}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Delete Document
              </button>
            </div>
          )}

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== BASIC INFORMATION ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Basic Information
                </h4>
              </div>
              
              <EditableField 
                label="Packing List Number" 
                value={currentPackingList.packingListNumber} 
                onChange={(value) => onUpdateField('packingListNumber', value)}
                icon={Hash}
              />
              <EditableField 
                label="Packing List Date" 
                value={currentPackingList.packingListDate} 
                onChange={(value) => onUpdateField('packingListDate', value)}
                type="date"
                icon={Calendar}
              />
              <EditableField 
                label="Reference No" 
                value={currentPackingList.referenceNo} 
                onChange={(value) => onUpdateField('referenceNo', value)}
                icon={Hash}
              />
              <EditableField 
                label="Proforma Invoice No" 
                value={currentPackingList.proformaInvoiceNo} 
                onChange={(value) => onUpdateField('proformaInvoiceNo', value)}
                icon={FileText}
              />
              <EditableField 
                label="Invoice Number" 
                value={currentPackingList.invoiceNumber} 
                onChange={(value) => onUpdateField('invoiceNumber', value)}
                icon={Hash}
              />
              <EditableField 
                label="Invoice Date" 
                value={currentPackingList.invoiceDate} 
                onChange={(value) => onUpdateField('invoiceDate', value)}
                type="date"
                icon={Calendar}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== EXPORTER DETAILS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Exporter Details
                </h4>
              </div>
              <EditableField 
                label="Name" 
                value={currentPackingList.exporterName} 
                onChange={(value) => onUpdateField('exporterName', value)}
                icon={Building}
              />
              <EditableField 
                label="Email" 
                value={currentPackingList.exporterEmail} 
                onChange={(value) => onUpdateField('exporterEmail', value)}
                type="email"
                icon={Mail}
              />
              <EditableField 
                label="Phone" 
                value={currentPackingList.exporterPhone} 
                onChange={(value) => onUpdateField('exporterPhone', value)}
                icon={Phone}
              />
              <EditableField 
                label="Mobile" 
                value={currentPackingList.exporterMobile} 
                onChange={(value) => onUpdateField('exporterMobile', value)}
                icon={Phone}
              />
              <EditableField 
                label="PAN" 
                value={currentPackingList.exporterPan} 
                onChange={(value) => onUpdateField('exporterPan', value)}
                icon={Hash}
              />
              <EditableField 
                label="GSTIN" 
                value={currentPackingList.exporterGstin} 
                onChange={(value) => onUpdateField('exporterGstin', value)}
                icon={Hash}
              />
              <EditableField 
                label="IEC" 
                value={currentPackingList.exporterIec} 
                onChange={(value) => onUpdateField('exporterIec', value)}
                icon={Hash}
              />
              <div className="col-span-2">
                <EditableField 
                  label="Address" 
                  value={currentPackingList.exporterAddress} 
                  onChange={(value) => onUpdateField('exporterAddress', value)}
                  multiline={true}
                  rows={3}
                  icon={MapPin}
                />
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== CONSIGNEE DETAILS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Consignee Details
                </h4>
              </div>
              <EditableField 
                label="Name" 
                value={currentPackingList.consigneeName} 
                onChange={(value) => onUpdateField('consigneeName', value)}
                icon={User}
              />
              <EditableField 
                label="Email" 
                value={currentPackingList.consigneeEmail} 
                onChange={(value) => onUpdateField('consigneeEmail', value)}
                type="email"
                icon={Mail}
              />
              <EditableField 
                label="Phone" 
                value={currentPackingList.consigneePhone} 
                onChange={(value) => onUpdateField('consigneePhone', value)}
                icon={Phone}
              />
              <EditableField 
                label="Mobile" 
                value={currentPackingList.consigneeMobile} 
                onChange={(value) => onUpdateField('consigneeMobile', value)}
                icon={Phone}
              />
              <EditableField 
                label="PO Box" 
                value={currentPackingList.consigneePoBox} 
                onChange={(value) => onUpdateField('consigneePoBox', value)}
                icon={Hash}
              />
              <div className="col-span-2">
                <EditableField 
                  label="Address" 
                  value={currentPackingList.consigneeAddress} 
                  onChange={(value) => onUpdateField('consigneeAddress', value)}
                  multiline={true}
                  rows={3}
                  icon={MapPin}
                />
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== BANK DETAILS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Bank Details
                </h4>
              </div>
              <EditableField 
                label="Bank Name" 
                value={currentPackingList.bankName} 
                onChange={(value) => onUpdateField('bankName', value)}
                icon={Banknote}
              />
              <EditableField 
                label="USD Account" 
                value={currentPackingList.bankAccountUsd} 
                onChange={(value) => onUpdateField('bankAccountUsd', value)}
                icon={Hash}
              />
              <EditableField 
                label="Euro Account" 
                value={currentPackingList.bankAccountEuro} 
                onChange={(value) => onUpdateField('bankAccountEuro', value)}
                icon={Hash}
              />
              <EditableField 
                label="SWIFT Code" 
                value={currentPackingList.bankSwiftCode} 
                onChange={(value) => onUpdateField('bankSwiftCode', value)}
                icon={Hash}
              />
              <EditableField 
                label="IFSC Code" 
                value={currentPackingList.bankIfscCode} 
                onChange={(value) => onUpdateField('bankIfscCode', value)}
                icon={Hash}
              />
              <EditableField 
                label="Branch Code" 
                value={currentPackingList.bankBranchCode} 
                onChange={(value) => onUpdateField('bankBranchCode', value)}
                icon={Hash}
              />
              <div className="col-span-2">
                <EditableField 
                  label="Bank Address" 
                  value={currentPackingList.bankAddress} 
                  onChange={(value) => onUpdateField('bankAddress', value)}
                  multiline={true}
                  rows={2}
                  icon={MapPin}
                />
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== SHIPMENT DETAILS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Shipment Details
                </h4>
              </div>
              <EditableField 
                label="Country of Origin" 
                value={currentPackingList.countryOfOrigin} 
                onChange={(value) => onUpdateField('countryOfOrigin', value)}
                icon={Globe}
              />
              <EditableField 
                label="Country of Destination" 
                value={currentPackingList.countryOfDestination} 
                onChange={(value) => onUpdateField('countryOfDestination', value)}
                icon={Globe}
              />
              <EditableField 
                label="Delivery Terms" 
                value={currentPackingList.deliveryTerms} 
                onChange={(value) => onUpdateField('deliveryTerms', value)}
                icon={FileText}
              />
              <EditableField 
                label="HSN Code" 
                value={currentPackingList.hsnCode} 
                onChange={(value) => onUpdateField('hsnCode', value)}
                icon={Hash}
              />
              <EditableField 
                label="Port of Loading" 
                value={currentPackingList.portOfLoading} 
                onChange={(value) => onUpdateField('portOfLoading', value)}
                icon={MapPin}
              />
              <EditableField 
                label="Port of Discharge" 
                value={currentPackingList.portOfDischarge} 
                onChange={(value) => onUpdateField('portOfDischarge', value)}
                icon={MapPin}
              />
              <EditableField 
                label="Vessel/Flight No" 
                value={currentPackingList.vesselFlightNo} 
                onChange={(value) => onUpdateField('vesselFlightNo', value)}
                icon={FileText}
              />
              <EditableField 
                label="Freight Terms" 
                value={currentPackingList.freightTerms} 
                onChange={(value) => onUpdateField('freightTerms', value)}
                icon={FileText}
              />
              <EditableField 
                label="Marks & Numbers" 
                value={currentPackingList.marksAndNos} 
                onChange={(value) => onUpdateField('marksAndNos', value)}
                icon={Hash}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== BOX & PACKAGE DETAILS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-3">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Package Summary
                </h4>
              </div>
              <EditableField 
                label="Total Boxes" 
                value={currentPackingList.totalBoxes} 
                onChange={(value) => onUpdateField('totalBoxes', parseInt(value) || 0)}
                type="number"
                icon={Package}
              />
              <EditableField 
                label="Package Type" 
                value={currentPackingList.packageType} 
                onChange={(value) => onUpdateField('packageType', value)}
                icon={Package}
              />
              <EditableField 
                label="Total Gross Weight" 
                value={currentPackingList.totalGrossWeight} 
                onChange={(value) => onUpdateField('totalGrossWeight', value)}
                icon={Scale}
              />
              <EditableField 
                label="Total Net Weight" 
                value={currentPackingList.totalNetWeight} 
                onChange={(value) => onUpdateField('totalNetWeight', value)}
                icon={Scale}
              />
              <EditableField 
                label="Total Box Weight" 
                value={currentPackingList.totalBoxWeight} 
                onChange={(value) => onUpdateField('totalBoxWeight', value)}
                icon={Scale}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== ADDITIONAL INFORMATION ===== */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Additional Information
                </h4>
              </div>
              <EditableField 
                label="Description of Goods" 
                value={currentPackingList.descriptionOfGoods} 
                onChange={(value) => onUpdateField('descriptionOfGoods', value)}
                multiline={true}
                rows={3}
                icon={FileText}
              />
              <EditableField 
                label="Certification Statement" 
                value={currentPackingList.certificationStatement} 
                onChange={(value) => onUpdateField('certificationStatement', value)}
                multiline={true}
                rows={2}
                icon={Shield}
              />
            </div>

            {/* ===== ACTION BUTTONS ===== */}
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => onSetEditMode(false)}
                disabled={packingListUpdating}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={onUpdatePackingList}
                disabled={packingListUpdating}
                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                {packingListUpdating ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Section - PDF Viewer */}
        {isPdfOpen && token && (
          <div className="w-1/2 pl-4">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  Document Preview
                </h3>
                <button
                  onClick={() => onTogglePdf('packinglist')}
                  className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <PdfViewer 
                  fileUrl={currentPackingList.fileUrl || ''} 
                  bucket="packing_lists"
                  token={token}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // VIEW MODE
  return (
    <div className="h-full flex">
      {/* Left Section - Review Form */}
      <div className={`${isPdfOpen ? 'w-1/2 pr-4' : 'w-full'} flex flex-col overflow-y-auto py-4 transition-all duration-300`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-700 to-teal-500 bg-clip-text text-transparent mb-1">
              Review Packing List
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400">
              Review the comprehensive packing list data and validation with commercial invoice
            </p>
          </div>
          <button
            onClick={() => onTogglePdf('packinglist')}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-200 text-sm"
          >
            <FileText className="w-4 h-4" />
            {isPdfOpen ? 'Hide PDF' : 'View PDF'}
          </button>
        </div>

        {onDeleteDocument && (
          <div className="flex justify-end mb-4">
            <button
              onClick={onDeleteDocument}
              disabled={packingListUpdating}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Delete Document
            </button>
          </div>
        )}

        <ValidationBadge
          completeness={currentPackingList.completeness || 0}
          errors={currentPackingList.validation_errors || []}
          warnings={currentPackingList.validation_warnings || []}
          invoiceMatchVerified={currentPackingList.invoiceMatchVerified}
        />

        {currentPackingList.validationDetails && (
          <ValidationDetails validationDetails={currentPackingList.validationDetails} />
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{currentPackingList.filename}</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full font-medium">
                {currentPackingList.totalBoxes} Box(es)
              </span>
            </div>
          </div>

          {onDeleteDocument && (
            <div className="flex justify-end mb-4">
              <button
                onClick={onDeleteDocument}
                disabled={packingListUpdating}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Delete Document
              </button>
            </div>
          )}

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Basic Information
              </h4>
            </div>
            <DataField label="Packing List Number" value={currentPackingList.packingListNumber} icon={Hash} />
            <DataField label="Packing List Date" value={currentPackingList.packingListDate} icon={Calendar} />
            <DataField label="Reference No" value={currentPackingList.referenceNo} icon={Hash} />
            <DataField label="Proforma Invoice No" value={currentPackingList.proformaInvoiceNo} icon={FileText} />
            <DataField label="Invoice Number" value={currentPackingList.invoiceNumber} icon={Hash} />
            <DataField label="Invoice Date" value={currentPackingList.invoiceDate} icon={Calendar} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          {/* Exporter Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Building className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Exporter Details
              </h4>
            </div>
            <DataField label="Name" value={currentPackingList.exporterName} icon={Building} />
            <DataField label="Email" value={currentPackingList.exporterEmail} icon={Mail} />
            <DataField label="Phone" value={currentPackingList.exporterPhone} icon={Phone} />
            <DataField label="Mobile" value={currentPackingList.exporterMobile} icon={Phone} />
            <DataField label="PAN" value={currentPackingList.exporterPan} icon={Hash} />
            <DataField label="GSTIN" value={currentPackingList.exporterGstin} icon={Hash} />
            <DataField label="IEC" value={currentPackingList.exporterIec} icon={Hash} />
            <div className="col-span-2">
              <DataField label="Address" value={currentPackingList.exporterAddress} icon={MapPin} />
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          {/* Consignee Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Consignee Details
              </h4>
            </div>
            <DataField label="Name" value={currentPackingList.consigneeName} icon={User} />
            <DataField label="Email" value={currentPackingList.consigneeEmail} icon={Mail} />
            <DataField label="Phone" value={currentPackingList.consigneePhone} icon={Phone} />
            <DataField label="Mobile" value={currentPackingList.consigneeMobile} icon={Phone} />
            <DataField label="PO Box" value={currentPackingList.consigneePoBox} icon={Hash} />
            <div className="col-span-2">
              <DataField label="Address" value={currentPackingList.consigneeAddress} icon={MapPin} />
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          {/* Bank Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Bank Details
              </h4>
            </div>
            <DataField label="Bank Name" value={currentPackingList.bankName} icon={Banknote} />
            <DataField label="USD Account" value={currentPackingList.bankAccountUsd} icon={Hash} />
            <DataField label="Euro Account" value={currentPackingList.bankAccountEuro} icon={Hash} />
            <DataField label="SWIFT Code" value={currentPackingList.bankSwiftCode} icon={Hash} />
            <DataField label="IFSC Code" value={currentPackingList.bankIfscCode} icon={Hash} />
            <DataField label="Branch Code" value={currentPackingList.bankBranchCode} icon={Hash} />
            <div className="col-span-2">
              <DataField label="Bank Address" value={currentPackingList.bankAddress} icon={MapPin} />
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          {/* Shipment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Shipment Details
              </h4>
            </div>
            <DataField label="Country of Origin" value={currentPackingList.countryOfOrigin} icon={Globe} />
            <DataField label="Country of Destination" value={currentPackingList.countryOfDestination} icon={Globe} />
            <DataField label="Delivery Terms" value={currentPackingList.deliveryTerms} icon={FileText} />
            <DataField label="HSN Code" value={currentPackingList.hsnCode} icon={Hash} />
            <DataField label="Port of Loading" value={currentPackingList.portOfLoading} icon={MapPin} />
            <DataField label="Port of Discharge" value={currentPackingList.portOfDischarge} icon={MapPin} />
            <DataField label="Vessel/Flight No" value={currentPackingList.vesselFlightNo} icon={FileText} />
            <DataField label="Freight Terms" value={currentPackingList.freightTerms} icon={FileText} />
            <DataField label="Marks & Numbers" value={currentPackingList.marksAndNos} icon={Hash} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          {/* Package Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="col-span-3">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Package Summary
              </h4>
            </div>
            <DataField label="Total Boxes" value={currentPackingList.totalBoxes} icon={Package} />
            <DataField label="Package Type" value={currentPackingList.packageType} icon={Package} />
            <DataField label="Total Gross Weight" value={currentPackingList.totalGrossWeight} icon={Scale} />
            <DataField label="Total Net Weight" value={currentPackingList.totalNetWeight} icon={Scale} />
            <DataField label="Total Box Weight" value={currentPackingList.totalBoxWeight} icon={Scale} />
          </div>

          {/* Box Details */}
          {currentPackingList.boxDetails && currentPackingList.boxDetails.length > 0 && (
            <>
              <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Box Details ({currentPackingList.boxDetails.length})
              </h4>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                        <th className="text-left p-2 font-semibold text-slate-900 dark:text-white text-xs">Box #</th>
                        <th className="text-left p-2 font-semibold text-slate-900 dark:text-white text-xs">Size</th>
                        <th className="text-left p-2 font-semibold text-slate-900 dark:text-white text-xs">Gross Weight</th>
                        <th className="text-left p-2 font-semibold text-slate-900 dark:text-white text-xs">Box Weight</th>
                        <th className="text-left p-2 font-semibold text-slate-900 dark:text-white text-xs">Net Weight</th>
                        <th className="text-left p-2 font-semibold text-slate-900 dark:text-white text-xs">Contents</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPackingList.boxDetails.map((box, idx) => (
                        <tr key={idx} className="border-b border-slate-200 dark:border-slate-600 last:border-b-0">
                          <td className="p-2 text-slate-900 dark:text-white text-xs">{box.boxNumber || 'N/A'}</td>
                          <td className="p-2 text-slate-900 dark:text-white text-xs">{box.size || 'N/A'}</td>
                          <td className="p-2 text-slate-900 dark:text-white text-xs">{box.grossWeight || 'N/A'}</td>
                          <td className="p-2 text-slate-900 dark:text-white text-xs">{box.boxWeight || 'N/A'}</td>
                          <td className="p-2 text-slate-900 dark:text-white text-xs">{box.netWeight || 'N/A'}</td>
                          <td className="p-2 text-slate-900 dark:text-white text-xs">{box.contents || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Additional Information */}
          {(currentPackingList.descriptionOfGoods || currentPackingList.certificationStatement) && (
            <>
              <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Additional Information
              </h4>
              <div className="grid grid-cols-1 gap-4">
                {currentPackingList.descriptionOfGoods && (
                  <DataField label="Description of Goods" value={currentPackingList.descriptionOfGoods} icon={FileText} />
                )}
                {currentPackingList.certificationStatement && (
                  <DataField label="Certification Statement" value={currentPackingList.certificationStatement} icon={Shield} />
                )}
              </div>
            </>
          )}
        </div>

        {/* {(Array.isArray(currentPackingList.validation_warnings) && currentPackingList.validation_warnings.length > 0) && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 mb-4">
            <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-2 text-sm">Warnings</h4>
            <ul className="list-disc list-inside space-y-1 text-xs">
              {currentPackingList.validation_warnings.map((warning, idx) => (
                <li key={idx} className="text-amber-800 dark:text-amber-400">{warning}</li>
              ))}
            </ul>
          </div>
        )} */}

        <div className="flex gap-3 justify-center">
          {canEdit && (
            <button
              onClick={() => onSetEditMode(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200 text-sm"
            >
              <Edit className="w-4 h-4" />
              Edit Data
            </button>
          )}
          {onDeleteDocument && (
            <button
              onClick={onDeleteDocument}
              disabled={packingListUpdating}
              className="inline-flex items-center gap-2 px-4 py-2 border border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors duration-200 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Delete Document
            </button>
          )}
          <button
            onClick={onNextStep}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-lg hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-sm"
          >
            Continue to Next Document
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right Section - PDF Viewer */}
      {isPdfOpen && token && (
        <div className="w-1/2 pl-4">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Document Preview
              </h3>
              <button
                onClick={() => onTogglePdf('packinglist')}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <PdfViewer 
                fileUrl={currentPackingList.fileUrl || ''} 
                bucket="packing_lists"
                token={token}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}