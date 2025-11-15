export interface Organization {
  organizationId: string
  name: string
  email?: string
  phone?: string
  address?: string
  industry?: string
  size?: string
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

export interface AdminMessage {
  message: string
  createdAt: string
  createdBy?: string
}

export interface User {
  userId: string
  name: string
  email?: string
  role: 'admin' | 'manager' | 'member' | 'viewer'
  organizationId: string
  isActive: boolean
  createdAt: string
  lastAccessed: string
  metadata?: Record<string, any>
  adminNotes?: AdminMessage[]
  lastAdminMessage?: AdminMessage | null
}

export interface AuthData {
  userId: string
  name: string
  email?: string
  password: string
  organizationId: string
  organizationName?: string
  createNewOrganization: boolean
  role?: 'admin' | 'manager' | 'member' | 'viewer'
  // Optional organization fields for new organization creation
  organizationEmail?: string
  organizationPhone?: string
  organizationAddress?: string
  industry?: string
  size?: string
}

export interface LoginRequest {
  userId?: string
  email?: string
  password: string
}

export interface LoginResponse {
  message: string
  user: {
    userId: string
    name: string
    email?: string
    role: string
    organizationId: string
    lastAccessed: string
    metadata?: Record<string, any>
    adminNotes?: AdminMessage[]
    lastAdminMessage?: AdminMessage | null
  }
  organization: {
    organizationId: string
    name: string
    email?: string
    phone?: string
    address?: string
    industry?: string
    size?: string
    isActive: boolean
    createdAt: string
  }
  token: string
  expiresIn: string
}

export interface RegisterResponse {
  message: string
  user: {
    userId: string
    name: string
    email?: string
    role: string
    organizationId: string
    createdAt: string
  }
  organization: {
    organizationId: string
    name: string
    email?: string
    isActive: boolean
  }
  token: string
  expiresIn: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface ChangePasswordResponse {
  message: string
}

export interface ErrorResponse {
  error: string
  details?: string
}