import React from 'react'
import { CircleCheck, CircleX, AlertTriangle } from 'lucide-react'

interface ValidationBadgeProps {
  completeness: number
  errors: string[]
  warnings: string[]
  invoiceMatchVerified?: boolean
}

export const ValidationBadge: React.FC<ValidationBadgeProps> = ({ 
  completeness, 
  errors, 
  warnings, 
  invoiceMatchVerified 
}) => (
  <div className="flex items-center gap-4 mb-4 flex-wrap">
    <div className="flex items-center gap-2">
      {completeness >= 80 ? (
        <CircleCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      ) : completeness >= 50 ? (
        <AlertTriangle className="w-5 h-5 text-amber-500" />
      ) : (
        <CircleX className="w-5 h-5 text-rose-600" />
      )}
      <span className="text-base font-semibold text-slate-900 dark:text-white">
        {completeness}% Complete
      </span>
    </div>
    {invoiceMatchVerified !== undefined && (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
        invoiceMatchVerified 
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700' 
          : 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200 border border-rose-200 dark:border-rose-700'
      }`}>
        {invoiceMatchVerified ? <CircleCheck className="w-3 h-3" /> : <CircleX className="w-3 h-3" />}
        {invoiceMatchVerified ? "Matches Commercial Invoice" : "Commercial Invoice Mismatch"}
      </span>
    )}
    {errors.length > 0 && (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200 border border-rose-200 dark:border-rose-700">
        <CircleX className="w-3 h-3" />
        {errors.length} Error{errors.length > 1 ? 's' : ''}
      </span>
    )}
    {warnings.length > 0 && (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-700">
        <AlertTriangle className="w-3 h-3" />
        {warnings.length} Warning{warnings.length > 1 ? 's' : ''}
      </span>
    )}
  </div>
)