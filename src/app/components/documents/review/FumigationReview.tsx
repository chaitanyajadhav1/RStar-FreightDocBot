import React from 'react'
import { FileText, Calendar, Hash, User, MapPin, Thermometer, Package, CheckCircle, Edit, ChevronRight, X, Wind, Clock, Droplet, Trash2 } from 'lucide-react'
import { FumigationCertificateData } from '../../../../types/documents'
import { ValidationBadge } from '../validation/ValidationBadge'
import { ValidationDetails } from '../validation/ValidationDetails'
import { DataField } from '../../common/DataField'
import { EditableField } from '../../common/EditableField'
import { PdfViewer } from '../../common/PdfViewer'

interface FumigationReviewProps {
  currentFumigation: FumigationCertificateData
  editFumigationMode: boolean
  fumigationUpdating: boolean
  isPdfOpen: boolean
  token: string | null
  onTogglePdf: (step: string) => void
  onSetEditMode: (edit: boolean) => void
  onUpdateFumigation: () => void
  onUpdateField: (field: keyof FumigationCertificateData, value: any) => void
  onNextStep: () => void
  canEdit?: boolean
  onDeleteDocument?: () => void
}

export const FumigationReview: React.FC<FumigationReviewProps> = ({
  currentFumigation,
  editFumigationMode,
  fumigationUpdating,
  isPdfOpen,
  token,
  onTogglePdf,
  onSetEditMode,
  onUpdateFumigation,
  onUpdateField,
  onNextStep,
  canEdit = true,
  onDeleteDocument
}) => {
  // EDIT MODE
  if (editFumigationMode) {
    return (
      <div className="h-full flex">
        {/* Left Section - Edit Form */}
        <div className={`${isPdfOpen ? 'w-1/2 pr-4' : 'w-full'} flex flex-col overflow-y-auto py-4 transition-all duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-purple-500 bg-clip-text text-transparent mb-1">
                Edit Fumigation Certificate
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-400">
                Update the extracted fumigation data as needed
              </p>
            </div>
            <button
              onClick={() => onTogglePdf('fumigation')}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-200 text-sm"
            >
              <FileText className="w-4 h-4" />
              {isPdfOpen ? 'Hide PDF' : 'View PDF'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <Wind className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {currentFumigation.filename}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full font-medium">
                  Editing Mode
                </span>
              </div>
            </div>

            {onDeleteDocument && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={onDeleteDocument}
                  disabled={fumigationUpdating}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Document
                </button>
              </div>
            )}

            <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

            {/* Certificate Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Certificate Information
                </h4>
              </div>
              
              <EditableField 
                label="Certificate Number" 
                value={currentFumigation.certificateNumber} 
                onChange={(value) => onUpdateField('certificateNumber', value)}
                icon={Hash}
              />
              <EditableField 
                label="Certificate Date" 
                value={currentFumigation.certificateDate} 
                onChange={(value) => onUpdateField('certificateDate', value)}
                type="date"
                icon={Calendar}
              />
              <EditableField 
                label="DPPQS Registration Number" 
                value={currentFumigation.dppqsRegistrationNumber} 
                onChange={(value) => onUpdateField('dppqsRegistrationNumber', value)}
                icon={Hash}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

            {/* Treatment Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Wind className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Treatment Details
                </h4>
              </div>
              
              <EditableField 
                label="Fumigant Name" 
                value={currentFumigation.fumigantName} 
                onChange={(value) => onUpdateField('fumigantName', value)}
                icon={Wind}
              />
              <EditableField 
                label="Fumigation Date" 
                value={currentFumigation.fumigationDate} 
                onChange={(value) => onUpdateField('fumigationDate', value)}
                type="date"
                icon={Calendar}
              />
              <EditableField 
                label="Fumigation Place" 
                value={currentFumigation.fumigationPlace} 
                onChange={(value) => onUpdateField('fumigationPlace', value)}
                icon={MapPin}
              />
              <EditableField 
                label="Fumigant Dosage" 
                value={currentFumigation.fumigantDosage} 
                onChange={(value) => onUpdateField('fumigantDosage', value)}
                icon={Droplet}
              />
              <EditableField 
                label="Fumigation Duration" 
                value={currentFumigation.fumigationDuration} 
                onChange={(value) => onUpdateField('fumigationDuration', value)}
                icon={Clock}
              />
              <EditableField 
                label="Minimum Temperature" 
                value={currentFumigation.minimumTemperature} 
                onChange={(value) => onUpdateField('minimumTemperature', value)}
                icon={Thermometer}
              />
              
              <div className="flex items-start gap-2">
                <Wind className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-2.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                    Gastight Sheets Used
                  </label>
                  <select
                    className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-slate-800 dark:text-white"
                    value={currentFumigation.gastightSheets === null ? 'null' : currentFumigation.gastightSheets ? 'true' : 'false'}
                    onChange={(e) => onUpdateField('gastightSheets', e.target.value === 'null' ? null : e.target.value === 'true')}
                  >
                    <option value="null">Not Specified</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>

              <EditableField 
                label="Pressure Decay Value" 
                value={currentFumigation.pressureDecayValue} 
                onChange={(value) => onUpdateField('pressureDecayValue', value)}
                icon={Droplet}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

            {/* Goods Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Goods Description
                </h4>
              </div>
              
              <EditableField 
                label="Container Number" 
                value={currentFumigation.containerNumber} 
                onChange={(value) => onUpdateField('containerNumber', value)}
                icon={Package}
              />
              <EditableField 
                label="Seal Number" 
                value={currentFumigation.sealNumber} 
                onChange={(value) => onUpdateField('sealNumber', value)}
                icon={Hash}
              />
              <EditableField 
                label="Exporter Name" 
                value={currentFumigation.exporterName} 
                onChange={(value) => onUpdateField('exporterName', value)}
                icon={User}
              />
              <EditableField 
                label="Consignee Name" 
                value={currentFumigation.consigneeName} 
                onChange={(value) => onUpdateField('consigneeName', value)}
                icon={User}
              />
              
              <div className="col-span-2">
                <EditableField 
                  label="Exporter Address" 
                  value={currentFumigation.exporterAddress} 
                  onChange={(value) => onUpdateField('exporterAddress', value)}
                  multiline={true}
                  rows={2}
                  icon={MapPin}
                />
              </div>
              
              <EditableField 
                label="Cargo Type" 
                value={currentFumigation.cargoType} 
                onChange={(value) => onUpdateField('cargoType', value)}
                icon={Package}
              />
              <EditableField 
                label="Quantity" 
                value={currentFumigation.quantity} 
                onChange={(value) => onUpdateField('quantity', value)}
                icon={Hash}
              />
              
              <div className="col-span-2">
                <EditableField 
                  label="Cargo Description" 
                  value={currentFumigation.cargoDescription} 
                  onChange={(value) => onUpdateField('cargoDescription', value)}
                  multiline={true}
                  rows={2}
                  icon={FileText}
                />
              </div>
              
              <EditableField 
                label="Packaging Material" 
                value={currentFumigation.packagingMaterial} 
                onChange={(value) => onUpdateField('packagingMaterial', value)}
                icon={Package}
              />
              <EditableField 
                label="Shipping Mark" 
                value={currentFumigation.shippingMark} 
                onChange={(value) => onUpdateField('shippingMark', value)}
                icon={Hash}
              />
               
              <EditableField 
                label="Invoice Date" 
                value={currentFumigation.invoiceDateFumigationCertificate} 
                onChange={(value) => onUpdateField('invoiceDateFumigationCertificate', value)}
                type="date"
                icon={Calendar}
              />
                        
              <EditableField 
                label="Invoice Number" 
                value={currentFumigation.invoiceNoFumigationCertificate} 
                onChange={(value) => onUpdateField('invoiceNoFumigationCertificate', value)}
                icon={Hash}
              />
              
              <div className="col-span-2">
                <EditableField 
                  label="Additional Declaration" 
                  value={currentFumigation.additionalDeclaration} 
                  onChange={(value) => onUpdateField('additionalDeclaration', value)}
                  multiline={true}
                  rows={2}
                  icon={FileText}
                />
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

            {/* Referenced Invoice */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Referenced Invoice
                </h4>
              </div>
              
              <EditableField 
                label="Invoice Number" 
                value={currentFumigation.invoiceNumber} 
                onChange={(value) => onUpdateField('invoiceNumber', value)}
                icon={Hash}
              />
              <EditableField 
                label="Invoice Date" 
                value={currentFumigation.invoiceDate} 
                onChange={(value) => onUpdateField('invoiceDate', value)}
                type="date"
                icon={Calendar}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

            {/* Operator Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="col-span-2">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Operator Information
                </h4>
              </div>
              
              <EditableField 
                label="Operator Name" 
                value={currentFumigation.operatorName} 
                onChange={(value) => onUpdateField('operatorName', value)}
                icon={User}
              />
              <EditableField 
                label="Accreditation Number" 
                value={currentFumigation.accreditationNumber} 
                onChange={(value) => onUpdateField('accreditationNumber', value)}
                icon={Hash}
              />
              
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-2.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                    Operator Signature Status
                  </label>
                  <select
                    className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-slate-800 dark:text-white"
                    value={currentFumigation.operatorSignatureStatus === null ? 'null' : currentFumigation.operatorSignatureStatus ? 'true' : 'false'}
                    onChange={(e) => onUpdateField('operatorSignatureStatus', e.target.value === 'null' ? null : e.target.value === 'true')}
                  >
                    <option value="null">Not Specified</option>
                    <option value="true">Signed</option>
                    <option value="false">Not Signed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => onSetEditMode(false)}
                disabled={fumigationUpdating}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={onUpdateFumigation}
                disabled={fumigationUpdating}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                {fumigationUpdating ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                  <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Document Preview
                </h3>
                <button
                  onClick={() => onTogglePdf('fumigation')}
                  className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <PdfViewer 
                  fileUrl={currentFumigation.fileUrl || ''} 
                  bucket="fumigation_certificates"
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
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-purple-500 bg-clip-text text-transparent mb-1">
              Review Fumigation Certificate
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400">
              Review the extracted fumigation certificate data and validation with commercial invoice
            </p>
          </div>
          <button
            onClick={() => onTogglePdf('fumigation')}
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
              disabled={fumigationUpdating}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Delete Document
            </button>
          </div>
        )}

        <ValidationBadge
          completeness={currentFumigation.completeness || 0}
          errors={currentFumigation.validation_errors || []}
          warnings={currentFumigation.validation_warnings || []}
          invoiceMatchVerified={currentFumigation.invoiceMatchVerified}
        />

        {currentFumigation.validationDetails && (
          <ValidationDetails validationDetails={currentFumigation.validationDetails} />
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Wind className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {currentFumigation.filename}
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full font-medium">
                Fumigation Certificate
              </span>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

          {/* Certificate Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Certificate Information
              </h4>
            </div>
            <DataField label="Certificate Number" value={currentFumigation.certificateNumber} icon={Hash} />
            <DataField label="Certificate Date" value={currentFumigation.certificateDate} icon={Calendar} />
            <DataField label="DPPQS Registration Number" value={currentFumigation.dppqsRegistrationNumber} icon={Hash} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

          {/* Treatment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Wind className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Treatment Details
              </h4>
            </div>
            <DataField label="Fumigant Name" value={currentFumigation.fumigantName} icon={Wind} />
            <DataField label="Fumigation Date" value={currentFumigation.fumigationDate} icon={Calendar} />
            <DataField label="Fumigation Place" value={currentFumigation.fumigationPlace} icon={MapPin} />
            <DataField label="Fumigant Dosage" value={currentFumigation.fumigantDosage} icon={Droplet} />
            <DataField label="Fumigation Duration" value={currentFumigation.fumigationDuration} icon={Clock} />
            <DataField label="Minimum Temperature" value={currentFumigation.minimumTemperature} icon={Thermometer} />
            <DataField 
              label="Gastight Sheets" 
              value={currentFumigation.gastightSheets === null ? 'Not Specified' : currentFumigation.gastightSheets ? 'Yes' : 'No'} 
              icon={Wind} 
            />
            <DataField label="Pressure Decay Value" value={currentFumigation.pressureDecayValue} icon={Droplet} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

          {/* Goods Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Goods Description
              </h4>
            </div>
            <DataField label="Container Number" value={currentFumigation.containerNumber} icon={Package} />
            <DataField label="Seal Number" value={currentFumigation.sealNumber} icon={Hash} />
            <DataField label="Exporter Name" value={currentFumigation.exporterName} icon={User} />
            <DataField label="Consignee Name" value={currentFumigation.consigneeName} icon={User} />
            {currentFumigation.exporterAddress && (
              <div className="col-span-2">
                <DataField label="Exporter Address" value={currentFumigation.exporterAddress} icon={MapPin} />
              </div>
            )}
            <DataField label="Cargo Type" value={currentFumigation.cargoType} icon={Package} />
            <DataField label="Quantity" value={currentFumigation.quantity} icon={Hash} />
            {currentFumigation.cargoDescription && (
              <div className="col-span-2">
                <DataField label="Cargo Description" value={currentFumigation.cargoDescription} icon={FileText} />
              </div>
            )}
            <DataField label="Packaging Material" value={currentFumigation.packagingMaterial} icon={Package} />
            <DataField label="Shipping Mark" value={currentFumigation.shippingMark} icon={Hash} />
            <DataField label="Invoice Number" value={currentFumigation.invoiceNoFumigationCertificate} icon={Hash} />
            <DataField label="Invoice Date" value={currentFumigation.invoiceDateFumigationCertificate} icon={Calendar} />

            {currentFumigation.additionalDeclaration && (
              <div className="col-span-2">
                <DataField label="Additional Declaration" value={currentFumigation.additionalDeclaration} icon={FileText} />
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

          {/* Referenced Invoice */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Referenced Invoice
              </h4>
            </div>
            <DataField label="Invoice Number" value={currentFumigation.invoiceNumber} icon={Hash} />
            <DataField label="Invoice Date" value={currentFumigation.invoiceDate} icon={Calendar} />
            {currentFumigation.invoiceMatchVerified && (
              <div className="col-span-2">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                  <div className="font-semibold text-emerald-900 dark:text-emerald-300 mb-1 text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Invoice Match Verified
                  </div>
                  <div className="text-emerald-700 dark:text-emerald-400 text-xs">
                    This fumigation certificate matches a commercial invoice in the thread.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

          {/* Operator Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="col-span-2">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Operator Information
              </h4>
            </div>
            <DataField label="Operator Name" value={currentFumigation.operatorName} icon={User} />
            <DataField label="Accreditation Number" value={currentFumigation.accreditationNumber} icon={Hash} />
            <DataField 
              label="Signature Status" 
              value={currentFumigation.operatorSignatureStatus === null ? 'Not Specified' : currentFumigation.operatorSignatureStatus ? 'Signed' : 'Not Signed'} 
              icon={CheckCircle} 
            />
          </div>
        </div>

        {Array.isArray(currentFumigation.validation_warnings) && currentFumigation.validation_warnings.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 mb-4">
            <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-2 text-sm">Warnings</h4>
            <ul className="list-disc list-inside space-y-1 text-xs">
              {currentFumigation.validation_warnings.map((warning, idx) => (
                <li key={idx} className="text-amber-800 dark:text-amber-400">
                  {warning}
                </li>
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
              disabled={fumigationUpdating}
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
                <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Document Preview
              </h3>
              <button
                onClick={() => onTogglePdf('fumigation')}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <PdfViewer 
                fileUrl={currentFumigation.fileUrl || ''} 
                bucket="fumigation_certificates"
                token={token}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}