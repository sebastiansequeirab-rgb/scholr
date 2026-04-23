'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { getInitials } from '@/lib/utils'
import { useSidebarCollapse } from '@/components/layout/SidebarCollapseContext'
import { TEACHER_NAV_ITEMS } from '@/config/nav'
import type { Profile } from '@/types'

interface TeacherSidebarProps {
  profile: Profile | null
}

export function TeacherSidebar({ profile }: TeacherSidebarProps) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const { collapsed, toggle } = useSidebarCollapse()
  const { resolvedTheme } = useTheme()
  const logoSrc = resolvedTheme === 'light' ? '/logo-light.png' : '/logo-dark.png'
  const [mobileOpen, setMobileOpen] = useState(false)
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full py-5 px-3">
      {/* Logo */}
      <div className={`mb-6 ${collapsed ? 'px-0 flex justify-center' : 'px-2'}`}>
        <Link href="/teacher/dashboard" className="flex items-center gap-2.5 group">
          {collapsed ? (
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}>
              <span className="material-symbols-outlined text-[18px]"
                style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
                cast_for_education
              </span>
            </div>
          ) : (
            <Image
              src={logoSrc}
              alt="Skolar"
              width={120}
              height={32}
              style={{ width: 'auto', height: '32px', objectFit: 'contain' }}
              priority
            />
          )}
        </Link>
      </div>

      {/* Teacher badge */}
      {!collapsed && (
        <div className="mx-2 mb-4 px-3 py-1.5 rounded-lg flex items-center gap-2"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
          <span className="material-symbols-outlined text-[14px]"
            style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
            cast_for_education
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--color-primary)' }}>
            Profesor
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5" aria-label="Teacher navigation">
        {TEACHER_NAV_ITEMS.map(({ key, href, icon }) => {
          const active = isActive(href)
          const accentColor = 'var(--color-primary)'
          return (
            <Link
              key={key}
              href={href}
              title={collapsed ? t(key) : undefined}
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
              {!collapsed && <span className="leading-none">{t(key)}</span>}
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
                : (profile?.full_name ? getInitials(profile.full_name) : 'P')
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold truncate leading-tight" style={{ color: 'var(--on-surface)' }}>
                {profile?.full_name || 'Profesor'}
              </p>
              <p className="text-[9px] font-mono truncate leading-tight" style={{ color: 'var(--color-outline)' }}>
                Profesor
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
              title={profile?.full_name || 'Profesor'}
            >
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                : (profile?.full_name ? getInitials(profile.full_name) : 'P')
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* ── Mobile top bar ── */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14 glass"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <Link href="/teacher/dashboard" className="flex items-center gap-2 group">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}>
            <span className="material-symbols-outlined text-[14px]"
              style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>cast_for_education</span>
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

      {/* ── Mobile bottom tab bar (just 2 items) ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 glass safe-bottom"
        style={{ borderTop: '1px solid var(--border-subtle)', height: '56px' }}
        aria-label="Teacher mobile navigation"
      >
        <div className="flex items-center h-full px-1">
          {TEACHER_NAV_ITEMS.map(({ key, href, icon }) => {
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
                  {t(key)}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ── Mobile overlay ── */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-all duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* ── Mobile side drawer ── */}
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
        <div className="flex items-center justify-between px-5 flex-shrink-0"
          style={{ height: '64px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Link href="/teacher/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}>
              <span className="material-symbols-outlined text-[20px]"
                style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>cast_for_education</span>
            </div>
            <div>
              <span className="text-[17px] font-black tracking-tighter leading-none block"
                style={{ color: 'var(--color-primary)' }}>Skolar</span>
              <span className="text-[9px] uppercase tracking-[0.18em] font-mono leading-none"
                style={{ color: 'var(--color-outline)' }}>Profesor</span>
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

        <nav className="flex-1 px-3 pt-4 space-y-1 overflow-y-auto" aria-label="Teacher side menu">
          {TEACHER_NAV_ITEMS.map(({ key, href, icon }) => {
            const active = isActive(href)
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
                <span className="flex-1 leading-none">{t(key)}</span>
              </Link>
            )
          })}
        </nav>

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
                : (profile?.full_name ? getInitials(profile.full_name) : 'P')
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate leading-tight"
                style={{ color: 'var(--on-surface)' }}>
                {profile?.full_name || 'Profesor'}
              </p>
              <p className="text-[10px] font-mono truncate leading-tight"
                style={{ color: 'var(--color-outline)' }}>
                Profesor
              </p>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="p-1.5 rounded-xl transition-all active:scale-90"
              style={{ color: 'var(--color-outline)' }}
              aria-label={t('nav.logout')}
            >
              <span className="material-symbols-outlined text-[18px]">
                {loggingOut ? 'hourglass_empty' : 'logout'}
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Desktop sidebar ── */}
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
