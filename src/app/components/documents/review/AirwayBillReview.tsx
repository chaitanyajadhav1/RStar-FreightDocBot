import React from 'react'
import { FileText, Calendar, Hash, User, Package, Plane, MapPin, CheckCircle, Edit, ChevronRight, X, Trash2 } from 'lucide-react'
import { AirwayBillData } from '../../../../types/documents'
import { ValidationBadge } from '../validation/ValidationBadge'
import { ValidationDetails } from '../validation/ValidationDetails'
import { DataField } from '../../common/DataField'
import { EditableField } from '../../common/EditableField'
import { PdfViewer } from '../../common/PdfViewer'

interface AirwayBillReviewProps {
  currentAirwayBill: AirwayBillData
  editAirwayBillMode: boolean
  airwayBillUpdating: boolean
  isPdfOpen: boolean
  token: string | null
  onTogglePdf: (step: string) => void
  onSetEditMode: (edit: boolean) => void
  onUpdateAirwayBill: () => void
  onUpdateField: (field: keyof AirwayBillData, value: any) => void
  onNextStep: () => void
  canEdit?: boolean
  onDeleteDocument?: () => void
}

export const AirwayBillReview: React.FC<AirwayBillReviewProps> = ({
  currentAirwayBill,
  editAirwayBillMode,
  airwayBillUpdating,
  isPdfOpen,
  token,
  onTogglePdf,
  onSetEditMode,
  onUpdateAirwayBill,
  onUpdateField,
  onNextStep,
  canEdit = true,
  onDeleteDocument
}) => {
  // Helper function to get display value (handle null/undefined)
  const getDisplayValue = (value: any): string => {
    if (value === null || value === undefined || value === 'N/A') return 'Not available'
    return String(value)
  }

  // EDIT MODE
  if (editAirwayBillMode) {
    return (
      <div className="h-full flex">
        {/* Left Section - Edit Form */}
        <div className={`${isPdfOpen ? 'w-1/2 pr-4' : 'w-full'} flex flex-col overflow-y-auto py-4 transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent mb-1">
                Edit Airway Bill
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-400">Update the extracted airway bill data as needed</p>
            </div>
            <button
              onClick={() => onTogglePdf('airwaybill')}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-200 text-sm"
            >
              <FileText className="w-4 h-4" />
              {isPdfOpen ? 'Hide PDF' : 'View PDF'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Plane className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{currentAirwayBill.filename}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full font-medium">
                  Editing Mode
                </span>
              </div>
            </div>

          {onDeleteDocument && (
            <div className="flex justify-end mb-4">
              <button
                onClick={onDeleteDocument}
                disabled={airwayBillUpdating}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Delete Document
              </button>
            </div>
          )}

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== DOCUMENT INFORMATION ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Document Information
                </h4>
              </div>
              
              <EditableField 
                label="Document Type" 
                value={currentAirwayBill.document_type || ''} 
                onChange={(value) => onUpdateField('document_type', value)}
                icon={FileText}
              />
              <EditableField 
                label="Airway Bill Number" 
                value={currentAirwayBill.airway_bill_no || ''} 
                onChange={(value) => onUpdateField('airway_bill_no', value)}
                icon={Hash}
              />
              <EditableField 
                label="Invoice Number" 
                value={currentAirwayBill.invoice_no || ''} 
                onChange={(value) => onUpdateField('invoice_no', value)}
                icon={Hash}
              />
              <EditableField 
                label="Invoice Date" 
                value={currentAirwayBill.invoice_date || ''} 
                onChange={(value) => onUpdateField('invoice_date', value)}
                type="date"
                icon={Calendar}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== SHIPPER INFORMATION ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Shipper Information
                </h4>
              </div>
              
              <EditableField 
                label="Shipper's Name" 
                value={currentAirwayBill.shippers_name || ''} 
                onChange={(value) => onUpdateField('shippers_name', value)}
                icon={User}
              />
              <EditableField 
                label="Shipper's Address" 
                value={currentAirwayBill.shippers_address || ''} 
                onChange={(value) => onUpdateField('shippers_address', value)}
                icon={MapPin}
                multiline
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== CONSIGNEE INFORMATION ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Consignee Information
                </h4>
              </div>
              
              <EditableField 
                label="Consignee's Name" 
                value={currentAirwayBill.consignees_name || ''} 
                onChange={(value) => onUpdateField('consignees_name', value)}
                icon={User}
              />
              <EditableField 
                label="Consignee's Address" 
                value={currentAirwayBill.consignees_address || ''} 
                onChange={(value) => onUpdateField('consignees_address', value)}
                icon={MapPin}
                multiline
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== CARRIER INFORMATION ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Plane className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Carrier Information
                </h4>
              </div>
              
              <EditableField 
                label="Issuing Carrier's Name" 
                value={currentAirwayBill.issuing_carriers_name || ''} 
                onChange={(value) => onUpdateField('issuing_carriers_name', value)}
                icon={Plane}
              />
              <EditableField 
                label="Issuing Carrier's City" 
                value={currentAirwayBill.issuing_carriers_city || ''} 
                onChange={(value) => onUpdateField('issuing_carriers_city', value)}
                icon={MapPin}
              />
              <EditableField 
                label="Agent's IATA Code" 
                value={currentAirwayBill.agents_iata_code || ''} 
                onChange={(value) => onUpdateField('agents_iata_code', value)}
                icon={Hash}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== SHIPMENT DETAILS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Shipment Details
                </h4>
              </div>
              
              <EditableField 
                label="Airport of Departure" 
                value={currentAirwayBill.airport_of_departure || ''} 
                onChange={(value) => onUpdateField('airport_of_departure', value)}
                icon={Plane}
              />
              <EditableField 
                label="Airport of Destination" 
                value={currentAirwayBill.airport_of_destination || ''} 
                onChange={(value) => onUpdateField('airport_of_destination', value)}
                icon={Plane}
              />
              <EditableField 
                label="Accounting Information" 
                value={currentAirwayBill.accounting_information || ''} 
                onChange={(value) => onUpdateField('accounting_information', value)}
                icon={FileText}
                multiline
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== CARGO DETAILS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Cargo Details
                </h4>
              </div>
              
              <EditableField 
                label="HS Code Number" 
                value={currentAirwayBill.hs_code_no || ''} 
                onChange={(value) => onUpdateField('hs_code_no', value)}
                icon={Hash}
              />
              <EditableField 
                label="Number of Pieces" 
                value={currentAirwayBill.no_of_pieces || ''} 
                onChange={(value) => onUpdateField('no_of_pieces', value)}
                icon={Package}
              />
              <EditableField 
                label="Gross Weight" 
                value={currentAirwayBill.gross_weight || ''} 
                onChange={(value) => onUpdateField('gross_weight', value)}
                icon={Package}
              />
              <EditableField 
                label="Chargeable Weight" 
                value={currentAirwayBill.chargeable_weight || ''} 
                onChange={(value) => onUpdateField('chargeable_weight', value)}
                icon={Package}
              />
              <div className="col-span-2">
                <EditableField 
                  label="Nature of Goods" 
                  value={currentAirwayBill.nature_of_goods || ''} 
                  onChange={(value) => onUpdateField('nature_of_goods', value)}
                  icon={FileText}
                  multiline
                />
              </div>
            </div>

            {/* ===== ACTION BUTTONS ===== */}
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => onSetEditMode(false)}
                disabled={airwayBillUpdating}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={onUpdateAirwayBill}
                disabled={airwayBillUpdating}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                {airwayBillUpdating ? (
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
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Document Preview
                </h3>
                <button
                  onClick={() => onTogglePdf('airwaybill')}
                  className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <PdfViewer 
                  fileUrl={currentAirwayBill.fileUrl || ''} 
                  bucket="airway_bills"
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
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent mb-1">
              Review Airway Bill
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400">
              Review the extracted airway bill data and validation with commercial invoice
            </p>
          </div>
          <button
            onClick={() => onTogglePdf('airwaybill')}
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
              disabled={airwayBillUpdating}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Delete Document
            </button>
          </div>
        )}

        <ValidationBadge
          completeness={currentAirwayBill.completeness || 0}
          errors={currentAirwayBill.validation_errors || []}
          warnings={currentAirwayBill.validation_warnings || []}
          invoiceMatchVerified={currentAirwayBill.invoiceMatchVerified}
        />

        {currentAirwayBill.validationDetails && (
          <ValidationDetails validationDetails={currentAirwayBill.validationDetails} />
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Plane className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{currentAirwayBill.filename}</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full font-medium">
                Airway Bill
              </span>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Document Information</h4>
            </div>
            <DataField label="Document Type" value={getDisplayValue(currentAirwayBill.document_type)} icon={FileText} />
            <DataField label="Airway Bill Number" value={getDisplayValue(currentAirwayBill.airway_bill_no)} icon={Hash} />
            <DataField label="Invoice Number" value={getDisplayValue(currentAirwayBill.invoice_no)} icon={Hash} />
            <DataField label="Invoice Date" value={getDisplayValue(currentAirwayBill.invoice_date)} icon={Calendar} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Shipper Information</h4>
            </div>
            <DataField label="Shipper's Name" value={getDisplayValue(currentAirwayBill.shippers_name)} icon={User} />
            <DataField label="Shipper's Address" value={getDisplayValue(currentAirwayBill.shippers_address)} icon={MapPin} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Consignee Information</h4>
            </div>
            <DataField label="Consignee's Name" value={getDisplayValue(currentAirwayBill.consignees_name)} icon={User} />
            <DataField label="Consignee's Address" value={getDisplayValue(currentAirwayBill.consignees_address)} icon={MapPin} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Carrier Information</h4>
            </div>
            <DataField label="Issuing Carrier's Name" value={getDisplayValue(currentAirwayBill.issuing_carriers_name)} icon={Plane} />
            <DataField label="Issuing Carrier's City" value={getDisplayValue(currentAirwayBill.issuing_carriers_city)} icon={MapPin} />
            <DataField label="Agent's IATA Code" value={getDisplayValue(currentAirwayBill.agents_iata_code)} icon={Hash} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Shipment Details</h4>
            </div>
            <DataField label="Airport of Departure" value={getDisplayValue(currentAirwayBill.airport_of_departure)} icon={Plane} />
            <DataField label="Airport of Destination" value={getDisplayValue(currentAirwayBill.airport_of_destination)} icon={Plane} />
            <div className="col-span-2">
              <DataField label="Accounting Information" value={getDisplayValue(currentAirwayBill.accounting_information)} icon={FileText} />
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Cargo Details</h4>
            </div>
            <DataField label="HS Code Number" value={getDisplayValue(currentAirwayBill.hs_code_no)} icon={Hash} />
            <DataField label="Number of Pieces" value={getDisplayValue(currentAirwayBill.no_of_pieces)} icon={Package} />
            <DataField label="Gross Weight" value={getDisplayValue(currentAirwayBill.gross_weight)} icon={Package} />
            <DataField label="Chargeable Weight" value={getDisplayValue(currentAirwayBill.chargeable_weight)} icon={Package} />
            <div className="col-span-2">
              <DataField label="Nature of Goods" value={getDisplayValue(currentAirwayBill.nature_of_goods)} icon={FileText} />
            </div>
          </div>

          {currentAirwayBill.invoiceMatchVerified && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
              <div className="font-semibold text-emerald-900 dark:text-emerald-300 mb-1 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Invoice Match Verified
              </div>
              <div className="text-emerald-700 dark:text-emerald-400 text-xs">
                This airway bill matches a commercial invoice in the thread.
              </div>
            </div>
          )}
        </div>

        {(Array.isArray(currentAirwayBill.validation_warnings) && currentAirwayBill.validation_warnings.length > 0) && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 mb-4">
            <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-2 text-sm">Warnings</h4>
            <ul className="list-disc list-inside space-y-1 text-xs">
              {currentAirwayBill.validation_warnings.map((warning, idx) => (
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
          <button
            onClick={onNextStep}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-sm"
          >
            Complete Process
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
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Document Preview
              </h3>
              <button
                onClick={() => onTogglePdf('airwaybill')}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <PdfViewer 
                fileUrl={currentAirwayBill.fileUrl || ''} 
                bucket="airway_bills"
                token={token}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}