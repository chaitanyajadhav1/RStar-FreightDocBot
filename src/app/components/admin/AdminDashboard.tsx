"use client"

import React, { useState, useEffect, ChangeEvent } from 'react'
import { Users, FileText, ChevronRight, User, Search, Eye, Edit, MessageSquare, X, Send } from 'lucide-react'
import { API_BASE } from '../../../utils/constants'

interface UserWithCounts {
  userId: string
  name: string
  email?: string
  role: string
  isActive: boolean
  createdAt: string
  lastAccessed: string
  documentCounts: {
    total: number
    invoices: number
    scomet: number
    packingLists: number
    fumigation: number
    exportDeclarations: number
    airwayBills: number
    documents: number
  }
}

type UserRole = 'admin' | 'manager' | 'member' | 'viewer'

interface AdminDashboardProps {
  token: string
  onSelectUser: (userId: string) => void
  selectedUserId?: string
  darkMode: boolean
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  token,
  onSelectUser,
  selectedUserId,
  darkMode
}) => {
  const [users, setUsers] = useState<UserWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [manageUser, setManageUser] = useState<UserWithCounts | null>(null)
  const [manageRole, setManageRole] = useState<UserRole>('member')
  const [manageActive, setManageActive] = useState<boolean>(true)
  const [adminMessage, setAdminMessage] = useState('')
  const [manageSaving, setManageSaving] = useState(false)
  const [manageStatus, setManageStatus] = useState<string | null>(null)
  const [manageError, setManageError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [token])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${API_BASE}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch users')
      }

      const data = await response.json()
      setUsers((data.users || []) as UserWithCounts[])
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError(err.message || 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter((user: UserWithCounts) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      user.name.toLowerCase().includes(searchLower) ||
      user.userId.toLowerCase().includes(searchLower) ||
      (user.email && user.email.toLowerCase().includes(searchLower))
    )
  })

  const handleOpenManageUser = (user: UserWithCounts) => {
    setManageUser(user)
    setManageRole(user.role as UserRole)
    setManageActive(user.isActive)
    setAdminMessage('')
    setManageStatus(null)
    setManageError(null)
  }

  const handleCloseManageUser = () => {
    setManageUser(null)
    setManageStatus(null)
    setManageError(null)
    setAdminMessage('')
  }

  const handleSaveUserChanges = async () => {
    if (!manageUser) return

    const payload: Record<string, unknown> = {
      targetUserId: manageUser.userId
    }

    if (manageRole !== manageUser.role) {
      payload.role = manageRole
    }

    if (manageActive !== manageUser.isActive) {
      payload.isActive = manageActive
    }

    if (adminMessage.trim()) {
      payload.adminNote = adminMessage.trim()
    }

    if (Object.keys(payload).length === 1) {
      setManageError('No changes to save. Update role/status or add a message before saving.')
      setManageStatus(null)
      return
    }

    try {
      setManageSaving(true)
      setManageError(null)
      setManageStatus(null)

      const response = await fetch(`${API_BASE}/organizations/users`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update user')
      }

      setUsers((prev: UserWithCounts[]) =>
        prev.map((u: UserWithCounts) =>
          u.userId === manageUser.userId
            ? {
                ...u,
                role: result.user.role as UserRole,
                isActive: result.user.isActive
              }
            : u
        )
      )

      setManageUser(prev =>
        prev
          ? {
              ...prev,
              role: result.user.role as UserRole,
              isActive: result.user.isActive
            }
          : prev
      )

      setManageStatus(
        adminMessage.trim()
          ? 'Update saved and message delivered to the member.'
          : 'User details updated successfully.'
      )
      setAdminMessage('')
    } catch (err: any) {
      console.error('Error updating user:', err)
      setManageError(err.message || 'Failed to update user')
    } finally {
      setManageSaving(false)
    }
  }

  const totalDocuments = users.reduce((sum: number, user: UserWithCounts) => sum + user.documentCounts.total, 0)
  const activeUsers = users.filter((user: UserWithCounts) => user.isActive).length

  return (
    <div className={`h-full w-full ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-teal-900/30' : 'bg-teal-100'}`}>
              <Users className={`w-6 h-6 ${darkMode ? 'text-teal-400' : 'text-teal-600'}`} />
            </div>
            <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              Admin Dashboard
            </h1>
          </div>
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Manage users and view their documents
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className={`p-4 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Total Users
                </p>
                <p className={`text-2xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {users.length}
                </p>
              </div>
              <User className={`w-8 h-8 ${darkMode ? 'text-teal-400' : 'text-teal-600'}`} />
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Active Users
                </p>
                <p className={`text-2xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {activeUsers}
                </p>
              </div>
              <Users className={`w-8 h-8 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Total Documents
                </p>
                <p className={`text-2xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {totalDocuments}
                </p>
              </div>
              <FileText className={`w-8 h-8 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              type="text"
              placeholder="Search users by name, ID, or email..."
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                darkMode 
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' 
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'
              } focus:ring-2 focus:ring-teal-500 focus:border-teal-500`}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`mb-4 p-4 rounded-lg border ${
            darkMode ? 'bg-red-900/20 border-red-700 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {error}
          </div>
        )}

        {/* Users Table */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className={`text-center py-12 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            {searchTerm ? 'No users found matching your search.' : 'No users found.'}
          </div>
        ) : (
          <div className={`rounded-lg border overflow-hidden ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className={`overflow-x-auto ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className={`border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      darkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      User
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      darkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Role
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      darkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Documents
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      darkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Status
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      darkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-200'}`}>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.userId}
                      className={`hover:${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'} transition-colors ${
                        selectedUserId === user.userId 
                          ? darkMode ? 'bg-teal-900/20' : 'bg-teal-50' 
                          : ''
                      }`}
                    >
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                            darkMode ? 'bg-slate-700' : 'bg-slate-200'
                          }`}>
                            <User className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} />
                          </div>
                          <div className="ml-3 sm:ml-4 min-w-0 flex-1">
                            <div className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-900'} truncate`}>
                              {user.name}
                            </div>
                            <div className={`text-xs sm:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'} truncate`}>
                              {user.userId}
                            </div>
                            {user.email && (
                              <div className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'} truncate`}>
                                {user.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'admin'
                            ? darkMode ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-800'
                            : user.role === 'manager'
                            ? darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-800'
                            : darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="text-sm">
                          <div className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            {user.documentCounts.total} total
                          </div>
                          <div className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'} break-words`}>
                            <span className="inline-block mr-2">{user.documentCounts.invoices} invoices</span>
                            <span className="inline-block mr-2">{user.documentCounts.scomet} SCOMET</span>
                            <span className="inline-block mr-2">{user.documentCounts.packingLists} packing lists</span>
                            <span className="inline-block mr-2">{user.documentCounts.fumigation} fumigation</span>
                            <span className="inline-block mr-2">{user.documentCounts.exportDeclarations} export declarations</span>
                            <span className="inline-block">{user.documentCounts.airwayBills} airway bills</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.isActive
                            ? darkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-800'
                            : darkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm font-medium">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => onSelectUser(user.userId)}
                            className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                              selectedUserId === user.userId
                                ? darkMode 
                                  ? 'bg-teal-600 text-white' 
                                  : 'bg-teal-600 text-white'
                                : darkMode
                                ? 'text-teal-400 hover:bg-slate-700'
                                : 'text-teal-600 hover:bg-teal-50'
                            }`}
                          >
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">View Dashboard</span>
                            <span className="sm:hidden">View</span>
                          </button>
                          <button
                            onClick={() => handleOpenManageUser(user)}
                            className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                              darkMode
                                ? 'text-slate-200 hover:bg-slate-700'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <Edit className="w-4 h-4" />
                            <span className="hidden sm:inline">Manage</span>
                            <span className="sm:hidden">Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {manageUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className={`w-full max-w-xl rounded-2xl shadow-2xl border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div>
                <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  Manage User • {manageUser.name}
                </h3>
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {manageUser.userId}{manageUser.email ? ` • ${manageUser.email}` : ''}
                </p>
              </div>
              <button
                onClick={handleCloseManageUser}
                className={`p-2 rounded-lg ${darkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Role
                  </label>
                  <select
                    value={manageRole}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setManageRole(e.target.value as UserRole)}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Status
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setManageActive(true)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        manageActive
                          ? darkMode
                            ? 'bg-teal-600 text-white shadow'
                            : 'bg-teal-600 text-white shadow'
                          : darkMode
                          ? 'bg-slate-800 text-slate-300 border border-slate-700'
                          : 'bg-white text-slate-600 border border-slate-300'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => setManageActive(false)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        !manageActive
                          ? darkMode
                            ? 'bg-red-600 text-white shadow'
                            : 'bg-red-600 text-white shadow'
                          : darkMode
                          ? 'bg-slate-800 text-slate-300 border border-slate-700'
                          : 'bg-white text-slate-600 border border-slate-300'
                      }`}
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <MessageSquare className="w-4 h-4" />
                  Message to Member
                  <span className="text-[10px] font-normal uppercase tracking-tight bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                </label>
                <textarea
                  value={adminMessage}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAdminMessage(e.target.value)}
                  rows={4}
                  placeholder="e.g., Please re-upload the commercial invoice. The previous file had missing signatures."
                  className={`w-full px-3 py-2 rounded-lg border text-sm resize-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500'}`}
                />
                <p className={`text-[11px] mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  Members will see this note when they next log in.
                </p>
              </div>

              {manageError && (
                <div className={`px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-red-900/30 text-red-300 border border-red-800' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {manageError}
                </div>
              )}
              {manageStatus && (
                <div className={`px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-teal-900/30 text-teal-200 border border-teal-800' : 'bg-teal-50 text-teal-700 border border-teal-200'}`}>
                  {manageStatus}
                </div>
              )}
            </div>

            <div className={`flex items-center justify-between px-6 py-4 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <button
                onClick={handleCloseManageUser}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUserChanges}
                disabled={manageSaving}
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition ${
                  manageSaving
                    ? 'bg-teal-400 text-white opacity-70 cursor-not-allowed'
                    : 'bg-teal-600 text-white hover:bg-teal-500 shadow-md'
                }`}
              >
                {manageSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

