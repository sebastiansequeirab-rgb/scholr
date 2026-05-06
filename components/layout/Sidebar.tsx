'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { getInitials } from '@/lib/utils'
import { NAV_ITEMS, BOTTOM_NAV, MORE_ITEMS, MORE_PATHS, SIDE_MENU_ITEMS } from '@/config/nav'
import type { Profile } from '@/types'

interface SidebarProps {
  profile: Profile | null
}

export function Sidebar({ profile }: SidebarProps) {
  const { t, language } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const logoSrc = resolvedTheme === 'light' ? '/logo-icon-blue.png' : '/logo-icon-white.png'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
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

  const initials = profile?.full_name ? getInitials(profile.full_name) : 'SS'

  return (
    <>
      {/* ─────────── Mobile top bar ─────────── */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-12 glass"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-[9px] flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}>
            <Image src={logoSrc} alt="Skolar" width={18} height={18} priority />
          </div>
          <span className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--on-surface)', letterSpacing: '-0.015em' }}>
            Skolar
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-[10px] active:scale-95 transition-transform"
          style={{ color: 'var(--color-outline)' }}
          aria-label="Abrir menú"
        >
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>
      </header>

      {/* ─────────── Mobile bottom tab bar ─────────── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 glass"
        style={{
          borderTop: '1px solid var(--border-subtle)',
          height: '64px',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5 h-full">
          {BOTTOM_NAV.map(({ key, href, icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={key}
                href={href}
                className="flex flex-col items-center justify-center gap-1 h-full active:scale-95 transition-transform"
                aria-current={pathname === href ? 'page' : undefined}
              >
                <span
                  className="w-9 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: active ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)' : 'transparent',
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{
                      color: active ? 'var(--color-primary)' : 'var(--color-outline)',
                      fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                    }}
                  >
                    {icon}
                  </span>
                </span>
                <span
                  className="text-[9.5px] leading-none font-mono"
                  style={{
                    color: active ? 'var(--color-primary)' : 'var(--color-outline)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {t(`nav.${key}`)}
                </span>
              </Link>
            )
          })}

          {/* More tab */}
          {(() => {
            const moreActive = MORE_PATHS.some(p => pathname.startsWith(p))
            return (
              <button
                onClick={() => setMoreOpen(true)}
                className="flex flex-col items-center justify-center gap-1 h-full active:scale-95 transition-transform"
                aria-label="Más"
              >
                <span
                  className="w-9 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: moreActive ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)' : 'transparent',
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{
                      color: moreActive ? 'var(--color-primary)' : 'var(--color-outline)',
                      fontVariationSettings: moreActive ? "'FILL' 1" : "'FILL' 0",
                    }}
                  >
                    apps
                  </span>
                </span>
                <span
                  className="text-[9.5px] leading-none font-mono"
                  style={{
                    color: moreActive ? 'var(--color-primary)' : 'var(--color-outline)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {language === 'es' ? 'Más' : 'More'}
                </span>
              </button>
            )
          })()}
        </div>
      </nav>

      {/* ─────────── More bottom sheet ─────────── */}
      {moreOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-[24px] animate-slide-up"
            style={{
              backgroundColor: 'var(--s-base)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.45)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div className="flex justify-center pt-3 pb-3">
              <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'var(--border-strong)' }} />
            </div>

            <div className="px-4 pb-4 grid grid-cols-3 gap-3">
              {MORE_ITEMS.map(({ key, href, icon }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={key}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-2 py-4 px-2 rounded-[14px] active:scale-95 transition-transform"
                    style={{
                      backgroundColor: active
                        ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                        : 'var(--s-low)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span
                      className="material-symbols-outlined text-[24px]"
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

            <div className="px-4 pb-4">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[14px] active:scale-[0.98] transition-transform"
                style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}
              >
                <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--danger)' }}>
                  {loggingOut ? 'hourglass_empty' : 'logout'}
                </span>
                <span className="text-[13.5px] font-semibold" style={{ color: 'var(--danger)' }}>
                  {t('nav.logout')}
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─────────── Mobile drawer overlay ─────────── */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-all duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* ─────────── Mobile drawer ─────────── */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 h-full flex flex-col transform transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          width: 'min(82vw, 320px)',
          backgroundColor: 'var(--s-bg)',
          borderRight: '1px solid var(--border-subtle)',
          boxShadow: '20px 0 60px -10px rgba(0,0,0,0.45)',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 flex-shrink-0"
          style={{ height: '64px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}>
              <Image src={logoSrc} alt="Skolar" width={22} height={22} />
            </div>
            <div>
              <span className="text-[16px] font-bold tracking-tight leading-none block"
                style={{ color: 'var(--on-surface)', letterSpacing: '-0.018em' }}>Skolar</span>
              <span className="text-[9px] uppercase tracking-[0.18em] font-mono leading-none"
                style={{ color: 'var(--color-outline)' }}>Asistente Académico</span>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-[10px] active:scale-90 transition-transform"
            style={{
              color: 'var(--color-outline)',
              backgroundColor: 'var(--s-low)',
              border: '1px solid var(--border-subtle)',
            }}
            aria-label="Cerrar menú"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* User block */}
        <div className="px-5 pt-4 pb-3">
          <div className="text-[12.5px] font-bold leading-none" style={{ color: 'var(--on-surface)' }}>
            {profile?.full_name || 'Estudiante'}
          </div>
          <div className="text-[9.5px] uppercase tracking-[0.16em] font-mono mt-1" style={{ color: 'var(--color-outline)' }}>
            {profile?.is_premium ? 'PREMIUM · ALL ACCESS' : 'FREE'}
          </div>
        </div>

        {/* Section label */}
        <div className="px-5 pt-2 pb-1">
          <span className="text-[9px] uppercase tracking-[0.18em] font-mono font-semibold"
            style={{ color: 'var(--color-outline)' }}>{language === 'es' ? 'Navegación' : 'Navigation'}</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto" aria-label="Side menu">
          {NAV_ITEMS.map(({ key, href, icon }) => {
            const active = isActive(href)
            const isAI = key === 'ai'
            const accentColor = isAI ? 'var(--color-tertiary)' : 'var(--color-primary)'
            return (
              <Link
                key={key}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3.5 px-3 py-2.5 rounded-[10px] active:scale-[0.98] transition-all"
                style={{
                  color: active ? accentColor : 'var(--on-surface)',
                  fontWeight: active ? 600 : 500,
                  fontSize: '13.5px',
                  backgroundColor: active
                    ? `color-mix(in srgb, ${accentColor} 14%, transparent)`
                    : 'transparent',
                }}
              >
                <span className="material-symbols-outlined text-[20px] flex-shrink-0"
                  style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>
                  {icon}
                </span>
                <span className="flex-1 leading-none">{t(`nav.${key}`)}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: accentColor }} />
                )}
              </Link>
            )
          })}

          <div className="my-3 mx-1 h-px" style={{ background: 'var(--border-subtle)' }} />

          {SIDE_MENU_ITEMS.map(({ key, href, icon, label_es, label_en }) => {
            const active = pathname === href
            const label = language === 'es' ? label_es : label_en
            return (
              <Link
                key={key}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3.5 px-3 py-2.5 rounded-[10px] active:scale-[0.98] transition-all"
                style={{
                  color: active ? 'var(--color-primary)' : 'var(--on-surface-variant)',
                  fontWeight: active ? 600 : 500,
                  fontSize: '13px',
                }}
              >
                <span className="material-symbols-outlined text-[18px] flex-shrink-0"
                  style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>
                  {icon}
                </span>
                <span className="flex-1 leading-none">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Logout footer */}
        <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-[10px] active:scale-[0.98] transition-transform"
            style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--danger)' }}>
              {loggingOut ? 'hourglass_empty' : 'logout'}
            </span>
            <span className="text-[12.5px] font-semibold" style={{ color: 'var(--danger)' }}>
              {t('nav.logout')}
            </span>
          </button>
        </div>
      </aside>

      {/* ─────────── Desktop sidebar (narrow icon-only, 60px) ─────────── */}
      <aside
        className="hidden lg:flex flex-col fixed top-0 left-0 h-full z-30 sidebar"
        style={{ width: '60px' }}
      >
        {/* Logo */}
        <Link
          href="/dashboard"
          className="sidebar__logo group"
          title="Skolar — Asistente Académico"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
          }}
        >
          <Image src={logoSrc} alt="Skolar" width={22} height={22} priority />
        </Link>

        {/* Nav items */}
        <nav className="sidebar__nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ key, href, icon }) => {
            const active = isActive(href)
            const isAI = key === 'ai'
            return (
              <Link
                key={key}
                href={href}
                title={t(`nav.${key}`)}
                aria-current={pathname === href ? 'page' : undefined}
                className={`sidebar__btn ${active ? 'active' : ''} ${isAI ? 'ai' : ''}`}
              >
                <span className="material-symbols-outlined">{icon}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar__divider" />

        {/* Settings */}
        <Link
          href="/settings"
          title={t('nav.settings')}
          className={`sidebar__btn ${isActive('/settings') ? 'active' : ''}`}
        >
          <span className="material-symbols-outlined">settings</span>
        </Link>

        {/* Avatar */}
        <Link
          href="/settings"
          title={profile?.full_name || 'Perfil'}
          className={`sidebar__avatar mt-1 ${isActive('/settings') ? 'active' : ''}`}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover rounded-[8px]" />
          ) : (
            initials
          )}
        </Link>

        {/* Logout (small, bottom) */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title={t('nav.logout')}
          className="sidebar__btn"
          style={{ marginTop: '4px', color: 'var(--color-outline)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            {loggingOut ? 'hourglass_empty' : 'logout'}
          </span>
        </button>
      </aside>
    </>
  )
}
