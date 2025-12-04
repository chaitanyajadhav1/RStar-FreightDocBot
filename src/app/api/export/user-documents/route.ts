//src/app/api/export/user-documents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyUserToken, getUserById } from '@/lib/auth'
import {
  getUserInvoices,
  getUserSCOMETDeclarations,
  getUserPackingLists,
  getUserFumigationCertificates,
  getUserExportDeclarations,
  getUserAirwayBills
} from '@/lib/database'
import * as XLSX from 'xlsx'

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = await verifyUserToken(token)
    if (!decoded) {
      return new NextResponse('Invalid token', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestedUserId = searchParams.get('userId')

    let targetUserId = decoded.userId
    if (requestedUserId && requestedUserId !== decoded.userId) {
      const currentUser = await getUserById(decoded.userId)
      if (!currentUser || currentUser.role !== 'admin') {
        return new NextResponse('Forbidden', { status: 403 })
      }
      const requestedUser = await getUserById(requestedUserId)
      if (!requestedUser || requestedUser.organization_id !== decoded.organizationId) {
        return new NextResponse('Forbidden', { status: 403 })
      }
      targetUserId = requestedUserId
    }

    const userRecord = await getUserById(targetUserId)
    if (!userRecord || !userRecord.is_active) {
      return new NextResponse('User not found or inactive', { status: 404 })
    }

    const [invoices, scomet, packing, fumigation, exportDecl, airway] = await Promise.all([
      getUserInvoices(targetUserId),
      getUserSCOMETDeclarations(targetUserId),
      getUserPackingLists(targetUserId),
      getUserFumigationCertificates(targetUserId),
      getUserExportDeclarations(targetUserId),
      getUserAirwayBills(targetUserId)
    ])

    // Create a new workbook
    const workbook = XLSX.utils.book_new()

    // Sheet 1: User Information
    const userInfoData = [
      ['User ID', 'Name', 'Email', 'Role', 'Organization ID', 'Created At', 'Last Accessed'],
      [
        userRecord.user_id,
        userRecord.name,
        userRecord.email || '',
        userRecord.role,
        userRecord.organization_id,
        userRecord.created_at,
        userRecord.last_accessed || ''
      ]
    ]
    const userInfoSheet = XLSX.utils.aoa_to_sheet(userInfoData)
    
    // Set column widths
    userInfoSheet['!cols'] = [
      { wch: 15 }, // User ID
      { wch: 20 }, // Name
      { wch: 30 }, // Email
      { wch: 10 }, // Role
      { wch: 20 }, // Organization ID
      { wch: 20 }, // Created At
      { wch: 20 }  // Last Accessed
    ]
    
    XLSX.utils.book_append_sheet(workbook, userInfoSheet, 'User Information')

    // Helper function to convert records to sheet data
    const createDocumentSheet = (records: any[], documentType: string) => {
      if (!records || records.length === 0) {
        return XLSX.utils.aoa_to_sheet([
          [documentType],
          ['Status', 'No data']
        ])
      }

      // Get all unique keys from all records
      const allKeys = new Set<string>()
      records.forEach(rec => {
        Object.keys(rec || {}).forEach(key => allKeys.add(key))
      })
      const headers = Array.from(allKeys)

      // Create data rows
      const data = [headers]
      records.forEach(rec => {
        const row = headers.map(header => {
          const val = (rec as any)[header]
          if (val === null || val === undefined) return ''
          if (Array.isArray(val) || (val && typeof val === 'object')) {
            return JSON.stringify(val)
          }
          return String(val)
        })
        data.push(row)
      })

      const sheet = XLSX.utils.aoa_to_sheet(data)
      
      // Auto-size columns
      const colWidths = headers.map(header => {
        const maxLength = Math.max(
          header.length,
          ...records.map(rec => {
            const val = (rec as any)[header]
            if (val === null || val === undefined) return 0
            if (Array.isArray(val) || (val && typeof val === 'object')) {
              return JSON.stringify(val).length
            }
            return String(val).length
          })
        )
        return { wch: Math.min(maxLength + 2, 50) } // Max width 50
      })
      sheet['!cols'] = colWidths
      
      return sheet
    }

    // Sheet 2: Commercial Invoices
    if (invoices && invoices.length > 0) {
      const invoiceSheet = createDocumentSheet(invoices, 'Commercial Invoice')
      XLSX.utils.book_append_sheet(workbook, invoiceSheet, 'Commercial Invoices')
    }

    // Sheet 3: SCOMET Declarations
    if (scomet && scomet.length > 0) {
      const scometSheet = createDocumentSheet(scomet, 'SCOMET Declaration')
      XLSX.utils.book_append_sheet(workbook, scometSheet, 'SCOMET Declarations')
    }

    // Sheet 4: Packing Lists
    if (packing && packing.length > 0) {
      const packingSheet = createDocumentSheet(packing, 'Packing List')
      XLSX.utils.book_append_sheet(workbook, packingSheet, 'Packing Lists')
    }

    // Sheet 5: Fumigation Certificates
    if (fumigation && fumigation.length > 0) {
      const fumigationSheet = createDocumentSheet(fumigation, 'Fumigation Certificate')
      XLSX.utils.book_append_sheet(workbook, fumigationSheet, 'Fumigation Certs')
    }

    // Sheet 6: Export Declarations
    if (exportDecl && exportDecl.length > 0) {
      const exportSheet = createDocumentSheet(exportDecl, 'Export Declaration')
      XLSX.utils.book_append_sheet(workbook, exportSheet, 'Export Declarations')
    }

    // Sheet 7: Airway Bills
    if (airway && airway.length > 0) {
      const airwaySheet = createDocumentSheet(airway, 'Airway Bill')
      XLSX.utils.book_append_sheet(workbook, airwaySheet, 'Airway Bills')
    }

    // Generate Excel file as base64 and then convert to buffer
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      compression: true
    })
    
    const filename = `user_documents_${targetUserId}.xlsx`

    // Return with proper headers
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      }
    })
  } catch (e: any) {
    console.error('Export error:', e)
    return new NextResponse(JSON.stringify({ error: 'Failed to export', details: e.message }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}