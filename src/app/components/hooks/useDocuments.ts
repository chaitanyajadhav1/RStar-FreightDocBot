import { useState, useRef } from 'react'
import { 
  InvoiceData, 
  SCOMETDeclarationData, 
  PackingListData, 
  FumigationCertificateData,
  ExportDeclarationData,
  AirwayBillData 
} from '../../../types/documents'

export const useDocuments = () => {
  // Document state
  const [currentInvoice, setCurrentInvoice] = useState<InvoiceData | null>(null)
  const [currentSCOMET, setCurrentSCOMET] = useState<SCOMETDeclarationData | null>(null)
  const [currentPackingList, setCurrentPackingList] = useState<PackingListData | null>(null)
  const [currentFumigationCertificate, setCurrentFumigationCertificate] = useState<FumigationCertificateData | null>(null)
  const [currentExportDeclaration, setCurrentExportDeclaration] = useState<ExportDeclarationData | null>(null)
  const [currentAirwayBill, setCurrentAirwayBill] = useState<AirwayBillData | null>(null)

  // Uploading state
  const [invoiceUploading, setInvoiceUploading] = useState(false)
  const [scometUploading, setSCOMETUploading] = useState(false)
  const [packingListUploading, setPackingListUploading] = useState(false)
  const [fumigationUploading, setFumigationUploading] = useState(false)
  const [exportDeclarationUploading, setExportDeclarationUploading] = useState(false)
  const [airwayBillUploading, setAirwayBillUploading] = useState(false)

  // Updating state
  const [invoiceUpdating, setInvoiceUpdating] = useState(false)
  const [scometUpdating, setSCOMETUpdating] = useState(false)
  const [packingListUpdating, setPackingListUpdating] = useState(false)
  const [fumigationUpdating, setFumigationUpdating] = useState(false)
  const [exportDeclarationUpdating, setExportDeclarationUpdating] = useState(false)
  const [airwayBillUpdating, setAirwayBillUpdating] = useState(false)

  // Edit mode state
  const [editInvoiceMode, setEditInvoiceMode] = useState(false)
  const [editSCOMETMode, setEditSCOMETMode] = useState(false)
  const [editPackingListMode, setEditPackingListMode] = useState(false)
  const [editFumigationMode, setEditFumigationMode] = useState(false)
  const [editExportDeclarationMode, setEditExportDeclarationMode] = useState(false)
  const [editAirwayBillMode, setEditAirwayBillMode] = useState(false)

  // Input refs
  const invoiceInputRef = useRef<HTMLInputElement>(null)
  const scometInputRef = useRef<HTMLInputElement>(null)
  const packingListInputRef = useRef<HTMLInputElement>(null)
  const fumigationInputRef = useRef<HTMLInputElement>(null)
  const exportDeclarationInputRef = useRef<HTMLInputElement>(null)
  const airwayBillInputRef = useRef<HTMLInputElement>(null)

  return {
    // Document state
    currentInvoice, setCurrentInvoice,
    currentSCOMET, setCurrentSCOMET,
    currentPackingList, setCurrentPackingList,
    currentFumigationCertificate, setCurrentFumigationCertificate,
    currentExportDeclaration, setCurrentExportDeclaration,
    currentAirwayBill, setCurrentAirwayBill,

    // Uploading state
    invoiceUploading, setInvoiceUploading,
    scometUploading, setSCOMETUploading,
    packingListUploading, setPackingListUploading,
    fumigationUploading, setFumigationUploading,
    exportDeclarationUploading, setExportDeclarationUploading,
    airwayBillUploading, setAirwayBillUploading,

    // Updating state
    invoiceUpdating, setInvoiceUpdating,
    scometUpdating, setSCOMETUpdating,
    packingListUpdating, setPackingListUpdating,
    fumigationUpdating, setFumigationUpdating,
    exportDeclarationUpdating, setExportDeclarationUpdating,
    airwayBillUpdating, setAirwayBillUpdating,

    // Edit mode state
    editInvoiceMode, setEditInvoiceMode,
    editSCOMETMode, setEditSCOMETMode,
    editPackingListMode, setEditPackingListMode,
    editFumigationMode, setEditFumigationMode,
    editExportDeclarationMode, setEditExportDeclarationMode,
    editAirwayBillMode, setEditAirwayBillMode,

    // Input refs
    invoiceInputRef,
    scometInputRef,
    packingListInputRef,
    fumigationInputRef,
    exportDeclarationInputRef,
    airwayBillInputRef,
  }
}