import React from 'react'
import { CheckCircle, SkipForward, LucideIcon } from 'lucide-react'
import { PROCESSING_STEPS } from '../../../utils/constants'

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  currentStep: number
  completedSteps: Set<number>
  skippedSteps: Set<number>
  onStepClick: (stepIndex: number) => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  currentStep,
  completedSteps,
  skippedSteps,
  onStepClick
}) => {
  return (
    <div className={`
      fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Document Processing</h2>
          <p className="text-slate-600 dark:text-slate-400 text-xs">
            Complete all {PROCESSING_STEPS.length} steps to process your shipping documents.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {PROCESSING_STEPS.map((step, index) => {
              const isCompleted = completedSteps.has(index)
              const isSkipped = skippedSteps.has(index)
              const isActive = currentStep === index
              const Icon = step.icon
              
              return (
                <button
                  key={step.id}
                  onClick={() => onStepClick(index)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-300 ${
                    isActive 
                      ? 'bg-gradient-to-r from-teal-700 to-teal-600 text-white shadow-lg scale-105' 
                      : isCompleted
                      ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-300 border border-purple-200 dark:border-purple-700'
                      : isSkipped
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-700'
                      : 'bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300
                      ${isActive ? 'bg-white/20 text-white' : 
                        isCompleted ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white' :
                        isSkipped ? 'bg-amber-500 text-white' :
                        'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-400'}
                    `}>
                      {isSkipped ? (
                        <SkipForward className="w-4 h-4" />
                      ) : isCompleted ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <div className={`font-semibold truncate text-sm ${
                          isActive ? 'text-white' : 
                          isSkipped ? 'text-amber-900 dark:text-amber-300' :
                          'text-slate-900 dark:text-white'
                        }`}>
                          {step.label}
                        </div>
                        {isSkipped && (
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs rounded-full font-medium">
                            Skipped
                          </span>
                        )}
                      </div>
                      <div className={`text-xs mt-0.5 ${
                        isActive ? 'text-white/80' : 
                        isSkipped ? 'text-amber-700 dark:text-amber-400' :
                        'text-slate-600 dark:text-slate-400'
                      }`}>
                        {step.description}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Progress Summary */}
          <div className="mt-6 p-3 bg-gradient-to-br from-white to-teal-50 dark:from-slate-700 dark:to-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-xl backdrop-blur-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-2 text-sm">Progress Summary</h3>
            <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 mb-2">
              <div 
                className="bg-gradient-to-r from-teal-700 to-teal-500 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(completedSteps.size / PROCESSING_STEPS.length) * 100}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-teal-700 dark:text-teal-400">
                {completedSteps.size} of {PROCESSING_STEPS.length} steps completed
              </span>
              <span className="font-bold text-teal-700 dark:text-teal-400">
                {Math.round((completedSteps.size / PROCESSING_STEPS.length) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}