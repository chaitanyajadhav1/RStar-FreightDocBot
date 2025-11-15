import { useState } from 'react'

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

  const showSnackbar = (message: string, severity: SnackbarSeverity = "success") => {
    setSnackbar({ open: true, message, severity })
  }

  const hideSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }))
  }

  return {
    snackbar,
    setSnackbar,
    showSnackbar,
    hideSnackbar
  }
}