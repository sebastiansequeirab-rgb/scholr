'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { getInitials } from '@/lib/utils'
import { useSidebarCollapse } from '@/components/ui/SidebarCollapseContext'
import type { Profile } from '@/types'

const NAV_ITEMS = [
  { key: 'dashboard', href: '/dashboard',  icon: 'home'           },
  { key: 'calendar',  href: '/calendar',   icon: 'calendar_month' },
  { key: 'subjects',  href: '/subjects',   icon: 'menu_book'      },
  { key: 'tasks',     href: '/tasks',      icon: 'check_circle'   },
  { key: 'notes',     href: '/notes',      icon: 'sticky_note_2'  },
  { key: 'exams',     href: '/exams',      icon: 'event_upcoming' },
]

interface SidebarProps {
  profile: Profile | null
}

export function Sidebar({ profile }: SidebarProps) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const { collapsed, toggle } = useSidebarCollapse()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [pathname])

  const handleLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full py-6 px-3">

      {/* Logo */}
      <div className={`mb-8 ${collapsed && !mobile ? 'px-0 flex justify-center' : 'px-3'}`}>
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
            <span className="material-symbols-outlined text-lg" style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
              school
            </span>
          </div>
          {(!collapsed || mobile) && (
            <div>
              <span className="text-base font-black tracking-tighter" style={{ color: 'var(--color-primary)' }}>
                Scholr
              </span>
              <p className="text-[9px] uppercase tracking-[0.2em] font-mono" style={{ color: 'var(--color-outline)' }}>
                Sanctuary
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5" aria-label="Main navigation">
        {NAV_ITEMS.map(({ key, href, icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={key}
              href={href}
              title={collapsed && !mobile ? t(`nav.${key}`) : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                collapsed && !mobile ? 'justify-center' : ''
              } ${active ? '' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
              style={{
                color: active ? 'var(--color-primary)' : 'var(--color-outline)',
                backgroundColor: active
                  ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                  : undefined,
              }}
              aria-current={pathname === href ? 'page' : undefined}
            >
              <span
                className="material-symbols-outlined text-[20px] flex-shrink-0"
                style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
              >
                {icon}
              </span>
              {(!collapsed || mobile) && <span>{t(`nav.${key}`)}</span>}
            </Link>
          )
        })}

        {/* AI */}
        <Link
          href="/ai"
          title={collapsed && !mobile ? t('nav.ai') : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
            collapsed && !mobile ? 'justify-center' : ''
          } ${isActive('/ai') ? '' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
          style={{
            color: isActive('/ai') ? 'var(--color-tertiary)' : 'var(--color-outline)',
            backgroundColor: isActive('/ai')
              ? 'color-mix(in srgb, var(--color-tertiary) 10%, transparent)'
              : undefined,
          }}
        >
          <span
            className="material-symbols-outlined text-[20px] flex-shrink-0"
            style={{ fontVariationSettings: isActive('/ai') ? "'FILL' 1" : "'FILL' 0" }}
          >
            auto_awesome
          </span>
          {(!collapsed || mobile) && (
            <>
              <span>{t('nav.ai')}</span>
              {!profile?.is_premium && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-tertiary) 15%, transparent)', color: 'var(--color-tertiary)' }}>
                  PRO
                </span>
              )}
            </>
          )}
        </Link>

        {/* Collapse toggle (desktop only) */}
        {!mobile && (
          <button
            onClick={toggle}
            title={collapsed ? 'Expandir barra' : 'Colapsar barra'}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 mt-2 ${
              collapsed ? 'justify-center' : ''
            }`}
            style={{ color: 'var(--color-outline)' }}
          >
            <span className="material-symbols-outlined text-[20px] flex-shrink-0">
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
            {!collapsed && <span className="mono text-[10px] uppercase tracking-widest">Colapsar</span>}
          </button>
        )}
      </nav>

      {/* Footer */}
      <div className="mt-auto space-y-0.5 pt-4" style={{ borderTop: '1px solid var(--border-default)' }}>
        <Link
          href="/settings"
          title={collapsed && !mobile ? t('nav.settings') : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
            collapsed && !mobile ? 'justify-center' : ''
          } ${isActive('/settings') ? '' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
          style={{
            color: isActive('/settings') ? 'var(--color-primary)' : 'var(--color-outline)',
            backgroundColor: isActive('/settings')
              ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
              : undefined,
          }}
        >
          <span className="material-symbols-outlined text-[20px] flex-shrink-0">settings</span>
          {(!collapsed || mobile) && <span>{t('nav.settings')}</span>}
        </Link>

        {/* User row */}
        {(!collapsed || mobile) ? (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
            style={{ backgroundColor: 'var(--s-low)' }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)', color: 'var(--color-primary)' }}
            >
              {profile?.full_name ? getInitials(profile.full_name) : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--on-surface)' }}>
                {profile?.full_name || 'Estudiante'}
              </p>
              <p className="text-[10px] font-mono truncate" style={{ color: 'var(--color-outline)' }}>
                {profile?.is_premium ? '★ Premium' : 'Free Plan'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="p-1.5 rounded-lg transition-all hover:bg-black/5 dark:hover:bg-white/5 hover:text-red-400"
              style={{ color: 'var(--color-outline)' }}
              aria-label={t('nav.logout')}
              title={t('nav.logout')}
            >
              <span className="material-symbols-outlined text-[18px]">
                {loggingOut ? 'hourglass_empty' : 'logout'}
              </span>
            </button>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)', color: 'var(--color-primary)' }}
              title={profile?.full_name || 'Estudiante'}
            >
              {profile?.full_name ? getInitials(profile.full_name) : 'U'}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile glass top bar */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 glass"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <Link href="/dashboard" className="text-lg font-black tracking-tighter"
          style={{ color: 'var(--color-primary)' }}>
          Scholr
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-full transition-all hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: 'var(--color-outline)' }}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <span className="material-symbols-outlined text-[22px]">
            {mobileOpen ? 'close' : 'menu'}
          </span>
        </button>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30"
          style={{ backgroundColor: 'var(--overlay-bg)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-40 h-full w-72 transform transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: 'var(--s-bg)', borderRight: '1px solid var(--border-subtle)' }}
      >
        <div className="pt-14">
          <SidebarContent mobile />
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 h-full z-30 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
        style={{ backgroundColor: 'var(--s-bg)', borderRight: '1px solid var(--border-subtle)' }}
      >
        <SidebarContent />
      </aside>
    </>
  )
}
