import React from 'react'
import { FileText, Calendar, Hash, User, CheckCircle, Edit, ChevronRight, X, Trash2 } from 'lucide-react'
import { ExportDeclarationData } from '../../../../types/documents'
import { ValidationBadge } from '../validation/ValidationBadge'
import { ValidationDetails } from '../validation/ValidationDetails'
import { DataField } from '../../common/DataField'
import { EditableField } from '../../common/EditableField'
import { PdfViewer } from '../../common/PdfViewer'

interface ExportDeclarationReviewProps {
  currentExportDeclaration: ExportDeclarationData
  editExportDeclarationMode: boolean
  exportDeclarationUpdating: boolean
  isPdfOpen: boolean
  token: string | null
  onTogglePdf: (step: string) => void
  onSetEditMode: (edit: boolean) => void
  onUpdateExportDeclaration: () => void
  onUpdateField: (field: keyof ExportDeclarationData, value: any) => void
  onNextStep: () => void
  canEdit?: boolean
  onDeleteDocument?: () => void
}

export const ExportDeclarationReview: React.FC<ExportDeclarationReviewProps> = ({
  currentExportDeclaration,
  editExportDeclarationMode,
  exportDeclarationUpdating,
  isPdfOpen,
  token,
  onTogglePdf,
  onSetEditMode,
  onUpdateExportDeclaration,
  onUpdateField,
  onNextStep,
  canEdit = true,
  onDeleteDocument
}) => {
  // EDIT MODE
  if (editExportDeclarationMode) {
    return (
      <div className="h-full flex">
        {/* Left Section - Edit Form (compact when PDF is open) */}
        <div className={`${isPdfOpen ? 'w-1/2 pr-4' : 'w-full'} flex flex-col overflow-y-auto py-4 transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent mb-1">
                Edit Export Declaration
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-400">Update the extracted export declaration data as needed</p>
            </div>
            <button
              onClick={() => onTogglePdf('exportdeclaration')}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-200 text-sm"
            >
              <FileText className="w-4 h-4" />
              {isPdfOpen ? 'Hide PDF' : 'View PDF'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{currentExportDeclaration.filename}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full font-medium">
                  Editing Mode
                </span>
              </div>
            </div>

          {onDeleteDocument && (
            <div className="flex justify-end mb-4">
              <button
                onClick={onDeleteDocument}
                disabled={exportDeclarationUpdating}
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
                value={currentExportDeclaration.documentType} 
                onChange={(value) => onUpdateField('documentType', value)}
                icon={FileText}
              />
              <EditableField 
                label="Declaration Number" 
                value={currentExportDeclaration.declarationNumber} 
                onChange={(value) => onUpdateField('declarationNumber', value)}
                icon={Hash}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== CORE REFERENCE FIELDS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Core Reference Fields
                </h4>
              </div>
              
              <EditableField 
                label="Invoice Number" 
                value={currentExportDeclaration.invoiceNo} 
                onChange={(value) => onUpdateField('invoiceNo', value)}
                icon={Hash}
              />
              <EditableField 
                label="Invoice Date" 
                value={currentExportDeclaration.invoiceDate} 
                onChange={(value) => onUpdateField('invoiceDate', value)}
                type="date"
                icon={Calendar}
              />
              <EditableField 
                label="Shipping Bill Number" 
                value={currentExportDeclaration.shippingBillNo} 
                onChange={(value) => onUpdateField('shippingBillNo', value)}
                icon={Hash}
              />
              <EditableField 
                label="Shipping Bill Date" 
                value={currentExportDeclaration.shippingBillDate} 
                onChange={(value) => onUpdateField('shippingBillDate', value)}
                type="date"
                icon={Calendar}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== VALUATION INFORMATION ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Valuation Information
                </h4>
              </div>
              
              <EditableField 
                label="Valuation Method" 
                value={currentExportDeclaration.valuationMethod} 
                onChange={(value) => onUpdateField('valuationMethod', value)}
                icon={FileText}
              />
              
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-2.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Seller-Buyer Relationship</label>
                  <select
                    className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 dark:text-white"
                    value={currentExportDeclaration.sellerBuyerRelated === null ? 'null' : currentExportDeclaration.sellerBuyerRelated ? 'true' : 'false'}
                    onChange={(e) => onUpdateField('sellerBuyerRelated', e.target.value === 'null' ? null : e.target.value === 'true')}
                  >
                    <option value="null">Not Specified</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-2.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Relationship Influenced Price</label>
                  <select
                    className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 dark:text-white"
                    value={currentExportDeclaration.relationshipInfluencedPrice === null ? 'null' : currentExportDeclaration.relationshipInfluencedPrice ? 'true' : 'false'}
                    onChange={(e) => onUpdateField('relationshipInfluencedPrice', e.target.value === 'null' ? null : e.target.value === 'true')}
                  >
                    <option value="null">Not Specified</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>

              <EditableField 
                label="Applicable Rule" 
                value={currentExportDeclaration.applicableRule} 
                onChange={(value) => onUpdateField('applicableRule', value)}
                icon={FileText}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== TRANSACTION DETAILS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Transaction Details
                </h4>
              </div>
              
              <EditableField 
                label="Payment Terms" 
                value={currentExportDeclaration.paymentTerms} 
                onChange={(value) => onUpdateField('paymentTerms', value)}
                icon={FileText}
              />
              <EditableField 
                label="Delivery Terms" 
                value={currentExportDeclaration.deliveryTerms} 
                onChange={(value) => onUpdateField('deliveryTerms', value)}
                icon={FileText}
              />
              <EditableField 
                label="Type of Sale" 
                value={currentExportDeclaration.typeOfSale} 
                onChange={(value) => onUpdateField('typeOfSale', value)}
                icon={FileText}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== DECLARATION DETAILS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Declaration Details
                </h4>
              </div>
              
              <EditableField 
                label="Declaration Status" 
                value={currentExportDeclaration.declarationStatus} 
                onChange={(value) => onUpdateField('declarationStatus', value)}
                icon={CheckCircle}
              />
              <EditableField 
                label="Signed By" 
                value={currentExportDeclaration.signedBy} 
                onChange={(value) => onUpdateField('signedBy', value)}
                icon={User}
              />
              <EditableField 
                label="Signed Date" 
                value={currentExportDeclaration.signedDate} 
                onChange={(value) => onUpdateField('signedDate', value)}
                type="date"
                icon={Calendar}
              />
            </div>

            {/* ===== ACTION BUTTONS ===== */}
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => onSetEditMode(false)}
                disabled={exportDeclarationUpdating}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={onUpdateExportDeclaration}
                disabled={exportDeclarationUpdating}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                {exportDeclarationUpdating ? (
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
                  onClick={() => onTogglePdf('exportdeclaration')}
                  className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <PdfViewer 
                  fileUrl={currentExportDeclaration.fileUrl || ''} 
                  bucket="export_declarations"
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
              Review Export Declaration
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400">
              Review the extracted export declaration data and validation with commercial invoice
            </p>
          </div>
          <button
            onClick={() => onTogglePdf('exportdeclaration')}
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
              disabled={exportDeclarationUpdating}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Delete Document
            </button>
          </div>
        )}

        <ValidationBadge
          completeness={currentExportDeclaration.completeness || 0}
          errors={currentExportDeclaration.validation_errors || []}
          warnings={currentExportDeclaration.validation_warnings || []}
          invoiceMatchVerified={currentExportDeclaration.invoiceMatchVerified}
        />

        {currentExportDeclaration.validationDetails && (
          <ValidationDetails validationDetails={currentExportDeclaration.validationDetails} />
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{currentExportDeclaration.filename}</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full font-medium">
                Export Declaration
              </span>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Document Information</h4>
            </div>
            <DataField label="Document Type" value={currentExportDeclaration.documentType} icon={FileText} />
            <DataField label="Declaration Number" value={currentExportDeclaration.declarationNumber} icon={Hash} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Core Reference Fields</h4>
            </div>
            <DataField label="Invoice Number" value={currentExportDeclaration.invoiceNo} icon={Hash} />
            <DataField label="Invoice Date" value={currentExportDeclaration.invoiceDate} icon={Calendar} />
            <DataField label="Shipping Bill Number" value={currentExportDeclaration.shippingBillNo} icon={Hash} />
            <DataField label="Shipping Bill Date" value={currentExportDeclaration.shippingBillDate} icon={Calendar} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Valuation Information</h4>
            </div>
            <DataField label="Valuation Method" value={currentExportDeclaration.valuationMethod} icon={FileText} />
            <DataField 
              label="Seller-Buyer Relationship" 
              value={currentExportDeclaration.sellerBuyerRelated === null ? 'Not Specified' : currentExportDeclaration.sellerBuyerRelated ? 'Yes' : 'No'} 
              icon={CheckCircle} 
            />
            <DataField 
              label="Relationship Influenced Price" 
              value={currentExportDeclaration.relationshipInfluencedPrice === null ? 'Not Specified' : currentExportDeclaration.relationshipInfluencedPrice ? 'Yes' : 'No'} 
              icon={CheckCircle} 
            />
            <DataField label="Applicable Rule" value={currentExportDeclaration.applicableRule} icon={FileText} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Transaction Details</h4>
            </div>
            <DataField label="Payment Terms" value={currentExportDeclaration.paymentTerms} icon={FileText} />
            <DataField label="Delivery Terms" value={currentExportDeclaration.deliveryTerms} icon={FileText} />
            <DataField label="Type of Sale" value={currentExportDeclaration.typeOfSale} icon={FileText} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Declaration Details</h4>
            </div>
            <DataField label="Declaration Status" value={currentExportDeclaration.declarationStatus} icon={CheckCircle} />
            <DataField label="Signed By" value={currentExportDeclaration.signedBy} icon={User} />
            <DataField label="Signed Date" value={currentExportDeclaration.signedDate} icon={Calendar} />
          </div>

          {currentExportDeclaration.invoiceMatchVerified && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
              <div className="font-semibold text-emerald-900 dark:text-emerald-300 mb-1 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Invoice Match Verified
              </div>
              <div className="text-emerald-700 dark:text-emerald-400 text-xs">
                This export declaration matches a commercial invoice in the thread.
              </div>
            </div>
          )}
        </div>

        {(Array.isArray(currentExportDeclaration.validation_warnings) && currentExportDeclaration.validation_warnings.length > 0) && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 mb-4">
            <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-2 text-sm">Warnings</h4>
            <ul className="list-disc list-inside space-y-1 text-xs">
              {currentExportDeclaration.validation_warnings.map((warning, idx) => (
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
                onClick={() => onTogglePdf('exportdeclaration')}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <PdfViewer 
                fileUrl={currentExportDeclaration.fileUrl || ''} 
                bucket="export_declarations"
                token={token}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}