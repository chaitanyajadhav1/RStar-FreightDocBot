import { sanitizeFilename, validateDocumentWithCommercial } from '../../../../utils/validation'
import { API_BASE } from '../../../../utils/constants'

export const createUploadHandler = (
  endpoint: string,
  setUploading: (uploading: boolean) => void,
  setDocument: (document: any) => void,
  setCompletedSteps: (updater: (prev: Set<number>) => Set<number>) => void,
  setSkippedSteps: (updater: (prev: Set<number>) => Set<number>) => void,
  showSnackbar: (message: string, severity?: string) => void,
  currentInvoice: any,
  token: string | null,
  user: any,
  organization: any,
  stepIndex: number,
  documentType: string
) => {
  return async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !token || !user || !organization) {
      showSnackbar("Please login first", "warning")
      return
    }

    setUploading(true)
    
    const formData = new FormData()
    const sanitizedFile = new File([file], sanitizeFilename(file.name), { type: file.type })
    formData.append('file', sanitizedFile)
    formData.append('threadId', `thread_${Date.now()}`)
    formData.append('userId', user.userId)
    formData.append('organizationId', organization.organizationId)

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
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

      // Process result based on document type and update state accordingly
      // This would include the specific data transformation for each document type
      
      setUploading(false)
      showSnackbar("Document processed successfully!", "success")
    } catch (error: any) {
      setUploading(false)
      showSnackbar(error.message || "Upload failed", "error")
    }
  }
}