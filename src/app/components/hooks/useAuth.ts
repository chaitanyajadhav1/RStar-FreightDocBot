import { useState, useEffect } from 'react'
import { User, Organization, AuthData } from '../../../types/auth'

export const useAuth = () => {
  const [authDialogOpen, setAuthDialogOpen] = useState(true)
  const [isLogin, setIsLogin] = useState(true)
  const [authRole, setAuthRole] = useState<'admin' | 'user'>('user')
  const [user, setUser] = useState<User | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [authData, setAuthData] = useState<AuthData>({
    userId: "",
    name: "",
    email: "",
    password: "",
    organizationId: "",
    organizationName: "",
    createNewOrganization: false,
    role: 'member',
  })

  useEffect(() => {
    const savedToken = sessionStorage.getItem("freightchat_token")
    const savedUser = sessionStorage.getItem("freightchat_user")
    const savedOrg = sessionStorage.getItem("freightchat_org")

    if (savedToken && savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        const orgData = savedOrg ? JSON.parse(savedOrg) : null
        setToken(savedToken)
        setUser(userData)
        setOrganization(orgData)
        setAuthDialogOpen(false)
      } catch (error) {
        console.error("Error loading saved session:", error)
        sessionStorage.removeItem("freightchat_token")
        sessionStorage.removeItem("freightchat_user")
        sessionStorage.removeItem("freightchat_org")
      }
    }
  }, [])

  const handleAuthDataChange = (field: keyof AuthData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setAuthData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }))
  }

  const logout = () => {
    setUser(null)
    setOrganization(null)
    setToken(null)
    setAuthDialogOpen(true)
    sessionStorage.removeItem("freightchat_token")
    sessionStorage.removeItem("freightchat_user")
    sessionStorage.removeItem("freightchat_org")
  }

  const handleSetRole = (role: 'admin' | 'user') => {
    setAuthRole(role)
    // When switching to admin mode, automatically set createNewOrganization to true
    if (role === 'admin') {
      setAuthData(prev => ({
        ...prev,
        createNewOrganization: true,
        role: 'admin'
      }))
    } else {
      setAuthData(prev => ({
        ...prev,
        createNewOrganization: false,
        role: 'member',
        organizationName: '',
        organizationEmail: '',
        organizationPhone: '',
        organizationAddress: '',
        industry: '',
        size: ''
      }))
    }
  }

  return {
    authDialogOpen,
    setAuthDialogOpen,
    isLogin,
    setIsLogin,
    authRole,
    setAuthRole: handleSetRole,
    user,
    setUser,
    organization,
    setOrganization,
    token,
    setToken,
    loading,
    setLoading,
    authData,
    setAuthData,
    handleAuthDataChange,
    logout
  }
}