import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api, type User } from './api'

interface AuthState {
  token: string | null
  user: User | null
  permissions: string[]
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasPermission: (perm: string) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'leah_token'
const USER_KEY = 'leah_user'
const PERMS_KEY = 'leah_perms'

function loadState(): AuthState {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null')
    const permissions = JSON.parse(localStorage.getItem(PERMS_KEY) || '[]')
    return { token, user, permissions }
  } catch {
    return { token: null, user: null, permissions: [] }
  }
}

function saveState(token: string | null, user: User | null, permissions: string[]) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    localStorage.setItem(PERMS_KEY, JSON.stringify(permissions))
  } else {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(PERMS_KEY)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const s = loadState()
    api.setToken(s.token)  // set token BEFORE first render
    return s
  })

  useEffect(() => {
    saveState(state.token, state.user, state.permissions)
  }, [state.token, state.user, state.permissions])

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password)
    const perms = res.permissions || []
    api.setToken(res.token)  // set BEFORE navigate
    setState({ token: res.token, user: res.user, permissions: perms })
  }

  const logout = () => {
    setState({ token: null, user: null, permissions: [] })
    window.location.href = '/'
  }

  const hasPermission = (perm: string): boolean => {
    if (state.user?.role === 'admin') return true
    return state.permissions.includes(perm)
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
