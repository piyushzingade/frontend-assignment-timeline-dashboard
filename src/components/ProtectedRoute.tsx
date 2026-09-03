import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Spinner } from './Spinner'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { booting, user } = useAuth()

  if (booting) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100">
        <Spinner label="Restoring session" />
      </main>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return children
}
