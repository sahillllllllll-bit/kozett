import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import MemberPage from './pages/MemberPages'
import {
  AssessmentDetailsPage,
  AssessmentResultsPage,
  AssessmentTestPage,
  CertificateVerificationPage,
  CertificatesPage,
  MyCertificateDetailPage,
  MyCertificatesPage,
} from './pages/CertificatesPage'
import ProfilePage from './pages/ProfilePage'
import ProfileSettingsPage from './pages/ProfileSettingsPage'
import PublicProfilePage from './pages/PublicProfilePage'
import SignupPage from './pages/SignupPage'
import Dashboard from './pages/Dashboard'
import ContestHubPage from './pages/ContestHubPage'
import FeedPage from './pages/FeedPage'
import { ThemeProvider } from './context/ThemeContext'
import NotificationsPage from './pages/NotificationsPage'
import AdminControlCenter from './pages/AdminControlCenter'
import AdminLoginPage from './pages/AdminLoginPage'
import { ForgotPasswordPage, NewPasswordPage, VerifyResetOtpPage } from './pages/PasswordRecoveryPages'

function AppRoutes() {
  const { pathname } = useLocation()
  const reservedRoutes = new Set([
    'ad',
    'certifications',
    'certificates',
    'my-certificates',
    'contest',
    'dashboard',
    'earn',
    'feed',
    'forgot-password',
    'leaderboard',
    'login',
    'notifications',
    'profile',
    'reset-password',
    'signup',
    'verify',
  ])
  const pathSegments = pathname.split('/').filter(Boolean)
  const isPublicProfilePath =
    pathSegments.length === 1 && !reservedRoutes.has(pathSegments[0].toLowerCase())

  return (
    <div className='site-shell min-h-screen'>
      {!isPublicProfilePath && !pathname.startsWith('/ad') && <Navbar />}
      <main>
        <Routes>
          <Route path='/ad/login' element={<AdminLoginPage />} />
          <Route path='/ad/forgot-password' element={<ForgotPasswordPage scope='admin' />} />
          <Route path='/ad/reset-password/verify' element={<VerifyResetOtpPage scope='admin' />} />
          <Route path='/ad/reset-password/new' element={<NewPasswordPage scope='admin' />} />
          <Route path='/ad/*' element={<AdminControlCenter />} />
          <Route path='/' element={<HomePage />} />
          <Route path='/login' element={<LoginPage />} />
          <Route path='/forgot-password' element={<ForgotPasswordPage scope='user' />} />
          <Route path='/reset-password/verify' element={<VerifyResetOtpPage scope='user' />} />
          <Route path='/reset-password/new' element={<NewPasswordPage scope='user' />} />
          <Route path='/signup' element={<SignupPage />} />
          <Route path='/certifications' element={<Navigate to='/my-certificates' replace />} />
          <Route path='/certificates' element={<CertificatesPage />} />
          <Route path='/certificates/:assessmentSlug/test' element={<ProtectedRoute><AssessmentTestPage /></ProtectedRoute>} />
          <Route path='/certificates/:assessmentSlug/results/:attemptId' element={<ProtectedRoute><AssessmentResultsPage /></ProtectedRoute>} />
          <Route path='/certificates/:assessmentSlug' element={<AssessmentDetailsPage />} />
          <Route path='/my-certificates' element={<ProtectedRoute><MyCertificatesPage /></ProtectedRoute>} />
          <Route path='/my-certificates/:certificateId' element={<ProtectedRoute><MyCertificateDetailPage /></ProtectedRoute>} />
          <Route path='/verify/:certificateId' element={<CertificateVerificationPage />} />
          <Route path='/contest' element={<ContestHubPage />} />
          <Route path='/feed/post/:postId' element={<ProtectedRoute><FeedPage mode='detail' /></ProtectedRoute>} />
          <Route path='/feed/saved' element={<ProtectedRoute><FeedPage mode='saved' /></ProtectedRoute>} />
          <Route path='/feed' element={<ProtectedRoute><MemberPage page='feed' /></ProtectedRoute>} />
          <Route path='/notifications' element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path='/earn' element={<ProtectedRoute><MemberPage page='earn' /></ProtectedRoute>} />
          <Route path='/leaderboard' element={<ProtectedRoute><MemberPage page='leaderboard' /></ProtectedRoute>} />

          <Route
            path='/dashboard'
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path='/profile/settings'
            element={
              <ProtectedRoute>
                <ProfileSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path='/profile'
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path='/:username' element={<PublicProfilePage />} />
          <Route path='*' element={<Navigate to='/' replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <NotificationProvider>
            <AppRoutes />
          </NotificationProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
