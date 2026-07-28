import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MemoIcon } from './MemoIcon'

export interface SelectOption<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  value: T
  onChange: (value: T) => void
  options: readonly SelectOption<T>[]
  disabled?: boolean
  /** Appliquées au déclencheur, pas au menu. */
  className?: string
  ariaLabel?: string
  title?: string
}

/**
 * Remplace `<select>`, dont le popup natif ne peut être ni paddé ni thémé de
 * façon fiable — en sombre il s'affiche en blanc. Reconstruit ici en
 * combobox + listbox, dans un portail `fixed` posé au-dessus des modales.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
  className = '',
  ariaLabel,
  title,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [active, setActive] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const baseId = useId()

  const selected = options.find((o) => o.value === value)
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )

  const openMenu = () => {
    if (disabled) return
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) setRect(r)
    setActive(selectedIndex)
    setOpen(true)
  }

  const close = () => setOpen(false)

  const choose = (opt: SelectOption<T>) => {
    onChange(opt.value)
    close()
    triggerRef.current?.focus()
  }

  // Scroll écouté en capture, pour attraper aussi celui d'une modale.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return
      close()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openMenu()
      }
      return
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close()
        triggerRef.current?.focus()
        break
      case 'ArrowDown':
        e.preventDefault()
        setActive((i) => Math.min(options.length - 1, i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => Math.max(0, i - 1))
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(options.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (options[active]) choose(options[active])
        break
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-list` : undefined}
        aria-activedescendant={open ? `${baseId}-opt-${active}` : undefined}
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={`flex min-w-0 items-center justify-between gap-1 rounded border border-[var(--color-line-strong)] bg-[var(--color-surface-strong)] text-inherit outline-none cursor-pointer disabled:cursor-default disabled:opacity-50 ${className}`}
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <MemoIcon name="chevron-down" size={14} className="shrink-0 opacity-60" />
      </button>

      {open &&
        rect &&
        createPortal(
          <ul
            ref={listRef}
            id={`${baseId}-list`}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: 'fixed',
              top: rect.bottom + 4,
              left: rect.left,
              minWidth: rect.width,
            }}
            className="z-[9500] max-h-60 overflow-auto rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface-1)] py-1 shadow-[0_8px_24px_var(--color-shadow)]"
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value
              return (
                <li
                  key={opt.value}
                  id={`${baseId}-opt-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(opt)}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-[13px] transition-colors duration-[120ms] ${
                    i === active ? 'bg-[var(--color-line)]' : ''
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <MemoIcon name="check" size={14} className="shrink-0 opacity-70" />
                  )}
                </li>
              )
            })}
          </ul>,
          document.body,
        )}
    </>
  )
}
