import { useSessionStore, type SessionTokens } from '../../features/auth/model/sessionStore'
import { API_BASE_URL } from '../config/env'

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  auth?: boolean
  retryAfterRefresh?: boolean
}

export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(status: number, payload: unknown) {
    super(getApiErrorMessage(payload))
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

function findMessage(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = findMessage(item)
      if (message) return message
    }
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    for (const key of ['detail', 'details', 'message']) {
      if (!(key in record)) continue
      const message = findMessage(record[key])
      if (message) return message
    }
    for (const [key, item] of Object.entries(record)) {
      if (key === 'code' || key === 'request_id') continue
      const message = findMessage(item)
      if (message) return message
    }
  }
  return null
}

export function getApiErrorMessage(payload: unknown): string {
  return findMessage(payload) ?? 'Не удалось выполнить запрос. Попробуйте ещё раз.'
}

let refreshRequest: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken, setTokens, clearSession } = useSessionStore.getState()
  if (!refreshToken) return false

  try {
    const response = await fetch(`${API_BASE_URL}/auth/token/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    })

    if (!response.ok) {
      clearSession()
      return false
    }

    setTokens((await response.json()) as SessionTokens)
    return true
  } catch {
    return false
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, retryAfterRefresh = true, headers, ...requestInit } = options
  const accessToken = useSessionStore.getState().accessToken
  const requestHeaders = new Headers(headers)

  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json')
  if (auth && accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(`${API_BASE_URL}/${path.replace(/^\/+/, '')}`, {
    ...requestInit,
    headers: requestHeaders,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401 && auth && retryAfterRefresh) {
    refreshRequest ??= refreshAccessToken().finally(() => {
      refreshRequest = null
    })

    if (await refreshRequest) {
      return apiRequest<T>(path, { ...options, retryAfterRefresh: false })
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new ApiError(response.status, payload)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
