'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'student.sidebar.collapsed'
const COOKIE_KEY = 'student_sidebar_collapsed'

type Ctx = {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (v: boolean) => void
  mobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
}

const AppSidebarCtx = createContext<Ctx | null>(null)

export function useAppSidebar(): Ctx {
  const ctx = useContext(AppSidebarCtx)
  if (!ctx) throw new Error('useAppSidebar must be used within <AppSidebarShell>')
  return ctx
}

export function AppSidebarShell({
  initialCollapsed = false,
  children,
}: {
  initialCollapsed?: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsedState] = useState(initialCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
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
    <AppSidebarCtx.Provider value={ctx}>
      <div className={`t-main ${collapsed ? 'is-collapsed' : ''}`}>
        {children}
      </div>
    </AppSidebarCtx.Provider>
  )
}
