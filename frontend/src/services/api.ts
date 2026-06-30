const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export interface Ticket {
  id: number
  title: string
  description: string
  status: string
  priority: string
  assigned_to: number | null
  created_by: number
  created_at: string
  updated_at: string
}

export interface Asset {
  id: number
  name: string
  type: string
  serial: string
  status: string
  location: string
  assigned_to: number | null
  created_at: string
  updated_at: string
}

export const api = {
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
