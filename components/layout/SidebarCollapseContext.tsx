'use client'

import { createContext, useContext, useState, useEffect } from 'react'

interface SidebarCtx {
  collapsed: boolean
  toggle: () => void
}

const SidebarCollapseContext = createContext<SidebarCtx>({
  collapsed: false,
  toggle: () => {},
})

export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    document.body.setAttribute('data-sidebar', collapsed ? 'collapsed' : 'expanded')
  }, [collapsed])

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  return (
    <SidebarCollapseContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarCollapseContext.Provider>
  )
}

export function useSidebarCollapse() {
  return useContext(SidebarCollapseContext)
}
