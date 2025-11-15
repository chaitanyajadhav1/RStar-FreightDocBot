import React from 'react'
import { Menu, Truck, Sun, Moon , LogOut, Ship,Users, Home } from 'lucide-react'
import { User } from '../../../types/auth'

interface HeaderProps {
  user: User | null
  darkMode: boolean
  setDarkMode: (darkMode: boolean) => void
  setSidebarOpen: (open: boolean) => void
  onLogout: () => void
  onAdminDashboard?: () => void
  onUserDashboard?: () => void
  showAdminButton?: boolean
  isAdminView?: boolean
  viewingUser?: User | null
}

export const Header: React.FC<HeaderProps> = ({
  user,
  darkMode,
  setDarkMode,
  setSidebarOpen,
  onLogout,
  onAdminDashboard,
  onUserDashboard,
  showAdminButton = false,
  isAdminView = false,
  viewingUser = null
}) => {
  if (!user) return null

  const isAdmin = user.role === 'admin'
  const isViewingMember = isAdmin && viewingUser && viewingUser.userId !== user.userId

  return (
    <header className={`sticky top-0 z-50 backdrop-blur-lg ${darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-teal-100'} border-b shadow-sm`}>
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            {!isAdminView && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors duration-200"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/30">
<Ship className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-teal-700 to-teal-500 bg-clip-text text-transparent">
                RStar - FreightDocBot
              </h1>
              {isAdmin && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                  Admin
                </span>
              )}
              {isViewingMember && (
                <div className="flex items-center gap-2 ml-2 px-3 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700">
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                    Viewing:
                  </span>
                  <span className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                    {viewingUser.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                {isAdminView ? (
                  <button
                    onClick={onUserDashboard}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-200"
                    title="Go to My Dashboard"
                  >
                    <Home className="w-4 h-4" />
                    <span className="hidden sm:inline">My Dashboard</span>
                  </button>
                ) : (
                  <button
                    onClick={onAdminDashboard}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 dark:text-purple-300 rounded-lg bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors duration-200"
                    title="Admin Dashboard"
                  >
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline">Admin Dashboard</span>
                  </button>
                )}
              </>
            )}
            
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-200"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-900/30 dark:to-teal-800/30 rounded-full">
              <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center text-white font-semibold text-xs">
                {user.name[0]}
              </div>
              <span className="font-semibold text-slate-900 dark:text-white text-sm hidden sm:inline">{user.name}</span>
            </div>
            <button 
              onClick={onLogout}
              className="flex items-center gap-1 px-3 py-1.5 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-700 dark:hover:text-orange-400 transition-colors duration-200 font-semibold text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}