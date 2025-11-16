import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface StepNavigationProps {
  currentStep: number
  totalSteps: number
  hasDocumentForStep: (stepIndex: number) => boolean
  skippedSteps: Set<number>
  onPreviousStep: () => void
  onNextStep: () => void
  darkMode?: boolean
  documents: {
    currentInvoice: any
    currentSCOMET: any
    currentPackingList: any
    currentFumigationCertificate: any
  }
}

export const StepNavigation: React.FC<StepNavigationProps> = ({
  currentStep,
  totalSteps,
  hasDocumentForStep,
  skippedSteps,
  onPreviousStep,
  onNextStep,
  darkMode = false,
  documents
}) => {
  const isNextButtonDisabled = () => {
    if (currentStep === totalSteps) return true
    
    switch (currentStep) {
      case 0: // Commercial Invoice - required
        return !documents.currentInvoice
      case 1: // SCOMET - required unless skipped
        return !documents.currentSCOMET && !skippedSteps.has(1)
      case 2: // Packing List - required unless skipped
        return !documents.currentPackingList && !skippedSteps.has(2)
      case 3: // Fumigation Certificate - required unless skipped
        return !documents.currentFumigationCertificate && !skippedSteps.has(3)
      default:
        return false
    }
  }

  const getNextButtonText = () => {
    if (currentStep === totalSteps - 1) {
      return 'Complete'
    }
    return 'Next Step'
  }

  return (
    <div className={`border-t ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'} p-4`}>
      <div className="flex justify-between items-center">
        {/* Previous Button */}
        <button
          onClick={onPreviousStep}
          disabled={currentStep === 0}
          className={`
            inline-flex items-center gap-2 px-4 py-2 border rounded-lg transition-all duration-200 text-sm font-medium
            ${
              currentStep === 0
                ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-md'
            }
          `}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        {/* Step Indicator */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className={`
                  w-2 h-2 rounded-full transition-all duration-300
                  ${
                    index === currentStep
                      ? 'bg-teal-600 dark:bg-teal-500 scale-125'
                      : index < currentStep
                      ? 'bg-teal-400 dark:bg-teal-600'
                      : 'bg-slate-300 dark:bg-slate-600'
                  }
                `}
              />
            ))}
          </div>
        </div>

        {/* Next Button */}
        <button
          onClick={onNextStep}
          disabled={isNextButtonDisabled()}
          className={`
            inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium
            ${
              isNextButtonDisabled()
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-teal-700 to-teal-600 text-white hover:shadow-xl hover:-translate-y-0.5'
            }
          `}
        >
          {getNextButtonText()}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1">
        <div 
          className="bg-gradient-to-r from-teal-700 to-teal-500 h-1 rounded-full transition-all duration-500 ease-out"
          style={{ 
            width: `${((currentStep + 1) / totalSteps) * 100}%` 
          }}
        />
      </div>

      {/* Step Requirements Hint */}
      {!isNextButtonDisabled() && currentStep < totalSteps && (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
          {getStepRequirementHint(currentStep)}
        </div>
      )}
    </div>
  )
}

const getStepRequirementHint = (currentStep: number): string => {
  switch (currentStep) {
    case 0:
      return 'Commercial Invoice is required to proceed'
    case 1:
      return 'SCOMET Declaration is required or can be skipped if not applicable'
    case 2:
      return 'Packing List is required or can be skipped if not available'
    case 3:
      return 'Fumigation Certificate is required or can be skipped if not applicable'
    default:
      return ''
  }
}

// Alternative simplified version for basic step navigation
interface SimpleStepNavigationProps {
  currentStep: number
  totalSteps: number
  onPreviousStep: () => void
  onNextStep: () => void
  previousDisabled?: boolean
  nextDisabled?: boolean
  darkMode?: boolean
}

export const SimpleStepNavigation: React.FC<SimpleStepNavigationProps> = ({
  currentStep,
  totalSteps,
  onPreviousStep,
  onNextStep,
  previousDisabled = false,
  nextDisabled = false,
  darkMode = false
}) => {
  return (
    <div className={`flex justify-between items-center p-4 border-t ${
      darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'
    }`}>
      <button
        onClick={onPreviousStep}
        disabled={previousDisabled || currentStep === 0}
        className={`
          inline-flex items-center gap-2 px-4 py-2 border rounded-lg transition-all duration-200 text-sm font-medium
          ${
            previousDisabled || currentStep === 0
              ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-600 cursor-not-allowed'
              : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-md'
          }
        `}
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </button>

      <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
        Step {currentStep + 1} of {totalSteps}
      </div>

      <button
        onClick={onNextStep}
        disabled={nextDisabled || currentStep === totalSteps}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium
          ${
            nextDisabled || currentStep === totalSteps
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-teal-700 to-teal-600 text-white hover:shadow-xl hover:-translate-y-0.5'
          }
        `}
      >
        {currentStep === totalSteps - 1 ? 'Complete' : 'Next Step'}
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// Navigation for completion screen
interface CompletionNavigationProps {
  onStartNewProcess: () => void
  onExportDocuments?: () => void
  darkMode?: boolean
}

export const CompletionNavigation: React.FC<CompletionNavigationProps> = ({
  onStartNewProcess,
  onExportDocuments,
  darkMode = false
}) => {
  return (
    <div className={`p-6 border-t ${
      darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'
    }`}>
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
        {onExportDocuments && (
          <button
            onClick={onExportDocuments}
            className="inline-flex items-center gap-2 px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 hover:shadow-md transition-all duration-200 font-semibold"
          >
            Export All Documents
          </button>
        )}
        
        <button
          onClick={onStartNewProcess}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-700 to-teal-600 text-white rounded-xl hover:shadow-xl hover:-translate-y-1 transition-all duration-200 font-semibold"
        >
          Start New Process
        </button>
      </div>
    </div>
  )
}

export default StepNavigation