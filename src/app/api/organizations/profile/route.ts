// src/app/api/organization/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { 
  getOrganizationById, 
  updateOrganization,
  getOrganizationUsers,
  getOrganizationStats,
  verifyUserToken 
} from '@/lib/auth';

// GET - Fetch organization profile
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

    const { organizationId } = tokenData;
    
    // Fetch organization details
    const organization = await getOrganizationById(organizationId);
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Fetch organization statistics
    const stats = await getOrganizationStats(organizationId);

    return NextResponse.json({
      organization: {
        organizationId: organization.organization_id,
        name: organization.name,
        email: organization.email,
        phone: organization.phone,
        address: organization.address,
        industry: organization.industry,
        size: organization.size,
        metadata: organization.metadata,
        isActive: organization.is_active,
        createdAt: organization.created_at,
        updatedAt: organization.updated_at
      },
      stats
    });

  } catch (error: any) {
    console.error('Error fetching organization profile:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch organization profile',
      details: error.message 
    }, { status: 500 });
  }
}

// PUT - Update organization profile
export async function PUT(request: NextRequest) {
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
    
    // Check if user has permission (admin role required)
    const { getUserById } = await import('@/lib/auth');
    const user = await getUserById(userId);
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Forbidden: Admin role required' 
      }, { status: 403 });
    }

    // Parse request body
    const updates = await request.json();
    
    // Only allow updating specific fields
    const allowedFields = ['name', 'email', 'phone', 'address', 'industry', 'size', 'metadata'];
    const sanitizedUpdates: any = {};
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return NextResponse.json({ 
        error: 'No valid fields to update' 
      }, { status: 400 });
    }

    // Update organization
    const updatedOrganization = await updateOrganization(organizationId, sanitizedUpdates);

    return NextResponse.json({
      message: 'Organization updated successfully',
      organization: {
        organizationId: updatedOrganization.organization_id,
        name: updatedOrganization.name,
        email: updatedOrganization.email,
        phone: updatedOrganization.phone,
        address: updatedOrganization.address,
        industry: updatedOrganization.industry,
        size: updatedOrganization.size,
        metadata: updatedOrganization.metadata,
        isActive: updatedOrganization.is_active,
        updatedAt: updatedOrganization.updated_at
      }
    });

  } catch (error: any) {
    console.error('Error updating organization:', error);
    return NextResponse.json({ 
      error: 'Failed to update organization',
      details: error.message 
    }, { status: 500 });
  }
}