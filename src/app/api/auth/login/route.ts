// src/app/api/auth/login/route.ts - Updated with Password Authentication
import { NextRequest, NextResponse } from 'next/server';
import { 
  authenticateUser,
  getUserWithOrganization, 
  getOrganizationById,
  updateUserLastAccessed, 
  generateUserToken 
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { userId, email, password, mode } = await request.json();
    
    // User must provide identifier (userId or email) and password
    if (!userId && !email) {
      return NextResponse.json({ 
        error: 'Either userId or email is required' 
      }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ 
        error: 'Password is required' 
      }, { status: 400 });
    }
    
    // Authenticate user with password
    const identifier = userId || email;
    let user;
    
    try {
      user = await authenticateUser(identifier, password);
    } catch (error: any) {
      return NextResponse.json({ 
        error: 'Invalid credentials' 
      }, { status: 401 });
    }
    
    // Check if user is active
    if (!user.is_active) {
      return NextResponse.json({ 
        error: 'User account is inactive. Please contact your administrator.' 
      }, { status: 403 });
    }

    // Enforce role-based login restrictions
    if (mode === 'admin' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required. Please use the member login instead.' },
        { status: 403 }
      );
    }
    
    // Enforce user-only login when mode is 'user' (non-admin users)
    if (mode === 'user' && user.role === 'admin') {
      return NextResponse.json(
        { error: 'Admin users must use the admin login. Please use the admin login instead.' },
        { status: 403 }
      );
    }
    
    // Get organization details
    const organization = await getOrganizationById(user.organization_id);
    
    if (!organization) {
      return NextResponse.json({ 
        error: 'Organization not found' 
      }, { status: 404 });
    }
    
    // Check if organization is active
    if (!organization.is_active) {
      return NextResponse.json({ 
        error: 'Organization is inactive. Please contact support.' 
      }, { status: 403 });
    }
    
    // Update last accessed time
    await updateUserLastAccessed(user.user_id);
    
    let metadata = user.metadata || null;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (error) {
        console.warn('[Auth] Failed to parse user metadata, defaulting to null');
        metadata = null;
      }
    }

    const lastAdminMessage = metadata?.last_admin_message || null;
    const adminNotes = Array.isArray(metadata?.admin_notes) ? metadata.admin_notes : [];

    // Generate token with organization info
    const token = generateUserToken(
      user.user_id, 
      user.organization_id
    );
    
    return NextResponse.json({
      message: 'Login successful',
      user: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        lastAccessed: new Date().toISOString(),
        metadata,
        lastAdminMessage,
        adminNotes
      },
      organization: {
        organizationId: organization.organization_id,
        name: organization.name,
        email: organization.email,
        phone: organization.phone,
        address: organization.address,
        industry: organization.industry,
        size: organization.size,
        isActive: organization.is_active,
        createdAt: organization.created_at
      },
      token,
      expiresIn: '30 days'
    });

  } catch (error: any) {
    console.error('Error during login:', error);
    return NextResponse.json({ 
      error: 'Login failed', 
      details: error.message 
    }, { status: 500 });
  }
}