import React from 'react'
import { FileText, Calendar, Hash, User, Globe, Shield, CheckCircle, Edit, ChevronRight, X, AlertTriangle, Trash2 } from 'lucide-react'
import { SCOMETDeclarationData } from '../../../../types/documents'
import { ValidationBadge } from '../validation/ValidationBadge'
import { ValidationDetails } from '../validation/ValidationDetails'
import { DataField } from '../../common/DataField'
import { EditableField } from '../../common/EditableField'
import { PdfViewer } from '../../common/PdfViewer'

interface SCOMETReviewProps {
  currentSCOMET: SCOMETDeclarationData
  editSCOMETMode: boolean
  scometUpdating: boolean
  isPdfOpen: boolean
  token: string | null
  onTogglePdf: (step: string) => void
  onSetEditMode: (edit: boolean) => void
  onUpdateSCOMET: () => void
  onUpdateField: (field: keyof SCOMETDeclarationData, value: any) => void
  onNextStep: () => void
  canEdit?: boolean
  onDeleteDocument?: () => void
}

export const SCOMETReview: React.FC<SCOMETReviewProps> = ({
  currentSCOMET,
  editSCOMETMode,
  scometUpdating,
  isPdfOpen,
  token,
  onTogglePdf,
  onSetEditMode,
  onUpdateSCOMET,
  onUpdateField,
  onNextStep,
  canEdit = true,
  onDeleteDocument
}) => {
  // EDIT MODE
  if (editSCOMETMode) {
    return (
      <div className="h-full flex">
        {/* Left Section - Edit Form (compact when PDF is open) */}
        <div className={`${isPdfOpen ? 'w-1/2 pr-4' : 'w-full'} flex flex-col overflow-y-auto py-4 transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-700 to-teal-500 bg-clip-text text-transparent mb-1">
                Edit SCOMET Declaration
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-400">Update the extracted SCOMET data as needed</p>
            </div>
            <button
              onClick={() => onTogglePdf('scomet')}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-200 text-sm"
            >
              <FileText className="w-4 h-4" />
              {isPdfOpen ? 'Hide PDF' : 'View PDF'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <Shield className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{currentSCOMET.filename}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs rounded-full font-medium">
                  Editing Mode
                </span>
              </div>
            </div>

          {onDeleteDocument && (
            <div className="flex justify-end mb-4">
              <button
                onClick={onDeleteDocument}
                disabled={scometUpdating}
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
                  <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Document Information
                </h4>
              </div>
              
              <EditableField 
                label="Document Date" 
                value={currentSCOMET.documentDate} 
                onChange={(value) => onUpdateField('documentDate', value)}
                type="date"
                icon={Calendar}
              />
              <EditableField 
                label="Document Type" 
                value={currentSCOMET.documentType} 
                onChange={(value) => onUpdateField('documentType', value)}
                icon={FileText}
              />
              <EditableField 
                label="Invoice Number" 
                value={currentSCOMET.invoiceNumber} 
                onChange={(value) => onUpdateField('invoiceNumber', value)}
                icon={Hash}
              />
              <EditableField 
                label="Invoice Date" 
                value={currentSCOMET.invoiceDate} 
                onChange={(value) => onUpdateField('invoiceDate', value)}
                type="date"
                icon={Calendar}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== CONSIGNMENT DETAILS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Consignment Details
                </h4>
              </div>
              
              <EditableField 
                label="Consignee Name" 
                value={currentSCOMET.consigneeName} 
                onChange={(value) => onUpdateField('consigneeName', value)}
                icon={User}
              />
              <EditableField 
                label="Destination Country" 
                value={currentSCOMET.destinationCountry} 
                onChange={(value) => onUpdateField('destinationCountry', value)}
                icon={Globe}
              />
              <EditableField 
                label="HS Code" 
                value={currentSCOMET.hsCode} 
                onChange={(value) => onUpdateField('hsCode', value)}
                icon={Hash}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== SCOMET STATUS ===== */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  SCOMET Status
                </h4>
              </div>
              
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-teal-600 dark:text-teal-400 mt-2.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">SCOMET Coverage</label>
                  <select
                    className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-800 dark:text-white"
                    value={currentSCOMET.scometCoverage ? 'true' : 'false'}
                    onChange={(e) => onUpdateField('scometCoverage', e.target.value === 'true')}
                  >
                    <option value="true">Yes - SCOMET Applicable</option>
                    <option value="false">No - Not SCOMET</option>
                  </select>
                </div>
              </div>

              <EditableField 
                label="Goods Description" 
                value={currentSCOMET.goodsDescription} 
                onChange={(value) => onUpdateField('goodsDescription', value)}
                multiline={true}
                rows={3}
                icon={FileText}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            {/* ===== DECLARATION DETAILS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Declaration Details
                </h4>
              </div>
              
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-teal-600 dark:text-teal-400 mt-2.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Signed Status</label>
                  <select
                    className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-800 dark:text-white"
                    value={currentSCOMET.signedStatus ? 'true' : 'false'}
                    onChange={(e) => onUpdateField('signedStatus', e.target.value === 'true')}
                  >
                    <option value="true">Signed</option>
                    <option value="false">Not Signed</option>
                  </select>
                </div>
              </div>

              <EditableField 
                label="Signatory Name" 
                value={currentSCOMET.signatoryName} 
                onChange={(value) => onUpdateField('signatoryName', value)}
                icon={User}
              />

              <div className="col-span-2">
                <EditableField 
                  label="Declaration Statement" 
                  value={currentSCOMET.declarationStatement} 
                  onChange={(value) => onUpdateField('declarationStatement', value)}
                  multiline={true}
                  rows={3}
                  icon={FileText}
                />
              </div>
            </div>

            {/* ===== ACTION BUTTONS ===== */}
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => onSetEditMode(false)}
                disabled={scometUpdating}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={onUpdateSCOMET}
                disabled={scometUpdating}
                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                {scometUpdating ? (
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
                  onClick={() => onTogglePdf('scomet')}
                  className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <PdfViewer 
                  fileUrl={currentSCOMET.fileUrl || ''} 
                  bucket="scomet"
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
              Review SCOMET Declaration
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400">
              Review the extracted SCOMET declaration data and validation with commercial invoice
            </p>
          </div>
          <button
            onClick={() => onTogglePdf('scomet')}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-200 text-sm"
          >
            <FileText className="w-4 h-4" />
            {isPdfOpen ? 'Hide PDF' : 'View PDF'}
          </button>
        </div>

        <ValidationBadge
          completeness={currentSCOMET.completeness || 0}
          errors={currentSCOMET.validation_errors || []}
          warnings={currentSCOMET.validation_warnings || []}
          invoiceMatchVerified={currentSCOMET.invoiceMatchVerified}
        />

        {currentSCOMET.validationDetails && (
          <ValidationDetails validationDetails={currentSCOMET.validationDetails} />
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <Shield className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{currentSCOMET.filename}</h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${
                currentSCOMET.scometCoverage 
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' 
                  : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
              }`}>
                {currentSCOMET.scometCoverage ? "SCOMET Applicable" : "Not SCOMET"}
              </span>
            </div>
          </div>

          {onDeleteDocument && (
            <div className="flex justify-end mb-4">
              <button
                onClick={onDeleteDocument}
                disabled={scometUpdating}
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
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Document Information</h4>
            </div>
            <DataField label="Document Date" value={currentSCOMET.documentDate} icon={Calendar} />
            <DataField label="Document Type" value={currentSCOMET.documentType} icon={FileText} />
            <DataField label="Invoice Number" value={currentSCOMET.invoiceNumber} icon={Hash} />
            <DataField label="Invoice Date" value={currentSCOMET.invoiceDate} icon={Calendar} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Consignment Details</h4>
            </div>
            <DataField label="Consignee Name" value={currentSCOMET.consigneeName} icon={User} />
            <DataField label="Destination Country" value={currentSCOMET.destinationCountry} icon={Globe} />
            <DataField label="HS Code" value={currentSCOMET.hsCode} icon={Hash} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">SCOMET Status</h4>
            </div>
            <div className={`p-3 rounded-xl border ${
              currentSCOMET.scometCoverage 
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700' 
                : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
            }`}>
              <div className="font-semibold text-slate-900 dark:text-white mb-1 text-sm">
                SCOMET Coverage: {currentSCOMET.scometCoverage ? 'YES' : 'NO'}
              </div>
              <div className="text-slate-700 dark:text-slate-300 text-xs">
                {currentSCOMET.scometCoverage 
                  ? 'These goods fall under SCOMET list and require special export authorization.'
                  : 'These goods do not fall under SCOMET list.'}
              </div>
            </div>
            {currentSCOMET.goodsDescription && (
              <div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Goods Description</div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">{currentSCOMET.goodsDescription}</div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Declaration Details</h4>
            </div>
            <DataField label="Signed Status" value={currentSCOMET.signedStatus ? 'Signed' : 'Not Signed'} icon={CheckCircle} />
            <DataField label="Signatory Name" value={currentSCOMET.signatoryName} icon={User} />
            {currentSCOMET.declarationStatement && (
              <div className="col-span-2">
                <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Declaration Statement</div>
                <div className="text-slate-700 dark:text-slate-300 italic text-sm">{currentSCOMET.declarationStatement}</div>
              </div>
            )}
          </div>
        </div>

        {(Array.isArray(currentSCOMET.validation_warnings) && currentSCOMET.validation_warnings.length > 0) && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 mb-4">
            <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-2 text-sm">Warnings</h4>
            <ul className="list-disc list-inside space-y-1 text-xs">
              {currentSCOMET.validation_warnings.map((warning, idx) => (
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
              disabled={scometUpdating}
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
                onClick={() => onTogglePdf('scomet')}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <PdfViewer 
                fileUrl={currentSCOMET.fileUrl || ''} 
                bucket="scomet_declarations"
                token={token}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}