import React from 'react'
import { LucideIcon } from 'lucide-react'

interface DataFieldProps {
  label: string
  value: any
  icon?: LucideIcon
}

export const DataField: React.FC<DataFieldProps> = ({ label, value, icon: Icon }) => (
  <div className="flex items-start gap-2">
    {Icon && <Icon className="w-4 h-4 text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" />}
    <div className="flex-1 min-w-0">
      <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">{label}</div>
      <div className="text-sm font-medium text-slate-900 dark:text-white break-words">
        {value || 'N/A'}
      </div>
    </div>
  </div>
)