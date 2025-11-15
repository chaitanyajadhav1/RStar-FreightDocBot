import React from 'react'
import { LucideIcon } from 'lucide-react'

interface EditableFieldProps {
  label: string
  value: any
  onChange: (value: any) => void
  type?: string
  multiline?: boolean
  rows?: number
  icon?: LucideIcon
}

export const EditableField: React.FC<EditableFieldProps> = ({ 
  label, 
  value, 
  onChange,
  type = 'text',
  multiline = false,
  rows = 1,
  icon: Icon
}) => (
  <div className="flex items-start gap-2">
    {Icon && <Icon className="w-4 h-4 text-teal-600 dark:text-teal-400 mt-2.5 flex-shrink-0" />}
    <div className="flex-1 min-w-0">
      <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">{label}</label>
      {multiline ? (
        <textarea
          className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-800 dark:text-white resize-none"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
        />
      ) : (
        <input
          type={type}
          className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-800 dark:text-white"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  </div>
)