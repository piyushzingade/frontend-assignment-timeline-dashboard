import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, clearStoredToken, getStoredToken, setUnauthorizedHandler, storeToken } from '../lib/api'
import type { CurrentUser } from '../types'
import { AuthContext } from './auth-context'

export type AuthState = {
  user: CurrentUser | null
  booting: boolean
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState(() => getStoredToken())
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [booting, setBooting] = useState(true)

  const expireSession = useCallback(() => {
    clearStoredToken()
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(expireSession)
    return () => setUnauthorizedHandler(null)
  }, [expireSession])

  useEffect(() => {
    let cancelled = false

    async function restore() {
      if (!token) {
        setBooting(false)
        return
      }

      try {
        const profile = await api.me()
        if (!cancelled) setUser(profile)
      } catch {
        if (!cancelled) expireSession()
      } finally {
        if (!cancelled) setBooting(false)
      }
    }

    restore()
    return () => {
      cancelled = true
    }
  }, [expireSession, token])

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.login(username, password)
    storeToken(response.access_token)
    setToken(response.access_token)
    const profile = await api.me()
    setUser(profile)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      expireSession()
    }
  }, [expireSession])

  const value = useMemo(() => ({ user, booting, token, login, logout }), [user, booting, token, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
