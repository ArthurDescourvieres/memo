import { useRef } from 'react'

type HoverVideoProps = {
  /** Chemin du mp4 servi depuis /public (ex. `/landing/espaces.mp4`). */
  src: string
  /** Source webm optionnelle (meilleure compression si fournie). */
  webm?: string
  /** Poster optionnel ; sinon on fige la 1ʳᵉ frame au repos. */
  poster?: string
  /** Description accessible de la démo. */
  label: string
}

/**
 * Vidéo de démo muette : se lance au survol, se met en pause à la sortie.
 * Au repos (et sur mobile, faute de survol) on fige une frame du début.
 */
export function HoverVideo({ src, webm, poster, label }: HoverVideoProps) {
  const ref = useRef<HTMLVideoElement>(null)

  const play = () => {
    void ref.current?.play().catch(() => {})
  }
  const pause = () => {
    ref.current?.pause()
  }

  return (
    <video
      ref={ref}
      className="block aspect-[16/10] w-full bg-surface-1 object-contain"
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      aria-label={label}
      onMouseEnter={play}
      onMouseLeave={pause}
      onLoadedMetadata={(e) => {
        if (!poster) e.currentTarget.currentTime = 0.1
      }}
    >
      {webm && <source src={webm} type="video/webm" />}
      <source src={src} type="video/mp4" />
    </video>
  )
}
