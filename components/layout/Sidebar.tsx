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
import { useAppSidebar } from './AppSidebarShell'
import type { Profile } from '@/types'

interface SidebarProps {
  profile: Profile | null
}

// Same grouping convention as the teacher sidebar
const TOP_KEYS = new Set(['dashboard', 'calendar', 'subjects', 'tareas'])

export function Sidebar({ profile }: SidebarProps) {
  const { t, language } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { collapsed, toggle } = useAppSidebar()

  const fullLogo = resolvedTheme === 'light' ? '/logo-light.png' : '/logo-full-white.png'
  const markLogo = resolvedTheme === 'light' ? '/logo-light-mark.png' : '/logo-icon-white.png'
  const mobileLogo = resolvedTheme === 'light' ? '/logo-icon-blue.png' : '/logo-icon-white.png'

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
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === href || pathname.startsWith(href + '/')

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
  const displayName = profile?.full_name || (language === 'es' ? 'Estudiante' : 'Student')

  const topItems = NAV_ITEMS.filter(i => TOP_KEYS.has(i.key))
  const generalItems = NAV_ITEMS.filter(i => !TOP_KEYS.has(i.key))

  const renderItem = ({ key, href, icon }: { key: string; href: string; icon: string }) => {
    const active = isActive(href)
    return (
      <Link
        key={key}
        href={href}
        className={`t-sidebar__item ${active ? 'is-active' : ''}`}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? t(`nav.${key}`) : undefined}
      >
        <span className="material-symbols-outlined">{icon}</span>
        <span className="t-sidebar__item__label">{t(`nav.${key}`)}</span>
      </Link>
    )
  }

  return (
    <>
      {/* ─────────── Mobile top bar ─────────── */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-12 glass"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div
            className="w-7 h-7 rounded-[9px] flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}
          >
            <Image src={mobileLogo} alt="Skolar" width={18} height={18} priority />
          </div>
          <span
            className="text-[15px] font-bold tracking-tight"
            style={{ color: 'var(--on-surface)', letterSpacing: '-0.015em' }}
          >
            Skolar
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-[10px] active:scale-95 transition-transform"
          style={{ color: 'var(--color-outline)' }}
          aria-label={language === 'es' ? 'Abrir menú' : 'Open menu'}
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
                    backgroundColor: active
                      ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)'
                      : 'transparent',
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
                    backgroundColor: moreActive
                      ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)'
                      : 'transparent',
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
                    <span
                      className="text-[11px] font-semibold text-center leading-tight"
                      style={{ color: active ? 'var(--color-primary)' : 'var(--on-surface)' }}
                    >
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
        <div
          className="flex items-center justify-between px-5 flex-shrink-0"
          style={{ height: '64px', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
            onClick={() => setMobileOpen(false)}
          >
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}
            >
              <Image src={mobileLogo} alt="Skolar" width={22} height={22} />
            </div>
            <div>
              <span
                className="text-[16px] font-bold tracking-tight leading-none block"
                style={{ color: 'var(--on-surface)', letterSpacing: '-0.018em' }}
              >
                Skolar
              </span>
              <span
                className="text-[9px] uppercase tracking-[0.18em] font-mono leading-none"
                style={{ color: 'var(--color-outline)' }}
              >
                Asistente Académico
              </span>
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
            aria-label={language === 'es' ? 'Cerrar menú' : 'Close menu'}
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <div className="px-5 pt-4 pb-3">
          <div className="text-[12.5px] font-bold leading-none" style={{ color: 'var(--on-surface)' }}>
            {displayName}
          </div>
          <div
            className="text-[9.5px] uppercase tracking-[0.16em] font-mono mt-1"
            style={{ color: 'var(--color-outline)' }}
          >
            {profile?.is_premium ? 'PREMIUM · ALL ACCESS' : 'FREE'}
          </div>
        </div>

        <div className="px-5 pt-2 pb-1">
          <span
            className="text-[9px] uppercase tracking-[0.18em] font-mono font-semibold"
            style={{ color: 'var(--color-outline)' }}
          >
            {language === 'es' ? 'Navegación' : 'Navigation'}
          </span>
        </div>

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
                <span
                  className="material-symbols-outlined text-[20px] flex-shrink-0"
                  style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {icon}
                </span>
                <span className="flex-1 leading-none">{t(`nav.${key}`)}</span>
                {active && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: accentColor }}
                  />
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
                <span
                  className="material-symbols-outlined text-[18px] flex-shrink-0"
                  style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {icon}
                </span>
                <span className="flex-1 leading-none">{label}</span>
              </Link>
            )
          })}
        </nav>

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

      {/* ─────────── Desktop sidebar (extendable, 240/72) ─────────── */}
      <aside
        className={`hidden lg:flex t-sidebar ${collapsed ? 'is-collapsed' : ''}`}
        aria-label={t('nav.dashboard')}
      >
        <Link href="/dashboard" className="t-sidebar__logo" aria-label="Skolar">
          {collapsed ? (
            <Image src={markLogo} alt="Skolar" width={28} height={28} priority />
          ) : (
            <Image
              src={fullLogo}
              alt="Skolar — Asistente Académico"
              width={200}
              height={44}
              priority
              style={{ width: 'auto', height: 44, objectFit: 'contain' }}
            />
          )}
        </Link>

        <div className="t-sidebar__role" aria-hidden={collapsed}>
          <span className="material-symbols-outlined">school</span>
          <span>{language === 'es' ? 'Estudiante' : 'Student'}</span>
        </div>

        <nav className="t-sidebar__nav" aria-label="Student navigation">
          {topItems.map(renderItem)}
          {!collapsed && (
            <div className="t-sidebar__group-label">
              {language === 'es' ? 'General' : 'General'}
            </div>
          )}
          {collapsed && <hr className="t-sidebar__group-hr" />}
          {generalItems.map(renderItem)}
        </nav>

        <button
          type="button"
          className="t-sidebar__collapse"
          onClick={toggle}
          aria-label={
            collapsed
              ? language === 'es' ? 'Expandir' : 'Expand'
              : language === 'es' ? 'Colapsar' : 'Collapse'
          }
          aria-expanded={!collapsed}
        >
          <span className="material-symbols-outlined">
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
          <span className="t-sidebar__collapse__label">
            {language === 'es' ? 'Colapsar' : 'Collapse'}
          </span>
        </button>

        <div className="t-sidebar__profile">
          <div className="t-sidebar__profile__avatar" title={displayName}>
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={displayName}
                width={36}
                height={36}
                style={{ borderRadius: 999, objectFit: 'cover' }}
              />
            ) : (
              initials
            )}
          </div>
          <div className="t-sidebar__profile__info">
            <div className="t-sidebar__profile__name">{displayName}</div>
            <div className="t-sidebar__profile__role">
              {language === 'es' ? 'Estudiante' : 'Student'}
            </div>
          </div>
          <button
            type="button"
            className="t-sidebar__profile__logout"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label={t('nav.logout')}
            title={t('nav.logout')}
          >
            <span className="material-symbols-outlined">
              {loggingOut ? 'hourglass_empty' : 'logout'}
            </span>
          </button>
        </div>
      </aside>
    </>
  )
}
