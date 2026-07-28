import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Spinner } from './memo/Spinner'
import { useAuth } from './lib/auth/AuthContext'
import { readPendingInvite } from './lib/pendingInvite'

// Chargement à la demande : WorkspaceShell embarque Tiptap, lowlight et
// socket.io, inutiles tant qu'on n'est pas connecté.
const WorkspaceShell = lazy(() =>
  import('./memo/WorkspaceShell').then((m) => ({ default: m.WorkspaceShell })),
)
const Landing = lazy(() => import('./memo/landing/Landing').then((m) => ({ default: m.Landing })))
const Login = lazy(() => import('./memo/Login').then((m) => ({ default: m.Login })))
const InviteGuestGate = lazy(() =>
  import('./memo/InviteGuestGate').then((m) => ({ default: m.InviteGuestGate })),
)
const ForgotPassword = lazy(() =>
  import('./memo/auth/ForgotPassword').then((m) => ({ default: m.ForgotPassword })),
)
const ResetPassword = lazy(() =>
  import('./memo/auth/ResetPassword').then((m) => ({ default: m.ResetPassword })),
)
const MentionsLegales = lazy(() =>
  import('./memo/legal/MentionsLegales').then((m) => ({ default: m.MentionsLegales })),
)
const Confidentialite = lazy(() =>
  import('./memo/legal/Confidentialite').then((m) => ({ default: m.Confidentialite })),
)

function CenteredSpinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--color-bg)]">
      <Spinner size={36} />
    </div>
  )
}

export function App() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return <CenteredSpinner />
  }

  // Un visiteur arrivé par un lien d'invitation voit l'écran d'authentification
  // dédié (espace affiché, e-mail prérempli) plutôt que la landing.
  const pendingInvite = readPendingInvite()

  return (
    <Suspense fallback={<CenteredSpinner />}>
      {auth.status === 'guest' ? (
        pendingInvite ? (
          <InviteGuestGate token={pendingInvite} />
        ) : (
          <PublicRoutes />
        )
      ) : (
        <Routes>
          <Route path="/" element={<WorkspaceShell />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/confidentialite" element={<Confidentialite />} />
          {/* Sans cette route, un lien de réinitialisation ouvert depuis une
              session active redirigerait vers `/` et paraîtrait cassé. */}
          <Route path="/reinitialiser-mot-de-passe" element={<AuthedResetPassword />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </Suspense>
  )
}

/**
 * La réinitialisation invalide toutes les sessions du compte, celle-ci
 * comprise : on déconnecte explicitement avant de renvoyer vers la connexion.
 */
function AuthedResetPassword() {
  const auth = useAuth()
  return (
    <ResetPassword
      onLogin={async () => {
        await auth.logout()
        // Rechargement et pas `navigate` : l'URL porte encore le jeton consommé,
        // repasser en visiteur re-monterait cet écran-ci.
        window.location.href = '/login'
      }}
    />
  )
}

/** Montées pour les seuls visiteurs : la landing est inatteignable une fois connecté. */
function PublicRoutes() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Landing onRegister={() => navigate('/register')} onLogin={() => navigate('/login')} />
        }
      />
      <Route
        path="/login"
        element={
          <Login
            key="login"
            initialMode="login"
            onBack={() => navigate('/')}
            onSwitchMode={() => navigate('/register')}
            onForgotPassword={() => navigate('/mot-de-passe-oublie')}
          />
        }
      />
      <Route
        path="/mot-de-passe-oublie"
        element={<ForgotPassword onBack={() => navigate('/')} onLogin={() => navigate('/login')} />}
      />
      <Route
        path="/reinitialiser-mot-de-passe"
        element={<ResetPassword onLogin={() => navigate('/login')} />}
      />
      <Route
        path="/register"
        element={
          <Login
            key="register"
            initialMode="register"
            onBack={() => navigate('/')}
            onSwitchMode={() => navigate('/login')}
          />
        }
      />
      <Route path="/mentions-legales" element={<MentionsLegales />} />
      <Route path="/confidentialite" element={<Confidentialite />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
