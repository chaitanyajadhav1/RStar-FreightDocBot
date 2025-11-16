import { useState, useEffect, useRef } from 'react'

export type SnackbarSeverity = "success" | "error" | "warning" | "info"

export interface SnackbarState {
  open: boolean
  message: string
  severity: SnackbarSeverity
}

export const useSnackbar = () => {
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: "",
    severity: "success",
  })
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const showSnackbar = (message: string, severity: SnackbarSeverity = "success", autoHideDuration: number = 4000) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    setSnackbar({ open: true, message, severity })
    
    // Auto-dismiss after specified duration (default 4 seconds)
    // For "document loaded" messages, use longer duration (5 seconds)
    const duration = message.toLowerCase().includes('document') && message.toLowerCase().includes('loaded') 
      ? 5000 
      : autoHideDuration
    
    timeoutRef.current = setTimeout(() => {
      setSnackbar(prev => ({ ...prev, open: false }))
      timeoutRef.current = null
    }, duration)
  }

  const hideSnackbar = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setSnackbar(prev => ({ ...prev, open: false }))
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    snackbar,
    setSnackbar,
    showSnackbar,
    hideSnackbar
  }
}