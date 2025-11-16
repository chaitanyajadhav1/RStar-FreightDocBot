// src/app/api/auth/register/route.ts - Updated with Password Support
import { NextRequest, NextResponse } from 'next/server';
import { 
  createUser, 
  createOrganization, 
  getOrganizationById,
  isValidUserId, 
  isValidOrganizationId,
  isValidEmail,
  isValidPassword,
  generateUserToken
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userId, 
      name, 
      email,
      password,
      organizationId,
      organizationName,
      createNewOrganization = false,
      role: requestedRole = 'member',
      // Optional organization fields
      organizationEmail,
      organizationPhone,
      organizationAddress,
      industry,
      size
    } = body;
    
    const allowedRoles = ['admin', 'manager', 'member', 'viewer'] as const;
    const normalizedRequestedRole = typeof requestedRole === 'string'
      ? requestedRole.toLowerCase()
      : 'member';

    let role: typeof allowedRoles[number] =
      allowedRoles.includes(normalizedRequestedRole as any)
        ? normalizedRequestedRole as typeof allowedRoles[number]
        : 'member';
    
    // Validate required fields
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'password is required' }, { status: 400 });
    }
    
    if (!isValidUserId(userId)) {
      return NextResponse.json({ 
        error: 'Invalid userId format. Use 3-50 characters (letters, numbers, _ or -)' 
      }, { status: 400 });
    }
    
    // Validate email if provided
    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate password
    if (!isValidPassword(password)) {
      return NextResponse.json({ 
        error: 'Invalid password. Must be at least 8 characters with letters and numbers' 
      }, { status: 400 });
    }
    
    // Handle organization logic
    let finalOrganizationId: string;
    let organizationInfo: any;
    
    if (createNewOrganization) {
      if (role !== 'admin') {
        return NextResponse.json(
          { error: 'Only admins can create new organizations' },
          { status: 403 }
        );
      }
      // Create new organization
      if (!organizationId) {
        return NextResponse.json({ 
          error: 'organizationId is required when creating new organization' 
        }, { status: 400 });
      }
      
      if (!organizationName) {
        return NextResponse.json({ 
          error: 'organizationName is required when creating new organization' 
        }, { status: 400 });
      }
      
      if (!isValidOrganizationId(organizationId)) {
        return NextResponse.json({ 
          error: 'Invalid organizationId format. Use 3-50 characters (letters, numbers, _ or -)' 
        }, { status: 400 });
      }
      
      // Check if organization already exists
      const existingOrg = await getOrganizationById(organizationId);
      if (existingOrg) {
        return NextResponse.json({ 
          error: 'Organization ID already exists' 
        }, { status: 409 });
      }
      
      // Create the organization
      organizationInfo = await createOrganization({
        organizationId,
        name: organizationName,
        email: organizationEmail,
        phone: organizationPhone,
        address: organizationAddress,
        industry,
        size
      });
      
      finalOrganizationId = organizationId;
      // First user of new organization becomes admin
      role = 'admin';
      
    } else {
      // Join existing organization
      if (role === 'admin') {
        role = 'member';
      }
      if (!organizationId) {
        return NextResponse.json({ 
          error: 'organizationId is required when joining existing organization' 
        }, { status: 400 });
      }
      
      // Verify organization exists
      organizationInfo = await getOrganizationById(organizationId);
      if (!organizationInfo) {
        return NextResponse.json({ 
          error: 'Organization not found' 
        }, { status: 404 });
      }
      
      if (!organizationInfo.is_active) {
        return NextResponse.json({ 
          error: 'Organization is inactive' 
        }, { status: 403 });
      }
      
      finalOrganizationId = organizationId;
    }
    
    // Create the user with password
    const userInfo = await createUser({ 
      userId, 
      organizationId: finalOrganizationId,
      name, 
      email: email || null,
      password,
      role,
      metadata: {
        registeredVia: createNewOrganization ? 'new_organization' : 'existing_organization'
      }
    });
    
    // Generate token
    const token = generateUserToken(userId, finalOrganizationId);
    
    return NextResponse.json({
      message: createNewOrganization 
        ? 'Organization and user created successfully' 
        : 'User registered successfully',
      user: {
        userId: userInfo.user_id,
        name: userInfo.name,
        email: userInfo.email,
        role: userInfo.role,
        organizationId: userInfo.organization_id,
        createdAt: userInfo.created_at
      },
      organization: {
        organizationId: organizationInfo.organization_id,
        name: organizationInfo.name,
        email: organizationInfo.email,
        isActive: organizationInfo.is_active
      },
      token,
      expiresIn: '30 days'
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error during registration:', error);
    
    // Handle specific error cases
    if (error.message === 'User ID already exists') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    
    if (error.message === 'Organization ID already exists') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    
    if (error.message === 'Organization not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    
    return NextResponse.json({ 
      error: 'Registration failed', 
      details: error.message 
    }, { status: 500 });
  }
}