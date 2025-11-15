import React from 'react'
import { CheckCircle, CircleX, AlertTriangle, Info, X } from 'lucide-react'
import { SnackbarState } from '../hooks/useSnackbar'

interface SnackbarProps {
  snackbar: SnackbarState
  onClose: () => void
}

export const Snackbar: React.FC<SnackbarProps> = ({ snackbar, onClose }) => {
  if (!snackbar.open) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full">
      <div className={`p-3 rounded-xl shadow-lg border ${
        snackbar.severity === 'success' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300' :
        snackbar.severity === 'error' ? 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-700 text-rose-800 dark:text-rose-300' :
        snackbar.severity === 'warning' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 text-amber-800 dark:text-amber-300' :
        'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700 text-blue-800 dark:text-blue-300'
      }`}>
        <div className="flex items-center gap-2">
          {snackbar.severity === 'success' && <CheckCircle className="w-4 h-4" />}
          {snackbar.severity === 'error' && <CircleX className="w-4 h-4" />}
          {snackbar.severity === 'warning' && <AlertTriangle className="w-4 h-4" />}
          {snackbar.severity === 'info' && <Info className="w-4 h-4" />}
          <span className="font-medium text-sm flex-1">{snackbar.message}</span>
          <button
            onClick={onClose}
            className="ml-2 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors duration-200"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}