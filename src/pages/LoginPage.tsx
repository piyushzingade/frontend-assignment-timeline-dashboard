import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button, Field, Input } from '@base-ui/react'
import { ActivitySquare } from 'lucide-react'
import { ApiError } from '../lib/api'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { login, token, user } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [navigate, user])

  if (token && user) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.')
      return
    }

    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(err.message || 'Invalid username or password.')
      } else {
        setError('Unable to sign in. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-blue-700 text-white">
            <ActivitySquare size={24} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Timeline Dashboard</h1>
            <p className="text-sm text-slate-500">Sign in to inspect production history</p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <Field.Root className="space-y-2">
            <Field.Label className="text-sm font-medium text-slate-700">Username</Field.Label>
            <Input
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-blue-700/20 transition focus:border-blue-700 focus:ring-4"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </Field.Root>

          <Field.Root className="space-y-2">
            <Field.Label className="text-sm font-medium text-slate-700">Password</Field.Label>
            <Input
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-blue-700/20 transition focus:border-blue-700 focus:ring-4"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </Field.Root>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <Button
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-700/25 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </section>
    </main>
  )
}
