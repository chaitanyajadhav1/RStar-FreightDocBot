// src/lib/auth.ts - Added Password Support

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { JWT_SECRET, supabaseAdmin } from './config';

// ========== VALIDATION ==========

export function isValidUserId(userId: string): boolean {
  return /^[a-zA-Z0-9_-]{3,50}$/.test(userId);
}

export function isValidOrganizationId(orgId: string): boolean {
  return /^[a-zA-Z0-9_-]{3,50}$/.test(orgId);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string): boolean {
  // At least 8 characters, with at least one letter and one number
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

// ========== PASSWORD MANAGEMENT ==========

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

// ========== TOKEN MANAGEMENT ==========

export function generateUserToken(userId: string, organizationId: string): string {
  return jwt.sign(
    { 
      userId, 
      organizationId,
      createdAt: Date.now(), 
      type: 'auth' 
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export async function verifyUserToken(token: string): Promise<{ userId: string; organizationId: string } | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await getUserById(decoded.userId);
    if (!user || !user.is_active) {
      return null;
    }
    await updateUserLastAccessed(decoded.userId);
    return { 
      userId: decoded.userId, 
      organizationId: decoded.organizationId 
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// ========== ORGANIZATION MANAGEMENT ==========

export async function createOrganization(orgData: {
  organizationId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  industry?: string;
  size?: string;
  metadata?: any;
}) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized. Check your environment variables.');
  }

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .insert([{
      organization_id: orgData.organizationId,
      name: orgData.name,
      email: orgData.email || null,
      phone: orgData.phone || null,
      address: orgData.address || null,
      industry: orgData.industry || null,
      size: orgData.size || null,
      metadata: orgData.metadata || {},
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Organization creation error:', error);
    if (error.code === '23505') {
      throw new Error('Organization ID already exists');
    }
    throw error;
  }
  return data;
}

export async function getOrganizationById(organizationId: string) {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not initialized');
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('organization_id', organizationId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching organization:', error);
    throw error;
  }
  return data;
}

export async function updateOrganization(organizationId: string, updates: any) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('organization_id', organizationId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getOrganizationUsers(organizationId: string) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('user_id, name, email, role, is_active, created_at, last_accessed')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getOrganizationStats(organizationId: string) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  const { count: userCount } = await supabaseAdmin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  const { count: invoiceCount } = await supabaseAdmin
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  const { count: shipmentCount } = await supabaseAdmin
    .from('shipment_tracking')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  return {
    userCount: userCount || 0,
    invoiceCount: invoiceCount || 0,
    shipmentCount: shipmentCount || 0
  };
}

// ========== USER MANAGEMENT ==========

export async function createUser(userData: {
  userId: string;
  organizationId: string;
  name: string;
  email?: string;
  password: string;
  role?: string;
  metadata?: any;
}) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  const org = await getOrganizationById(userData.organizationId);
  if (!org) {
    throw new Error('Organization not found');
  }

  // Hash the password
  const hashedPassword = await hashPassword(userData.password);

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert([{
      user_id: userData.userId,
      organization_id: userData.organizationId,
      name: userData.name,
      email: userData.email || null,
      password_hash: hashedPassword,
      role: userData.role || 'member',
      metadata: userData.metadata || {},
      is_active: true,
      created_at: new Date().toISOString(),
      last_accessed: new Date().toISOString()
    }])
    .select()
    .single();
  
  if (error) {
    console.error('User creation error:', error);
    if (error.code === '23505') {
      throw new Error('User ID already exists');
    }
    throw error;
  }
  return data;
}

export async function getUserById(userId: string) {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not initialized');
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching user:', error);
    throw error;
  }
  return data;
}

export async function getUserByEmail(email: string) {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not initialized');
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching user by email:', error);
    throw error;
  }
  return data;
}

export async function getUserWithOrganization(userId: string) {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not initialized');
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select(`
      *,
      organization:organizations(*)
    `)
    .eq('user_id', userId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching user with organization:', error);
    throw error;
  }
  return data;
}

export async function authenticateUser(identifier: string, password: string): Promise<any> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  // Try to find user by userId or email
  let user = null;
  
  if (identifier.includes('@')) {
    user = await getUserByEmail(identifier);
  } else {
    user = await getUserById(identifier);
  }

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  return user;
}

export async function updateUserLastAccessed(userId: string) {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not initialized');
    return;
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ last_accessed: new Date().toISOString() })
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error updating last accessed:', error);
  }
}

export async function updateUser(userId: string, updates: any) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateUserPassword(userId: string, newPassword: string) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  const hashedPassword = await hashPassword(newPassword);

  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ password_hash: hashedPassword })
    .eq('user_id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deactivateUser(userId: string) {
  return updateUser(userId, { is_active: false });
}

export async function activateUser(userId: string) {
  return updateUser(userId, { is_active: true });
}

// ========== ROLE-BASED ACCESS CONTROL ==========

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  MEMBER = 'member',
  VIEWER = 'viewer'
}

export function hasPermission(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = {
    [UserRole.ADMIN]: 4,
    [UserRole.MANAGER]: 3,
    [UserRole.MEMBER]: 2,
    [UserRole.VIEWER]: 1
  };
  
  return (roleHierarchy[userRole as UserRole] || 0) >= (roleHierarchy[requiredRole as UserRole] || 0);
}

export async function checkUserPermission(userId: string, requiredRole: string): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user || !user.is_active) return false;
  return hasPermission(user.role, requiredRole);
}