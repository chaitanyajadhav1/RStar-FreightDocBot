import React from 'react'
import { FileText, Info, SkipForward ,X} from 'lucide-react'
import { PdfViewer } from '../../common/PdfViewer'

interface UploadSectionProps {
  title: string
  description: string
   uploadRetryCount?: number;
  canEdit?: boolean;
  uploading: boolean
  inputRef: React.RefObject<HTMLInputElement>
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDelete?: () => void
  icon: React.ReactNode
  stepIndex: number
  currentDocument: any
  documentType: string
  isPdfOpen: boolean
  onTogglePdf: (step: string) => void
  token: string | null
  skippedSteps: Set<number>
  onSkipStep: (stepIndex: number) => void
  onReloadDocuments?: () => void
  documentsLoaded?: boolean
  uploadError?: string
  onClearError?: () => void
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  title,
  description,
  uploading,
  inputRef,
  onUpload,
  onDelete,
  icon,
  stepIndex,
  currentDocument,
  documentType,
  isPdfOpen,
  onTogglePdf,
  token,
  skippedSteps,
  onSkipStep
}) => {
  const hasDocument = !!currentDocument
  const bucket = documentType === 'invoice' ? 'invoices' : 
                 documentType === 'scomet' ? 'scomet' :
                 documentType === 'packinglist' ? 'packing_lists' :
                 'fumigation'

  return (
    <div className="h-full flex">
      {/* Left Section - Upload Form */}
      <div className={`${isPdfOpen && hasDocument ? 'w-1/2 pr-4' : 'w-full'} flex flex-col justify-center py-2 transition-all duration-300`}>
        <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-teal-700 to-teal-500 bg-clip-text text-transparent mb-2 text-center">
          {title}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 text-center">{description}</p>

        <div 
          className={`relative p-6 md:p-8 text-center border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${
            uploading 
              ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 shadow-xl' 
              : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 hover:border-teal-400 hover:dark:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/10 hover:shadow-lg'
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <div className={`inline-flex p-3 rounded-full mb-3 transition-all duration-300 ${
            uploading ? 'bg-teal-500 text-white shadow-lg' : 'bg-gradient-to-r from-teal-600 to-teal-400 text-white shadow-md'
          }`}>
            {icon}
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {uploading ? "Processing Document..." : hasDocument ? "Upload New Document" : "Upload Your Document"}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-2 text-sm">
            {hasDocument ? "Click to replace current document" : "Click to browse or drag and drop your PDF file here"}
          </p>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-700">
            PDF • Max 10MB
          </span>
          {uploading && (
            <div className="mt-3">
              <div className="w-6 h-6 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-slate-600 dark:text-slate-400 text-xs">Extracting data with AI...</p>
            </div>
          )}
        </div>

        {/* PDF Toggle Button - Only show when document exists */}
        {hasDocument && (
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => onTogglePdf(documentType)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-200 text-sm"
            >
              <FileText className="w-4 h-4" />
              {isPdfOpen ? 'Hide Document' : 'View Document'}
            </button>
            {onDelete && (
              <button
                onClick={onDelete}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors duration-200 text-sm"
              >
                <X className="w-4 h-4" />
                Delete Document
              </button>
            )}
          </div>
        )}

        <input
          type="file"
          accept=".pdf"
          ref={inputRef}
          onChange={onUpload}
          className="hidden"
        />

        {/* Show skip option only for steps after commercial invoice and if not already skipped */}
        {stepIndex > 0 && !skippedSteps.has(stepIndex) && (
          <div className="mt-3 p-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded-xl">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-teal-900 dark:text-teal-300 mb-1 text-sm">
                  Don't have this document?
                </h4>
                <p className="text-teal-800 dark:text-teal-400 mb-2 text-xs">
                  You can skip this step and continue with the process.
                </p>
                <button
                  onClick={() => onSkipStep(stepIndex)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-700 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-600 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:shadow-md transition-all duration-200 text-xs"
                >
                  <SkipForward className="w-3 h-3" />
                  Skip This Step
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Section - PDF Viewer (only when toggled and document exists) */}
      {isPdfOpen && hasDocument && token && (
        <div className="w-1/2 pl-4">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Document Preview
              </h3>
              <button
                onClick={() => onTogglePdf(documentType)}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <PdfViewer 
                fileUrl={currentDocument.fileUrl} 
                bucket={bucket}
                token={token}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}