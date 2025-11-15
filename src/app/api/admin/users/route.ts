// src/app/api/admin/users/route.ts - Admin endpoint to get all users with document counts
import { NextRequest, NextResponse } from 'next/server';
import { 
  verifyUserToken,
  getUserById,
  getOrganizationUsers
} from '@/lib/auth';
import {
  getUserDocuments,
  getUserInvoices,
  getUserSCOMETDeclarations,
  getUserPackingLists,
  getUserFumigationCertificates,
  getUserExportDeclarations
} from '@/lib/database';

// GET - Fetch all users in organization with document counts (admin only)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const tokenData = await verifyUserToken(token);
    
    if (!tokenData) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { userId, organizationId } = tokenData;
    
    // Check if current user is admin
    const currentUser = await getUserById(userId);
    if (!currentUser || !currentUser.is_active) {
      return NextResponse.json({ error: 'User not active' }, { status: 403 });
    }

    if (currentUser.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Forbidden: Admin role required' 
      }, { status: 403 });
    }
    
    // Fetch all users in the organization
    const users = await getOrganizationUsers(organizationId);

    // Get document counts for each user
    const usersWithCounts = await Promise.all(
      users.map(async (user: any) => {
        try {
          // Get all document types for this user
          const [
            documents,
            invoices,
            scomet,
            packingLists,
            fumigation,
            exportDeclarations
          ] = await Promise.all([
            getUserDocuments(user.user_id),
            getUserInvoices(user.user_id),
            getUserSCOMETDeclarations(user.user_id),
            getUserPackingLists(user.user_id),
            getUserFumigationCertificates(user.user_id),
            getUserExportDeclarations(user.user_id)
          ]);

          const totalDocuments = 
            invoices.length + 
            scomet.length + 
            packingLists.length + 
            fumigation.length + 
            exportDeclarations.length;

          return {
            userId: user.user_id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.is_active,
            createdAt: user.created_at,
            lastAccessed: user.last_accessed,
            documentCounts: {
              total: totalDocuments,
              invoices: invoices.length,
              scomet: scomet.length,
              packingLists: packingLists.length,
              fumigation: fumigation.length,
              exportDeclarations: exportDeclarations.length,
              documents: documents.length
            }
          };
        } catch (error: any) {
          console.error(`Error fetching documents for user ${user.user_id}:`, error);
          return {
            userId: user.user_id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.is_active,
            createdAt: user.created_at,
            lastAccessed: user.last_accessed,
            documentCounts: {
              total: 0,
              invoices: 0,
              scomet: 0,
              packingLists: 0,
              fumigation: 0,
              exportDeclarations: 0,
              documents: 0
            }
          };
        }
      })
    );

    return NextResponse.json({
      users: usersWithCounts,
      total: usersWithCounts.length,
      organizationId
    });

  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch users',
      details: error.message 
    }, { status: 500 });
  }
}
