import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Spinner } from './memo/Spinner'
import { useAuth } from './lib/auth/AuthContext'
import { readPendingInvite } from './lib/pendingInvite'

// Code splitting (éco-conception) : les écrans lourds sont chargés à la demande.
// WorkspaceShell embarque l'éditeur Tiptap + lowlight + socket.io (gros chunk) et
// n'est utile qu'une fois connecté ; Landing/Login ne servent qu'aux visiteurs.
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

  // A signed-out visitor who followed an invite link gets the invite-aware auth
  // screen (workspace shown, email prefilled) instead of the marketing landing.
  const pendingInvite = readPendingInvite()

  // Public routes are only mounted for unauthenticated visitors, so the landing
  // page is unreachable once signed in. Suspense covers the lazy-loaded chunks.
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
          {/* Un lien de réinitialisation ouvert depuis une session déjà connectée
              doit rester fonctionnel, sinon la redirection vers `/` donne
              l'impression d'un lien cassé. */}
          <Route path="/reinitialiser-mot-de-passe" element={<AuthedResetPassword />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </Suspense>
  )
}

/**
 * Réinitialisation ouverte alors qu'une session est active. La réinitialisation
 * invalide toutes les sessions du compte : celle-ci ne survit pas non plus, on
 * déconnecte donc explicitement avant de renvoyer vers l'écran de connexion.
 */
function AuthedResetPassword() {
  const auth = useAuth()
  return (
    <ResetPassword
      onLogin={async () => {
        await auth.logout()
        // Rechargement plutôt que `navigate` : l'URL porte encore le jeton
        // consommé, et repasser en visiteur re-monterait cet écran-ci.
        window.location.href = '/login'
      }}
    />
  )
}

/** Routes available to visitors who are not signed in. */
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
