import { Link } from 'react-router-dom'
import { Button, Paper } from '@mui/material'
import { FileQuestion } from 'lucide-react'

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
      <Paper component="section" elevation={1} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500">
          <FileQuestion size={24} />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">404</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-950">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">The page you are looking for does not exist or was moved.</p>
        <Button className="mt-6" component={Link} to="/dashboard" variant="contained">
          Go to dashboard
        </Button>
      </Paper>
    </main>
  )
}
