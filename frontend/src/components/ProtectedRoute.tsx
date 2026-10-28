import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className='flex min-h-[50vh] items-center justify-center text-sm font-medium text-slate-500'>
        Checking your session...
      </div>
    )
  }

  if (!user) {
    const destination = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(destination)}`} replace />
  }

  return <>{children}</>
}
