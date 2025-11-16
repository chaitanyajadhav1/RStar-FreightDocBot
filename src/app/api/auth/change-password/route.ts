// src/app/api/auth/change-password/route.ts - Password Change Endpoint
import { NextRequest, NextResponse } from 'next/server';
import { 
  authenticateUser,
  updateUserPassword,
  isValidPassword,
  verifyUserToken
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'Authorization token required' 
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await verifyUserToken(token);
    
    if (!decoded) {
      return NextResponse.json({ 
        error: 'Invalid or expired token' 
      }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();
    
    // Validate required fields
    if (!currentPassword) {
      return NextResponse.json({ 
        error: 'Current password is required' 
      }, { status: 400 });
    }

    if (!newPassword) {
      return NextResponse.json({ 
        error: 'New password is required' 
      }, { status: 400 });
    }

    // Validate new password format
    if (!isValidPassword(newPassword)) {
      return NextResponse.json({ 
        error: 'Invalid password. Must be at least 8 characters with letters and numbers' 
      }, { status: 400 });
    }

    // Don't allow same password
    if (currentPassword === newPassword) {
      return NextResponse.json({ 
        error: 'New password must be different from current password' 
      }, { status: 400 });
    }

    // Verify current password
    try {
      await authenticateUser(decoded.userId, currentPassword);
    } catch (error) {
      return NextResponse.json({ 
        error: 'Current password is incorrect' 
      }, { status: 401 });
    }

    // Update password
    await updateUserPassword(decoded.userId, newPassword);

    return NextResponse.json({
      message: 'Password changed successfully'
    });

  } catch (error: any) {
    console.error('Error during password change:', error);
    return NextResponse.json({ 
      error: 'Password change failed', 
      details: error.message 
    }, { status: 500 });
  }
}