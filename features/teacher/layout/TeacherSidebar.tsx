'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { getInitials } from '@/lib/utils'
import { TEACHER_NAV_ITEMS } from '@/config/nav'
import { useTeacherSidebar } from './TeacherShell'
import type { Profile } from '@/types'

export function TeacherSidebar({ profile }: { profile: Profile | null }) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const { collapsed, toggle, mobileOpen, closeMobile } = useTeacherSidebar()
  const { resolvedTheme } = useTheme()
  const [loggingOut, setLoggingOut] = useState(false)

  const isActive = (href: string) =>
    href === '/teacher' ? pathname === '/teacher' : pathname === href || pathname.startsWith(href + '/')

  const handleLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const fullLogo = resolvedTheme === 'light' ? '/logo-light.png' : '/logo-full-white.png'
  const markLogo = resolvedTheme === 'light' ? '/logo-light-mark.png' : '/logo-icon-white.png'

  const initials = profile?.full_name ? getInitials(profile.full_name) : 'P'
  const displayName = profile?.full_name || 'Profesor'

  const topItems = TEACHER_NAV_ITEMS.filter(i => i.group === 'top')
  const generalItems = TEACHER_NAV_ITEMS.filter(i => i.group === 'general')

  const renderItem = ({ key, href, icon }: { key: string; href: string; icon: string }) => {
    const active = isActive(href)
    return (
      <Link
        key={key}
        href={href}
        className={`t-sidebar__item ${active ? 'is-active' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={closeMobile}
        title={collapsed ? t(key) : undefined}
      >
        <span className="material-symbols-outlined">{icon}</span>
        <span className="t-sidebar__item__label">{t(key)}</span>
      </Link>
    )
  }

  return (
    <>
      <aside
        className={`t-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-open' : ''}`}
        aria-label={t('teacher.nav.panel')}
      >
        <Link href="/teacher" className="t-sidebar__logo" aria-label="Skolar">
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
          <span className="material-symbols-outlined">podcasts</span>
          <span>{t('teacher.nav.role')}</span>
        </div>

        <nav className="t-sidebar__nav" aria-label="Teacher navigation">
          {topItems.map(renderItem)}
          {!collapsed && <div className="t-sidebar__group-label">{t('teacher.nav.general')}</div>}
          {collapsed && <hr className="t-sidebar__group-hr" />}
          {generalItems.map(renderItem)}
        </nav>

        <button
          type="button"
          className="t-sidebar__collapse"
          onClick={toggle}
          aria-label={collapsed ? t('teacher.nav.expand') : t('teacher.nav.collapse')}
          aria-expanded={!collapsed}
        >
          <span className="material-symbols-outlined">{collapsed ? 'chevron_right' : 'chevron_left'}</span>
          <span className="t-sidebar__collapse__label">{t('teacher.nav.collapse')}</span>
        </button>

        <div className="t-sidebar__profile">
          <div className="t-sidebar__profile__avatar" title={displayName}>
            {profile?.avatar_url
              ? <Image src={profile.avatar_url} alt={displayName} width={36} height={36} style={{ borderRadius: 999, objectFit: 'cover' }} />
              : initials}
          </div>
          <div className="t-sidebar__profile__info">
            <div className="t-sidebar__profile__name">{displayName}</div>
            <div className="t-sidebar__profile__role">{t('teacher.nav.role')}</div>
          </div>
          <button
            type="button"
            className="t-sidebar__profile__logout"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label={t('teacher.nav.logout')}
            title={t('teacher.nav.logout')}
          >
            <span className="material-symbols-outlined">
              {loggingOut ? 'hourglass_empty' : 'logout'}
            </span>
          </button>
        </div>
      </aside>

      <div
        className="t-sidebar__backdrop"
        onClick={closeMobile}
        aria-hidden="true"
      />
    </>
  )
}
