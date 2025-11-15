import React from 'react'
import { CircleCheck, CircleX } from 'lucide-react'

interface ValidationDetailsProps {
  validationDetails: any
}

export const ValidationDetails: React.FC<ValidationDetailsProps> = ({ validationDetails }) => {
  if (!validationDetails || Object.keys(validationDetails).length === 0) return null

  return (
    <div className="mt-3">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
        Commercial Invoice Validation:
      </h4>
      <div className="grid gap-1">
        {Object.entries(validationDetails).map(([field, details]: [string, any]) => (
          <div key={field} className={`flex items-center p-2 rounded-lg border ${
            details.match 
              ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' 
              : 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800'
          }`}>
            {details.match ? (
              <CircleCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-2" />
            ) : (
              <CircleX className="w-4 h-4 text-rose-600 dark:text-rose-400 mr-2" />
            )}
            <div className="flex-1">
              <div className="text-xs font-medium text-slate-900 dark:text-white">
                {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </div>
              {!details.match && (
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Commercial: {details.commercialValue || 'Not set'} • Document: {details.documentValue || 'Not set'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}