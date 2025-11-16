"use client"

import React, { useState, useEffect } from 'react'
import { AlertCircle, X } from 'lucide-react'

interface PdfViewerProps {
  fileUrl: string
  bucket: string
  token: string | null
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ fileUrl, bucket, token }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPdf = async () => {
      if (!fileUrl || !token) {
        setError('No file URL or token provided')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        
        let filePath = fileUrl;
        
        console.log('Original fileUrl:', fileUrl);
        
        if (fileUrl.includes('/storage/v1/object/')) {
          const urlParts = fileUrl.split('/storage/v1/object/');
          if (urlParts.length > 1) {
            filePath = urlParts[1];
            filePath = filePath.split('?')[0];
          }
        }
        
        if (filePath.startsWith('public/invoices/')) {
          filePath = filePath.replace('public/invoices/', '');
        }
        if (filePath.startsWith('invoices/')) {
          filePath = filePath.replace('invoices/', '');
        }
        if (filePath.startsWith('public/')) {
          filePath = filePath.replace('public/', '');
        }

        if (filePath.startsWith('scomet_declarations/')) {
        filePath = filePath.replace('scomet_declarations/', '');
        }

        if (filePath.startsWith('packing_lists/')) {
        filePath = filePath.replace('packing_lists/', '');
        }

        if (filePath.startsWith('fumigation_certificates/')) {
        filePath = filePath.replace('fumigation_certificates/', '');
        }

        if (filePath.startsWith('export_declarations/')) {
        filePath = filePath.replace('export_declarations/', '');
        }

        if (filePath.startsWith('airway_bills/')) {
        filePath = filePath.replace('airway_bills/', '');
        }
        
        console.log(filePath);
        console.log('Final filePath for API:', filePath);
        console.log('Bucket:', bucket);
        
        const response = await fetch(`/api/invoice/view-pdf?path=${encodeURIComponent(filePath)}&bucket=${encodeURIComponent(bucket)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          const errorText = await response.text();
          console.error('PDF fetch error:', response.status, errorText);
          throw new Error(`Failed to load PDF: ${response.status}`)
        }

        const blob = await response.blob()
        
        if (blob.size === 0) {
          throw new Error('PDF is empty or corrupted')
        }

        const blobUrl = URL.createObjectURL(blob)
        setPdfUrl(blobUrl)
      } catch (err: any) {
        console.error('PDF loading error:', err)
        setError(err.message || 'Failed to load PDF')
      } finally {
        setLoading(false)
      }
    }

    loadPdf()

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [fileUrl, bucket, token])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading PDF...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg">
        <div className="text-center p-4">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm text-rose-600 dark:text-rose-400 mb-2">Failed to load PDF</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 px-3 py-1 bg-teal-600 text-white rounded text-xs hover:bg-teal-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden flex flex-col">
      <div className="flex-1">
        {pdfUrl ? (
          <iframe 
            src={pdfUrl}
            className="w-full h-full border-0"
            title="PDF Document"
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-slate-500 dark:text-slate-400">No PDF available</p>
          </div>
        )}
      </div>
    </div>
  )
}