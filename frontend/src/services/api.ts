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
  avatar_url?: string | null
  organization_id?: number | null
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
  organization_id?: number | null
  type_id?: number | null
  sla_policy_id?: number | null
  sla_response_at?: string | null
  sla_resolve_at?: string | null
  closed_at?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface TicketType {
  id: number
  name: string
  created_at: string
}

export interface TicketComment {
  id: number
  ticket_id: number
  user_id: number
  content: string
  is_internal: boolean
  created_at: string
  user_name?: string
  user_email?: string
}

export interface TicketStatusHistory {
  id: number
  ticket_id: number
  from_status?: string | null
  to_status: string
  changed_by: number
  note?: string | null
  created_at: string
  changed_by_name?: string
  changed_by_email?: string
}

export interface SLAPolicy {
  id: number
  name: string
  priority: string
  response_hours: number
  resolve_hours: number
  created_at: string
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

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface UserOrgDetail {
  organization_id: number
  org_name: string
  holding_id: number
  holding_name: string
}

export interface Holding {
  id: number
  name: string
  slug: string
  created_at: string
}

export interface Organization {
  id: number
  name: string
  parent_id?: number | null
  holding_id: number
  path: string
  level: number
  created_at: string
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

export interface AssetModel {
  id: number
  name: string
  manufacturer: string
  part_number: string
  category_id?: number | null
  type_id?: number | null
  created_at: string
  updated_at: string
}

export interface Asset {
  id: number
  name: string
  type: string
  type_id?: number | null
  category_id?: number | null
  model_id?: number | null
  serial: string
  status: string
  location: string
  organization_id?: number | null
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

  updateProfile: (data: { name: string }) =>
    request<User>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  uploadAvatar: async (file: File) => {
    const form = new FormData()
    form.append('avatar', file)
    const headers: Record<string, string> = {}
    if (typeof _token === 'string') headers['Authorization'] = `Bearer ${_token}`
    const res = await fetch('/api/auth/avatar', { method: 'POST', body: form, headers })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error)
    }
    return res.json() as Promise<{ avatar_url: string }>
  },

  getMyOrgs: () => request<UserOrgDetail[]>('/auth/organizations'),

  users: {
    list: () => request<User[]>('/users'),
    get: (id: number) => request<User>(`/users/${id}`),
    create: (data: { email: string; name: string; password: string; role_id: number | null; organization_id?: number | null }) =>
      request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { email: string; name: string; role_id: number | null; organization_id?: number | null; org_ids?: number[] }) =>
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

  holdings: {
    list: () => request<Holding[]>('/holdings'),
    create: (data: { name: string; slug: string }) => request<Holding>('/holdings', { method: 'POST', body: JSON.stringify(data) }),
  },

  organizations: {
    list: () => request<Organization[]>('/organizations'),
    create: (data: { name: string; holding_id: number; parent_id?: number | null }) =>
      request<Organization>('/organizations', { method: 'POST', body: JSON.stringify(data) }),
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
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<PaginatedResult<Ticket>>('/tickets' + q)
    },
    get: (id: number) => request<Ticket>(`/tickets/${id}`),
    create: (data: Partial<Ticket>) =>
      request<Ticket>('/tickets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Ticket>) =>
      request<Ticket>(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/tickets/${id}`, { method: 'DELETE' }),
    updateStatus: (id: number, status: string, note?: string) =>
      request<Ticket>(`/tickets/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, note }) }),
    history: (id: number) =>
      request<TicketStatusHistory[]>(`/tickets/${id}/history`),
    comments: {
      list: (id: number) => request<TicketComment[]>(`/tickets/${id}/comments`),
      create: (id: number, data: { content: string; is_internal: boolean }) =>
        request<TicketComment>(`/tickets/${id}/comments`, { method: 'POST', body: JSON.stringify(data) }),
      delete: (id: number, cid: number) =>
        request<void>(`/tickets/${id}/comments/${cid}`, { method: 'DELETE' }),
    },
  },

  ticketTypes: {
    list: () => request<TicketType[]>('/ticket-types'),
    create: (name: string) => request<TicketType>('/ticket-types', { method: 'POST', body: JSON.stringify({ name }) }),
    update: (id: number, name: string) => request<TicketType>(`/ticket-types/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
    delete: (id: number) => request<void>(`/ticket-types/${id}`, { method: 'DELETE' }),
  },

  slaPolicies: {
    list: () => request<SLAPolicy[]>('/sla-policies'),
    create: (data: { name: string; priority: string; response_hours: number; resolve_hours: number }) =>
      request<SLAPolicy>('/sla-policies', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name: string; priority: string; response_hours: number; resolve_hours: number }) =>
      request<SLAPolicy>(`/sla-policies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/sla-policies/${id}`, { method: 'DELETE' }),
  },

  assets: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<PaginatedResult<Asset>>('/assets' + q)
    },
    get: (id: number) => request<Asset>(`/assets/${id}`),
    create: (data: Partial<Asset>) =>
      request<Asset>('/assets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Asset>) =>
      request<Asset>(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<void>(`/assets/${id}`, { method: 'DELETE' }),
    bulk: (data: { model_id: number; quantity: number; serial_numbers?: string[]; serial_prefix?: string; status?: string; organization_id?: number | null }) =>
      request<{ created: number; assets: Asset[] }>('/assets/bulk', { method: 'POST', body: JSON.stringify(data) }),
  },

  assetModels: {
    list: () => request<AssetModel[]>('/asset-models'),
    create: (data: { name: string; manufacturer: string; part_number: string; category_id?: number | null; type_id?: number | null }) =>
      request<AssetModel>('/asset-models', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name: string; manufacturer: string; part_number: string; category_id?: number | null; type_id?: number | null }) =>
      request<AssetModel>(`/asset-models/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/asset-models/${id}`, { method: 'DELETE' }),
  },
}
