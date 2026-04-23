export const TEACHER_NAV_ITEMS = [
  { key: 'teacher.nav.dashboard', href: '/teacher/dashboard', icon: 'home'      },
  { key: 'teacher.nav.courses',   href: '/teacher/courses',   icon: 'menu_book' },
]

export const NAV_ITEMS = [
  { key: 'dashboard', href: '/dashboard', icon: 'home'           },
  { key: 'ai',        href: '/ai',        icon: 'auto_awesome'   },
  { key: 'calendar',  href: '/calendar',  icon: 'calendar_month' },
  { key: 'subjects',  href: '/subjects',  icon: 'menu_book'      },
  { key: 'planner',   href: '/planner',   icon: 'check_circle'   },
  { key: 'notes',     href: '/notes',     icon: 'sticky_note_2'  },
]

// Bottom tab bar (5 tabs) — Home | Calendar | Planner | Subjects | More
export const BOTTOM_NAV = [
  { key: 'dashboard', href: '/dashboard', icon: 'home'           },
  { key: 'calendar',  href: '/calendar',  icon: 'calendar_month' },
  { key: 'planner',   href: '/planner',   icon: 'check_circle'   },
  { key: 'subjects',  href: '/subjects',  icon: 'menu_book'      },
]

// Items revealed inside the "More" bottom sheet
export const MORE_ITEMS = [
  { key: 'ai',    href: '/ai',    icon: 'auto_awesome'  },
  { key: 'notes', href: '/notes', icon: 'sticky_note_2' },
]

// Paths that belong to "More" — used to highlight the More tab when active
export const MORE_PATHS = ['/ai', '/notes', '/settings', '/personalization', '/ai-settings']

// Side drawer — account & utility only (no duplicate of bottom nav main items)
export const SIDE_MENU_ITEMS = [
  { key: 'settings',        href: '/settings',        icon: 'manage_accounts',   label_es: 'Cuenta',           label_en: 'Account'          },
  { key: 'personalization', href: '/personalization', icon: 'palette',           label_es: 'Personalización',  label_en: 'Personalization'  },
  { key: 'ai',              href: '/ai-settings',     icon: 'auto_awesome',      label_es: 'Configuración IA', label_en: 'AI Settings'      },
  { key: 'plan',            href: '/settings',        icon: 'workspace_premium', label_es: 'Plan',             label_en: 'Plan'             },
  { key: 'help',            href: '/settings',        icon: 'help_outline',      label_es: 'Ayuda',            label_en: 'Help'             },
]
