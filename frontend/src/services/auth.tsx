import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { api, type User, type UserOrgDetail } from './api'

interface AuthState {
  token: string | null
  user: User | null
  permissions: string[]
  memberships: UserOrgDetail[]
  activeMembershipId: number | null
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  switchMembership: (membershipId: number) => Promise<void>
  refreshAuthorization: (membershipId?: number | null) => Promise<void>
  hasPermission: (perm: string) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'leah_token'
const USER_KEY = 'leah_user'
const PERMS_KEY = 'leah_perms'
const MEMBERSHIPS_KEY = 'leah_memberships'
const ACTIVE_MEMBERSHIP_KEY = 'leah_active_membership'

function loadState(): AuthState {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null')
    const permissions = JSON.parse(localStorage.getItem(PERMS_KEY) || '[]')
    const memberships = JSON.parse(localStorage.getItem(MEMBERSHIPS_KEY) || '[]')
    const activeMembershipId = Number(localStorage.getItem(ACTIVE_MEMBERSHIP_KEY)) || null
    return { token, user, permissions, memberships, activeMembershipId }
  } catch {
    return { token: null, user: null, permissions: [], memberships: [], activeMembershipId: null }
  }
}

function saveState(state: AuthState) {
  const { token, user, permissions, memberships, activeMembershipId } = state
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    localStorage.setItem(PERMS_KEY, JSON.stringify(permissions))
    localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(memberships))
    if (activeMembershipId) localStorage.setItem(ACTIVE_MEMBERSHIP_KEY, String(activeMembershipId))
    else localStorage.removeItem(ACTIVE_MEMBERSHIP_KEY)
  } else {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(PERMS_KEY)
    localStorage.removeItem(MEMBERSHIPS_KEY)
    localStorage.removeItem(ACTIVE_MEMBERSHIP_KEY)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const authorizationRequest = useRef(0)
  const [state, setState] = useState<AuthState>(() => {
    const s = loadState()
    api.setToken(s.token)  // set token BEFORE first render
    api.setMembership(s.activeMembershipId)
    return s
  })

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    if (!state.token) return
    const requestID = ++authorizationRequest.current
    api.me().then(response => {
      if (requestID !== authorizationRequest.current) return
      api.setMembership(response.active_membership_id || null)
      setState(current => ({
        ...current,
        user: response.user,
        permissions: response.permissions,
        memberships: response.memberships,
        activeMembershipId: response.active_membership_id || null,
      }))
    }).catch(() => {
      if (requestID !== authorizationRequest.current) return
      api.setToken(null)
      api.setMembership(null)
      setState({ token: null, user: null, permissions: [], memberships: [], activeMembershipId: null })
    })
    // Session state is refreshed once; later context changes use switchMembership.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password)
    const perms = res.permissions || []
    api.setToken(res.token)  // set BEFORE navigate
    api.setMembership(res.active_membership_id || null)
    setState({ token: res.token, user: res.user, permissions: perms, memberships: res.memberships || [], activeMembershipId: res.active_membership_id || null })
    return res.user
  }

  const logout = () => {
    const emptyState = { token: null, user: null, permissions: [], memberships: [], activeMembershipId: null }
    api.setToken(null)
    api.setMembership(null)
    saveState(emptyState)
    setState(emptyState)
    window.location.href = '/'
  }

  const refreshAuthorization = async (membershipId: number | null = state.activeMembershipId) => {
    const requestID = ++authorizationRequest.current
    try {
      const response = await api.me(membershipId)
      if (requestID !== authorizationRequest.current) return
      api.setMembership(response.active_membership_id || null)
      setState(current => ({
        ...current,
        user: response.user,
        permissions: response.permissions,
        memberships: response.memberships,
        activeMembershipId: response.active_membership_id,
      }))
    } catch (error) {
      if (requestID !== authorizationRequest.current) return
      throw error
    }
  }

  const switchMembership = (membershipId: number) => refreshAuthorization(membershipId)

  const hasPermission = (perm: string): boolean => {
    if (state.user?.is_root) return true
    if (state.user?.role === 'admin' && !perm.startsWith('settings.')) return true
    return state.permissions.includes(perm)
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, switchMembership, refreshAuthorization, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
