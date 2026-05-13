'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { TeacherSidebar } from './TeacherSidebar'
import type { Profile } from '@/types'

const STORAGE_KEY = 'teacher.sidebar.collapsed'
const COOKIE_KEY = 'teacher_sidebar_collapsed'

type Ctx = {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (v: boolean) => void
  mobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
}

const TeacherSidebarCtx = createContext<Ctx | null>(null)

export function useTeacherSidebar(): Ctx {
  const ctx = useContext(TeacherSidebarCtx)
  if (!ctx) throw new Error('useTeacherSidebar must be used within <TeacherShell>')
  return ctx
}

export function TeacherShell({
  profile,
  initialCollapsed = false,
  children,
}: {
  profile: Profile | null
  initialCollapsed?: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsedState] = useState(initialCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    // Fallback hydration from localStorage when cookie wasn't set yet
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === '1' && !initialCollapsed) setCollapsedState(true)
    } catch {}
  }, [initialCollapsed])

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v)
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0') } catch {}
    try {
      document.cookie = `${COOKIE_KEY}=${v ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`
    } catch {}
  }, [])

  const toggle = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed])
  const openMobile = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  const ctx = useMemo<Ctx>(
    () => ({ collapsed, toggle, setCollapsed, mobileOpen, openMobile, closeMobile }),
    [collapsed, toggle, setCollapsed, mobileOpen, openMobile, closeMobile],
  )

  return (
    <TeacherSidebarCtx.Provider value={ctx}>
      <TeacherSidebar profile={profile} />
      <div className={`t-main ${collapsed ? 'is-collapsed' : ''}`}>
        <TeacherMobileHeader />
        {children}
      </div>
    </TeacherSidebarCtx.Provider>
  )
}

function TeacherMobileHeader() {
  const { openMobile } = useTeacherSidebar()
  return (
    <header className="t-mobile-header">
      <button type="button" onClick={openMobile} aria-label="Abrir menú" className="t-mobile-header__btn">
        <span className="material-symbols-outlined">menu</span>
      </button>
    </header>
  )
}
