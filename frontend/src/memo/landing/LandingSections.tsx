import { Link } from 'react-router-dom'
import { WindowFrame, VideoSlot } from './WindowFrame'
import { HoverVideo } from './HoverVideo'
import { LandingButton, landingButtonClass } from './LandingButton'
import { MemoLogo } from '../MemoLogo'

const GITHUB_URL = 'https://github.com/ArthurDescourvieres/arthur-descourvieres-dossiers-pros-CDA'

/** Titre de section partagé (ex-`.lp-h2`). */
const H2 = 'm-0 text-[clamp(26px,3.2vw,38px)] font-semibold leading-[1.12] tracking-[-0.02em]'
/** Paragraphe de section partagé (ex-`.lp-section-text`). */
const SECTION_TEXT = 'mt-4 text-[17px] leading-[1.6] text-muted'

export function LandingSections({ onRegister }: { onRegister: () => void }) {
  return (
    <>
      <Stance />
      <div className="lp-grid-bg">
        <Demo
          id="decouvrir"
          title="Un espace par matière."
          text="Crée autant d'espaces que tu veux — cours, stage, projets perso. Range tes notes en dossiers, retrouve-les d'un coup d'œil."
          videoLabel="Démo : créer un espace et naviguer dans la sidebar"
          video={{ src: '/landing/espaces.mp4' }}
        />
        <Demo
          reverse
          title="Écris. Glisse une image. C'est noté."
          text="Un éditeur qui va à l'essentiel — titres, listes, blocs de code. Tes captures se posent directement sous le texte, au bon endroit."
          videoLabel="Démo : écrire une note et y glisser une image"
          video={{ src: '/landing/editeur.mp4' }}
        />
        <AndMore />
      </div>
      <OpenSource />
      <div className="lp-grid-bg">
        <FinalCta onRegister={onRegister} />
      </div>
      <LandingFooter />
    </>
  )
}

function Stance() {
  return (
    <section className="border-y border-line bg-surface-1">
      <div className="mx-auto max-w-[980px] px-6 py-16" data-reveal>
        <h2 className="m-0 border-l-[3px] border-accent pl-6 text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.1] tracking-[-0.02em]">
          Notion fait tout.
          <br />
          Toi, tu veux juste noter.
        </h2>
        <p className="mt-5 ml-6 max-w-[620px] text-[18px] leading-[1.6] text-muted">
          Les grosses apps te demandent de tout configurer avant d'écrire la première ligne. Memo
          prend le parti inverse : tu ouvres, tu écris.
        </p>
      </div>
    </section>
  )
}

type DemoProps = {
  title: string
  text: string
  videoLabel: string
  video?: { src: string; webm?: string; poster?: string }
  id?: string
  reverse?: boolean
}

function Demo({ title, text, videoLabel, video, id, reverse }: DemoProps) {
  return (
    <section
      id={id}
      className="mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-8 px-6 py-14 min-[860px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] min-[860px]:gap-14 min-[860px]:py-20"
    >
      <div
        className={`max-w-none min-[860px]:max-w-[440px] ${reverse ? 'min-[860px]:order-2' : ''}`}
        data-reveal
      >
        <h2 className={H2}>{title}</h2>
        <p className={SECTION_TEXT}>{text}</p>
      </div>
      <div className="relative" data-reveal>
        <WindowFrame
          className={`transition-[transform,box-shadow] duration-[450ms] ease-expo will-change-transform hover:z-[2] hover:scale-[1.4] hover:shadow-[0_60px_120px_-55px_var(--color-ink-shadow),0_0_0_1px_var(--color-overlay-weak)_inset] ${
            reverse ? 'hover:-rotate-3' : 'hover:rotate-3'
          }`}
        >
          {video ? (
            <HoverVideo
              src={video.src}
              webm={video.webm}
              poster={video.poster}
              label={videoLabel}
            />
          ) : (
            <VideoSlot label={videoLabel} />
          )}
        </WindowFrame>
      </div>
    </section>
  )
}

function AndMore() {
  return (
    <p
      className="mx-auto max-w-[1120px] border-t border-line px-6 pt-7 text-center text-sm text-faint"
      data-reveal
    >
      Et aussi : <span className="text-dim">recherche instantanée ⌘K</span> ·{' '}
      <span className="text-dim">collaboration en temps réel</span>
    </p>
  )
}

function OpenSource() {
  return (
    <section className="mt-18 border-y border-line bg-surface-1">
      <div className="mx-auto max-w-[760px] px-6 py-18 text-center" data-reveal>
        <svg
          className="mx-auto mb-2.5 block text-ink"
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.47c.52.1.71-.23.71-.5v-1.96c-2.9.63-3.52-1.23-3.52-1.23-.48-1.2-1.16-1.53-1.16-1.53-.95-.65.07-.63.07-.63 1.05.07 1.6 1.08 1.6 1.08.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.66-1.4-2.31-.26-4.74-1.16-4.74-5.14 0-1.14.4-2.06 1.07-2.79-.11-.27-.46-1.32.1-2.75 0 0 .88-.28 2.88 1.07a9.9 9.9 0 0 1 5.24 0c2-1.35 2.87-1.07 2.87-1.07.57 1.43.21 2.48.1 2.75.67.73 1.07 1.65 1.07 2.79 0 3.99-2.43 4.87-4.75 5.13.38.33.71.97.71 1.96v2.9c0 .28.19.62.72.5A10.5 10.5 0 0 0 12 1.5Z" />
        </svg>
        <h2 className={H2}>Open source, et ça change tout.</h2>
        <p className={`${SECTION_TEXT} mx-auto max-w-[560px]`}>
          Pas de paywall qui débarque un jour, pas de données revendues. Lis le code, contribue, ou
          héberge Memo sur ton propre serveur.
        </p>
        <a
          className={landingButtonClass('ghost', 'lg', 'mt-7')}
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
        >
          Voir le code sur GitHub
        </a>
      </div>
    </section>
  )
}

function FinalCta({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="mx-auto max-w-[1000px] px-6 py-24">
      <div
        className="rounded-[var(--r-xl)] border border-line-strong bg-surface-2 px-8 py-18 text-center"
        data-reveal
      >
        <h2 className={`${H2} mb-7`}>Ton prochain cours commence ici.</h2>
        <LandingButton variant="primary" size="lg" onClick={onRegister}>
          Créer mon espace gratuitement
        </LandingButton>
      </div>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer className="border-t border-line px-6 pt-7 pb-12">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 text-[13px] text-faint">
        <span className="inline-flex items-center gap-[10px] text-[15px] font-semibold tracking-[0.01em]">
          <MemoLogo size={18} />
          Memo
        </span>
        <nav className="flex flex-wrap gap-[18px]">
          <Link to="/mentions-legales" className="text-muted no-underline">
            Mentions légales
          </Link>
          <Link to="/confidentialite" className="text-muted no-underline">
            Politique de confidentialité
          </Link>
        </nav>
        <span>© 2026 Memo · Tes notes, au clair.</span>
      </div>
    </footer>
  )
}
