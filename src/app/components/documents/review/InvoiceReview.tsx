import React from 'react'
import { FileText, Calendar, Hash, Banknote, Package, User, Globe, Mail, Phone, MapPin, Building, Truck, Shield, CheckCircle, Edit, ChevronRight, X, Info, Scale, AlertTriangle, CircleCheck, CircleX, Trash2 } from 'lucide-react'
import { InvoiceData, InvoiceItem } from '../../../../types/documents'
import { ValidationBadge } from '../validation/ValidationBadge'
import { ValidationDetails } from '../validation/ValidationDetails'
import { DataField } from '../../common/DataField'
import { EditableField } from '../../common/EditableField'
import { PdfViewer } from '../../common/PdfViewer'

interface InvoiceReviewProps {
  currentInvoice: InvoiceData
  editInvoiceMode: boolean
  invoiceUpdating: boolean
  isPdfOpen: boolean
  token: string | null
  onTogglePdf: (step: string) => void
  onSetEditMode: (edit: boolean) => void
  onUpdateInvoice: () => void
  onUpdateField: (field: keyof InvoiceData, value: any) => void
  onUpdateItem: (index: number, field: keyof InvoiceItem, value: any) => void
  onRemoveItem: (index: number) => void
  onAddItem: () => void
  onNextStep: () => void
  canEdit?: boolean
  onDeleteDocument?: () => void
}

export const InvoiceReview: React.FC<InvoiceReviewProps> = ({
  currentInvoice,
  editInvoiceMode,
  invoiceUpdating,
  isPdfOpen,
  token,
  onTogglePdf,
  onSetEditMode,
  onUpdateInvoice,
  onUpdateField,
  onUpdateItem,
  onRemoveItem,
  onAddItem,
  onNextStep,
  canEdit = true,
  onDeleteDocument
}) => {
  // EDIT MODE
  if (editInvoiceMode) {
    return (
      <div className="h-full flex">
        {/* Left Section - Edit Form (compact when PDF is open) */}
        <div className={`${isPdfOpen ? 'w-1/2 pr-4' : 'w-full'} flex flex-col overflow-y-auto py-4 transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-700 to-teal-500 bg-clip-text text-transparent mb-1">
                Edit Commercial Invoice
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-400">Update the extracted invoice data as needed</p>
            </div>
            <button
              onClick={() => onTogglePdf('invoice')}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-200 text-sm"
            >
              <FileText className="w-4 h-4" />
              {isPdfOpen ? 'Hide PDF' : 'View PDF'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
                <FileText className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{currentInvoice.filename}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 text-xs rounded-full font-medium">
                  Editing Mode
                </span>
              </div>
            </div>

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
                label="Invoice Number" 
                value={currentInvoice.invoice_no} 
                onChange={(value) => onUpdateField('invoice_no', value)}
                icon={FileText}
              />
              <EditableField 
                label="Invoice Date" 
                value={currentInvoice.invoice_date} 
                onChange={(value) => onUpdateField('invoice_date', value)}
                type="date"
                icon={Calendar}
              />
              <EditableField 
                label="Reference No" 
                value={currentInvoice.reference_no} 
                onChange={(value) => onUpdateField('reference_no', value)}
                icon={Hash}
              />
              <EditableField 
                label="Proforma Invoice No" 
                value={currentInvoice.proforma_invoice_no} 
                onChange={(value) => onUpdateField('proforma_invoice_no', value)}
                icon={FileText}
              />
              <EditableField 
                label="Marks and Nos" 
                value={currentInvoice.marks_and_nos} 
                onChange={(value) => onUpdateField('marks_and_nos', value)}
                icon={Hash}
              />
              <EditableField 
                label="Currency" 
                value={currentInvoice.currency} 
                onChange={(value) => onUpdateField('currency', value)}
                icon={Banknote}
              />
              <EditableField 
                label="Total Amount" 
                value={currentInvoice.total_amount} 
                onChange={(value) => onUpdateField('total_amount', parseFloat(value) || 0)}
                type="number"
                icon={Banknote}
              />
              <EditableField 
                label="Item Count" 
                value={currentInvoice.item_count} 
                onChange={(value) => onUpdateField('item_count', parseInt(value) || 0)}
                type="number"
                icon={Package}
              />
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
                value={currentInvoice.consignee_name} 
                onChange={(value) => onUpdateField('consignee_name', value)}
                icon={User}
              />
              <EditableField 
                label="Country" 
                value={currentInvoice.consignee_country} 
                onChange={(value) => onUpdateField('consignee_country', value)}
                icon={Globe}
              />
              <EditableField 
                label="Email" 
                value={currentInvoice.consignee_email} 
                onChange={(value) => onUpdateField('consignee_email', value)}
                type="email"
                icon={Mail}
              />
              <EditableField 
                label="Phone" 
                value={currentInvoice.consignee_phone} 
                onChange={(value) => onUpdateField('consignee_phone', value)}
                icon={Phone}
              />
              <div className="col-span-2">
                <EditableField 
                  label="Address" 
                  value={currentInvoice.consignee_address} 
                  onChange={(value) => onUpdateField('consignee_address', value)}
                  multiline={true}
                  rows={3}
                  icon={MapPin}
                />
              </div>
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
                value={currentInvoice.exporter_name} 
                onChange={(value) => onUpdateField('exporter_name', value)}
                icon={Building}
              />
              <EditableField 
                label="Email" 
                value={currentInvoice.exporter_email} 
                onChange={(value) => onUpdateField('exporter_email', value)}
                type="email"
                icon={Mail}
              />
              <EditableField 
                label="Phone" 
                value={currentInvoice.exporter_phone} 
                onChange={(value) => onUpdateField('exporter_phone', value)}
                icon={Phone}
              />
              <EditableField 
                label="PAN" 
                value={currentInvoice.exporter_pan} 
                onChange={(value) => onUpdateField('exporter_pan', value)}
                icon={Hash}
              />
              <EditableField 
                label="GSTIN" 
                value={currentInvoice.exporter_gstin} 
                onChange={(value) => onUpdateField('exporter_gstin', value)}
                icon={Hash}
              />
              <EditableField 
                label="IEC" 
                value={currentInvoice.exporter_iec} 
                onChange={(value) => onUpdateField('exporter_iec', value)}
                icon={Hash}
              />
              <div className="col-span-2">
                <EditableField 
                  label="Address" 
                  value={currentInvoice.exporter_address} 
                  onChange={(value) => onUpdateField('exporter_address', value)}
                  multiline={true}
                  rows={3}
                  icon={MapPin}
                />
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== SHIPPING DETAILS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Shipping Details
                </h4>
              </div>
              <EditableField 
                label="Incoterms" 
                value={currentInvoice.incoterms} 
                onChange={(value) => onUpdateField('incoterms', value)}
                icon={FileText}
              />
              <EditableField 
                label="Place of Receipt" 
                value={currentInvoice.place_of_receipt} 
                onChange={(value) => onUpdateField('place_of_receipt', value)}
                icon={MapPin}
              />
              <EditableField 
                label="Port of Loading" 
                value={currentInvoice.port_of_loading} 
                onChange={(value) => onUpdateField('port_of_loading', value)}
                icon={MapPin}
              />
              <EditableField 
                label="Port of Discharge" 
                value={currentInvoice.port_of_discharge} 
                onChange={(value) => onUpdateField('port_of_discharge', value)}
                icon={MapPin}
              />
              <EditableField 
                label="Final Destination" 
                value={currentInvoice.final_destination} 
                onChange={(value) => onUpdateField('final_destination', value)}
                icon={Globe}
              />
              <EditableField 
                label="Country of Origin" 
                value={currentInvoice.country_of_origin} 
                onChange={(value) => onUpdateField('country_of_origin', value)}
                icon={Globe}
              />
              <EditableField 
                label="Country of Destination" 
                value={currentInvoice.country_of_destination} 
                onChange={(value) => onUpdateField('country_of_destination', value)}
                icon={Globe}
              />
              <EditableField 
                label="HSN Code" 
                value={currentInvoice.hsn_code} 
                onChange={(value) => onUpdateField('hsn_code', value)}
                icon={Hash}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== BANKING DETAILS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Banking Details
                </h4>
              </div>
              <EditableField 
                label="Bank Name" 
                value={currentInvoice.bank_name} 
                onChange={(value) => onUpdateField('bank_name', value)}
                icon={Banknote}
              />
              <EditableField 
                label="Account Number" 
                value={currentInvoice.bank_account} 
                onChange={(value) => onUpdateField('bank_account', value)}
                icon={Hash}
              />
              <EditableField 
                label="SWIFT Code" 
                value={currentInvoice.bank_swift_code} 
                onChange={(value) => onUpdateField('bank_swift_code', value)}
                icon={Hash}
              />
              <EditableField 
                label="IFSC Code" 
                value={currentInvoice.bank_ifsc_code} 
                onChange={(value) => onUpdateField('bank_ifsc_code', value)}
                icon={Hash}
              />
              <div className="col-span-2">
                <EditableField 
                  label="Payment Terms" 
                  value={currentInvoice.payment_terms} 
                  onChange={(value) => onUpdateField('payment_terms', value)}
                  multiline={true}
                  rows={2}
                  icon={FileText}
                />
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== DOCUMENT STATUS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Document Status
                </h4>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-teal-600 dark:text-teal-400 mt-2.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Has Signature</label>
                  <select
                    className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-800 dark:text-white"
                    value={currentInvoice.has_signature ? 'true' : 'false'}
                    onChange={(e) => onUpdateField('has_signature', e.target.value === 'true')}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>
              <EditableField 
                label="Verification Status" 
                value={currentInvoice.verification_status} 
                onChange={(value) => onUpdateField('verification_status', value)}
                icon={Shield}
              />
            </div>

            {/* ===== ITEMS SECTION ===== */}
            {currentInvoice.items && currentInvoice.items.length > 0 && (
              <>
                <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    Invoice Items ({currentInvoice.items.length})
                  </h4>
                  <div className="space-y-3">
                    {currentInvoice.items.map((item, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-slate-900 dark:text-white text-sm">Item {idx + 1}</span>
                          <button
                            onClick={() => onRemoveItem(idx)}
                            className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 text-xs"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <EditableField 
                              label="Description" 
                              value={item.description} 
                              onChange={(value) => onUpdateItem(idx, 'description', value)}
                              multiline={true}
                              rows={2}
                            />
                          </div>
                          <EditableField 
                            label="Quantity" 
                            value={item.quantity} 
                            onChange={(value) => onUpdateItem(idx, 'quantity', parseFloat(value) || 0)}
                            type="number"
                          />
                          <EditableField 
                            label="Unit" 
                            value={item.unit} 
                            onChange={(value) => onUpdateItem(idx, 'unit', value)}
                          />
                          <EditableField 
                            label="Unit Price" 
                            value={item.unitPrice} 
                            onChange={(value) => {
                              const unitPrice = parseFloat(value) || 0
                              const quantity = item.quantity || 0
                              onUpdateItem(idx, 'unitPrice', unitPrice)
                              onUpdateItem(idx, 'totalPrice', unitPrice * quantity)
                            }}
                            type="number"
                          />
                          <EditableField 
                            label="Total Price" 
                            value={item.totalPrice} 
                            onChange={(value) => onUpdateItem(idx, 'totalPrice', parseFloat(value) || 0)}
                            type="number"
                          />
                          <EditableField 
                            label="HS Code" 
                            value={item.hsCode} 
                            onChange={(value) => onUpdateItem(idx, 'hsCode', value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Add New Item Button */}
                  <button
                    onClick={onAddItem}
                    className="mt-3 w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400 hover:border-teal-400 hover:text-teal-600 dark:hover:border-teal-500 dark:hover:text-teal-400 transition-colors duration-200 text-sm font-medium"
                  >
                    + Add New Item
                  </button>
                </div>
              </>
            )}

            {/* ===== ACTION BUTTONS ===== */}
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => onSetEditMode(false)}
                disabled={invoiceUpdating}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={onUpdateInvoice}
                disabled={invoiceUpdating}
                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                {invoiceUpdating ? (
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

        {/* Right Section - PDF Viewer (only when toggled and document exists) */}
        {isPdfOpen && token && (
          <div className="w-1/2 pl-4">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  Document Preview
                </h3>
                <button
                  onClick={() => onTogglePdf('invoice')}
                  className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <PdfViewer 
                  fileUrl={currentInvoice.fileUrl || ''} 
                  bucket="invoices"
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
              Review Commercial Invoice
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400">
              Review the extracted invoice data - this will be used to validate other documents
            </p>
          </div>
          <button
            onClick={() => onTogglePdf('invoice')}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-200 text-sm"
          >
            <FileText className="w-4 h-4" />
            {isPdfOpen ? 'Hide PDF' : 'View PDF'}
          </button>
        </div>

        <ValidationBadge
          completeness={currentInvoice.completeness || 0}
          errors={currentInvoice.validation_errors || []}
          warnings={currentInvoice.validation_warnings || []}
        />

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
              <FileText className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{currentInvoice.filename}</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 text-xs rounded-full font-medium">
                Invoice: {currentInvoice.invoice_no || 'N/A'}
              </span>
            </div>
          </div>

          {onDeleteDocument && (
            <div className="flex justify-end mb-4">
              <button
                onClick={onDeleteDocument}
                disabled={invoiceUpdating}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Delete Document
              </button>
            </div>
          )}

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Basic Information
              </h4>
            </div>
            <DataField label="Invoice Number" value={currentInvoice.invoice_no} icon={FileText} />
            <DataField label="Invoice Date" value={currentInvoice.invoice_date} icon={Calendar} />
            <DataField label="Reference No" value={currentInvoice.reference_no} icon={Hash} />
            <DataField label="Proforma Invoice" value={currentInvoice.proforma_invoice_no} icon={FileText} />
            <DataField label="Marks and Nos" value={currentInvoice.marks_and_nos} icon={Hash} />
            <DataField label="Currency" value={currentInvoice.currency} icon={Banknote} />
            <DataField label="Total Amount" value={currentInvoice.total_amount ? `${currentInvoice.currency || ''} ${currentInvoice.total_amount}` : 'N/A'} icon={Banknote} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Consignee Details
              </h4>
            </div>
            <DataField label="Name" value={currentInvoice.consignee_name} icon={User} />
            <DataField label="Country" value={currentInvoice.consignee_country} icon={Globe} />
            <DataField label="Email" value={currentInvoice.consignee_email} icon={Mail} />
            <DataField label="Phone" value={currentInvoice.consignee_phone} icon={Phone} />
            <div className="col-span-2">
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Address</div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">{currentInvoice.consignee_address || 'N/A'}</div>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Building className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Exporter Details
              </h4>
            </div>
            <DataField label="Name" value={currentInvoice.exporter_name} icon={Building} />
            <DataField label="Email" value={currentInvoice.exporter_email} icon={Mail} />
            <DataField label="Phone" value={currentInvoice.exporter_phone} icon={Phone} />
            <DataField label="PAN" value={currentInvoice.exporter_pan} icon={Hash} />
            <DataField label="GSTIN" value={currentInvoice.exporter_gstin} icon={Hash} />
            <DataField label="IEC" value={currentInvoice.exporter_iec} icon={Hash} />
            <div className="col-span-2">
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Address</div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">{currentInvoice.exporter_address || 'N/A'}</div>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Shipping Details
              </h4>
            </div>
            <DataField label="Incoterms" value={currentInvoice.incoterms} icon={FileText} />
            <DataField label="Place of Receipt" value={currentInvoice.place_of_receipt} icon={MapPin} />
            <DataField label="Port of Loading" value={currentInvoice.port_of_loading} icon={MapPin} />
            <DataField label="Port of Discharge" value={currentInvoice.port_of_discharge} icon={MapPin} />
            <DataField label="Final Destination" value={currentInvoice.final_destination} icon={Globe} />
            <DataField label="Country of Origin" value={currentInvoice.country_of_origin} icon={Globe} />
            <DataField label="HSN Code" value={currentInvoice.hsn_code} icon={Hash} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Banking Details
              </h4>
            </div>
            <DataField label="Bank Name" value={currentInvoice.bank_name} icon={Banknote} />
            <DataField label="Account Number" value={currentInvoice.bank_account} icon={Hash} />
            <DataField label="SWIFT Code" value={currentInvoice.bank_swift_code} icon={Hash} />
            <DataField label="IFSC Code" value={currentInvoice.bank_ifsc_code} icon={Hash} />
            <DataField label="Payment Terms" value={currentInvoice.payment_terms} icon={FileText} />
          </div>

          {currentInvoice.items && currentInvoice.items.length > 0 && (
            <>
              <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Items ({currentInvoice.items.length})
              </h4>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                        <th className="text-left p-2 font-semibold text-slate-900 dark:text-white text-xs">Description</th>
                        <th className="text-left p-2 font-semibold text-slate-900 dark:text-white text-xs">Quantity</th>
                        <th className="text-left p-2 font-semibold text-slate-900 dark:text-white text-xs">Unit</th>
                        <th className="text-left p-2 font-semibold text-slate-900 dark:text-white text-xs">Unit Price</th>
                        <th className="text-left p-2 font-semibold text-slate-900 dark:text-white text-xs">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentInvoice.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-200 dark:border-slate-600 last:border-b-0">
                          <td className="p-2 text-slate-900 dark:text-white text-xs">{item.description}</td>
                          <td className="p-2 text-slate-900 dark:text-white text-xs">{item.quantity}</td>
                          <td className="p-2 text-slate-900 dark:text-white text-xs">{item.unit}</td>
                          <td className="p-2 text-slate-900 dark:text-white text-xs">{item.unitPrice}</td>
                          <td className="p-2 text-slate-900 dark:text-white text-xs font-semibold">{item.totalPrice}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {(Array.isArray(currentInvoice.validation_warnings) && currentInvoice.validation_warnings.length > 0) && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 mb-4">
            <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-2 text-sm">Warnings</h4>
            <ul className="list-disc list-inside space-y-1 text-xs">
              {currentInvoice.validation_warnings.map((warning, idx) => (
                <li key={idx} className="text-amber-800 dark:text-amber-400">{warning}</li>
              ))}
            </ul>
          </div>
        )}

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
              disabled={invoiceUpdating}
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
                onClick={() => onTogglePdf('invoice')}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <PdfViewer 
                fileUrl={currentInvoice.fileUrl || ''} 
                bucket="invoices"
                token={token}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}