import React from 'react'
import { CircleCheck, CircleX } from 'lucide-react'

interface ValidationDetailsProps {
  validationDetails: any
}

// Field name mapping for better display labels
const fieldNameMap: Record<string, string> = {
  // Fumigation Certificate
  shippingMarkInvoiceNo: 'Shipping Mark/Brand → Invoice No',
  shippingMarkInvoiceDate: 'Shipping Mark/Brand → Invoice Date',
  invoiceNumber: 'Invoice Number',
  invoiceDate: 'Invoice Date',
  invoiceNo: 'Invoice Number',
  invoice_no: 'Invoice Number',
  invoice_date: 'Invoice Date',
  
  // Annexure A / Export Declaration
  shippingBillNo: 'Shipping Bill No',
  shippingBillDate: 'Shipping Date',
  paymentTerms: 'Terms of Payment',
  
  // Airway Bill
  shippers_name: 'Shippers Name',
  shippers_address: 'Shippers Address',
  consignees_name: 'Consignees Name',
  consignees_address: 'Consignees Address',
  issuing_carriers_name: 'Issuing Carriers Name',
  issuing_carriers_city: 'Issuing Carriers City',
  hs_code_no: 'HS Code No',
  
  // Common fields
  exporterName: 'Exporter Name',
  exporterAddress: 'Exporter Address',
  consigneeName: 'Consignee Name',
  consigneeAddress: 'Consignee Address',
  hsnCode: 'HS Code',
  portOfLoading: 'Port of Loading',
  portOfDischarge: 'Port of Discharge',
  finalDestination: 'Final Destination',
}

// Format field name for display
const formatFieldName = (field: string): string => {
  // Check if we have a mapped name
  if (fieldNameMap[field]) {
    return fieldNameMap[field]
  }
  
  // Otherwise format the field name
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, str => str.toUpperCase())
    .trim()
}

export const ValidationDetails: React.FC<ValidationDetailsProps> = ({ validationDetails }) => {
  if (!validationDetails || Object.keys(validationDetails).length === 0) return null

  return (
    <div className="mt-3">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
        Commercial Invoice Validation:
      </h4>
      <div className="grid gap-1">
        {Object.entries(validationDetails).map(([field, details]: [string, any]) => {
          // Skip if details is not an object with match property
          if (!details || typeof details !== 'object' || details.match === undefined) {
            return null
          }
          
          return (
            <div key={field} className={`flex items-center p-2 rounded-lg border ${
              details.match 
                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' 
                : 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800'
            }`}>
              {details.match ? (
                <CircleCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-2 flex-shrink-0" />
              ) : (
                <CircleX className="w-4 h-4 text-rose-600 dark:text-rose-400 mr-2 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-900 dark:text-white">
                  {formatFieldName(field)}
                </div>
                {!details.match && details.message && (
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {details.message}
                  </div>
                )}
                {!details.match && !details.message && (
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {details.commercialValue && details.commercialValue !== 'N/A (Commercial Invoice)' && (
                      <>Commercial: {details.commercialValue} • </>
                    )}
                    Document: {details.documentValue || 'Not set'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
