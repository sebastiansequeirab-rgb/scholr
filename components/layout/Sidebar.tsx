'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { getInitials } from '@/lib/utils'
import { useSidebarCollapse } from '@/components/layout/SidebarCollapseContext'
import { NAV_ITEMS, BOTTOM_NAV, MORE_ITEMS, MORE_PATHS, SIDE_MENU_ITEMS } from '@/config/nav'
import type { Profile } from '@/types'

interface SidebarProps {
  profile: Profile | null
}

export function Sidebar({ profile }: SidebarProps) {
  const { t, language } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const { collapsed, toggle } = useSidebarCollapse()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [moreOpen,   setMoreOpen]   = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const touchStartXRef = useRef<number | null>(null)

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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return
    const delta = touchStartXRef.current - e.changedTouches[0].clientX
    if (delta > 60) setMobileOpen(false)
    touchStartXRef.current = null
  }

  // ── Desktop sidebar content ───────────────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full py-5 px-3">

      {/* Logo */}
      <div className={`mb-6 ${collapsed ? 'px-0 flex justify-center' : 'px-2'}`}>
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}>
            <span className="material-symbols-outlined text-[18px]"
              style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
              school
            </span>
          </div>
          {!collapsed && (
            <div>
              <span className="text-base font-black tracking-tighter" style={{ color: 'var(--color-primary)' }}>
                Skolar
              </span>
              <p className="text-[9px] uppercase tracking-[0.2em] font-mono leading-none mt-0.5"
                style={{ color: 'var(--color-outline)' }}>
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
          const isAI = key === 'ai'
          const accentColor = isAI ? 'var(--color-tertiary)' : 'var(--color-primary)'
          return (
            <Link
              key={key}
              href={href}
              title={collapsed ? t(`nav.${key}`) : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                collapsed ? 'justify-center' : ''
              }`}
              style={{
                color: active ? accentColor : 'var(--color-outline)',
                fontWeight: active ? 700 : 500,
                backgroundColor: active
                  ? `color-mix(in srgb, ${accentColor} 10%, transparent)`
                  : 'transparent',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = `color-mix(in srgb, ${accentColor} 5%, transparent)`
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
              }}
              aria-current={pathname === href ? 'page' : undefined}
            >
              <span
                className="material-symbols-outlined text-[20px] flex-shrink-0"
                style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
              >
                {icon}
              </span>
              {!collapsed && <span className="leading-none">{t(`nav.${key}`)}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        title={collapsed ? 'Expandir' : 'Colapsar'}
        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150 mt-1 ${
          collapsed ? 'justify-center' : ''
        }`}
        style={{ color: 'var(--color-outline)', opacity: 0.6 }}
      >
        <span className="material-symbols-outlined text-[18px] flex-shrink-0">
          {collapsed ? 'chevron_right' : 'chevron_left'}
        </span>
        {!collapsed && <span className="mono text-[9px] uppercase tracking-widest">Colapsar</span>}
      </button>

      {/* Footer */}
      <div className="mt-2 space-y-0.5 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <Link
          href="/settings"
          title={collapsed ? t('nav.settings') : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
            collapsed ? 'justify-center' : ''
          }`}
          style={{
            color: isActive('/settings') ? 'var(--color-primary)' : 'var(--color-outline)',
            fontWeight: isActive('/settings') ? 700 : 500,
            backgroundColor: isActive('/settings')
              ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
              : 'transparent',
          }}
        >
          <span className="material-symbols-outlined text-[20px] flex-shrink-0"
            style={{ fontVariationSettings: isActive('/settings') ? "'FILL' 1" : "'FILL' 0" }}>
            settings
          </span>
          {!collapsed && <span className="leading-none">{t('nav.settings')}</span>}
        </Link>

        {/* User row */}
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 6%, transparent)' }}>
            <div
              className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
                color: 'var(--color-primary)',
              }}
            >
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                : (profile?.full_name ? getInitials(profile.full_name) : 'U')
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold truncate leading-tight" style={{ color: 'var(--on-surface)' }}>
                {profile?.full_name || 'Estudiante'}
              </p>
              <p className="text-[9px] font-mono truncate leading-tight" style={{ color: 'var(--color-outline)' }}>
                {profile?.is_premium ? '★ Premium' : 'Free'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="p-1 rounded-lg transition-all hover:text-red-400 flex-shrink-0"
              style={{ color: 'var(--color-outline)', opacity: 0.7 }}
              aria-label={t('nav.logout')}
              title={t('nav.logout')}
            >
              <span className="material-symbols-outlined text-[16px]">
                {loggingOut ? 'hourglass_empty' : 'logout'}
              </span>
            </button>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <div
              className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold cursor-pointer"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
                color: 'var(--color-primary)',
              }}
              title={profile?.full_name || 'Estudiante'}
            >
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                : (profile?.full_name ? getInitials(profile.full_name) : 'U')
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* ── Mobile top bar ──────────────────────────────────────────────── */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14 glass"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}>
            <span className="material-symbols-outlined text-[14px]"
              style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>school</span>
          </div>
          <span className="text-[17px] font-black tracking-tighter" style={{ color: 'var(--color-primary)' }}>
            Skolar
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90"
          style={{ color: 'var(--color-outline)' }}
          aria-label="Abrir menú"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>
      </header>

      {/* ── Mobile bottom tab bar ───────────────────────────────────────── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 glass safe-bottom"
        style={{ borderTop: '1px solid var(--border-subtle)', height: '56px' }}
        aria-label="Mobile navigation"
      >
        <div className="flex items-center h-full px-1">
          {BOTTOM_NAV.map(({ key, href, icon }) => {
            const active = isActive(href)
            const accentColor = 'var(--color-primary)'
            return (
              <Link
                key={key}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full relative transition-all duration-150 active:scale-95"
                aria-current={pathname === href ? 'page' : undefined}
              >
                {active && (
                  <div className="absolute top-2 rounded-full"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
                      width: '44px',
                      height: '26px',
                    }} />
                )}
                <span
                  className="material-symbols-outlined text-[19px] relative transition-all duration-150"
                  style={{
                    color: active ? accentColor : 'var(--color-outline)',
                    fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {icon}
                </span>
                <span className="text-[8px] font-semibold leading-none relative transition-colors duration-150"
                  style={{ color: active ? accentColor : 'var(--color-outline)' }}>
                  {t(`nav.${key}`)}
                </span>
              </Link>
            )
          })}

          {/* More tab */}
          {(() => {
            const moreActive = MORE_PATHS.some(p => pathname.startsWith(p))
            const accentColor = 'var(--color-primary)'
            return (
              <button
                onClick={() => setMoreOpen(true)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full relative transition-all duration-150 active:scale-95"
                aria-label="Más"
              >
                {moreActive && (
                  <div className="absolute top-2 rounded-full"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
                      width: '44px',
                      height: '26px',
                    }} />
                )}
                <span
                  className="material-symbols-outlined text-[19px] relative transition-all duration-150"
                  style={{
                    color: moreActive ? accentColor : 'var(--color-outline)',
                    fontVariationSettings: moreActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  apps
                </span>
                <span className="text-[8px] font-semibold leading-none relative transition-colors duration-150"
                  style={{ color: moreActive ? accentColor : 'var(--color-outline)' }}>
                  Más
                </span>
              </button>
            )
          })()}
        </div>
      </nav>

      {/* ── More bottom sheet ────────────────────────────────────────────── */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          {/* Sheet */}
          <div
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl animate-slide-up pb-[env(safe-area-inset-bottom)]"
            style={{
              backgroundColor: 'var(--s-base)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.35)',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-4">
              <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'var(--border-strong)' }} />
            </div>

            {/* Items */}
            <div className="px-4 pb-4 grid grid-cols-3 gap-3">
              {MORE_ITEMS.map(({ key, href, icon }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={key}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all active:scale-95"
                    style={{
                      backgroundColor: active
                        ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                        : 'var(--s-low)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span
                      className="material-symbols-outlined text-[26px]"
                      style={{
                        color: active ? 'var(--color-primary)' : 'var(--on-surface-variant)',
                        fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                      }}
                    >
                      {icon}
                    </span>
                    <span className="text-[11px] font-semibold text-center leading-tight"
                      style={{ color: active ? 'var(--color-primary)' : 'var(--on-surface)' }}>
                      {t(`nav.${key}`)}
                    </span>
                  </Link>
                )
              })}
            </div>

            {/* Logout row */}
            <div className="px-4 pb-4">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98]"
                style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}
              >
                <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--danger)' }}>
                  {loggingOut ? 'hourglass_empty' : 'logout'}
                </span>
                <span className="text-[14px] font-medium" style={{ color: 'var(--danger)' }}>
                  {t('nav.logout')}
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile overlay ──────────────────────────────────────────────── */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-all duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* ── Mobile side drawer — premium panel ─────────────────────────── */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 h-full flex flex-col transform transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          width: 'min(85vw, 320px)',
          backgroundColor: 'var(--s-bg)',
          borderRight: '1px solid var(--border-subtle)',
          boxShadow: '20px 0 60px -10px rgba(0,0,0,0.4)',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 flex-shrink-0"
          style={{
            height: '64px',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
          <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}>
              <span className="material-symbols-outlined text-[20px]"
                style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>school</span>
            </div>
            <div>
              <span className="text-[17px] font-black tracking-tighter leading-none block"
                style={{ color: 'var(--color-primary)' }}>Skolar</span>
              <span className="text-[9px] uppercase tracking-[0.18em] font-mono leading-none"
                style={{ color: 'var(--color-outline)' }}>Sanctuary</span>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{
              color: 'var(--color-outline)',
              backgroundColor: 'var(--s-low)',
              border: '1px solid var(--border-subtle)',
            }}
            aria-label="Cerrar menú"
          >
            <span className="material-symbols-outlined text-[17px]">close</span>
          </button>
        </div>

        {/* Section label */}
        <div className="px-5 pt-5 pb-2">
          <span className="mono text-[9px] uppercase tracking-[0.2em] font-medium"
            style={{ color: 'var(--color-outline)' }}>Navegación</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto" aria-label="Side menu">
          {SIDE_MENU_ITEMS.map(({ key, href, icon, label_es, label_en }) => {
            const active = pathname === href || (href !== '/settings' && pathname.startsWith(href))
            const label  = language === 'es' ? label_es : label_en
            return (
              <Link
                key={key}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-150 active:scale-[0.98]"
                style={{
                  color: active ? 'var(--color-primary)' : 'var(--on-surface)',
                  fontWeight: active ? 700 : 500,
                  fontSize: '15px',
                  backgroundColor: active
                    ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                    : 'transparent',
                }}
              >
                <span className="material-symbols-outlined text-[22px] flex-shrink-0"
                  style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>
                  {icon}
                </span>
                <span className="flex-1 leading-none">{label}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: 'var(--color-primary)' }} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Profile footer */}
        <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 7%, transparent)' }}>
            <div
              className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[11px] font-bold"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
                color: 'var(--color-primary)',
              }}
            >
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                : (profile?.full_name ? getInitials(profile.full_name) : 'U')
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate leading-tight"
                style={{ color: 'var(--on-surface)' }}>
                {profile?.full_name || 'Estudiante'}
              </p>
              <p className="text-[10px] font-mono truncate leading-tight"
                style={{ color: 'var(--color-outline)' }}>
                {profile?.is_premium ? '★ Premium' : 'Free'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="p-1.5 rounded-xl transition-all active:scale-90"
              style={{ color: 'var(--color-outline)' }}
              aria-label={t('nav.logout')}
              title={t('nav.logout')}
            >
              <span className="material-symbols-outlined text-[18px]">
                {loggingOut ? 'hourglass_empty' : 'logout'}
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 h-full z-30 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
        style={{ backgroundColor: 'var(--s-bg)', borderRight: '1px solid var(--border-subtle)' }}
      >
        <SidebarContent />
      </aside>
    </>
  )
}
