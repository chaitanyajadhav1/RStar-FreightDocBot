"use client"

import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Upload, X, Shield, Trash2, MessageSquare, Download } from 'lucide-react'

// Hooks
import { useAuth } from './hooks/useAuth'
import { useDocuments } from './hooks/useDocuments'
import { useSnackbar } from './hooks/useSnackbar'

// Components
import { Header } from './layout/Header'
import { Sidebar } from './layout/Sidebar'
import { Snackbar } from './layout/Snackbar'
import { AuthDialog } from './auth/AuthDialog'
import { UploadSection } from './documents/upload/UploadSection'
import { InvoiceReview } from './documents/review/InvoiceReview'
import { SCOMETReview } from './documents/review/SCOMETReview'
import { PackingListReview } from './documents/review/PackingListReview'
import { FumigationReview } from './documents/review/FumigationReview'
import { ExportDeclarationReview } from './documents/review/ExportDeclarationReview'
import { AirwayBillReview } from './documents/review/AirwayBillReview'
import { AdminDashboard } from './admin/AdminDashboard'

// Constants & Types
import { PROCESSING_STEPS } from '../../utils/constants'
import { sanitizeFilename } from '../../utils/validation'
import { API_BASE } from '../../utils/constants'

import type { 
  User, 
  Organization, 
  AuthData,
  LoginRequest,
  AdminMessage
} from '../../types/auth'

export default function FreightChatPro() {
  // State - Initialize dark mode from localStorage if available (prevents flash)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode')
      if (saved !== null) return saved === 'true'
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    }
    return false
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set())
  const [pdfViewerOpen, setPdfViewerOpen] = useState({
    invoice: false,
    scomet: false,
    packinglist: false,
    fumigation: false,
    exportdeclaration: false,
    airwaybill: false
  })
  const [documentsLoaded, setDocumentsLoaded] = useState(false)
  const [adminMode, setAdminMode] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [viewingUser, setViewingUser] = useState<User | null>(null)
  const [uploadErrors, setUploadErrors] = useState<{[key: string]: string}>({})
  const [uploadRetryCount, setUploadRetryCount] = useState<{[key: string]: number}>({})
  const [showAdminNotice, setShowAdminNotice] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Hooks
  const auth = useAuth()
  const documents = useDocuments()
  const snackbar = useSnackbar()

  // Get effective userId - if admin is viewing a member's dashboard, use member's userId
  const getEffectiveUserId = () => {
    if (adminMode && selectedUserId) {
      return selectedUserId // Admin viewing member's dashboard
    }
    // Ensure we always return a valid userId, throw error if not available
    if (!auth.user?.userId) {
      throw new Error('User ID is not available. Please log in again.')
    }
    return auth.user.userId // Regular user or admin viewing their own dashboard
  }

  // Helper function to validate userId for admin editing
  const validateUserIdForUpdate = (): string => {
    // Get effective userId with validation
    let effectiveUserId: string
    try {
      effectiveUserId = getEffectiveUserId()
    } catch (error: any) {
      throw new Error(error.message || 'User ID is not available')
    }

    // Additional validation: if admin is editing, ensure selectedUserId is set
    if (adminMode && auth.user?.role === 'admin' && !selectedUserId) {
      throw new Error('Please select a member to edit their documents')
    }

    // Validate that userId is not empty or undefined
    if (!effectiveUserId || effectiveUserId.trim() === '' || effectiveUserId === 'undefined' || effectiveUserId === 'null') {
      throw new Error('User ID is not available')
    }

    return effectiveUserId
  }

  // Determine if user can edit - only admins can edit
  const canEdit = auth.user?.role === 'admin'

  const rawMemberMessage = !adminMode && auth.user
    ? auth.user.lastAdminMessage ??
      (auth.user.metadata ? auth.user.metadata.last_admin_message : null) ??
      null
    : null

  const memberAdminMessage: AdminMessage | null =
    rawMemberMessage && typeof rawMemberMessage === 'object' && 'message' in rawMemberMessage
      ? (rawMemberMessage as AdminMessage)
      : null

  // Effects - Apply dark mode class and persist to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      // Apply dark mode class to document
      if (darkMode) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('darkMode', 'true')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('darkMode', 'false')
      }
    }
  }, [darkMode])

  // Check if user is admin and set admin mode
  useEffect(() => {
    if (auth.user) {
      if (auth.user.role === 'admin') {
        setAdminMode(true)
        // For admin users, ensure we don't have a selected user unless explicitly set
        // This ensures admin dashboard shows by default
        if (!selectedUserId) {
          // Clear any viewing user to ensure admin dashboard shows
          setViewingUser(null)
        }
      } else {
        setAdminMode(false)
        setSelectedUserId(null)
        setViewingUser(null)
      }
    } else {
      setAdminMode(false)
      setSelectedUserId(null)
      setViewingUser(null)
    }
  }, [auth.user, selectedUserId])

  // Show admin notice immediately when user logs in
  useEffect(() => {
    if (auth.user && !adminMode && memberAdminMessage?.message) {
      setShowAdminNotice(true)
      // Auto-hide notice after 10 seconds
      const timer = setTimeout(() => {
        setShowAdminNotice(false)
      }, 10000)
      return () => clearTimeout(timer)
    } else {
      setShowAdminNotice(false)
    }
  }, [auth.user, adminMode, memberAdminMessage])

  // Fetch user documents when user logs in or component mounts with existing user
  useEffect(() => {
    if (auth.user && auth.token && auth.organization && !documentsLoaded) {
      // For admin users: only fetch documents if they've selected a user to view
      // For regular users: always fetch their documents
      if (adminMode) {
        // Admin mode: only fetch if a user is selected
        if (selectedUserId) {
          fetchUserDocuments(selectedUserId)
        }
        // If no user selected, admin dashboard will be shown (no documents needed)
      } else {
        // Regular user: fetch their own documents
        fetchUserDocuments(auth.user.userId)
      }
    }
  }, [auth.user, auth.token, auth.organization, documentsLoaded, adminMode, selectedUserId])

  // Update completed steps based on current documents
  useEffect(() => {
    const newCompletedSteps = new Set<number>()
    
    if (documents.currentInvoice) newCompletedSteps.add(0)
    if (documents.currentSCOMET) newCompletedSteps.add(1)
    if (documents.currentPackingList) newCompletedSteps.add(2)
    if (documents.currentFumigationCertificate) newCompletedSteps.add(3)
    if (documents.currentExportDeclaration) newCompletedSteps.add(4)
    if (documents.currentAirwayBill) newCompletedSteps.add(5)
    
    setCompletedSteps(newCompletedSteps)
  }, [
    documents.currentInvoice,
    documents.currentSCOMET,
    documents.currentPackingList,
    documents.currentFumigationCertificate,
    documents.currentExportDeclaration,
    documents.currentAirwayBill
  ])

  // Fetch user documents from server with commercial invoice validation
  const fetchUserDocuments = async (targetUserId?: string) => {
    if (!auth.token || !auth.user || !auth.organization) {
      return
    }

    try {
      // Use regular endpoint - it now supports userId query parameter for admins
      const userId = targetUserId || auth.user.userId
      const isAdminViewingOtherUser = adminMode && selectedUserId && selectedUserId !== auth.user.userId
      
      // Add userId query parameter if admin is viewing another user
      const endpoint = isAdminViewingOtherUser 
        ? `${API_BASE}/documents/user-documents?userId=${userId}`
        : `${API_BASE}/documents/user-documents`

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch documents')
      }

      // Handle response format - both admin and regular now use the same format
      const data = result.data || result

      if (data) {
        // Set the documents in state
        if (data.invoice) {
          documents.setCurrentInvoice(data.invoice)
        } else {
          documents.setCurrentInvoice(null)
        }
        
        if (data.scomet) {
          documents.setCurrentSCOMET(data.scomet)
        } else {
          documents.setCurrentSCOMET(null)
        }
        
        if (data.packingList) {
          documents.setCurrentPackingList(data.packingList)
        } else {
          documents.setCurrentPackingList(null)
        }
        
        if (data.fumigationCertificate) {
          documents.setCurrentFumigationCertificate(data.fumigationCertificate)
        } else {
          documents.setCurrentFumigationCertificate(null)
        }
        
        if (data.exportDeclaration) {
          documents.setCurrentExportDeclaration(data.exportDeclaration)
        } else {
          documents.setCurrentExportDeclaration(null)
        }

        if (data.airwayBill) {
          documents.setCurrentAirwayBill(data.airwayBill)
        } else {
          documents.setCurrentAirwayBill(null)
        }

        setDocumentsLoaded(true)

        if (!isAdminViewingOtherUser && data.user) {
          auth.setUser(prev => {
            if (!prev) return prev
            return {
              ...prev,
              metadata: data.user.metadata ?? prev.metadata,
              adminNotes: data.user.adminNotes ?? prev.adminNotes,
              lastAdminMessage: data.user.lastAdminMessage ?? null
            }
          })
        }
        
        // Cross-verify other documents with the commercial invoice after fetching
        if (data.invoice?.invoice_no) {
          await validateAllDocumentsWithCommercialInvoice(
            data.invoice.invoice_no,
            {
              scomet: data.scomet || null,
              packingList: data.packingList || null,
              fumigationCertificate: data.fumigationCertificate || null,
              exportDeclaration: data.exportDeclaration || null,
              airwayBill: data.airwayBill || null
            },
            { showToast: !!isAdminViewingOtherUser }
          )
        }
        
        if (isAdminViewingOtherUser) {
          snackbar.showSnackbar(`Documents loaded for user: ${userId}`, "success")
        } else {
          snackbar.showSnackbar("Your documents have been loaded", "success")
        }
      }
    } catch (error: any) {
      console.error('Error fetching user documents:', error)
      // Don't show error for initial load, it's normal if no documents exist
      if (documentsLoaded) {
        snackbar.showSnackbar(error.message || "Failed to load documents", "error")
      }
      setDocumentsLoaded(true)
    }
  }

  const mergeMessages = (current?: string[] | null, next?: string[] | null) => {
    const combined = [...(current || []), ...(next || [])].filter(Boolean)
    return Array.from(new Set(combined))
  }

  // Validate all documents with commercial invoice (for admin viewing member documents)
  const validateAllDocumentsWithCommercialInvoice = async (
    commercialInvoiceNumber?: string,
    documentSnapshot?: {
      scomet?: typeof documents.currentSCOMET
      packingList?: typeof documents.currentPackingList
      fumigationCertificate?: typeof documents.currentFumigationCertificate
      exportDeclaration?: typeof documents.currentExportDeclaration
      airwayBill?: typeof documents.currentAirwayBill
    },
    options: { showToast?: boolean } = {}
  ) => {
    if (!commercialInvoiceNumber) return

    const { showToast = false } = options

    try {
      // Validate SCOMET
      const snapshotSCOMET = documentSnapshot?.scomet ?? documents.currentSCOMET
      if (snapshotSCOMET) {
        const scometValidation = await validateWithCommercialInvoice(
          commercialInvoiceNumber,
          snapshotSCOMET,
          'scomet'
        )
        if (scometValidation) {
          documents.setCurrentSCOMET(prev => {
            const base = documentSnapshot?.scomet ?? prev
            if (!base) return prev

            return {
              ...base,
            invoiceMatchVerified: scometValidation.invoiceMatchVerified,
            validationDetails: scometValidation.validationDetails,
              validation_errors: mergeMessages(base?.validation_errors, scometValidation.validation_errors),
              validation_warnings: mergeMessages(base?.validation_warnings, scometValidation.validation_warnings)
            }
          })
        }
      }

      // Validate Packing List
      const snapshotPackingList = documentSnapshot?.packingList ?? documents.currentPackingList
      if (snapshotPackingList) {
        const packingListValidation = await validateWithCommercialInvoice(
          commercialInvoiceNumber,
          snapshotPackingList,
          'packinglist'
        )
        if (packingListValidation) {
          documents.setCurrentPackingList(prev => {
            const base = documentSnapshot?.packingList ?? prev
            if (!base) return prev

            return {
              ...base,
            invoiceMatchVerified: packingListValidation.invoiceMatchVerified,
            amountsMatchVerified: packingListValidation.amountsMatchVerified,
            validationDetails: packingListValidation.validationDetails,
              validation_errors: mergeMessages(base?.validation_errors, packingListValidation.validation_errors),
              validation_warnings: mergeMessages(base?.validation_warnings, packingListValidation.validation_warnings)
            }
          })
        }
      }

      // Validate Fumigation Certificate
      const snapshotFumigation = documentSnapshot?.fumigationCertificate ?? documents.currentFumigationCertificate
      if (snapshotFumigation) {
        const fumigationValidation = await validateWithCommercialInvoice(
          commercialInvoiceNumber,
          {
            invoiceNumber: snapshotFumigation.invoiceNumber,
            invoiceDate: snapshotFumigation.invoiceDate,
            shippingMark: snapshotFumigation.shippingMark,
            exporterName: snapshotFumigation.exporterName,
            consigneeName: snapshotFumigation.consigneeName,
          },
          'fumigation'
        )
        if (fumigationValidation) {
          documents.setCurrentFumigationCertificate(prev => {
            const base = documentSnapshot?.fumigationCertificate ?? prev
            if (!base) return prev

            return {
              ...base,
            invoiceMatchVerified: fumigationValidation.invoiceMatchVerified,
            validationDetails: fumigationValidation.validationDetails,
              validation_errors: mergeMessages(base?.validation_errors, fumigationValidation.validation_errors),
              validation_warnings: mergeMessages(base?.validation_warnings, fumigationValidation.validation_warnings)
            }
          })
        }
      }

      // Validate Export Declaration
      const snapshotExportDeclaration = documentSnapshot?.exportDeclaration ?? documents.currentExportDeclaration
      if (snapshotExportDeclaration) {
        const exportDeclarationValidation = await validateWithCommercialInvoice(
          commercialInvoiceNumber,
          {
            invoiceNo: snapshotExportDeclaration.invoiceNo,
            invoiceDate: snapshotExportDeclaration.invoiceDate,
            shippingBillNo: snapshotExportDeclaration.shippingBillNo,
            shippingBillDate: snapshotExportDeclaration.shippingBillDate,
            paymentTerms: snapshotExportDeclaration.paymentTerms,
          },
          'exportdeclaration'
        )
        if (exportDeclarationValidation) {
          documents.setCurrentExportDeclaration(prev => {
            const base = documentSnapshot?.exportDeclaration ?? prev
            if (!base) return prev

            return {
              ...base,
            invoiceMatchVerified: exportDeclarationValidation.invoiceMatchVerified,
            validationDetails: exportDeclarationValidation.validationDetails,
              validation_errors: mergeMessages(base?.validation_errors, exportDeclarationValidation.validation_errors),
              validation_warnings: mergeMessages(base?.validation_warnings, exportDeclarationValidation.validation_warnings)
            }
          })
        }
      }

      // Validate Airway Bill
      const snapshotAirwayBill = documentSnapshot?.airwayBill ?? documents.currentAirwayBill
      if (snapshotAirwayBill) {
        const airwayBillValidation = await validateWithCommercialInvoice(
          commercialInvoiceNumber,
          {
            invoice_no: snapshotAirwayBill.invoice_no,
            invoice_date: snapshotAirwayBill.invoice_date,
            shippers_name: snapshotAirwayBill.shippers_name,
            shippers_address: snapshotAirwayBill.shippers_address,
            consignees_name: snapshotAirwayBill.consignees_name,
            consignees_address: snapshotAirwayBill.consignees_address,
            issuing_carriers_name: snapshotAirwayBill.issuing_carriers_name,
            issuing_carriers_city: snapshotAirwayBill.issuing_carriers_city,
            hs_code_no: snapshotAirwayBill.hs_code_no,
          },
          'airwaybill'
        )
        if (airwayBillValidation) {
          documents.setCurrentAirwayBill(prev => {
            const base = documentSnapshot?.airwayBill ?? prev
            if (!base) return prev

            return {
              ...base,
            invoiceMatchVerified: airwayBillValidation.invoiceMatchVerified,
            validationDetails: airwayBillValidation.validationDetails,
              validation_errors: mergeMessages(base?.validation_errors, airwayBillValidation.validation_errors),
              validation_warnings: mergeMessages(base?.validation_warnings, airwayBillValidation.validation_warnings)
            }
          })
        }
      }

      if (showToast) {
        snackbar.showSnackbar("All documents validated with commercial invoice", "success")
      }
    } catch (error: any) {
      console.error('Error validating documents with commercial invoice:', error)
      if (showToast) {
        snackbar.showSnackbar("Validation completed with some warnings", "warning")
      }
    }
  }

  // Handle admin user selection
  const handleSelectUser = async (userId: string) => {
    setSelectedUserId(userId)
    setDocumentsLoaded(false)
    // Fetch user info to display
    try {
      const response = await fetch(`${API_BASE}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${auth.token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        const user = data.users.find((u: any) => u.userId === userId)
        if (user) {
          setViewingUser({
            userId: user.userId,
            name: user.name,
            email: user.email,
            role: user.role,
            organizationId: auth.organization?.organizationId || '',
            isActive: user.isActive,
            createdAt: user.createdAt,
            lastAccessed: user.lastAccessed
          })
        }
      }
    } catch (error) {
      console.error('Error fetching user info:', error)
    }
    // Reset step to 0 when viewing a new user
    setCurrentStep(0)
    setCompletedSteps(new Set())
    setSkippedSteps(new Set())
  }

  // Handle switch back to admin view
  const handleBackToAdmin = () => {
    setSelectedUserId(null)
    setViewingUser(null)
    setDocumentsLoaded(false)
    // Reset documents when going back
    documents.setCurrentInvoice(null)
    documents.setCurrentSCOMET(null)
    documents.setCurrentPackingList(null)
    documents.setCurrentFumigationCertificate(null)
    documents.setCurrentExportDeclaration(null)
    documents.setCurrentAirwayBill(null)
    setCurrentStep(0)
    setCompletedSteps(new Set())
    setSkippedSteps(new Set())
  }

  // Handle switch to admin dashboard from header
  const handleGoToAdminDashboard = () => {
    handleBackToAdmin()
  }

  // Handle switch to user dashboard from header
  const handleGoToUserDashboard = () => {
    setSelectedUserId(auth.user?.userId || null)
    setViewingUser(null)
    setDocumentsLoaded(false)
    setCurrentStep(0)
    setCompletedSteps(new Set())
    setSkippedSteps(new Set())
  }

  // Handler functions
  const handleStepClick = (stepIndex: number) => {
    if (completedSteps.has(stepIndex) || stepIndex === currentStep || skippedSteps.has(stepIndex)) {
      setCurrentStep(stepIndex)
    }
  }

  const handleNextStep = () => {
    if (currentStep < PROCESSING_STEPS.length - 1) {
      if (hasDocumentForStep(currentStep)) {
        setCompletedSteps(prev => new Set([...prev, currentStep]))
      }
      setCurrentStep(currentStep + 1)
    } else {
      if (hasDocumentForStep(currentStep)) {
        setCompletedSteps(prev => new Set([...prev, currentStep]))
      }
      snackbar.showSnackbar("All documents processed successfully!", "success")
    }
  }

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkipStep = (stepIndex: number) => {
    if (stepIndex === 0) return;
    
    setSkippedSteps(prev => new Set([...prev, stepIndex]))
    if (stepIndex < PROCESSING_STEPS.length - 1) {
      setCurrentStep(stepIndex + 1)
    }
    
    snackbar.showSnackbar(`Step "${PROCESSING_STEPS[stepIndex].label}" skipped`, "info")
  }

  const hasDocumentForStep = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: return !!documents.currentInvoice
      case 1: return !!documents.currentSCOMET
      case 2: return !!documents.currentPackingList
      case 3: return !!documents.currentFumigationCertificate
      case 4: return !!documents.currentExportDeclaration
      case 5: return !!documents.currentAirwayBill
      default: return false
    }
  }

  const togglePdfViewer = (step: string) => {
    setPdfViewerOpen(prev => ({
      ...prev,
      [step]: !prev[step as keyof typeof prev]
    }))
  }

  // Server-side validation function
  const validateWithCommercialInvoice = async (
    commercialInvoiceNumber: string | undefined,
    documentData: any,
    documentType: string
  ): Promise<any> => {
    // If no commercial invoice number provided, skip validation early.
    if (!commercialInvoiceNumber) {
      // This can happen when invoice number extraction failed; caller expects null on missing number.
      console.warn('Commercial invoice number missing; skipping cross-verification')
      return null
    }

    if (!auth.token || !auth.user) {
      snackbar.showSnackbar("Please login first", "warning")
      return null
    }

    try {
      const response = await fetch(`${API_BASE}/validate/cross-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          commercialInvoiceNumber,
          documentType,
          documentData,
          userId: getEffectiveUserId(),
          threadId: `thread_${Date.now()}`
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Validation failed')
      }

      return result
    } catch (error: any) {
      console.error('Cross-verification error:', error)
      snackbar.showSnackbar(error.message || 'Validation failed', 'error')
      return null
    }
  }

  // Clear upload error for a specific document type
  const clearUploadError = (documentType: string) => {
    setUploadErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[documentType]
      return newErrors
    })
    setUploadRetryCount(prev => {
      const newCounts = { ...prev }
      delete newCounts[documentType]
      return newCounts
    })
  }

  // Delete document handler
  const handleDeleteDocument = async (documentType: string) => {
    if (!auth.token || !auth.user) {
      snackbar.showSnackbar("Please login first", "warning")
      return
    }

    // Clear any upload errors for this document type
    clearUploadError(documentType)

    const setDocument = 
      documentType === 'invoice' ? documents.setCurrentInvoice :
      documentType === 'scomet' ? documents.setCurrentSCOMET :
      documentType === 'packinglist' ? documents.setCurrentPackingList :
      documentType === 'fumigation' ? documents.setCurrentFumigationCertificate :
      documentType === 'exportdeclaration' ? documents.setCurrentExportDeclaration :
      documents.setCurrentAirwayBill

    const currentDocument =
      documentType === 'invoice' ? documents.currentInvoice :
      documentType === 'scomet' ? documents.currentSCOMET :
      documentType === 'packinglist' ? documents.currentPackingList :
      documentType === 'fumigation' ? documents.currentFumigationCertificate :
      documentType === 'exportdeclaration' ? documents.currentExportDeclaration :
      documents.currentAirwayBill

    if (!currentDocument) {
      snackbar.showSnackbar("No document to delete", "warning")
      return
    }

    try {
      const endpoint = 
        documentType === 'invoice' ? '/invoice/delete/delete-invoice' :
        documentType === 'scomet' ? '/invoice/delete/delete-scomet' :
        documentType === 'packinglist' ? '/invoice/delete/delete-packinglist' :
        documentType === 'fumigation' ? '/invoice/delete/delete-fumigation-certificate' :
        documentType === 'exportdeclaration' ? '/invoice/delete/delete-export-declaration' :
        '/invoice/delete/delete-airway-bill'

      // Determine id key and value safely by narrowing via runtime checks and casting to any
      const idKey =
        documentType === 'invoice' ? 'invoiceId' :
        documentType === 'scomet' ? 'scometId' :
        documentType === 'packinglist' ? 'packingListId' :
        documentType === 'fumigation' ? 'certificateId' :
        documentType === 'exportdeclaration' ? 'declarationId' :
        'airwayBillId'

      const idValue =
        documentType === 'invoice' ? (currentDocument as any).invoiceId :
        documentType === 'scomet' ? (currentDocument as any).declarationId :
        documentType === 'packinglist' ? (currentDocument as any).packingListId :
        documentType === 'fumigation' ? (currentDocument as any).fumigationCertificateId :
        documentType === 'exportdeclaration' ? (currentDocument as any).declarationId :
        (currentDocument as any).airway_bill_id

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          [idKey]: idValue,
          userId: getEffectiveUserId(),
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Delete failed')
      }

      // Clear the document from state
      setDocument(null)
      
      // Remove from completed steps
      const stepIndex = 
        documentType === 'invoice' ? 0 :
        documentType === 'scomet' ? 1 :
        documentType === 'packinglist' ? 2 :
        documentType === 'fumigation' ? 3 : 
        documentType === 'exportdeclaration' ? 4 : 5
        
      setCompletedSteps(prev => {
        const newSet = new Set(prev)
        newSet.delete(stepIndex)
        return newSet
      })

      // Reset edit mode if active
      if (documentType === 'invoice') documents.setEditInvoiceMode(false)
      if (documentType === 'scomet') documents.setEditSCOMETMode(false)
      if (documentType === 'packinglist') documents.setEditPackingListMode(false)
      if (documentType === 'fumigation') documents.setEditFumigationMode(false)
      if (documentType === 'exportdeclaration') documents.setEditExportDeclarationMode(false)
      if (documentType === 'airwaybill') documents.setEditAirwayBillMode(false)

      snackbar.showSnackbar(result.message || "Document deleted successfully", "success")
    } catch (error: any) {
      console.error('Delete error:', error)
      snackbar.showSnackbar(error.message || "Delete failed", "error")
    }
  }

  // Auth handler
  const handleAuth = async () => {
    if (!auth.authData.userId) {
      snackbar.showSnackbar("User ID is required", "error")
      return
    }

    if (!auth.authData.password) {
      snackbar.showSnackbar("Password is required", "error")
      return
    }

    if (!auth.isLogin) {
      if (!auth.authData.name) {
        snackbar.showSnackbar("Name is required", "error")
        return
      }

      if (auth.authData.createNewOrganization && !auth.authData.organizationName) {
        snackbar.showSnackbar("Organization name is required", "error")
        return
      }

      if (!auth.authData.createNewOrganization && !auth.authData.organizationId) {
        snackbar.showSnackbar("Organization ID is required", "error")
        return
      }
    }

    auth.setLoading(true)
    try {
      if (auth.isLogin) {
        const loginPayload = {
          userId: auth.authData.userId,
          email: auth.authData.email,
          password: auth.authData.password,
          mode: auth.authRole
        }

        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(loginPayload),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Login failed')
        }

        auth.setToken(result.token)
        auth.setUser(result.user)
        auth.setOrganization(result.organization)

        sessionStorage.setItem("freightchat_token", result.token)
        sessionStorage.setItem("freightchat_user", JSON.stringify(result.user))
        sessionStorage.setItem("freightchat_org", JSON.stringify(result.organization))
        // Save auth role for next login
        sessionStorage.setItem("freightchat_authRole", auth.authRole)

        auth.setAuthDialogOpen(false)
        
        const welcomeMessage = result.user.role === 'admin'
          ? `Welcome back ${result.user.name}! 🎉 Admin Dashboard`
          : `Welcome back ${result.user.name}! 🎉`
        snackbar.showSnackbar(welcomeMessage, "success")

        // Show admin notice immediately if user has one
        if (result.user.lastAdminMessage?.message) {
          setTimeout(() => {
            snackbar.showSnackbar(
              `Note from your administrator: ${result.user.lastAdminMessage?.message}`,
              "warning"
            )
          }, 400)
        }
        
        // For admin users, don't auto-load documents - show admin dashboard instead
        // For regular users, fetch documents after successful login
        if (result.user.role !== 'admin') {
          setDocumentsLoaded(false)
        } else {
          // Admin will see admin dashboard, documents will load when they select a user
          setDocumentsLoaded(true) // Set to true to prevent auto-fetch
        }
        
      } else {
        // Determine role based on authRole - admin registration always creates new organization
        const isAdminFlow = auth.authRole === 'admin'
        const role = isAdminFlow ? 'admin' : (auth.authData.role || 'member')
        const createNewOrg = isAdminFlow ? true : false
        
        const registerPayload = {
          userId: auth.authData.userId,
          name: auth.authData.name,
          email: auth.authData.email || undefined,
          password: auth.authData.password,
          createNewOrganization: createNewOrg,
          role: role,
          registrationMode: auth.authRole,
          ...(createNewOrg ? {
            organizationId: auth.authData.organizationId || `org_${auth.authData.userId}_${Date.now()}`,
            organizationName: auth.authData.organizationName,
            organizationEmail: auth.authData.organizationEmail,
            organizationPhone: auth.authData.organizationPhone,
            organizationAddress: auth.authData.organizationAddress,
            industry: auth.authData.industry,
            size: auth.authData.size,
          } : {
            organizationId: auth.authData.organizationId
          })
        }

        const response = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(registerPayload),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Registration failed')
        }

        const newUser: User = {
          userId: result.user.userId,
          isActive: result.user.isActive,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          organizationId: result.user.organizationId,
          createdAt: result.user.createdAt,
          lastAccessed: result.user.lastAccessed || new Date().toISOString(),
          metadata: result.user.metadata,
          adminNotes: result.user.adminNotes || [],
          lastAdminMessage: result.user.lastAdminMessage || null
        }

        const newOrg: Organization = {
          organizationId: result.organization.organizationId,
          name: result.organization.name,
          email: result.organization.email,
          isActive: result.organization.isActive,
          createdAt: result.organization.createdAt || new Date().toISOString(),
        }

        auth.setToken(result.token)
        auth.setUser(newUser)
        auth.setOrganization(newOrg)

        sessionStorage.setItem("freightchat_token", result.token)
        sessionStorage.setItem("freightchat_user", JSON.stringify(newUser))
        sessionStorage.setItem("freightchat_org", JSON.stringify(newOrg))

        auth.setAuthDialogOpen(false)
        snackbar.showSnackbar(
          auth.authData.createNewOrganization 
            ? `Welcome ${newUser.name}! Organization created successfully 🎉` 
            : `Welcome ${newUser.name}! 🎉`, 
          "success"
        )
        
        // For new registration, documents will be empty, so mark as loaded
        setDocumentsLoaded(true)
      }
    } catch (error: any) {
      console.error('Auth error:', error)
      
      if (error.message.includes('Invalid credentials')) {
        snackbar.showSnackbar("Invalid user ID or password", "error")
      } else if (error.message.includes('User ID already exists')) {
        snackbar.showSnackbar("User ID already taken. Please choose another.", "error")
      } else if (error.message.includes('Organization not found')) {
        snackbar.showSnackbar("Organization not found. Please check the ID.", "error")
      } else if (error.message.includes('Organization ID already exists')) {
        snackbar.showSnackbar("Organization ID already exists. Please choose another.", "error")
      } else if (error.message.includes('Invalid password')) {
        snackbar.showSnackbar("Password must be at least 8 characters with letters and numbers", "error")
      } else {
        snackbar.showSnackbar(error.message || "Authentication failed", "error")
      }
    } finally {
      auth.setLoading(false)
    }
  }

  // Upload handlers with improved error handling and retry capability
  const createUploadHandler = (documentType: string) => {
    return async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file || !auth.token || !auth.user || !auth.organization) {
        snackbar.showSnackbar("Please login first", "warning")
        return
      }

      // Clear any previous upload errors for this document type
      clearUploadError(documentType)

      const setUploading = 
        documentType === 'invoice' ? documents.setInvoiceUploading :
        documentType === 'scomet' ? documents.setSCOMETUploading :
        documentType === 'packinglist' ? documents.setPackingListUploading :
        documentType === 'fumigation' ? documents.setFumigationUploading :
        documentType === 'exportdeclaration' ? documents.setExportDeclarationUploading :
        documents.setAirwayBillUploading

      const setDocument = 
        documentType === 'invoice' ? documents.setCurrentInvoice :
        documentType === 'scomet' ? documents.setCurrentSCOMET :
        documentType === 'packinglist' ? documents.setCurrentPackingList :
        documentType === 'fumigation' ? documents.setCurrentFumigationCertificate :
        documentType === 'exportdeclaration' ? documents.setCurrentExportDeclaration :
        documents.setCurrentAirwayBill

      setUploading(true)
      
      // Increment retry count
      setUploadRetryCount(prev => ({
        ...prev,
        [documentType]: (prev[documentType] || 0) + 1
      }))
      
      const formData = new FormData()
      const sanitizedFile = new File([file], sanitizeFilename(file.name), { type: file.type })
      formData.append('file', sanitizedFile)
      formData.append('threadId', `thread_${Date.now()}`)
      formData.append('userId', getEffectiveUserId())
      formData.append('organizationId', auth.organization.organizationId)

      try {
        const endpoint = 
          documentType === 'invoice' ? '/invoice/upload-invoice' :
          documentType === 'scomet' ? '/invoice/upload-scomet' :
          documentType === 'packinglist' ? '/invoice/upload-packinglist' :
          documentType === 'fumigation' ? '/invoice/upload-fumigation-certificate' :
          documentType === 'exportdeclaration' ? '/invoice/upload-export-declaration' :
          '/invoice/upload-airway-bill'

        const response = await fetch(`${API_BASE}${endpoint}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
          body: formData,
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Upload failed')
        }

        if (!result.success) {
          throw new Error(result.message || 'Processing failed')
        }

        const extractedData = result.validation?.extractedData || {}
        let processedData: any = {}

        if (documentType === 'invoice') {
          processedData = {
            invoiceId: result.invoiceId || `inv_${Date.now()}`,
            invoice_no: extractedData.invoiceNo || null,
            invoice_date: extractedData.date || null,
            reference_no: extractedData.referenceNo || null,
            proforma_invoice_no: extractedData.proformaInvoiceNo || null,
            marks_and_nos: extractedData.marksandnos || null,
            currency: extractedData.currency || null,
            total_amount: extractedData.totalAmount || null,
            item_count: extractedData.itemCount || 0,
            
            consignee_name: extractedData.consignee?.name || null,
            consignee_address: extractedData.consignee?.address || null,
            consignee_email: extractedData.consignee?.email || null,
            consignee_phone: extractedData.consignee?.phone || null,
            consignee_country: extractedData.consignee?.country || null,
            
            exporter_name: extractedData.exporter?.name || null,
            exporter_address: extractedData.exporter?.address || null,
            exporter_email: extractedData.exporter?.email || null,
            exporter_phone: extractedData.exporter?.phone || null,
            exporter_pan: extractedData.exporter?.pan || null,
            exporter_gstin: extractedData.exporter?.gstin || null,
            exporter_iec: extractedData.exporter?.iec || null,
            
            incoterms: extractedData.shipmentDetails?.incoterms || null,
            place_of_receipt: extractedData.shipmentDetails?.placeOfReceipt || null,
            port_of_loading: extractedData.shipmentDetails?.portOfLoading || null,
            port_of_discharge: extractedData.shipmentDetails?.portOfDischarge || null,
            final_destination: extractedData.shipmentDetails?.finalDestination || null,
            country_of_origin: extractedData.shipmentDetails?.countryOfOrigin || null,
            country_of_destination: extractedData.shipmentDetails?.countryOfDestination || null,
            hsn_code: extractedData.shipmentDetails?.hsnCode || null,
            
            bank_name: extractedData.bankDetails?.bankName || null,
            bank_account: extractedData.bankDetails?.usdAccount || null,
            bank_swift_code: extractedData.bankDetails?.swiftCode || null,
            bank_ifsc_code: extractedData.bankDetails?.ifscCode || null,
            payment_terms: extractedData.paymentTerms || null,
            
            has_signature: extractedData.signature || false,
            verification_status: result.validation?.isValid ? 'verified' : 'pending',
            completeness: result.validation?.completeness || 0,
            validation_errors: result.validation?.errors || [],
            validation_warnings: result.validation?.warnings || [],
            
            items: extractedData.items || [],
            
            fileUrl: result.fileUrl || URL.createObjectURL(file),
            filename: file.name
          }
        } else if (documentType === 'scomet') {
          processedData = {
            declarationId: result.declarationId || `scomet_${Date.now()}`,
            documentDate: extractedData.documentDate || null,
            documentType: extractedData.documentType || 'SCOMET Declaration',
            consigneeName: extractedData.consigneeName || null,
            invoiceNumber: extractedData.invoiceNumber || null,
            invoiceDate: extractedData.invoiceDate || null,
            destinationCountry: extractedData.destinationCountry || null,
            scometCoverage: extractedData.scometCoverage !== null && extractedData.scometCoverage !== undefined 
              ? extractedData.scometCoverage 
              : null,
            hsCode: extractedData.hsCode || null,
            goodsDescription: extractedData.goodsDescription || null,
            declarationStatement: extractedData.declarationStatement || null,
            signedStatus: extractedData.signedStatus || false,
            signatoryName: extractedData.signatoryName || null,
            is_valid: result.validation?.isValid || false,
            completeness: result.validation?.completeness || 0,
            validation_errors: result.validation?.errors || [],
            validation_warnings: result.validation?.warnings || [],
            fileUrl: result.fileUrl || URL.createObjectURL(file),
            filename: file.name
          }
          
          // Server-side validation with commercial invoice
          if (documents.currentInvoice) {
            const validationResult = await validateWithCommercialInvoice(
              documents.currentInvoice.invoice_no,
              processedData,
              'scomet'
            )
            
            if (validationResult) {
              processedData = {
                ...processedData,
                invoiceMatchVerified: validationResult.invoiceMatchVerified,
                validationDetails: validationResult.validationDetails,
                validation_errors: [...processedData.validation_errors, ...validationResult.validation_errors],
                validation_warnings: [...processedData.validation_warnings, ...validationResult.validation_warnings]
              }
            }
          }
          
          setSkippedSteps(prev => {
            const newSkipped = new Set(prev)
            newSkipped.delete(1)
            return newSkipped
          })
        } else if (documentType === 'packinglist') {
          processedData = {
            packingListId: result.packingListId || `pl_${Date.now()}`,
            
            packingListNumber: extractedData.packingListNumber || null,
            packingListDate: extractedData.packingListDate || null,
            referenceNo: extractedData.referenceNo || null,
            proformaInvoiceNo: extractedData.proformaInvoiceNo || null,
            invoiceNumber: extractedData.invoiceNumber || null,
            invoiceDate: extractedData.invoiceDate || null,
            
            exporterName: extractedData.exporter?.name || null,
            exporterAddress: extractedData.exporter?.address || null,
            exporterEmail: extractedData.exporter?.email || null,
            exporterPhone: extractedData.exporter?.phone || null,
            exporterMobile: extractedData.exporter?.mobile || null,
            exporterPan: extractedData.exporter?.pan || null,
            exporterGstin: extractedData.exporter?.gstin || null,
            exporterIec: extractedData.exporter?.iec || null,
            
            consigneeName: extractedData.consignee?.name || null,
            consigneeAddress: extractedData.consignee?.address || null,
            consigneeEmail: extractedData.consignee?.email || null,
            consigneePhone: extractedData.consignee?.phone || null,
            consigneeMobile: extractedData.consignee?.mobile || null,
            consigneePoBox: extractedData.consignee?.poBox || null,
            
            bankName: extractedData.bankDetails?.bankName || null,
            bankAddress: extractedData.bankDetails?.bankAddress || null,
            bankAccountUsd: extractedData.bankDetails?.usdAccount || null,
            bankAccountEuro: extractedData.bankDetails?.euroAccount || null,
            bankIfscCode: extractedData.bankDetails?.ifscCode || null,
            bankSwiftCode: extractedData.bankDetails?.swiftCode || null,
            bankBranchCode: extractedData.bankDetails?.branchCode || null,
            bankAdCode: extractedData.bankDetails?.adCode || null,
            bankBsrCode: extractedData.bankDetails?.bsrCode || null,
            
            marksAndNos: extractedData.marksAndNos || null,
            countryOfOrigin: extractedData.shipmentDetails?.countryOfOrigin || null,
            countryOfDestination: extractedData.shipmentDetails?.countryOfDestination || null,
            preCarriageBy: extractedData.shipmentDetails?.preCarriageBy || null,
            placeOfReceipt: extractedData.shipmentDetails?.placeOfReceipt || null,
            deliveryTerms: extractedData.shipmentDetails?.deliveryTerms || null,
            hsnCode: extractedData.shipmentDetails?.hsnCode || null,
            vesselFlightNo: extractedData.shipmentDetails?.vesselFlightNo || null,
            portOfLoading: extractedData.shipmentDetails?.portOfLoading || null,
            portOfDischarge: extractedData.shipmentDetails?.portOfDischarge || null,
            finalDestination: extractedData.shipmentDetails?.finalDestination || null,
            freightTerms: extractedData.shipmentDetails?.freightTerms || null,
            
            boxDetails: extractedData.boxDetails || [],
            totalBoxes: extractedData.totalBoxes || 0,
            totalGrossWeight: extractedData.totalGrossWeight || null,
            totalNetWeight: extractedData.totalNetWeight || null,
            totalBoxWeight: extractedData.totalBoxWeight || null,
            packageType: extractedData.packageType || null,
            
            descriptionOfGoods: extractedData.descriptionOfGoods || null,
            certificationStatement: extractedData.certificationStatement || null,
            
            is_valid: result.validation?.isValid || false,
            completeness: result.validation?.completeness || 0,
            validation_errors: result.validation?.errors || [],
            validation_warnings: result.validation?.warnings || [],
            invoiceMatchVerified: result.validation?.invoiceMatchVerified || false,
            amountsMatchVerified: result.validation?.amountsMatchVerified || false,
            
            fileUrl: result.fileUrl || URL.createObjectURL(file),
            filename: file.name
          }
          
          // Server-side validation with commercial invoice
          if (documents.currentInvoice) {
            const validationResult = await validateWithCommercialInvoice(
              documents.currentInvoice.invoice_no,
              processedData,
              'packinglist'
            )
            
            if (validationResult) {
              processedData = {
                ...processedData,
                invoiceMatchVerified: validationResult.invoiceMatchVerified,
                amountsMatchVerified: validationResult.amountsMatchVerified,
                validationDetails: validationResult.validationDetails,
                validation_errors: [...processedData.validation_errors, ...validationResult.validation_errors],
                validation_warnings: [...processedData.validation_warnings, ...validationResult.validation_warnings]
              }
            }
          }
          
          setSkippedSteps(prev => {
            const newSkipped = new Set(prev)
            newSkipped.delete(2)
            return newSkipped
          })
        } else if (documentType === 'fumigation') {
          processedData = {
            fumigationCertificateId: result.certificateId || `fum_${Date.now()}`,
            
            certificateNumber: extractedData.certificateNumber || null,
            certificateDate: extractedData.certificateDate || null,
            dppqsRegistrationNumber: extractedData.dppqsRegistrationNumber || null,
            
            fumigantName: extractedData.fumigantName || null,
            fumigationDate: extractedData.fumigationDate || null,
            invoiceDateFumigationCertificate:extractedData.invoice_date_fumigation_certificate||null,
            invoiceNoFumigationCertificate:extractedData.invoice_no_fumigation_certificate||null,

            fumigationPlace: extractedData.fumigationPlace || null,
            fumigantDosage: extractedData.fumigantDosage || null,
            fumigationDuration: extractedData.fumigationDuration || null,
            minimumTemperature: extractedData.minimumTemperature || null,
            gastightSheets: extractedData.gastightSheets !== null && extractedData.gastightSheets !== undefined 
              ? extractedData.gastightSheets 
              : null,
            pressureDecayValue: extractedData.pressureDecayValue || null,
            
            containerNumber: extractedData.containerNumber || null,
            sealNumber: extractedData.sealNumber || null,
            exporterName: extractedData.exporterName || null,
            exporterAddress: extractedData.exporterAddress || null,
            consigneeName: extractedData.consigneeName || null,
            cargoType: extractedData.cargoType || null,
            cargoDescription: extractedData.cargoDescription || null,
            quantity: extractedData.quantity || null,
            packagingMaterial: extractedData.packagingMaterial || null,
            additionalDeclaration: extractedData.additionalDeclaration || null,
            shippingMark: extractedData.shippingMark || null,
            
            invoiceNumber: extractedData.invoiceNumber || null,
            invoiceDate: extractedData.invoiceDate || null,
            
            operatorName: extractedData.operatorName || null,
            operatorSignatureStatus: extractedData.operatorSignatureStatus !== null && extractedData.operatorSignatureStatus !== undefined 
              ? extractedData.operatorSignatureStatus 
              : null,
            accreditationNumber: extractedData.accreditationNumber || null,
            
            is_valid: result.validation?.isValid || false,
            completeness: result.validation?.completeness || 0,
            validation_errors: result.validation?.errors || [],
            validation_warnings: result.validation?.warnings || [],
            invoiceMatchVerified: result.validation?.invoiceMatchVerified || false,
            
            fileUrl: result.fileUrl || URL.createObjectURL(file),
            filename: file.name
          }
          
          // Server-side validation with commercial invoice
          if (documents.currentInvoice) {
            const validationResult = await validateWithCommercialInvoice(
              documents.currentInvoice.invoice_no,
              {
                invoiceNumber: processedData.invoiceNumber,
                invoiceDate: processedData.invoiceDate,
                shippingMark: processedData.shippingMark,
                exporterName: processedData.exporterName,
                consigneeName: processedData.consigneeName,
              },
              'fumigation'
            )
            
            if (validationResult) {
              processedData = {
                ...processedData,
                invoiceMatchVerified: validationResult.invoiceMatchVerified,
                validationDetails: validationResult.validationDetails,
                validation_errors: [...processedData.validation_errors, ...validationResult.validation_errors],
                validation_warnings: [...processedData.validation_warnings, ...validationResult.validation_warnings]
              }
            }
          }
          
          setSkippedSteps(prev => {
            const newSkipped = new Set(prev)
            newSkipped.delete(3)
            return newSkipped
          })
        } else if (documentType === 'exportdeclaration') {
          processedData = {
            declarationId: result.declarationId || `exp_${Date.now()}`,
            
            documentType: extractedData.documentType || 'Export Value Declaration',
            
            invoiceNo: extractedData.invoiceNo || null,
            invoiceDate: extractedData.invoiceDate || null,
            shippingBillNo: extractedData.shippingBillNo || null,
            shippingBillDate: extractedData.shippingBillDate || null,
            
            valuationMethod: extractedData.valuationMethod || null,
            sellerBuyerRelated: extractedData.sellerBuyerRelated !== null && extractedData.sellerBuyerRelated !== undefined 
              ? extractedData.sellerBuyerRelated 
              : null,
            relationshipInfluencedPrice: extractedData.relationshipInfluencedPrice !== null && extractedData.relationshipInfluencedPrice !== undefined 
              ? extractedData.relationshipInfluencedPrice 
              : null,
            applicableRule: extractedData.applicableRule || null,
            
            paymentTerms: extractedData.paymentTerms || null,
            deliveryTerms: extractedData.deliveryTerms || null,
            typeOfSale: extractedData.typeOfSale || null,
            
            declarationStatus: extractedData.declarationStatus || null,
            signedBy: extractedData.signedBy || null,
            signedDate: extractedData.signedDate || null,
            declarationNumber: extractedData.declarationNumber || null,
            
            is_valid: result.validation?.isValid || false,
            completeness: result.validation?.completeness || 0,
            validation_errors: result.validation?.errors || [],
            validation_warnings: result.validation?.warnings || [],
            invoiceMatchVerified: result.validation?.invoiceMatchVerified || false,
            
            fileUrl: result.fileUrl || URL.createObjectURL(file),
            filename: file.name
          }
          
          // Server-side validation with commercial invoice
          if (documents.currentInvoice) {
            const validationResult = await validateWithCommercialInvoice(
              documents.currentInvoice.invoice_no,
              {
                invoiceNo: processedData.invoiceNo,
                invoiceDate: processedData.invoiceDate,
                shippingBillNo: processedData.shippingBillNo,
                shippingBillDate: processedData.shippingBillDate,
                paymentTerms: processedData.paymentTerms,
              },
              'exportdeclaration'
            )
            
            if (validationResult) {
              processedData = {
                ...processedData,
                invoiceMatchVerified: validationResult.invoiceMatchVerified,
                validationDetails: validationResult.validationDetails,
                validation_errors: [...processedData.validation_errors, ...validationResult.validation_errors],
                validation_warnings: [...processedData.validation_warnings, ...validationResult.validation_warnings]
              }
            }
          }
          
          setSkippedSteps(prev => {
            const newSkipped = new Set(prev)
            newSkipped.delete(4)
            return newSkipped
          })
        } else if (documentType === 'airwaybill') {
          processedData = {
            airway_bill_id: result.airwayBillId || `awb_${Date.now()}`,
            
            document_type: extractedData.documentType || 'Air Waybill',
            airway_bill_no: extractedData.airwayBillNo || null,
            invoice_no: extractedData.invoiceNo || null,
            invoice_date: extractedData.invoiceDate || null,
            
            shippers_name: extractedData.shippersName || null,
            shippers_address: extractedData.shippersAddress || null,
            
            consignees_name: extractedData.consigneesName || null,
            consignees_address: extractedData.consigneesAddress || null,
            
            issuing_carriers_name: extractedData.issuingCarriersName || null,
            issuing_carriers_city: extractedData.issuingCarriersCity || null,
            agents_iata_code: extractedData.agentsIataCode || null,
            
            airport_of_departure: extractedData.airportOfDeparture || null,
            airport_of_destination: extractedData.airportOfDestination || null,
            accounting_information: extractedData.accountingInformation || null,
            
            hs_code_no: extractedData.hsCodeNo || null,
            no_of_pieces: extractedData.noOfPieces || null,
            gross_weight: extractedData.grossWeight || null,
            chargeable_weight: extractedData.chargeableWeight || null,
            nature_of_goods: extractedData.natureOfGoods || null,
            
            is_valid: result.validation?.isValid || false,
            completeness: result.validation?.completeness || 0,
            validation_errors: result.validation?.errors || [],
            validation_warnings: result.validation?.warnings || [],
            invoiceMatchVerified: result.validation?.invoiceMatchVerified || false,
            
            fileUrl: result.fileUrl || URL.createObjectURL(file),
            filename: file.name
          }
          
          // Server-side validation with commercial invoice
          if (documents.currentInvoice) {
            const validationResult = await validateWithCommercialInvoice(
              documents.currentInvoice.invoice_no,
              {
                invoice_no: processedData.invoice_no,
                invoice_date: processedData.invoice_date,
                shippers_name: processedData.shippers_name,
                shippers_address: processedData.shippers_address,
                consignees_name: processedData.consignees_name,
                consignees_address: processedData.consignees_address,
                issuing_carriers_name: processedData.issuing_carriers_name,
                issuing_carriers_city: processedData.issuing_carriers_city,
                hs_code_no: processedData.hs_code_no,
              },
              'airwaybill'
            )
            
            if (validationResult) {
              processedData = {
                ...processedData,
                invoiceMatchVerified: validationResult.invoiceMatchVerified,
                validationDetails: validationResult.validationDetails,
                validation_errors: [...processedData.validation_errors, ...validationResult.validation_errors],
                validation_warnings: [...processedData.validation_warnings, ...validationResult.validation_warnings]
              }
            }
          }
          
          setSkippedSteps(prev => {
            const newSkipped = new Set(prev)
            newSkipped.delete(5)
            return newSkipped
          })
        }

        setDocument(processedData)
        setUploading(false)
        
        // Clear the file input to allow re-upload of same file if needed
        if (event.target) {
          event.target.value = ''
        }
        
        // Clear retry count on success
        setUploadRetryCount(prev => {
          const newCounts = { ...prev }
          delete newCounts[documentType]
          return newCounts
        })
        
        snackbar.showSnackbar(result.message || "Document processed successfully!", "success")
      } catch (error: any) {
        setUploading(false)
        const errorMessage = error.message || "Upload failed"
        snackbar.showSnackbar(errorMessage, "error")
        
        // Store the error for this document type to show retry option
        setUploadErrors(prev => ({
          ...prev,
          [documentType]: errorMessage
        }))
        
        // Clear the file input to allow retry
        if (event.target) {
          event.target.value = ''
        }
      }
    }
  }

  // ========== COMMERCIAL INVOICE UPDATE ==========
  const handleUpdateInvoice = async () => {
    if (!documents.currentInvoice || !auth.token || !auth.user) {
      snackbar.showSnackbar("Missing required data", "error")
      return
    }

    documents.setInvoiceUpdating(true)
    try {
      // Validate userId for admin editing
      let effectiveUserId: string
      try {
        effectiveUserId = validateUserIdForUpdate()
      } catch (error: any) {
        snackbar.showSnackbar(error.message || 'User ID validation failed', 'error')
        documents.setInvoiceUpdating(false)
        return
      }
      const updateData = {
        invoice_no: documents.currentInvoice.invoice_no,
        invoice_date: documents.currentInvoice.invoice_date,
        reference_no: documents.currentInvoice.reference_no,
        proforma_invoice_no: documents.currentInvoice.proforma_invoice_no,
        marks_and_nos: documents.currentInvoice.marks_and_nos,
        currency: documents.currentInvoice.currency,
        total_amount: documents.currentInvoice.total_amount,
        item_count: documents.currentInvoice.item_count,
        
        consignee_name: documents.currentInvoice.consignee_name,
        consignee_address: documents.currentInvoice.consignee_address,
        consignee_email: documents.currentInvoice.consignee_email,
        consignee_phone: documents.currentInvoice.consignee_phone,
        consignee_country: documents.currentInvoice.consignee_country,
        
        exporter_name: documents.currentInvoice.exporter_name,
        exporter_address: documents.currentInvoice.exporter_address,
        exporter_email: documents.currentInvoice.exporter_email,
        exporter_phone: documents.currentInvoice.exporter_phone,
        exporter_pan: documents.currentInvoice.exporter_pan,
        exporter_gstin: documents.currentInvoice.exporter_gstin,
        exporter_iec: documents.currentInvoice.exporter_iec,
        
        incoterms: documents.currentInvoice.incoterms,
        place_of_receipt: documents.currentInvoice.place_of_receipt,
        port_of_loading: documents.currentInvoice.port_of_loading,
        port_of_discharge: documents.currentInvoice.port_of_discharge,
        final_destination: documents.currentInvoice.final_destination,
        country_of_origin: documents.currentInvoice.country_of_origin,
        country_of_destination: documents.currentInvoice.country_of_destination,
        hsn_code: documents.currentInvoice.hsn_code,
        
        bank_name: documents.currentInvoice.bank_name,
        bank_account: documents.currentInvoice.bank_account,
        bank_swift_code: documents.currentInvoice.bank_swift_code,
        bank_ifsc_code: documents.currentInvoice.bank_ifsc_code,
        payment_terms: documents.currentInvoice.payment_terms,
        
        has_signature: documents.currentInvoice.has_signature,
        verification_status: documents.currentInvoice.verification_status,
        
        items: documents.currentInvoice.items,
        
        is_valid: documents.currentInvoice.is_valid,
        completeness: documents.currentInvoice.completeness,
        validation_errors: documents.currentInvoice.validation_errors,
        validation_warnings: documents.currentInvoice.validation_warnings,
      }

      const response = await fetch(`${API_BASE}/invoice/update/commercial-invoice`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
        invoiceNo: documents.currentInvoice.invoice_no, // Changed from invoiceId to invoiceNo
          userId: effectiveUserId, // Use validated effective userId
          updateData: updateData,
          updateReason: adminMode ? 'Admin edited data' : 'User edited data in review step'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Update failed')
      }

      if (!result.success) {
        throw new Error(result.error || result.details || 'Update failed')
      }

      const updatedInvoicePayload = result.data || null
      let invoiceForValidation = documents.currentInvoice

      if (updatedInvoicePayload) {
        invoiceForValidation = {
          ...(documents.currentInvoice || {}),
          ...updatedInvoicePayload,
          items: updatedInvoicePayload.items ?? documents.currentInvoice?.items ?? [],
          validation_errors: updatedInvoicePayload.validation_errors ?? documents.currentInvoice?.validation_errors ?? [],
          validation_warnings: updatedInvoicePayload.validation_warnings ?? documents.currentInvoice?.validation_warnings ?? []
        }

        documents.setCurrentInvoice(invoiceForValidation)
      }
      
      documents.setEditInvoiceMode(false)

      await validateAllDocumentsWithCommercialInvoice(
        invoiceForValidation?.invoice_no || documents.currentInvoice.invoice_no,
        undefined,
        { showToast: false }
      )
      
      snackbar.showSnackbar(result.message || 'Commercial invoice updated successfully and all documents revalidated!', 'success')
    } catch (error: any) {
      console.error('Invoice update error:', error)
      snackbar.showSnackbar(error.message || 'Update failed', 'error')
    } finally {
      documents.setInvoiceUpdating(false)
    }
  }

  const handleUpdateInvoiceField = (field: string, value: any) => {
    if (documents.currentInvoice) {
      documents.setCurrentInvoice({
        ...documents.currentInvoice,
        [field]: value
      })
    }
  }

  const handleUpdateInvoiceItem = (index: number, field: string, value: any) => {
    if (documents.currentInvoice?.items) {
      const updatedItems = [...documents.currentInvoice.items]
      updatedItems[index] = { ...updatedItems[index], [field]: value }
      
      // Auto-calculate totalPrice if quantity or unitPrice changes
      if (field === 'quantity' || field === 'unitPrice') {
        const item = updatedItems[index]
        updatedItems[index].totalPrice = (item.quantity || 0) * (item.unitPrice || 0)
      }
      
      documents.setCurrentInvoice({
        ...documents.currentInvoice,
        items: updatedItems,
        item_count: updatedItems.length
      })
    }
  }

  const handleRemoveInvoiceItem = (index: number) => {
    if (documents.currentInvoice?.items) {
      const updatedItems = documents.currentInvoice.items.filter((_, i) => i !== index)
      documents.setCurrentInvoice({
        ...documents.currentInvoice,
        items: updatedItems,
        item_count: updatedItems.length
      })
    }
  }

  const handleAddInvoiceItem = () => {
    if (documents.currentInvoice) {
      const newItem = {
        description: "",
        quantity: 1,
        unit: "pcs",
        unitPrice: 0,
        totalPrice: 0,
        hsCode: ""
      }
      const updatedItems = [...(documents.currentInvoice.items || []), newItem]
      documents.setCurrentInvoice({
        ...documents.currentInvoice,
        items: updatedItems,
        item_count: updatedItems.length
      })
    }
  }

  // ========== SCOMET UPDATE ==========
  const handleUpdateSCOMET = async () => {
    if (!documents.currentSCOMET || !auth.token || !auth.user) {
      snackbar.showSnackbar("Missing required data", "error")
      return
    }

    documents.setSCOMETUpdating(true)
    try {
      // Validate userId for admin editing
      let effectiveUserId: string
      try {
        effectiveUserId = validateUserIdForUpdate()
      } catch (error: any) {
        snackbar.showSnackbar(error.message || 'User ID validation failed', 'error')
        documents.setSCOMETUpdating(false)
        return
      }
      const updateData = {
        document_date: documents.currentSCOMET.documentDate,
        document_type: documents.currentSCOMET.documentType,
        consignee_name: documents.currentSCOMET.consigneeName,
        invoice_number: documents.currentSCOMET.invoiceNumber,
        invoice_date: documents.currentSCOMET.invoiceDate,
        destination_country: documents.currentSCOMET.destinationCountry,
        scomet_coverage: documents.currentSCOMET.scometCoverage,
        hs_code: documents.currentSCOMET.hsCode,
        goods_description: documents.currentSCOMET.goodsDescription,
        declaration_statement: documents.currentSCOMET.declarationStatement,
        signed_status: documents.currentSCOMET.signedStatus,
        signatory_name: documents.currentSCOMET.signatoryName,
        is_valid: documents.currentSCOMET.is_valid,
        completeness: documents.currentSCOMET.completeness,
        validation_errors: documents.currentSCOMET.validation_errors,
        validation_warnings: documents.currentSCOMET.validation_warnings,
      }

      const response = await fetch(`${API_BASE}/invoice/update/scomet`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          scometId: documents.currentSCOMET.declarationId,
          userId: effectiveUserId, // Use validated effective userId
          updateData: updateData,
          updateReason: adminMode ? 'Admin edited data' : 'User edited data in review step'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Update failed')
      }

      if (!result.success) {
        throw new Error(result.error || result.details || 'Update failed')
      }

      // Revalidate with commercial invoice using server-side validation
      if (documents.currentInvoice) {
        const validationResult = await validateWithCommercialInvoice(
          documents.currentInvoice.invoice_no,
          documents.currentSCOMET,
          'scomet'
        )
        
        if (validationResult) {
          documents.setCurrentSCOMET({
            ...documents.currentSCOMET,
            invoiceMatchVerified: validationResult.invoiceMatchVerified,
            validationDetails: validationResult.validationDetails,
            validation_warnings: validationResult.validation_warnings
          })
        }
      }
      
      documents.setEditSCOMETMode(false)
      
      const validationMessage = documents.currentSCOMET.invoiceMatchVerified 
        ? 'SCOMET declaration updated and validated successfully with Commercial Invoice!' 
        : 'SCOMET declaration updated with validation warnings!'

      snackbar.showSnackbar(validationMessage, documents.currentSCOMET.invoiceMatchVerified ? 'success' : 'warning')
    } catch (error: any) {
      console.error('SCOMET update error:', error)
      snackbar.showSnackbar(error.message || 'Update failed', 'error')
    } finally {
      documents.setSCOMETUpdating(false)
    }
  }

  const handleUpdateSCOMETField = (field: string, value: any) => {
    if (documents.currentSCOMET) {
      documents.setCurrentSCOMET({
        ...documents.currentSCOMET,
        [field]: value
      })
    }
  }

  // ========== PACKING LIST UPDATE ==========
  const handleUpdatePackingList = async () => {
    if (!documents.currentPackingList || !auth.token || !auth.user) {
      snackbar.showSnackbar("Missing required data", "error")
      return
    }

    documents.setPackingListUpdating(true)
    try {
      // Validate userId for admin editing
      let effectiveUserId: string
      try {
        effectiveUserId = validateUserIdForUpdate()
      } catch (error: any) {
        snackbar.showSnackbar(error.message || 'User ID validation failed', 'error')
        documents.setPackingListUpdating(false)
        return
      }
      const formatDate = (dateValue: any): string | undefined => {
        if (!dateValue) return undefined;
        try {
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return undefined;
          return date.toISOString().split('T')[0];
        } catch {
          return undefined;
        }
      };

      const updateData = {
        packing_list_number: documents.currentPackingList.packingListNumber,
        packing_list_date: formatDate(documents.currentPackingList.packingListDate),
        reference_no: documents.currentPackingList.referenceNo,
        proforma_invoice_no: documents.currentPackingList.proformaInvoiceNo,
        exporter_name: documents.currentPackingList.exporterName,
        exporter_address: documents.currentPackingList.exporterAddress,
        exporter_email: documents.currentPackingList.exporterEmail,
        exporter_phone: documents.currentPackingList.exporterPhone,
        exporter_mobile: documents.currentPackingList.exporterMobile,
        exporter_pan: documents.currentPackingList.exporterPan,
        exporter_gstin: documents.currentPackingList.exporterGstin,
        exporter_iec: documents.currentPackingList.exporterIec,
        consignee_name: documents.currentPackingList.consigneeName,
        consignee_address: documents.currentPackingList.consigneeAddress,
        consignee_email: documents.currentPackingList.consigneeEmail,
        consignee_phone: documents.currentPackingList.consigneePhone,
        consignee_mobile: documents.currentPackingList.consigneeMobile,
        consignee_po_box: documents.currentPackingList.consigneePoBox,
        bank_name: documents.currentPackingList.bankName,
        bank_address: documents.currentPackingList.bankAddress,
        bank_account_usd: documents.currentPackingList.bankAccountUsd,
        bank_account_euro: documents.currentPackingList.bankAccountEuro,
        bank_ifsc_code: documents.currentPackingList.bankIfscCode,
        bank_swift_code: documents.currentPackingList.bankSwiftCode,
        bank_branch_code: documents.currentPackingList.bankBranchCode,
        bank_ad_code: documents.currentPackingList.bankAdCode,
        bank_bsr_code: documents.currentPackingList.bankBsrCode,
        marks_and_nos: documents.currentPackingList.marksAndNos,
        country_of_origin: documents.currentPackingList.countryOfOrigin,
        country_of_destination: documents.currentPackingList.countryOfDestination,
        pre_carriage_by: documents.currentPackingList.preCarriageBy,
        place_of_receipt: documents.currentPackingList.placeOfReceipt,
        delivery_terms: documents.currentPackingList.deliveryTerms,
        hsn_code: documents.currentPackingList.hsnCode,
        vessel_flight_no: documents.currentPackingList.vesselFlightNo,
        port_of_loading: documents.currentPackingList.portOfLoading,
        port_of_discharge: documents.currentPackingList.portOfDischarge,
        final_destination: documents.currentPackingList.finalDestination,
        freight_terms: documents.currentPackingList.freightTerms,
        invoice_number: documents.currentPackingList.invoiceNumber,
        invoice_date: formatDate(documents.currentPackingList.invoiceDate),
        box_details: documents.currentPackingList.boxDetails,
        total_boxes: documents.currentPackingList.totalBoxes,
        total_gross_weight: documents.currentPackingList.totalGrossWeight,
        total_net_weight: documents.currentPackingList.totalNetWeight,
        total_box_weight: documents.currentPackingList.totalBoxWeight,
        package_type: documents.currentPackingList.packageType,
        description_of_goods: documents.currentPackingList.descriptionOfGoods,
        certification_statement: documents.currentPackingList.certificationStatement,
        is_valid: documents.currentPackingList.is_valid,
        completeness: documents.currentPackingList.completeness,
        validation_errors: documents.currentPackingList.validation_errors,
        validation_warnings: documents.currentPackingList.validation_warnings,
        invoice_match_verified: documents.currentPackingList.invoiceMatchVerified,
        amounts_match_verified: documents.currentPackingList.amountsMatchVerified,
      }

      const response = await fetch(`${API_BASE}/invoice/update/packinglist`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          packingListId: documents.currentPackingList.packingListId,
          userId: effectiveUserId, // Use validated effective userId
          updateData: updateData,
          updateReason: adminMode ? 'Admin edited data' : 'User edited data in review step'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Update failed')
      }

      if (!result.success) {
        throw new Error(result.error || result.details || 'Update failed')
      }

      // Revalidate with commercial invoice using server-side validation
      if (documents.currentInvoice) {
        const validationResult = await validateWithCommercialInvoice(
          documents.currentInvoice.invoice_no,
          documents.currentPackingList,
          'packinglist'
        )
        
        if (validationResult) {
          documents.setCurrentPackingList({
            ...documents.currentPackingList,
            invoiceMatchVerified: validationResult.invoiceMatchVerified,
            amountsMatchVerified: validationResult.amountsMatchVerified,
            validationDetails: validationResult.validationDetails,
            validation_warnings: validationResult.validation_warnings
          })
        }
      }
      
      documents.setEditPackingListMode(false)
      
      const validationMessage = documents.currentPackingList.invoiceMatchVerified 
        ? 'Packing list updated and validated successfully with Commercial Invoice!' 
        : 'Packing list updated with validation warnings!'

      snackbar.showSnackbar(validationMessage, documents.currentPackingList.invoiceMatchVerified ? 'success' : 'warning')
    } catch (error: any) {
      console.error('Packing list update error:', error)
      snackbar.showSnackbar(error.message || 'Update failed', 'error')
    } finally {
      documents.setPackingListUpdating(false)
    }
  }

  const handleUpdatePackingListField = (field: string, value: any) => {
    if (documents.currentPackingList) {
      documents.setCurrentPackingList({
        ...documents.currentPackingList,
        [field]: value
      })
    }
  }

  const handleUpdatePackingListBox = (index: number, field: string, value: any) => {
    if (documents.currentPackingList?.boxDetails) {
      const updatedBoxes = [...documents.currentPackingList.boxDetails]
      updatedBoxes[index] = { ...updatedBoxes[index], [field]: value }
      documents.setCurrentPackingList({
        ...documents.currentPackingList,
        boxDetails: updatedBoxes
      })
    }
  }

  const handleRemovePackingListBox = (index: number) => {
    if (documents.currentPackingList?.boxDetails) {
      const updatedBoxes = documents.currentPackingList.boxDetails.filter((_, i) => i !== index)
      documents.setCurrentPackingList({
        ...documents.currentPackingList,
        boxDetails: updatedBoxes,
        totalBoxes: updatedBoxes.length
      })
    }
  }

  const handleAddPackingListBox = () => {
    if (documents.currentPackingList) {
      const newBox = {
        boxNumber: null,
        size: null,
        grossWeight: null,
        boxWeight: null,
        netWeight: null,
        contents: null
      }
      const updatedBoxes = [...(documents.currentPackingList.boxDetails || []), newBox]
      documents.setCurrentPackingList({
        ...documents.currentPackingList,
        boxDetails: updatedBoxes,
        totalBoxes: updatedBoxes.length
      })
    }
  }

  // ========== FUMIGATION UPDATE ==========
  const handleUpdateFumigation = async () => {
    if (!documents.currentFumigationCertificate || !auth.token || !auth.user) {
      snackbar.showSnackbar("Missing required data", "error")
      return
    }

    documents.setFumigationUpdating(true)
    try {
      // Validate userId for admin editing
      let effectiveUserId: string
      try {
        effectiveUserId = validateUserIdForUpdate()
      } catch (error: any) {
        snackbar.showSnackbar(error.message || 'User ID validation failed', 'error')
        documents.setFumigationUpdating(false)
        return
      }
      const updateData = {
        certificate_number: documents.currentFumigationCertificate.certificateNumber,
        certificate_date: documents.currentFumigationCertificate.certificateDate,
        dppqs_registration_number: documents.currentFumigationCertificate.dppqsRegistrationNumber,
        fumigant_name: documents.currentFumigationCertificate.fumigantName,

        fumigation_date: documents.currentFumigationCertificate.fumigationDate,
        fumigation_place: documents.currentFumigationCertificate.fumigationPlace,
        fumigant_dosage: documents.currentFumigationCertificate.fumigantDosage,
        fumigation_duration: documents.currentFumigationCertificate.fumigationDuration,
        minimum_temperature: documents.currentFumigationCertificate.minimumTemperature,
        gastight_sheets: documents.currentFumigationCertificate.gastightSheets,
        pressure_decay_value: documents.currentFumigationCertificate.pressureDecayValue,
        container_number: documents.currentFumigationCertificate.containerNumber,
        seal_number: documents.currentFumigationCertificate.sealNumber,
        exporter_name: documents.currentFumigationCertificate.exporterName,
        exporter_address: documents.currentFumigationCertificate.exporterAddress,
        consignee_name: documents.currentFumigationCertificate.consigneeName,
        cargo_type: documents.currentFumigationCertificate.cargoType,
        cargo_description: documents.currentFumigationCertificate.cargoDescription,
        quantity: documents.currentFumigationCertificate.quantity,
        packaging_material: documents.currentFumigationCertificate.packagingMaterial,
        additional_declaration: documents.currentFumigationCertificate.additionalDeclaration,
        shipping_mark: documents.currentFumigationCertificate.shippingMark,
        invoice_number: documents.currentFumigationCertificate.invoiceNumber,
        invoice_date: documents.currentFumigationCertificate.invoiceDate,
        operator_name: documents.currentFumigationCertificate.operatorName,
        operator_signature_status: documents.currentFumigationCertificate.operatorSignatureStatus,
        accreditation_number: documents.currentFumigationCertificate.accreditationNumber,
        is_valid: documents.currentFumigationCertificate.is_valid,
        completeness: documents.currentFumigationCertificate.completeness,
        validation_errors: documents.currentFumigationCertificate.validation_errors,
        validation_warnings: documents.currentFumigationCertificate.validation_warnings,
      }

      const response = await fetch(`${API_BASE}/invoice/update/fumigation-certificate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
certificateId: documents.currentFumigationCertificate.fumigationCertificateId || 
              (documents.currentFumigationCertificate as any).certificateId,
          userId: effectiveUserId, // Use validated effective userId
          updateData: updateData,
          updateReason: adminMode ? 'Admin edited data' : 'User edited data in review step'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Update failed')
      }

      if (!result.success) {
        throw new Error(result.error || result.details || 'Update failed')
      }

      // Revalidate with commercial invoice using server-side validation
      if (documents.currentInvoice) {
        const validationResult = await validateWithCommercialInvoice(
          documents.currentInvoice.invoice_no,
          {
            invoiceNumber: documents.currentFumigationCertificate.invoiceNumber,
            invoiceDate: documents.currentFumigationCertificate.invoiceDate,
            shippingMark: documents.currentFumigationCertificate.shippingMark,
            exporterName: documents.currentFumigationCertificate.exporterName,
            consigneeName: documents.currentFumigationCertificate.consigneeName,
          },
          'fumigation'
        )
        
        if (validationResult) {
          documents.setCurrentFumigationCertificate({
            ...documents.currentFumigationCertificate,
            invoiceMatchVerified: validationResult.invoiceMatchVerified,
            validationDetails: validationResult.validationDetails,
            validation_warnings: validationResult.validation_warnings
          })
        }
      }
      
      documents.setEditFumigationMode(false)
      
      const validationMessage = documents.currentFumigationCertificate.invoiceMatchVerified 
        ? 'Fumigation certificate updated and validated successfully with Commercial Invoice!' 
        : 'Fumigation certificate updated with validation warnings!'

      snackbar.showSnackbar(validationMessage, documents.currentFumigationCertificate.invoiceMatchVerified ? 'success' : 'warning')
    } catch (error: any) {
      console.error('Fumigation certificate update error:', error)
      snackbar.showSnackbar(error.message || 'Update failed', 'error')
    } finally {
      documents.setFumigationUpdating(false)
    }
  }

  const handleUpdateFumigationField = (field: string, value: any) => {
    if (documents.currentFumigationCertificate) {
      documents.setCurrentFumigationCertificate({
        ...documents.currentFumigationCertificate,
        [field]: value
      })
    }
  }

  // ========== EXPORT DECLARATION UPDATE ==========
  const handleUpdateExportDeclaration = async () => {
    if (!documents.currentExportDeclaration || !auth.token || !auth.user) {
      snackbar.showSnackbar("Missing required data", "error")
      return
    }

    documents.setExportDeclarationUpdating(true)
    try {
      // Validate userId for admin editing
      let effectiveUserId: string
      try {
        effectiveUserId = validateUserIdForUpdate()
      } catch (error: any) {
        snackbar.showSnackbar(error.message || 'User ID validation failed', 'error')
        documents.setExportDeclarationUpdating(false)
        return
      }
      const updateData = {
        document_type: documents.currentExportDeclaration.documentType,
        invoice_no: documents.currentExportDeclaration.invoiceNo,
        invoice_date: documents.currentExportDeclaration.invoiceDate,
        shipping_bill_no: documents.currentExportDeclaration.shippingBillNo,
        shipping_bill_date: documents.currentExportDeclaration.shippingBillDate,
        valuation_method: documents.currentExportDeclaration.valuationMethod,
        seller_buyer_related: documents.currentExportDeclaration.sellerBuyerRelated,
        relationship_influenced_price: documents.currentExportDeclaration.relationshipInfluencedPrice,
        applicable_rule: documents.currentExportDeclaration.applicableRule,
        payment_terms: documents.currentExportDeclaration.paymentTerms,
        delivery_terms: documents.currentExportDeclaration.deliveryTerms,
        type_of_sale: documents.currentExportDeclaration.typeOfSale,
        declaration_status: documents.currentExportDeclaration.declarationStatus,
        signed_by: documents.currentExportDeclaration.signedBy,
        signed_date: documents.currentExportDeclaration.signedDate,
        declaration_number: documents.currentExportDeclaration.declarationNumber,
        is_valid: documents.currentExportDeclaration.is_valid,
        completeness: documents.currentExportDeclaration.completeness,
        validation_errors: documents.currentExportDeclaration.validation_errors,
        validation_warnings: documents.currentExportDeclaration.validation_warnings,
      }

      const response = await fetch(`${API_BASE}/invoice/update/export-declaration`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          declarationId: documents.currentExportDeclaration.declarationId,
          userId: effectiveUserId, // Use validated effective userId
          updateData: updateData,
          updateReason: adminMode ? 'Admin edited data' : 'User edited data in review step'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Update failed')
      }

      if (!result.success) {
        throw new Error(result.error || result.details || 'Update failed')
      }

      // Revalidate with commercial invoice using server-side validation
      if (documents.currentInvoice) {
        const validationResult = await validateWithCommercialInvoice(
          documents.currentInvoice.invoice_no,
          {
            invoiceNo: documents.currentExportDeclaration.invoiceNo,
            invoiceDate: documents.currentExportDeclaration.invoiceDate,
            shippingBillNo: documents.currentExportDeclaration.shippingBillNo,
            shippingBillDate: documents.currentExportDeclaration.shippingBillDate,
            paymentTerms: documents.currentExportDeclaration.paymentTerms,
          },
          'exportdeclaration'
        )
        
        if (validationResult) {
          documents.setCurrentExportDeclaration({
            ...documents.currentExportDeclaration,
            invoiceMatchVerified: validationResult.invoiceMatchVerified,
            validationDetails: validationResult.validationDetails,
            validation_warnings: validationResult.validation_warnings
          })
        }
      }
      
      documents.setEditExportDeclarationMode(false)
      
      const validationMessage = documents.currentExportDeclaration.invoiceMatchVerified 
        ? 'Export declaration updated and validated successfully with Commercial Invoice!' 
        : 'Export declaration updated with validation warnings!'

      snackbar.showSnackbar(validationMessage, documents.currentExportDeclaration.invoiceMatchVerified ? 'success' : 'warning')
    } catch (error: any) {
      console.error('Export declaration update error:', error)
      snackbar.showSnackbar(error.message || 'Update failed', 'error')
    } finally {
      documents.setExportDeclarationUpdating(false)
    }
  }

  const handleUpdateExportDeclarationField = (field: string, value: any) => {
    if (documents.currentExportDeclaration) {
      documents.setCurrentExportDeclaration({
        ...documents.currentExportDeclaration,
        [field]: value
      })
    }
  }

  // ========== AIRWAY BILL UPDATE ==========
  const handleUpdateAirwayBill = async () => {
    if (!documents.currentAirwayBill || !auth.token || !auth.user) {
      snackbar.showSnackbar("Missing required data", "error")
      return
    }

    documents.setAirwayBillUpdating(true)
    try {
      // Validate userId for admin editing
      let effectiveUserId: string
      try {
        effectiveUserId = validateUserIdForUpdate()
        console.log('[Update AirwayBill] Effective userId:', effectiveUserId, {
          adminMode,
          selectedUserId,
          authUserId: auth.user?.userId
        })
      } catch (error: any) {
        console.error('[Update AirwayBill] Error validating userId:', error)
        snackbar.showSnackbar(error.message || 'User ID validation failed', 'error')
        documents.setAirwayBillUpdating(false)
        return
      }

      // Validate airway bill ID - check multiple possible property names
      const airwayBillId = documents.currentAirwayBill.airway_bill_id || 
                           documents.currentAirwayBill.id || 
                           (documents.currentAirwayBill as any).airwayBillId
      
      if (!airwayBillId) {
        console.error('[Update AirwayBill] Missing airway bill ID. Document:', documents.currentAirwayBill)
        snackbar.showSnackbar('Airway Bill ID is missing. Please refresh and try again.', 'error')
        documents.setAirwayBillUpdating(false)
        return
      }

      const updateData = {
        document_type: documents.currentAirwayBill.document_type,
        airway_bill_no: documents.currentAirwayBill.airway_bill_no,
        invoice_no: documents.currentAirwayBill.invoice_no,
        invoice_date: documents.currentAirwayBill.invoice_date,
        shippers_name: documents.currentAirwayBill.shippers_name,
        shippers_address: documents.currentAirwayBill.shippers_address,
        consignees_name: documents.currentAirwayBill.consignees_name,
        consignees_address: documents.currentAirwayBill.consignees_address,
        issuing_carriers_name: documents.currentAirwayBill.issuing_carriers_name,
        issuing_carriers_city: documents.currentAirwayBill.issuing_carriers_city,
        agents_iata_code: documents.currentAirwayBill.agents_iata_code,
        airport_of_departure: documents.currentAirwayBill.airport_of_departure,
        airport_of_destination: documents.currentAirwayBill.airport_of_destination,
        accounting_information: documents.currentAirwayBill.accounting_information,
        hs_code_no: documents.currentAirwayBill.hs_code_no,
        no_of_pieces: documents.currentAirwayBill.no_of_pieces,
        gross_weight: documents.currentAirwayBill.gross_weight,
        chargeable_weight: documents.currentAirwayBill.chargeable_weight,
        nature_of_goods: documents.currentAirwayBill.nature_of_goods,
        is_valid: documents.currentAirwayBill.is_valid,
        completeness: documents.currentAirwayBill.completeness,
        validation_errors: documents.currentAirwayBill.validation_errors,
        validation_warnings: documents.currentAirwayBill.validation_warnings,
      }

      const response = await fetch(`${API_BASE}/invoice/update/airway-bill`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          airwayBillId: airwayBillId,
          userId: effectiveUserId,
          updateData: updateData,
          updateReason: adminMode ? 'Admin edited data' : 'User edited data in review step'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Update failed')
      }

      if (!result.success) {
        throw new Error(result.error || result.details || 'Update failed')
      }

      // Revalidate with commercial invoice using server-side validation
      if (documents.currentInvoice) {
        const validationResult = await validateWithCommercialInvoice(
          documents.currentInvoice.invoice_no,
          {
            invoice_no: documents.currentAirwayBill.invoice_no,
            invoice_date: documents.currentAirwayBill.invoice_date,
            shippers_name: documents.currentAirwayBill.shippers_name,
            shippers_address: documents.currentAirwayBill.shippers_address,
            consignees_name: documents.currentAirwayBill.consignees_name,
            consignees_address: documents.currentAirwayBill.consignees_address,
            issuing_carriers_name: documents.currentAirwayBill.issuing_carriers_name,
            issuing_carriers_city: documents.currentAirwayBill.issuing_carriers_city,
            hs_code_no: documents.currentAirwayBill.hs_code_no,
          },
          'airwaybill'
        )
        
        if (validationResult) {
          documents.setCurrentAirwayBill({
            ...documents.currentAirwayBill,
            invoiceMatchVerified: validationResult.invoiceMatchVerified,
            validationDetails: validationResult.validationDetails,
            validation_warnings: validationResult.validation_warnings
          })
        }
      }
      
      documents.setEditAirwayBillMode(false)
      
      const validationMessage = documents.currentAirwayBill.invoiceMatchVerified 
        ? 'Airway bill updated and validated successfully with Commercial Invoice!' 
        : 'Airway bill updated with validation warnings!'

      snackbar.showSnackbar(validationMessage, documents.currentAirwayBill.invoiceMatchVerified ? 'success' : 'warning')
    } catch (error: any) {
      console.error('Airway bill update error:', error)
      snackbar.showSnackbar(error.message || 'Update failed', 'error')
    } finally {
      documents.setAirwayBillUpdating(false)
    }
  }

  const handleUpdateAirwayBillField = (field: string, value: any) => {
    if (documents.currentAirwayBill) {
      documents.setCurrentAirwayBill({
        ...documents.currentAirwayBill,
        [field]: value
      })
    }
  }

  // Function to reload documents
  const handleReloadDocuments = () => {
    setDocumentsLoaded(false)
    fetchUserDocuments()
  }

  // Export documents handler
  const handleExportDocuments = async () => {
    if (!auth.token || !auth.user) {
      snackbar.showSnackbar("Please login first", "warning")
      return
    }

    setExporting(true)
    try {
      const effectiveUserId = getEffectiveUserId()
      const isAdminViewingOtherUser = adminMode && selectedUserId && selectedUserId !== auth.user.userId
      const url = isAdminViewingOtherUser 
        ? `${API_BASE}/export/user-documents?userId=${effectiveUserId}`
        : `${API_BASE}/export/user-documents`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${auth.token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `user_documents_${effectiveUserId}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)

      snackbar.showSnackbar("Documents exported successfully", "success")
    } catch (error: any) {
      console.error('Export error:', error)
      snackbar.showSnackbar(error.message || "Export failed", "error")
    } finally {
      setExporting(false)
    }
  }
 
  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return !documents.currentInvoice ? (
          <UploadSection
            title="Commercial Invoice"
            description="Upload your commercial invoice PDF for AI-powered data extraction and validation"
            uploading={documents.invoiceUploading}
            inputRef={documents.invoiceInputRef as unknown as React.RefObject<HTMLInputElement>}
            onUpload={createUploadHandler('invoice')}
            onDelete={() => handleDeleteDocument('invoice')}
            icon={<Upload className="w-6 h-6" />}
            stepIndex={0}
            currentDocument={null}
            documentType="invoice"
            isPdfOpen={pdfViewerOpen.invoice}
            onTogglePdf={togglePdfViewer}
            token={auth.token}
            skippedSteps={skippedSteps}
            onSkipStep={handleSkipStep}
            onReloadDocuments={handleReloadDocuments}
            documentsLoaded={documentsLoaded}
            uploadError={uploadErrors.invoice}
            onClearError={() => clearUploadError('invoice')}
            uploadRetryCount={uploadRetryCount.invoice || 0}
            canEdit={canEdit}
          />
        ) : (
          <InvoiceReview
            currentInvoice={documents.currentInvoice}
            editInvoiceMode={documents.editInvoiceMode}
            invoiceUpdating={documents.invoiceUpdating}
            isPdfOpen={pdfViewerOpen.invoice}
            token={auth.token}
            onTogglePdf={togglePdfViewer}
            onSetEditMode={documents.setEditInvoiceMode}
            onUpdateInvoice={handleUpdateInvoice}
            onUpdateField={handleUpdateInvoiceField}
            onUpdateItem={handleUpdateInvoiceItem}
            onRemoveItem={handleRemoveInvoiceItem}
            onAddItem={handleAddInvoiceItem}
            onNextStep={handleNextStep}
            canEdit={canEdit}
            onDeleteDocument={() => handleDeleteDocument('invoice')}
          />
        )
      
      case 1:
        return !documents.currentSCOMET ? (
          <UploadSection
            title="SCOMET Declaration"
            description="Upload your SCOMET declaration for compliance verification"
            uploading={documents.scometUploading}
            inputRef={documents.scometInputRef as unknown as React.RefObject<HTMLInputElement>}
            onUpload={createUploadHandler('scomet')}
            onDelete={() => handleDeleteDocument('scomet')}
            icon={<Upload className="w-6 h-6" />}
            stepIndex={1}
            currentDocument={null}
            documentType="scomet"
            isPdfOpen={pdfViewerOpen.scomet}
            onTogglePdf={togglePdfViewer}
            token={auth.token}
            skippedSteps={skippedSteps}
            onSkipStep={handleSkipStep}
            onReloadDocuments={handleReloadDocuments}
            documentsLoaded={documentsLoaded}
            uploadError={uploadErrors.scomet}
            onClearError={() => clearUploadError('scomet')}
            uploadRetryCount={uploadRetryCount.scomet || 0}
            canEdit={canEdit}
          />
        ) : (
          <SCOMETReview
            currentSCOMET={documents.currentSCOMET}
            editSCOMETMode={documents.editSCOMETMode}
            scometUpdating={documents.scometUpdating}
            isPdfOpen={pdfViewerOpen.scomet}
            token={auth.token}
            onTogglePdf={togglePdfViewer}
            onSetEditMode={documents.setEditSCOMETMode}
            onUpdateSCOMET={handleUpdateSCOMET}
            onUpdateField={handleUpdateSCOMETField}
            onNextStep={handleNextStep}
            canEdit={canEdit}
            onDeleteDocument={() => handleDeleteDocument('scomet')}
          />
        )
      
      case 2:
        return !documents.currentPackingList ? (
          <UploadSection
            title="Packing List"
            description="Upload your packing list for cargo details verification"
            uploading={documents.packingListUploading}
            inputRef={documents.packingListInputRef as unknown as React.RefObject<HTMLInputElement>}
            onUpload={createUploadHandler('packinglist')}
            onDelete={() => handleDeleteDocument('packinglist')}
            icon={<Upload className="w-6 h-6" />}
            stepIndex={2}
            currentDocument={null}
            documentType="packinglist"
            isPdfOpen={pdfViewerOpen.packinglist}
            onTogglePdf={togglePdfViewer}
            token={auth.token}
            skippedSteps={skippedSteps}
            onSkipStep={handleSkipStep}
            onReloadDocuments={handleReloadDocuments}
            documentsLoaded={documentsLoaded}
            uploadError={uploadErrors.packinglist}
            onClearError={() => clearUploadError('packinglist')}
            uploadRetryCount={uploadRetryCount.packinglist || 0}
            canEdit={canEdit}
          />
        ) : (
          <PackingListReview
            currentPackingList={documents.currentPackingList}
            editPackingListMode={documents.editPackingListMode}
            packingListUpdating={documents.packingListUpdating}
            isPdfOpen={pdfViewerOpen.packinglist}
            token={auth.token}
            onTogglePdf={togglePdfViewer}
            onSetEditMode={documents.setEditPackingListMode}
            onUpdatePackingList={handleUpdatePackingList}
            onUpdateField={handleUpdatePackingListField}
            onUpdatePackingListBox={handleUpdatePackingListBox}
            onRemovePackingListBox={handleRemovePackingListBox}
            onAddPackingListBox={handleAddPackingListBox}
            onNextStep={handleNextStep}
            canEdit={canEdit}
            onDeleteDocument={() => handleDeleteDocument('packinglist')}
          />
        )
      
      case 3:
        return !documents.currentFumigationCertificate ? (
          <UploadSection
            title="Fumigation Certificate"
            description="Upload your fumigation certificate for compliance verification"
            uploading={documents.fumigationUploading}
            inputRef={documents.fumigationInputRef as unknown as React.RefObject<HTMLInputElement>}
            onUpload={createUploadHandler('fumigation')}
            onDelete={() => handleDeleteDocument('fumigation')}
            icon={<Upload className="w-6 h-6" />}
            stepIndex={3}
            currentDocument={null}
            documentType="fumigation"
            isPdfOpen={pdfViewerOpen.fumigation}
            onTogglePdf={togglePdfViewer}
            token={auth.token}
            skippedSteps={skippedSteps}
            onSkipStep={handleSkipStep}
            onReloadDocuments={handleReloadDocuments}
            documentsLoaded={documentsLoaded}
            uploadError={uploadErrors.fumigation}
            onClearError={() => clearUploadError('fumigation')}
            uploadRetryCount={uploadRetryCount.fumigation || 0}
            canEdit={canEdit}
          />
        ) : (
          <FumigationReview
            currentFumigation={documents.currentFumigationCertificate}
            editFumigationMode={documents.editFumigationMode}
            fumigationUpdating={documents.fumigationUpdating}
            isPdfOpen={pdfViewerOpen.fumigation}
            token={auth.token}
            onTogglePdf={togglePdfViewer}
            onSetEditMode={documents.setEditFumigationMode}
            onUpdateFumigation={handleUpdateFumigation}
            onUpdateField={handleUpdateFumigationField}
            onNextStep={handleNextStep}
            canEdit={canEdit}
            onDeleteDocument={() => handleDeleteDocument('fumigation')}
          />
        )
      
      case 4:
        return !documents.currentExportDeclaration ? (
          <UploadSection
            title="Export Value Declaration"
            description="Upload your export value declaration for customs valuation verification"
            uploading={documents.exportDeclarationUploading}
            inputRef={documents.exportDeclarationInputRef as unknown as React.RefObject<HTMLInputElement>}
            onUpload={createUploadHandler('exportdeclaration')}
            onDelete={() => handleDeleteDocument('exportdeclaration')}
            icon={<Upload className="w-6 h-6" />}
            stepIndex={4}
            currentDocument={null}
            documentType="exportdeclaration"
            isPdfOpen={pdfViewerOpen.exportdeclaration}
            onTogglePdf={togglePdfViewer}
            token={auth.token}
            skippedSteps={skippedSteps}
            onSkipStep={handleSkipStep}
            onReloadDocuments={handleReloadDocuments}
            documentsLoaded={documentsLoaded}
            uploadError={uploadErrors.exportdeclaration}
            onClearError={() => clearUploadError('exportdeclaration')}
            uploadRetryCount={uploadRetryCount.exportdeclaration || 0}
            canEdit={canEdit}
          />
        ) : (
          <ExportDeclarationReview
            currentExportDeclaration={documents.currentExportDeclaration}
            editExportDeclarationMode={documents.editExportDeclarationMode}
            exportDeclarationUpdating={documents.exportDeclarationUpdating}
            isPdfOpen={pdfViewerOpen.exportdeclaration}
            token={auth.token}
            onTogglePdf={togglePdfViewer}
            onSetEditMode={documents.setEditExportDeclarationMode}
            onUpdateExportDeclaration={handleUpdateExportDeclaration}
            onUpdateField={handleUpdateExportDeclarationField}
            onNextStep={handleNextStep}
            canEdit={canEdit}
            onDeleteDocument={() => handleDeleteDocument('exportdeclaration')}
          />
        )
      
      case 5:
        return !documents.currentAirwayBill ? (
          <UploadSection
            title="Air Waybill"
            description="Upload your air waybill for shipment tracking and verification"
            uploading={documents.airwayBillUploading}
            inputRef={documents.airwayBillInputRef as unknown as React.RefObject<HTMLInputElement>}
            onUpload={createUploadHandler('airwaybill')}
            onDelete={() => handleDeleteDocument('airwaybill')}
            icon={<Upload className="w-6 h-6" />}
            stepIndex={5}
            currentDocument={null}
            documentType="airwaybill"
            isPdfOpen={pdfViewerOpen.airwaybill}
            onTogglePdf={togglePdfViewer}
            token={auth.token}
            skippedSteps={skippedSteps}
            onSkipStep={handleSkipStep}
            onReloadDocuments={handleReloadDocuments}
            documentsLoaded={documentsLoaded}
            uploadError={uploadErrors.airwaybill}
            onClearError={() => clearUploadError('airwaybill')}
            uploadRetryCount={uploadRetryCount.airwaybill || 0}
            canEdit={canEdit}
          />
        ) : (
          <AirwayBillReview
            currentAirwayBill={documents.currentAirwayBill}
            editAirwayBillMode={documents.editAirwayBillMode}
            airwayBillUpdating={documents.airwayBillUpdating}
            isPdfOpen={pdfViewerOpen.airwaybill}
            token={auth.token}
            onTogglePdf={togglePdfViewer}
            onSetEditMode={documents.setEditAirwayBillMode}
            onUpdateAirwayBill={handleUpdateAirwayBill}
            onUpdateField={handleUpdateAirwayBillField}
            onNextStep={handleNextStep}
            canEdit={canEdit}
            onDeleteDocument={() => handleDeleteDocument('airwaybill')}
          />
        )
      
      default:
        return (
          <div className="h-full flex items-center justify-center">
            <div className="text-center p-8">
              <div className="w-24 h-24 bg-gradient-to-r from-teal-600 to-teal-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <Upload className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                Processing Complete! 🎉
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-lg mb-6 max-w-md">
                All your shipping documents have been processed and validated successfully.
              </p>
              
              {/* Summary of processed documents */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Documents Processed</h3>
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {documents.currentInvoice && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 rounded-full text-sm font-medium">
                      ✓ Commercial Invoice
                    </span>
                  )}
                  {documents.currentSCOMET && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium">
                      ✓ SCOMET Declaration
                    </span>
                  )}
                  {documents.currentPackingList && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium">
                      ✓ Packing List
                    </span>
                  )}
                  {documents.currentFumigationCertificate && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full text-sm font-medium">
                      ✓ Fumigation Certificate
                    </span>
                  )}
                  {documents.currentExportDeclaration && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-sm font-medium">
                      ✓ Export Declaration
                    </span>
                  )}
                  {documents.currentAirwayBill && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full text-sm font-medium">
                      ✓ Air Waybill
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    // Reset all documents
                    documents.setCurrentInvoice(null)
                    documents.setCurrentSCOMET(null)
                    documents.setCurrentPackingList(null)
                    documents.setCurrentFumigationCertificate(null)
                    documents.setCurrentExportDeclaration(null)
                    documents.setCurrentAirwayBill(null)
                    
                    // Reset edit modes
                    documents.setEditInvoiceMode(false)
                    documents.setEditSCOMETMode(false)
                    documents.setEditPackingListMode(false)
                    documents.setEditFumigationMode(false)
                    documents.setEditExportDeclarationMode(false)
                    documents.setEditAirwayBillMode(false)
                    
                    // Reset steps
                    setCurrentStep(0)
                    setCompletedSteps(new Set())
                    setSkippedSteps(new Set())
                    setDocumentsLoaded(false)
                    
                    snackbar.showSnackbar("Ready to process new documents", "info")
                  }}
                  className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Start Over
                </button>
                <button
                  onClick={handleExportDocuments}
                  disabled={exporting}
                  className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {exporting ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Export Documents
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
    }
  }

  // Calculate content padding based on banners
  const getContentPadding = () => {
    if (adminMode && selectedUserId) return 'pt-24' // Admin view mode banner
    if (!adminMode && showAdminNotice) return 'pt-20' // Admin notice
    return 'pt-4'
  }

  // Main render
  return (
    <div className={`min-h-screen w-full ${darkMode ? 'dark bg-slate-900' : 'bg-gradient-to-br from-slate-50 to-teal-50'}`}>
      <Header
        user={auth.user}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        setSidebarOpen={setSidebarOpen}
        onLogout={auth.logout}
        onAdminDashboard={handleGoToAdminDashboard}
        onUserDashboard={handleGoToUserDashboard}
        showAdminButton={auth.user?.role === 'admin'}
        isAdminView={adminMode && !selectedUserId}
        viewingUser={viewingUser}
      />

      {/* Fixed Banners - positioned below header */}
      {adminMode && selectedUserId && viewingUser && (
        <div className={`fixed top-14 left-0 right-0 z-30 border-b-2 ${darkMode ? 'border-purple-600 bg-gradient-to-r from-purple-900/95 to-purple-800/95' : 'border-purple-500 bg-gradient-to-r from-purple-50 to-purple-100'} shadow-lg`}>
          <div className="flex items-center justify-between max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-3 gap-2 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-purple-700/50' : 'bg-purple-200'}`}>
                <Shield className={`w-5 h-5 ${darkMode ? 'text-purple-300' : 'text-purple-700'}`} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                    Admin View Mode
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-purple-700/50 text-purple-200' : 'bg-purple-200 text-purple-800'}`}>
                    Viewing Member Dashboard
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 mt-1 flex-wrap">
                  <span className={`text-xs sm:text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Member:
                  </span>
                  <span className={`text-sm sm:text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'} truncate max-w-[150px] sm:max-w-none`}>
                    {viewingUser.name}
                  </span>
                  <span className={`text-xs sm:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'} hidden sm:inline`}>
                    ({viewingUser.userId})
                  </span>
                  {viewingUser.email && (
                    <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'} hidden md:inline truncate max-w-[200px]`}>
                      • {viewingUser.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleBackToAdmin}
              className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all hover:scale-105 flex-shrink-0 ${
                darkMode
                  ? 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg'
                  : 'bg-purple-600 text-white hover:bg-purple-700 shadow-md'
              }`}
            >
              <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Back to Admin Dashboard</span>
              <span className="sm:hidden">Back</span>
            </button>
          </div>
        </div>
      )}

      {!adminMode && showAdminNotice && memberAdminMessage?.message && (
        <div className={`fixed top-14 left-0 right-0 z-30 border-b ${darkMode ? 'border-amber-500 bg-amber-900/95' : 'border-amber-300 bg-amber-50'} shadow-md`}>
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-amber-900/60' : 'bg-amber-200'} mt-0.5`}>
                <MessageSquare className={`w-5 h-5 ${darkMode ? 'text-amber-200' : 'text-amber-700'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className={`text-sm font-semibold ${darkMode ? 'text-amber-100' : 'text-amber-800'}`}>
                    Admin Notice
                  </p>
                  {memberAdminMessage.createdAt && (
                    <p className={`text-xs ${darkMode ? 'text-amber-300/80' : 'text-amber-600/80'}`}>
                      {new Date(memberAdminMessage.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <p className={`text-sm ${darkMode ? 'text-amber-200' : 'text-amber-700'}`}>
                  {memberAdminMessage.message}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAdminNotice(false)}
              className={`p-1 rounded-full hover:bg-opacity-20 transition-colors ${
                darkMode ? 'hover:bg-amber-500 text-amber-300' : 'hover:bg-amber-400 text-amber-600'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!auth.user ? (
        <AuthDialog
          isLogin={auth.isLogin}
          authData={auth.authData as any}
          loading={auth.loading}
          onAuthDataChange={auth.handleAuthDataChange}
          onSetCreateNewOrganization={(value) => auth.setAuthData(prev => ({ ...prev, createNewOrganization: value }))}
          onToggleMode={() => auth.setIsLogin(!auth.isLogin)}
          onAuth={handleAuth}
          onSetRole={auth.setAuthRole}
          authRole={auth.authRole}
        />
      ) : auth.user?.role === 'admin' && adminMode && !selectedUserId ? (
        // Admin Dashboard - Show user list (only if admin and no user selected)
        <div className="h-[calc(100vh-56px)] overflow-y-auto w-full">
          <AdminDashboard
            token={auth.token || ''}
            onSelectUser={handleSelectUser}
            selectedUserId={selectedUserId || undefined}
            darkMode={darkMode}
          />
        </div>
      ) : (
        // User Dashboard (regular user or admin viewing a user)
        <div className="h-[calc(100vh-56px)] flex relative w-full overflow-hidden">
          <Sidebar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            currentStep={currentStep}
            completedSteps={completedSteps}
            skippedSteps={skippedSteps}
            onStepClick={handleStepClick}
          />

          <div className="flex-1 min-w-0 h-full overflow-hidden">
            <div className={`h-full flex flex-col ${getContentPadding()}`}>
              <div className="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-6">
                {renderStepContent()}
              </div>

              {/* Footer Navigation */}
              <div className={`border-t ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'} p-3 sm:p-4`}>
                <div className="flex justify-between items-center gap-2 sm:gap-4">
                  <button
                    onClick={handlePreviousStep}
                    disabled={currentStep === 0}
                    className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-white dark:hover:bg-slate-700 hover:shadow-md transition-all duration-200 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed text-xs sm:text-sm flex-shrink-0"
                  >
                    <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Previous</span>
                    <span className="sm:hidden">Prev</span>
                  </button>
                  <button
                    onClick={handleNextStep}
                    disabled={
                      currentStep === PROCESSING_STEPS.length || 
                      (currentStep === 0 && !documents.currentInvoice) ||
                      (currentStep === 1 && !documents.currentSCOMET && !skippedSteps.has(1)) ||
                      (currentStep === 2 && !documents.currentPackingList && !skippedSteps.has(2)) ||
                      (currentStep === 3 && !documents.currentFumigationCertificate && !skippedSteps.has(3)) ||
                      (currentStep === 4 && !documents.currentExportDeclaration && !skippedSteps.has(4)) ||
                      (currentStep === 5 && !documents.currentAirwayBill && !skippedSteps.has(5))
                    }
                    className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-teal-700 to-teal-600 text-white rounded-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed text-xs sm:text-sm flex-shrink-0"
                  >
                    <span className="hidden sm:inline">{currentStep === PROCESSING_STEPS.length - 1 ? 'Complete' : 'Next Step'}</span>
                    <span className="sm:hidden">{currentStep === PROCESSING_STEPS.length - 1 ? 'Done' : 'Next'}</span>
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <Snackbar
        snackbar={snackbar.snackbar}
        onClose={snackbar.hideSnackbar}
      />
    </div>
  )
}