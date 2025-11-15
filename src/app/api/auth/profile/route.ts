// src/app/api/auth/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyUserToken, getUserWithOrganization, updateUser, isValidEmail } from '@/lib/auth';
import { getUserDocuments, getUserShipments, getUserInvoices } from '@/lib/database';

interface Shipment {
  tracking_number: string;
  status: string;
  [key: string]: any;
}

interface Document {
  document_id: string;
  filename: string;
  uploaded_at: string;
  collection_name: string;
  strategy: string;
  processed: boolean;
  [key: string]: any;
}

interface Invoice {
  invoice_id: string;
  invoice_no: string;
  [key: string]: any;
}

interface UserProfileResponse {
  user: {
    userId: string;
    name: string;
    email: string | null;
    role: string;
    organizationId: string;
    isActive: boolean;
    createdAt: string;
    lastAccessed: string;
    documents: Document[];
    documentCount: number;
    invoiceCount: number;
    shipmentsCount: number;
    activeShipments: number;
    recentInvoices: Invoice[];
    recentShipments: Shipment[];
  };
  organization: {
    organizationId: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    industry: string | null;
    size: string | null;
    isActive: boolean;
    createdAt: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return NextResponse.json({ 
        error: 'Authentication required',
        requiresAuth: true
      }, { status: 401 });
    }
    
    // verifyUserToken returns { userId, organizationId } or null
    const tokenData = await verifyUserToken(token);
    if (!tokenData) {
      return NextResponse.json({ 
        error: 'Invalid or expired token',
        requiresAuth: true
      }, { status: 401 });
    }
    
    const { userId, organizationId } = tokenData;
    
    console.log('[Profile API] Fetching profile for user:', userId, 'org:', organizationId);
    
    // Fetch user with organization details
    const userWithOrg = await getUserWithOrganization(userId);
    if (!userWithOrg) {
      return NextResponse.json({ 
        error: 'User not found',
        requiresAuth: true
      }, { status: 404 });
    }
    
    // Check if user is active
    if (!userWithOrg.is_active) {
      return NextResponse.json({ 
        error: 'User account is inactive',
        requiresAuth: true
      }, { status: 403 });
    }
    
    // Fetch user's data
    console.log('[Profile API] Fetching user documents...');
    const documents = (await getUserDocuments(userId)) as Document[];
    console.log('[Profile API] Documents found:', documents.length);
    
    const shipments = (await getUserShipments(userId)) as Shipment[];
    const invoices = (await getUserInvoices(userId)) as Invoice[];
    
    // Filter active shipments
    const activeShipments = shipments.filter((shipment: Shipment) => 
      !['delivered', 'returned', 'cancelled'].includes(shipment.status)
    ).length;
    
    const response: UserProfileResponse = {
      user: {
        userId: userWithOrg.user_id,
        name: userWithOrg.name,
        email: userWithOrg.email,
        role: userWithOrg.role,
        organizationId: userWithOrg.organization_id,
        isActive: userWithOrg.is_active,
        createdAt: userWithOrg.created_at,
        lastAccessed: userWithOrg.last_accessed,
        
        // User statistics
        documents: documents,
        documentCount: documents.length,
        invoiceCount: invoices.length,
        shipmentsCount: shipments.length,
        activeShipments,
        
        // Recent activity
        recentInvoices: invoices.slice(0, 5),
        recentShipments: shipments.slice(0, 5)
      },
      organization: {
        organizationId: userWithOrg.organization.organization_id,
        name: userWithOrg.organization.name,
        email: userWithOrg.organization.email,
        phone: userWithOrg.organization.phone,
        address: userWithOrg.organization.address,
        industry: userWithOrg.organization.industry,
        size: userWithOrg.organization.size,
        isActive: userWithOrg.organization.is_active,
        createdAt: userWithOrg.organization.created_at
      }
    };
    
    console.log('[Profile API] Response documents count:', response.user.documents.length);
    
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[Profile API] Error fetching profile:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch profile',
      details: error.message 
    }, { status: 500 });
  }
}

// PUT - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return NextResponse.json({ 
        error: 'Authentication required'
      }, { status: 401 });
    }
    
    const tokenData = await verifyUserToken(token);
    if (!tokenData) {
      return NextResponse.json({ 
        error: 'Invalid or expired token'
      }, { status: 401 });
    }
    
    const { userId } = tokenData;
    const body = await request.json();
    
    // Only allow updating specific fields
    const allowedFields = ['name', 'email', 'metadata'];
    const sanitizedUpdates: Record<string, any> = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        sanitizedUpdates[field] = body[field];
      }
    }
    
    if (Object.keys(sanitizedUpdates).length === 0) {
      return NextResponse.json({ 
        error: 'No valid fields to update' 
      }, { status: 400 });
    }
    
    // Validate email if provided
    if (sanitizedUpdates.email) {
      if (!isValidEmail(sanitizedUpdates.email)) {
        return NextResponse.json({ 
          error: 'Invalid email format' 
        }, { status: 400 });
      }
    }
    
    // Update user
    const updatedUser = await updateUser(userId, sanitizedUpdates);
    
    return NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        userId: updatedUser.user_id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      }
    });

  } catch (error: any) {
    console.error('[Profile API] Error updating profile:', error);
    return NextResponse.json({ 
      error: 'Failed to update profile',
      details: error.message 
    }, { status: 500 });
  }
}