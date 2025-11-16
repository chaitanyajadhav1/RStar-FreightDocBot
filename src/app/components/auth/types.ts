// //auth/types.ts
// export interface Organization {
//   organizationId: string
//   name: string
//   email?: string
//   phone?: string
//   address?: string
//   industry?: string
//   size?: string
//   isActive: boolean
//   createdAt: string
//   updatedAt?: string
// }

// export interface User {
//   userId: string
//   name: string
//   email?: string
//   role: string
//   organizationId: string
//   createdAt: string
//   lastAccessed: string
//   isActive: boolean
//   preferences?: UserPreferences
//   permissions?: string[]
// }

// export interface UserPreferences {
//   theme: 'light' | 'dark' | 'auto'
//   language: string
//   notifications: {
//     email: boolean
//     push: boolean
//     documentUpdates: boolean
//   }
// }

// export interface AuthData {
//   userId: string
//   name: string
//   email: string
//   organizationId: string
//   organizationName: string
//   createNewOrganization: boolean
// }

// export interface LoginRequest {
//   userId: string
//   password?: string // Optional for demo purposes
// }

// export interface RegisterRequest {
//   userId: string
//   name: string
//   email: string
//   createNewOrganization: boolean
//   organizationId?: string
//   organizationName?: string
//   password?: string // Optional for demo purposes
// }

// export interface AuthResponse {
//   success: boolean
//   token: string
//   user: User
//   organization: Organization
//   message?: string
// }

// export interface AuthError {
//   error: string
//   code: string
//   details?: string
//   fieldErrors?: FieldError[]
// }

// export interface FieldError {
//   field: string
//   message: string
//   code: string
// }

// export interface Session {
//   token: string
//   user: User
//   organization: Organization
//   expiresAt: string
//   issuedAt: string
// }

// export interface AuthState {
//   isAuthenticated: boolean
//   user: User | null
//   organization: Organization | null
//   token: string | null
//   loading: boolean
//   error: AuthError | null
//   lastActivity: string
// }

// // Permission types
// export enum UserRole {
//   SUPER_ADMIN = 'super_admin',
//   ORGANIZATION_ADMIN = 'organization_admin',
//   USER = 'user',
//   VIEWER = 'viewer'
// }

// export enum Permission {
//   // Document permissions
//   UPLOAD_DOCUMENTS = 'upload_documents',
//   VIEW_DOCUMENTS = 'view_documents',
//   EDIT_DOCUMENTS = 'edit_documents',
//   DELETE_DOCUMENTS = 'delete_documents',
//   EXPORT_DOCUMENTS = 'export_documents',
  
//   // Organization permissions
//   MANAGE_ORGANIZATION = 'manage_organization',
//   VIEW_ORGANIZATION = 'view_organization',
  
//   // User management permissions
//   MANAGE_USERS = 'manage_users',
//   VIEW_USERS = 'view_users',
  
//   // Analytics permissions
//   VIEW_ANALYTICS = 'view_analytics',
//   EXPORT_ANALYTICS = 'export_analytics'
// }

// export interface RolePermissions {
//   [UserRole.SUPER_ADMIN]: Permission[]
//   [UserRole.ORGANIZATION_ADMIN]: Permission[]
//   [UserRole.USER]: Permission[]
//   [UserRole.VIEWER]: Permission[]
// }

// // API Response types
// export interface ApiResponse<T = any> {
//   success: boolean
//   data?: T
//   message?: string
//   error?: string
//   code?: string
// }

// export interface LoginResponse extends ApiResponse {
//   data?: {
//     token: string
//     user: User
//     organization: Organization
//   }
// }

// export interface RegisterResponse extends ApiResponse {
//   data?: {
//     token: string
//     user: User
//     organization: Organization
//   }
// }

// export interface VerifyTokenResponse extends ApiResponse {
//   data?: {
//     valid: boolean
//     user: User
//     organization: Organization
//   }
// }

// export interface LogoutResponse extends ApiResponse {
//   data?: {
//     message: string
//   }
// }

// // Validation types
// export interface AuthValidation {
//   userId: boolean
//   name: boolean
//   email: boolean
//   organizationId: boolean
//   organizationName: boolean
// }

// export interface AuthFormErrors {
//   userId?: string
//   name?: string
//   email?: string
//   organizationId?: string
//   organizationName?: string
//   general?: string
// }

// // Local storage keys
// export const AUTH_STORAGE_KEYS = {
//   TOKEN: 'freightchat_token',
//   USER: 'freightchat_user',
//   ORGANIZATION: 'freightchat_org',
//   SESSION_EXPIRY: 'freightchat_expiry',
//   THEME_PREFERENCE: 'freightchat_theme'
// } as const

// // Error codes
// export enum AuthErrorCode {
//   INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
//   USER_NOT_FOUND = 'USER_NOT_FOUND',
//   ORGANIZATION_NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
//   ORGANIZATION_INACTIVE = 'ORGANIZATION_INACTIVE',
//   USER_INACTIVE = 'USER_INACTIVE',
//   TOKEN_EXPIRED = 'TOKEN_EXPIRED',
//   TOKEN_INVALID = 'TOKEN_INVALID',
//   PERMISSION_DENIED = 'PERMISSION_DENIED',
//   VALIDATION_ERROR = 'VALIDATION_ERROR',
//   NETWORK_ERROR = 'NETWORK_ERROR',
//   UNKNOWN_ERROR = 'UNKNOWN_ERROR'
// }

// // Auth context type for React context
// export interface AuthContextType {
//   // State
//   isAuthenticated: boolean
//   user: User | null
//   organization: Organization | null
//   token: string | null
//   loading: boolean
//   error: AuthError | null
  
//   // Actions
//   login: (credentials: LoginRequest) => Promise<void>
//   register: (userData: RegisterRequest) => Promise<void>
//   logout: () => void
//   clearError: () => void
//   refreshToken: () => Promise<void>
//   hasPermission: (permission: Permission) => boolean
//   hasRole: (role: UserRole) => boolean
  
//   // Utilities
//   isTokenExpired: () => boolean
//   getRemainingTokenTime: () => number
// }

// // Default role permissions mapping
// export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
//   [UserRole.SUPER_ADMIN]: [
//     Permission.UPLOAD_DOCUMENTS,
//     Permission.VIEW_DOCUMENTS,
//     Permission.EDIT_DOCUMENTS,
//     Permission.DELETE_DOCUMENTS,
//     Permission.EXPORT_DOCUMENTS,
//     Permission.MANAGE_ORGANIZATION,
//     Permission.VIEW_ORGANIZATION,
//     Permission.MANAGE_USERS,
//     Permission.VIEW_USERS,
//     Permission.VIEW_ANALYTICS,
//     Permission.EXPORT_ANALYTICS
//   ],
//   [UserRole.ORGANIZATION_ADMIN]: [
//     Permission.UPLOAD_DOCUMENTS,
//     Permission.VIEW_DOCUMENTS,
//     Permission.EDIT_DOCUMENTS,
//     Permission.DELETE_DOCUMENTS,
//     Permission.EXPORT_DOCUMENTS,
//     Permission.MANAGE_ORGANIZATION,
//     Permission.VIEW_ORGANIZATION,
//     Permission.MANAGE_USERS,
//     Permission.VIEW_USERS,
//     Permission.VIEW_ANALYTICS,
//     Permission.EXPORT_ANALYTICS
//   ],
//   [UserRole.USER]: [
//     Permission.UPLOAD_DOCUMENTS,
//     Permission.VIEW_DOCUMENTS,
//     Permission.EDIT_DOCUMENTS,
//     Permission.EXPORT_DOCUMENTS,
//     Permission.VIEW_ORGANIZATION,
//     Permission.VIEW_ANALYTICS
//   ],
//   [UserRole.VIEWER]: [
//     Permission.VIEW_DOCUMENTS,
//     Permission.VIEW_ORGANIZATION,
//     Permission.VIEW_ANALYTICS
//   ]
// }

// // Helper type guards
// export const isAuthError = (error: any): error is AuthError => {
//   return error && typeof error === 'object' && 'error' in error && 'code' in error
// }

// export const isUser = (user: any): user is User => {
//   return user && typeof user === 'object' && 'userId' in user && 'name' in user && 'organizationId' in user
// }

// export const isOrganization = (org: any): org is Organization => {
//   return org && typeof org === 'object' && 'organizationId' in org && 'name' in org
// }

// export const isSession = (session: any): session is Session => {
//   return session && typeof session === 'object' && 'token' in session && 'user' in session && 'organization' in session
// }