import type {
  AssetNode,
  CurrentUser,
  CycleTimeBucket,
  EntityScope,
  Envelope,
  LoginResponse,
  MachineIntervals,
  ShiftDefinition,
} from '../types'

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL ?? 'https://fractaldmsdev.centralindia.cloudapp.azure.com'
const TOKEN_KEY = 'timeline-dashboard-token'

type ApiOptions = {
  auth?: boolean
  retry?: boolean
  signal?: AbortSignal
}

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, init: RequestInit = {}, options: ApiOptions = {}) {
  const attempts = options.retry === false ? 1 : 3
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const headers = new Headers(init.headers)
      if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

      if (options.auth) {
        const token = getStoredToken()
        if (token) headers.set('Authorization', `Bearer ${token}`)
      }

      const response = await fetch(`${BASE_URL}${path}`, { ...init, headers, signal: options.signal })
      const payload = (await response.json().catch(() => null)) as Envelope<T> | null
      const status = payload?.status_code ?? response.status
      const message = payload?.message ?? response.statusText

      if (!response.ok || status >= 400) {
        if (status === 401 && options.auth) unauthorizedHandler?.()
        if (status >= 500 && attempt < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)))
          continue
        }
        throw new ApiError(status, message, payload)
      }

      return payload?.data as T
    } catch (error) {
      lastError = error
      if (isAbortError(error) || error instanceof ApiError || attempt === attempts - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)))
    }
  }

  throw lastError
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export const api = {
  async login(username: string, password: string) {
    return request<LoginResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) },
      { retry: false },
    )
  },
  me() {
    return request<CurrentUser>('/auth/me', {}, { auth: true, retry: false })
  },
  logout() {
    return request<null>('/auth/logout', { method: 'POST' }, { auth: true, retry: false })
  },
  assets() {
    return request<AssetNode[]>('/core/assets/tree', {}, { auth: true })
  },
  shifts() {
    return request<ShiftDefinition[]>('/core/shifts', {}, { auth: true })
  },
  machineIntervals(entityScope: EntityScope, fromIso: string, toIso: string, exactProduces: boolean, signal?: AbortSignal) {
    return request<MachineIntervals>(
      '/analytics-query/machine-intervals',
      {
        method: 'POST',
        body: JSON.stringify({
          entity_scope: entityScope,
          time_range: { from_ts: fromIso, to_ts: toIso },
          produce_counts: true,
          exact_produces: exactProduces,
          group_produce_counts_by_part_model: true,
        }),
      },
      { auth: true, signal },
    )
  },
  cycleTimes(entityScope: EntityScope, fromIso: string, toIso: string, signal?: AbortSignal) {
    return request<CycleTimeBucket[]>(
      '/analytics-query',
      {
        method: 'POST',
        body: JSON.stringify({
          entity_scope: entityScope,
          metrics: ['ideal_cycle_time_seconds', 'actual_cycle_time_seconds'],
          time_range: { from_ts: fromIso, to_ts: toIso },
          distribution: 'hourly',
        }),
      },
      { auth: true, signal },
    )
  },
}
