'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useTranslation } from '@/hooks/useTranslation'

type CrumbMap = Record<string, { crumb_es: string; crumb_en: string; title_es: string; title_en: string }>

const CRUMBS: CrumbMap = {
  '/dashboard':       { crumb_es: 'Inicio',         crumb_en: 'Home',          title_es: 'Tu día',        title_en: 'Your day'       },
  '/subjects':        { crumb_es: 'Materias',       crumb_en: 'Subjects',      title_es: 'Mis clases',    title_en: 'My classes'     },
  '/tasks':           { crumb_es: 'Tareas',         crumb_en: 'Tasks',         title_es: 'Pendientes',    title_en: 'Open work'      },
  '/tareas':          { crumb_es: 'Tareas',         crumb_en: 'Tasks',         title_es: 'Esta semana',   title_en: 'This week'      },
  '/evaluaciones':    { crumb_es: 'Evaluaciones',   crumb_en: 'Exams',         title_es: 'Próximas',      title_en: 'Upcoming'       },
  '/planner':         { crumb_es: 'Tareas',         crumb_en: 'Tasks',         title_es: 'Plan',          title_en: 'Plan'           },
  '/calendar':        { crumb_es: 'Calendario',     crumb_en: 'Calendar',      title_es: 'Esta semana',   title_en: 'This week'      },
  '/exams':           { crumb_es: 'Evaluaciones',   crumb_en: 'Exams',         title_es: 'Próximas',      title_en: 'Upcoming'       },
  '/notes':           { crumb_es: 'Apuntes',        crumb_en: 'Notes',         title_es: 'Mis notas',     title_en: 'My notes'       },
  '/ai':              { crumb_es: 'Skolar IA',      crumb_en: 'Skolar AI',     title_es: 'Copiloto',      title_en: 'Copilot'        },
  '/grades':          { crumb_es: 'Calificaciones', crumb_en: 'Grades',        title_es: 'Boletín',       title_en: 'Transcript'     },
  '/settings':        { crumb_es: 'Configuración',  crumb_en: 'Settings',      title_es: 'Tu perfil',     title_en: 'Your profile'   },
  '/personalization': { crumb_es: 'Personalización',crumb_en: 'Personalization',title_es: 'Tu look',      title_en: 'Your look'      },
  '/ai-settings':     { crumb_es: 'IA',             crumb_en: 'AI',            title_es: 'Configuración', title_en: 'Settings'       },
}

function findCrumb(pathname: string) {
  if (CRUMBS[pathname]) return CRUMBS[pathname]
  const match = Object.keys(CRUMBS)
    .filter(p => pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0]
  return match ? CRUMBS[match] : null
}

export function Topbar() {
  const pathname = usePathname()
  const { language } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const meta = findCrumb(pathname)
  const crumb = !meta ? '' : language === 'es' ? meta.crumb_es : meta.crumb_en
  const titleEm = !meta ? '' : language === 'es' ? meta.title_es : meta.title_en

  const isLight = mounted && resolvedTheme === 'light'

  return (
    <header className="topbar hidden lg:flex">
      <div className="topbar__breadcrumbs">
        {crumb && (
          <span className="topbar__crumb">{crumb}</span>
        )}
        {titleEm && (
          <>
            <span className="topbar__crumb-sep">·</span>
            <span className="topbar__crumb-cur serif">{titleEm}</span>
          </>
        )}
      </div>

      <div className="topbar__search-wrap">
        <div className="search">
          <span className="material-symbols-outlined">search</span>
          <input
            placeholder={language === 'es' ? 'Buscar tareas, clases, notas…' : 'Search tasks, classes, notes…'}
            aria-label="Search"
          />
          <span className="search__kbd">⌘K</span>
        </div>
      </div>

      <div className="topbar__actions">
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme(isLight ? 'dark' : 'light')}
          aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
          suppressHydrationWarning
        >
          <span className="material-symbols-outlined">
            {isLight ? 'dark_mode' : 'light_mode'}
          </span>
        </button>
        <Link
          href={
            pathname.startsWith('/evaluaciones') ? '/evaluaciones?new=1' :
            pathname.startsWith('/notes')        ? '/notes?new=1' :
            '/tareas?new=1'
          }
          className="btn-new"
        >
          <span className="material-symbols-outlined">add</span>
          {language === 'es' ? 'Nuevo' : 'New'}
        </Link>
      </div>
    </header>
  )
}
