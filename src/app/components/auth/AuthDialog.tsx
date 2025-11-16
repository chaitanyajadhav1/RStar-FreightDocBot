import React, { useEffect, useState } from 'react'
import { Truck, Eye, EyeOff, User, Shield } from 'lucide-react'

interface AuthData {
  userId: string
  name: string
  email?: string
  password: string
  organizationId: string
  organizationName: string
  createNewOrganization: boolean
  role?: 'admin' | 'manager' | 'member' | 'viewer'
}

interface AuthDialogProps {
  isLogin: boolean
  authData: AuthData
  loading: boolean
  onAuthDataChange: (field: keyof AuthData) => (event: React.ChangeEvent<HTMLInputElement>) => void
  onSetCreateNewOrganization: (value: boolean) => void
  onToggleMode: () => void
  onAuth: () => void
  onSetRole?: (role: 'admin' | 'user') => void
  authRole?: 'admin' | 'user'
}

export const AuthDialog: React.FC<AuthDialogProps> = ({
  isLogin,
  authData,
  loading,
  onAuthDataChange,
  onSetCreateNewOrganization,
  onToggleMode,
  onAuth,
  onSetRole,
  authRole = 'user'
}) => {
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (authRole === 'admin' && !authData.createNewOrganization) {
      onSetCreateNewOrganization(true)
    }
    if (authRole === 'user' && authData.createNewOrganization) {
      onSetCreateNewOrganization(false)
    }
  }, [authRole, authData.createNewOrganization, onSetCreateNewOrganization])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      onAuth()
    }
  }

  const isAdminMode = authRole === 'admin'

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-50 to-teal-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-xl ${isAdminMode ? 'bg-purple-50 dark:bg-purple-900/30' : 'bg-teal-50 dark:bg-teal-900/30'}`}>
              {isAdminMode ? (
                <Shield className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              ) : (
                <Truck className="w-8 h-8 text-teal-600 dark:text-teal-400" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {isLogin 
                  ? (isAdminMode ? "Admin Login 🔐" : "Welcome Back! 👋")
                  : (isAdminMode ? "Admin Registration 🚀" : "Create Your Account 🚀")
                }
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                {isLogin 
                  ? (isAdminMode ? "Sign in as administrator" : "Sign in to continue to RStar - FreightDocBot ")
                  : (isAdminMode ? "Register as an administrator" : "Join RStar - FreightDocBot today")
                }
              </p>
            </div>
          </div>

          {/* Role Selector - Only show during registration, not login */}
          {onSetRole && !isLogin && (
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Register as:</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onSetRole('user')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    !isAdminMode
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-500'
                  }`}
                >
                  <User className="w-4 h-4" />
                  User
                </button>
                <button
                  type="button"
                  onClick={() => onSetRole('admin')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isAdminMode
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-500'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </button>
              </div>
            </div>
          )}
          
          {/* Login Mode Indicator - Show which mode you're logging in as */}
          {isLogin && (
            <div className={`mt-4 p-3 rounded-lg border ${
              isAdminMode 
                ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700' 
                : 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700'
            }`}>
              <div className="flex items-center gap-2">
                {isAdminMode ? (
                  <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                ) : (
                  <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                )}
                <p className={`text-xs font-medium ${
                  isAdminMode 
                    ? 'text-purple-900 dark:text-purple-300' 
                    : 'text-teal-900 dark:text-teal-300'
                }`}>
                  {isAdminMode 
                    ? 'Admin Login Mode - Only admin accounts can login here' 
                    : 'User Login Mode - Only member accounts can login here'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          {/* User ID */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              User ID *
            </label>
            <input
              type="text"
              value={authData.userId}
              onChange={onAuthDataChange("userId")}
              onKeyPress={handleKeyPress}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:text-white"
              placeholder="e.g., user123"
              autoComplete="username"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              3-50 characters (letters, numbers, _ or -)
            </p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={authData.password}
                onChange={onAuthDataChange("password")}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 pr-10 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:text-white"
                placeholder={isLogin ? "Enter your password" : "Min 8 chars, letters & numbers"}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {!isLogin && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                At least 8 characters with letters and numbers
              </p>
            )}
          </div>
          
          {!isLogin && (
            <>
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={authData.name}
                  onChange={onAuthDataChange("name")}
                  onKeyPress={handleKeyPress}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:text-white"
                  placeholder="e.g., John Doe"
                  autoComplete="name"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={authData.email || ''}
                  onChange={onAuthDataChange("email")}
                  onKeyPress={handleKeyPress}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:text-white"
                  placeholder="e.g., john.doe@company.com"
                  autoComplete="email"
                />
              </div>
              
              {/* Organization Setup - Only show for regular users */}
              {isAdminMode ? (
                // Admin registration - must create new organization
                <div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg mb-4">
                    <p className="text-sm text-purple-900 dark:text-purple-300 font-medium">
                      ⚠️ Admin accounts must create a new organization
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Organization ID *
                    </label>
                    <input
                      type="text"
                      value={authData.organizationId}
                      onChange={onAuthDataChange("organizationId")}
                      onKeyPress={handleKeyPress}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-slate-700 dark:text-white"
                      placeholder="e.g., admin_org_001"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Unique identifier for your organization
                    </p>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      value={authData.organizationName}
                      onChange={onAuthDataChange("organizationName")}
                      onKeyPress={handleKeyPress}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-slate-700 dark:text-white"
                      placeholder="e.g., Admin Organization"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      You'll become the admin of this organization
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded-lg">
                    <h4 className="font-semibold text-teal-900 dark:text-teal-300 mb-1 text-sm">Join Your Organization</h4>
                    <p className="text-xs text-teal-900/80 dark:text-teal-200">
                      Members can only join existing organizations. Ask your administrator for the organization ID.
                    </p>
                  </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Organization ID *
                  </label>
                  <input
                    type="text"
                    value={authData.organizationId}
                    onChange={onAuthDataChange("organizationId")}
                    onKeyPress={handleKeyPress}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:text-white"
                    placeholder="e.g., acme_corp"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Ask your admin for the organization ID
                  </p>
                </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={onToggleMode}
            className="px-4 py-2 text-teal-700 dark:text-teal-400 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors duration-200 font-semibold text-sm order-2 sm:order-1"
          >
            {isLogin ? "Create Account" : "Sign In Instead"}
          </button>
          <div className="flex gap-2 order-1 sm:order-2">
            <button
              onClick={onAuth}
              disabled={loading}
              className={`flex-1 sm:flex-none px-6 py-2 text-white rounded-lg hover:shadow-lg transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-sm ${
                isAdminMode
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500'
                  : 'bg-gradient-to-r from-teal-600 to-teal-500'
              }`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
              ) : (
                isLogin 
                  ? (isAdminMode ? "Admin Login" : "Sign In")
                  : (isAdminMode ? "Register as Admin" : "Create Account")
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}