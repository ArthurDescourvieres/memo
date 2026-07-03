import { useLayoutEffect } from 'react'
import { usePointerParallax, useScrollParallax, useRevealOnScroll } from './useParallax'
import { WindowFrame } from './WindowFrame'
import { AppMockup } from './AppMockup'
import { LandingSections } from './LandingSections'
import { LandingButton } from './LandingButton'
import { MemoLogo } from '../MemoLogo'

/**
 * La landing garde son identité sombre quel que soit le thème choisi ailleurs :
 * on force `data-theme='dark'` tant qu'elle est affichée, puis on restaure la
 * préférence de l'utilisateur en la quittant (ex. vers Login). useLayoutEffect
 * pour basculer avant le premier paint et éviter tout flash.
 */
function useForcedDarkLanding() {
  useLayoutEffect(() => {
    const root = document.documentElement
    const previous = root.dataset.theme === 'light' ? 'light' : 'dark'
    root.dataset.theme = 'dark'
    return () => {
      root.dataset.theme = previous
    }
  }, [])
}

export type LandingProps = {
  /** Open the auth screen in register mode. */
  onRegister: () => void
  /** Open the auth screen in login mode. */
  onLogin: () => void
}

export function Landing({ onRegister, onLogin }: LandingProps) {
  const scrollRef = useScrollParallax<HTMLDivElement>()
  useRevealOnScroll(scrollRef)
  useForcedDarkLanding()

  return (
    <div className="landing" ref={scrollRef}>
      <LandingNav onRegister={onRegister} onLogin={onLogin} />
      <div className="lp-grid-bg">
        <Hero onRegister={onRegister} />
      </div>
      <LandingSections onRegister={onRegister} />
    </div>
  )
}

function LandingNav({ onRegister, onLogin }: LandingProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/72 backdrop-blur-[14px]">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-[14px]">
        <span className="inline-flex items-center gap-[10px] text-[18px] font-semibold tracking-[0.01em]">
          <MemoLogo size={26} />
          Memo
        </span>
        <nav className="flex gap-[10px]">
          <LandingButton variant="ghost" onClick={onLogin} className="max-[560px]:hidden">
            Se connecter
          </LandingButton>
          <LandingButton variant="primary" onClick={onRegister}>
            Créer un compte
          </LandingButton>
        </nav>
      </div>
    </header>
  )
}

function Hero({ onRegister }: { onRegister: () => void }) {
  const visualRef = usePointerParallax<HTMLDivElement>()
  const seeProduct = () =>
    document.getElementById('decouvrir')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-9 px-6 pt-12 pb-16 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] min-[900px]:gap-14 min-[900px]:pt-[76px] min-[900px]:pb-[92px]">
      <div className="max-w-none min-[900px]:max-w-[520px]" data-reveal>
        <h1 className="m-0 text-[clamp(38px,5.4vw,64px)] font-semibold leading-[1.04] tracking-[-0.025em]">
          Prends tes notes,
          <br />
          pas la tête.
        </h1>
        <p className="mt-[22px] max-w-[460px] text-[clamp(16px,1.5vw,19px)] leading-[1.6] text-muted">
          Memo est un espace de notes open source et léger. Tu crées un espace, tu écris, tu glisses
          tes images. Zéro configuration.
        </p>
        <div className="mt-[30px] flex flex-wrap gap-[14px] max-[560px]:flex-col max-[560px]:items-center">
          <LandingButton
            variant="primary"
            size="lg"
            onClick={onRegister}
            className="max-[560px]:w-full max-[560px]:justify-center"
          >
            Créer mon espace
          </LandingButton>
          <LandingButton
            variant="ghost"
            size="lg"
            onClick={seeProduct}
            className="max-[560px]:w-full max-[560px]:justify-center"
          >
            Voir Memo en action
          </LandingButton>
        </div>
        <p className="mt-[18px] text-[13px] text-faint">
          Gratuit · Open source · Sans carte bancaire
        </p>
      </div>

      <div data-reveal>
        <div className="lp-hero-frame" ref={visualRef}>
          <WindowFrame>
            <AppMockup />
          </WindowFrame>
        </div>
      </div>
    </section>
  )
}
