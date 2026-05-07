# /notes — context dump

Repo `scholr` · canon prod `scholr-5x9n.vercel.app` · branch `main`. Working dir:
`/Users/sebastiansequeira/Library/Mobile Documents/com~apple~CloudDocs/Scholar/skolar/`.

Tarea: aplicar a `/notes` el mismo tratamiento que se le hizo a las otras pantallas. Solo hechos del estado actual abajo.

---

## Estado de `/notes`

- Path: `app/(app)/notes/page.tsx` (838 líneas).
- `'use client'`. 3-pane: lista lateral + editor principal + acciones.
- Imports clave: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/core` (custom `ImageNode`).
- Hooks/utils: `useTranslation`, `debounce`, `timeAgo`, `uniqueById` (`@/lib/utils`).
- Types: `Note`, `Subject` (`@/types`).
- Componente exportado: `NoteEditor` (linea 32 aprox).
- Features dentro: autosave debounced, auto-title (extrae H1/H2/H3 → primer plain text → fallback fecha), voice input vía `SpeechRecognition`, image upload vía `<input type="file">` + Supabase Storage, subject dropdown.
- Wrapper actual del editor: `<div className="max-w-3xl mx-auto px-6 py-8 lg:px-12 lg:py-10">` (linea 397).
- Algunos `style={{...}}` con `color-mix(in srgb, ${currentSubject.color} 12%, transparent)` y `'var(--s-base)'`, `'var(--color-outline)'`. La mayoría usa tokens; quedan inline styles con vars.
- No hay `DashMetaBar` ni `<header className="screen-head">` actualmente.
- No fetchea `exams` ni `tasks` (solo `notes` y `subjects`).
- No lee `searchParams`. No hay handler de `?new=1`.

## i18n actual `notes.*`

Ya presentes en `i18n/es.json` y `i18n/en.json` bajo el bloque `"notes"`: `noSubject`, `voice_start`, `voice_stop`, otras (grep `notes\.` para inventario completo).

No existen aún: `eyebrow`, `titleA`, `titleSerif`, `titleB`, `subTpl`, `filter`, `newNote` (o equivalentes para el header v2).

---

## Schema Supabase relevante

Tabla `public.notes` (RLS ON, 11 filas):
- `id uuid pk`
- `user_id uuid → auth.users.id`
- `subject_id uuid? → public.subjects.id`
- `title text default ''`
- `content text default ''`
- `updated_at timestamptz default now()`
- `created_at timestamptz default now()`

Tabla `public.subjects` (RLS ON, 101 filas) — columnas usadas en notes: `id`, `user_id`, `name`, `color`, `teacher_id`, `evaluation_plan jsonb?`.

Tablas también consultadas por las otras pantallas v2: `tasks`, `exams`, `exam_grades`, `enrollments`. Detalles completos de schema en CLAUDE.md.

RLS: queries de `notes` y `subjects` se auto-scopean al user autenticado. Excepción documentada en CLAUDE.md: subjects + exams pueden venir vía `enrollments` (no agregar `.eq('user_id', user.id)` para esos).

---

## Estado de las otras pantallas (ya rebuildeadas v2)

| Path | Estado |
|---|---|
| `app/(app)/dashboard/page.tsx` | v2 con `DashMetaBar` (líneas ~230) y hero serif italic. Real data. |
| `app/(app)/calendar/page.tsx` | v2 (commits `beef3ff`, `d1f2739`). Month/week/day custom. |
| `app/(app)/subjects/page.tsx` | v2. Cards + detail modal. |
| `app/(app)/ai/page.tsx` | v2. Hero copilot. |
| `app/(app)/tareas/page.tsx` | v2 + Supabase real + DnD persistente (@dnd-kit). Maneja `?new=1` (auto-abre quick-add de Pendientes). |
| `app/(app)/evaluaciones/page.tsx` | v2 + Supabase real + drawer detalle + study plan editable. Maneja `?new=1` y botón "+ Agregar" (abre `ExamCreateForm` en SideDrawer). |
| `app/(app)/planner/page.tsx` | Pantalla vieja, intacta. Ningún link interno apunta acá. |

---

## Componentes/utilities disponibles

| Path | Export | Notas |
|---|---|---|
| `features/home/components/DashMetaBar.tsx` | `DashMetaBar` | Props: `weekIndex \| null`, `weekTotal \| null`, `avg \| null`, `alertDueLabel \| null`. Reloj live cada 30s. |
| `lib/meta.ts` | `computeIsoWeek(date)`, `computeWeightedAvg(subjects, exams)`, `computeAlertDueLabel(tasks, exams, lang)`, `subjectInfo(id, subjects)` | Puros. Reusables. |
| `components/ui/SideDrawer.tsx` | `SideDrawer` | Portal a `document.body`. Solo monta si `open=true`. Esc + overlay click cierran. Props `open`, `onClose`, `kicker?`, `title`, `children`. |
| `lib/supabase/client.ts` | `createClient` | Browser client. |
| `hooks/useTranslation.ts` | `useTranslation` | Returns `{ t, language, changeLanguage }`. |
| `lib/utils.ts` | `subjectTag(hex)`, `daysUntil`, `isToday`, `isTomorrow`, `formatTime`, `debounce`, `getInitials`, `uniqueById`, `uniqueByName`, `timeAgo` | Reusables. |

---

## CSS classes ya en `app/globals.css`

Líneas relevantes:

- 102, 158: `--accent-soft` definido en root.
- 480–491: `.badge--prio-{high,mid,low}` con `--priority-{...}-bg/-fg`.
- 544–625: `.sidebar`, `.sidebar__btn`, `.sidebar__btn.active`, etc.
- 648–731: `.topbar*`, `.search`, `.theme-toggle`, `.btn-new`.
- 827–860: `.screen-head`, `.screen-head__left`, `.screen-head__title`, `.screen-head__title em/.serif`, `.screen-head__sub`, `.screen-head__actions`.
- 915–920 + 1516–1521: `.tag-{purple,cyan,green,amber,rose,blue}` con `--accent-color/-bg/-bg-strong`.
- Append final (introducidos en este sprint): `.kicker`, `.serif`, `.subj-chip`, `.tipo-chip`, `.pct-chip`, `.grade-chip`, `.seg`, `.seg__btn`, `.kan-grid`, `.kan-col`, `.kan-card`, `.kan-card.is-dragging`, `.kan-card-overlay`, `.kan-col.is-over`, `.kan-col__empty`, `.kan-card__delete`, `.quick-add*`, `.timeline`, `.timeline-row`, `.day-block*`, `.eval-card*`, `.countdown`, `.countdown.is-{danger,warning}`, `.fab-new`, `.side-drawer-overlay`, `.side-drawer`, `.side-drawer__head/title/kicker/close/body/placeholder/id`, `.drawer-chips`, `.drawer-section`, `.drawer-section__label`, `.drawer-meta*`, `.drawer-actions`, `.drawer-progress*`, `.drawer-checklist`, `.drawer-step*`, `.drawer-step.is-done`, `.drawer-step__delete`, `.drawer-step__edit-input`, `.drawer-add-step*`, `.drawer-stats`, `.drawer-stat*`, `.drawer-stat--editable`, `.drawer-form*`, `.drawer-form__type-grid/__type/__type.is-active`, `.drawer-form__error`.

CSS vars semánticas disponibles (no exhaustivo): `--s-bg`, `--s-dim`, `--s-low`, `--s-base`, `--s-high`, `--s-highest`, `--s-bright`, `--on-surface`, `--on-surface-variant`, `--color-outline`, `--color-outline-variant`, `--border-subtle`, `--border-default`, `--border-strong`, `--color-primary`, `--color-primary-container`, `--color-primary-hover`, `--color-tertiary` (lavanda AI), `--success`, `--warning`, `--danger`, `--info`, `--priority-{high,mid,low}` y `--priority-{high,mid,low}-bg`, `--tag-{purple,cyan,green,amber,rose,blue}`, `--font-sans`, `--font-serif` (Instrument Serif), `--font-mono`, `--radius-sm/-/lg/xl`, `--glass-bg`, `--overlay-bg`.

---

## Routing relevante

- `config/nav.ts::NAV_ITEMS` ya incluye `{ key: 'notes', href: '/notes', icon: 'sticky_note_2' }`.
- `components/layout/Topbar.tsx::CRUMBS['/notes']` ya está como `{ crumb_es: 'Apuntes', crumb_en: 'Notes', title_es: 'Mis notas', title_en: 'My notes' }`.
- Topbar `+ Nuevo` (línea 89 aprox) detecta `pathname` y rutea: `/evaluaciones?new=1` si está en /evaluaciones, `/notes?new=1` si está en /notes, sino `/tareas?new=1`.
- `BOTTOM_NAV` no incluye notes (mobile bottom tabs son dashboard/calendar/tareas/subjects). `MORE_ITEMS` sí incluye notes.

---

## Patrón `?new=1` (tal como está implementado en /tareas y /evaluaciones)

Lectura de URL en /tareas (`app/(app)/tareas/page.tsx`):
```tsx
const router = useRouter()
const searchParams = useSearchParams()
useEffect(() => {
  if (searchParams.get('new') === '1') {
    setAutoOpenPending(true)
    router.replace('/tareas', { scroll: false })
  }
}, [searchParams, router])
```

En /evaluaciones (mismo archivo, distintas líneas):
```tsx
useEffect(() => {
  if (searchParams.get('new') === '1') {
    setCreating(true)
    router.replace('/evaluaciones', { scroll: false })
  }
}, [searchParams, router])
```

---

## i18n parity check (cualquier rebuild lo necesita pasar)

```bash
cd skolar && node -e "
const es = require('./i18n/es.json'); const en = require('./i18n/en.json');
function k(o,p=''){let r=[];for(const x of Object.keys(o)){const v=o[x];if(v&&typeof v==='object'&&!Array.isArray(v))r=r.concat(k(v,p+x+'.'));else r.push(p+x);}return r;}
const a=new Set(k(es)), b=new Set(k(en));
console.log('es-only:', [...a].filter(x=>!b.has(x)));
console.log('en-only:', [...b].filter(x=>!a.has(x)));
"
```

Output esperado: `es-only: []` / `en-only: []`.

---

## Verificación tipo + dev

```bash
cd skolar
npx tsc --noEmit                              # exit 0
npm run dev                                   # localhost:3000
# /notes debe responder 307 (redirect a login si no auth) o 200 si auth
```

---

## Memoria del usuario relevante

- `sebastiansequeirab@gmail.com` es el user de prueba (tiene 11 notes, 3 tasks, 32 exams, 101 subjects).
- Idioma default: ES (`'es'` en `profiles.language`, cookie `skolar_lang`).
- Cada cambio termina con commit + push + Vercel auto-deploy (proyecto `scholr`).
- Lenguaje de la conversación habitual: español.
- No hardcodear hex; usar CSS vars.
- Mantener i18n es/en en sync.
- Sin `any` en TypeScript (regla del repo).

---

## Último commit antes de este handoff

Ver `git log -1` en main. Lista de commits recientes incluye `feat(tareas+evaluaciones)`, fixes drawer, kanban dnd, split planner.
