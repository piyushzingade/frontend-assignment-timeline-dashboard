import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Alert, Button, Paper, TextField } from '@mui/material'
import { ActivitySquare } from 'lucide-react'
import { ApiError } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import { FieldLabel } from '../components/FieldLabel'

export function LoginPage() {
  const { login, token, user } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [navigate, user])

  if (token && user) return <Navigate to="/dashboard" replace />

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
      navigate('/dashboard', { replace: true })
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
      <Paper component="section" elevation={1} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
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
          <div>
            <FieldLabel htmlFor="login-username">Username</FieldLabel>
            <TextField
              autoComplete="username"
              fullWidth
              id="login-username"
              onChange={(event) => setUsername(event.target.value)}
              size="small"
              value={username}
            />
          </div>

          <div>
            <FieldLabel htmlFor="login-password">Password</FieldLabel>
            <TextField
              autoComplete="current-password"
              fullWidth
              id="login-password"
              onChange={(event) => setPassword(event.target.value)}
              size="small"
              type="password"
              value={password}
            />
          </div>

          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}

          <Button
            disabled={loading}
            fullWidth
            size="large"
            type="submit"
            variant="contained"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </Paper>
    </main>
  )
}
