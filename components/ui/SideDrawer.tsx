'use client'

import { useEffect } from 'react'
import { useTranslation } from '@/hooks/useTranslation'

interface SideDrawerProps {
  open: boolean
  onClose: () => void
  kicker?: string
  title: string
  children?: React.ReactNode
}

export function SideDrawer({ open, onClose, kicker, title, children }: SideDrawerProps) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <>
      <div
        className={`side-drawer-overlay${open ? ' is-open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`side-drawer${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <div className="side-drawer__head">
          <div>
            {kicker && <div className="side-drawer__kicker">{kicker}</div>}
            <div className="side-drawer__title">{title}</div>
          </div>
          <button
            className="side-drawer__close"
            onClick={onClose}
            aria-label={t('drawer.close')}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="side-drawer__body">{children}</div>
      </aside>
    </>
  )
}
