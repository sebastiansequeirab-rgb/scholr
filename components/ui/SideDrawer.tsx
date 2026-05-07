'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

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

  if (!mounted || !open) return null

  const node = (
    <>
      <div
        className="side-drawer-overlay is-open"
        onClick={onClose}
        aria-hidden={false}
      />
      <aside
        className="side-drawer is-open"
        role="dialog"
        aria-modal="true"
      >
        <div className="side-drawer__head">
          <div>
            {kicker && <div className="side-drawer__kicker">{kicker}</div>}
            {title && <div className="side-drawer__title">{title}</div>}
          </div>
          <button
            type="button"
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

  return createPortal(node, document.body)
}
