const BASE = '/api'

let _token: string | null = null

export function setToken(t: string | null) {
  _token = t
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (_token) headers['Authorization'] = `Bearer ${_token}`

  const res = await fetch(`${BASE}${url}`, { headers, ...options })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export interface User {
  id: number
  email: string
  name: string
  role: string
  role_id: number | null
  is_superuser?: boolean
  created_at: string
  deleted_at?: string | null
}

export interface Ticket {
  id: number
  title: string
  description: string
  status: string
  priority: string
  assigned_to: number | null
  created_by: number
  updated_by?: number | null
  deleted_by?: number | null
  asset_id?: number | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface Role {
  id: number
  name: string
  label: string
  is_admin: boolean
  created_at: string
}

export interface Permission {
  id: number
  name: string
  module: string
  action: string
}

export interface BinItem {
  type: string
  id: number
  title: string
  deleted_at: string
}

export interface AssetType {
  id: number
  name: string
  created_at: string
}

export interface AssetCategory {
  id: number
  name: string
  parent_id?: number | null
  type_id: number
  created_at: string
}

export interface Asset {
  id: number
  name: string
  type: string
  type_id?: number | null
  category_id?: number | null
  serial: string
  status: string
  location: string
  assigned_to: number | null
  created_by?: number | null
  updated_by?: number | null
  deleted_by?: number | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

interface LoginResponse {
  token: string
  user: User
  permissions: string[]
}

export const api = {
  setToken,

  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: User; permissions: string[] }>('/auth/me'),

  changePassword: (password: string) =>
    request<void>('/auth/password', { method: 'PUT', body: JSON.stringify({ password }) }),

  users: {
    list: () => request<User[]>('/users'),
    get: (id: number) => request<User>(`/users/${id}`),
    create: (data: { email: string; name: string; password: string; role_id: number | null }) =>
      request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { email: string; name: string; role_id: number | null }) =>
      request<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updatePassword: (id: number, password: string) =>
      request<void>(`/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
    delete: (id: number) => request<void>(`/users/${id}`, { method: 'DELETE' }),
  },

  roles: {
    list: () => request<Role[]>('/roles'),
    create: (data: { name: string; label: string; is_admin: boolean }) =>
      request<Role>('/roles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name: string; label: string; is_admin: boolean }) =>
      request<Role>(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/roles/${id}`, { method: 'DELETE' }),
    getPermissions: (id: number) => request<Permission[]>(`/roles/${id}/permissions`),
    setPermissions: (id: number, permission_ids: number[]) =>
      request<void>(`/roles/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permission_ids }) }),
  },

  permissions: {
    list: () => request<Permission[]>('/permissions'),
  },

  assetTypes: {
    list: () => request<AssetType[]>('/asset-types'),
    create: (name: string) => request<AssetType>('/asset-types', { method: 'POST', body: JSON.stringify({ name }) }),
    update: (id: number, name: string) => request<AssetType>(`/asset-types/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
    delete: (id: number) => request<void>(`/asset-types/${id}`, { method: 'DELETE' }),
  },

  assetCategories: {
    list: () => request<AssetCategory[]>('/asset-categories'),
    create: (data: { name: string; type_id: number; parent_id?: number | null }) =>
      request<AssetCategory>('/asset-categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name: string; type_id: number; parent_id?: number | null }) =>
      request<AssetCategory>(`/asset-categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/asset-categories/${id}`, { method: 'DELETE' }),
  },

  bin: {
    list: () => request<BinItem[]>('/bin'),
    restore: (type_: string, id: number) =>
      request<void>(`/bin/${type_}/${id}/restore`, { method: 'POST' }),
    delete: (type_: string, id: number) =>
      request<void>(`/bin/${type_}/${id}`, { method: 'DELETE' }),
  },

  tickets: {
    list: () => request<Ticket[]>('/tickets'),
    get: (id: number) => request<Ticket>(`/tickets/${id}`),
    create: (data: Partial<Ticket>) =>
      request<Ticket>('/tickets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Ticket>) =>
      request<Ticket>(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/tickets/${id}`, { method: 'DELETE' }),
  },

  assets: {
    list: () => request<Asset[]>('/assets'),
    get: (id: number) => request<Asset>(`/assets/${id}`),
    create: (data: Partial<Asset>) =>
      request<Asset>('/assets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Asset>) =>
      request<Asset>(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/assets/${id}`, { method: 'DELETE' }),
  },
}
