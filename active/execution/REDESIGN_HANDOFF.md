# Skolar — Rediseño visual v2 (Swiss editorial académica)

> **Para Claude Code en próximas sesiones.** Este doc es lo único que necesitás leer para retomar el rebuild visual sin contexto previo. Última actualización 2026-05-06 — commits `ef1439e`, `1a71889`, `88d8ea4`, `9d3ea24` (planner kanban), `1729295` (calendar editorial), `62a4e43` (notes 3-pane).

---

## 1 · Qué pasó en este rebuild

El usuario rediseñó Skolar en Claude Design (canvas HTML/CSS/React-via-CDN) y lo portamos al app Next.js de producción. La carpeta original del canvas vive en `/Users/sebastiansequeira/Library/Mobile Documents/com~apple~CloudDocs/Scholar/re design/_src/skolar-2/project/` — usala como **fuente visual de verdad** cuando necesites ver cómo se veía algo.

**Producción:** https://skolar-kappa.vercel.app/ — auto-deploy desde `main` en Vercel proyecto `skolar` (NO `scholr` — ese era un duplicado, ignorar).

**Stack:** Next.js 14 App Router · TypeScript strict · Tailwind · Supabase · `next-themes` (attribute=class) · Inter + Instrument Serif + JetBrains Mono via Google Fonts.

---

## 2 · Dirección estética (no negociable)

| Elemento | Token |
|---|---|
| Body font | `var(--font-sans)` → Inter |
| **Italic accents en títulos** (la firma del look) | `var(--font-serif)` → Instrument Serif italic — usar en tags `<em>`, `<span class="serif">` o clase `.serif` |
| Mono (timestamps, kickers, weights, codes) | `var(--font-mono)` → JetBrains Mono con `tabular-nums` |
| Dark surface | `--s-bg #0e1014` warm slate (NO navy frío) |
| Light surface | `--s-bg #fbf9f6` warm bone (NO blanco frío) |
| Primary | `--color-primary #5b8def` (light) / `#2d5bff` (dark) — royal blue |
| AI tertiary | `--color-tertiary #c084fc` lavanda |
| Tags por materia | `--tag-{purple,cyan,green,amber,rose,blue}` — son la "firma de color" de cada materia, sobreviven la migración |
| Radii | `--radius-sm 8` / `--radius 10` / `--radius-lg 14` / `--radius-xl 18` |
| Body font-size base | 13.5px (más chico de lo normal — densidad editorial) |
| Letter-spacing | -0.005em body, -0.02em headlines, 0.16em kickers |

**Patrones señales que identifican el rediseño** (si están ausentes en una pantalla, todavía no fue migrada):
- Kicker mono uppercase con tracking 0.16em → serif italic title  
- Cards con barra superior 2px coloreada por subject  
- KPI con `tabular-nums` y label mono  
- Status badges (APROBANDO / EN RIESGO / DESAPROBADO / SIN NOTAS)  
- `.live-dot` para "en vivo"  
- `reveal-stagger` para fade-in escalonado al cargar la pantalla

---

## 3 · Design system (todo en `app/globals.css`)

### Componentes listos para usar

```
.card                 — bg s-low + border subtle + radius-lg + 14px padding
.card-hover           — adds cursor:pointer + hover bg/border
.card-flat            — sin background, solo border
.card-elevated        — bg s-base + border default + 16px padding

.btn                  — base 32h, 12.5px font, .15s transitions
.btn-primary          — color-primary-container bg + on-primary text
.btn-secondary        — s-low bg + border default
.btn-ghost            — transparent + on-surface-variant text
.btn-danger           — danger bg + white text
.btn-tertiary         — tertiary-container bg (para AI)
.btn-icon             — 32x32 square

.badge                — mono 9.5px uppercase pill
.badge--prio-{high,mid,low}
.badge--{success,danger,warn,ai}

.chip                 — pill rounded-full con icon + texto
.chip.urgent          — red bg + red text + red border

.kicker               — mono 10px uppercase tracking 0.16em color-outline
.headline             — 30px bold tracking -0.02em (con <em class="serif"> dentro)
.display              — clamp(34,4.6vw,52)px — para hero login/register
.tabular              — font-variant-numeric: tabular-nums

.row                  — grid 38px/1fr/auto + barra lateral 2px ::before
                        + .row__time / .row__main / .row__title / .row__meta / .row__right
.tag-{purple,cyan,green,amber,rose,blue}  — sobre .row para colorear la barra

.stat                 — pill con .stat__num + .stat__label + .stat__value
.stat.urgent          — variante roja

.kpi                  — bloque más grande con .kpi__sub + .kpi__num + .kpi__hint
.kpi__num.{good,pass,risk,fail}  — tonos por estado de calificación

.progress-bar         — 4px alto + .progress-fill (transition width .25s)
.progress-bar.lg      — 8px alto

.grade-input          — input numérico tabular 70px width
.grade-input.{good,pass,risk,fail}  — color del texto según classify()

.input                — input genérico full width
.label                — mono 9.5px uppercase tracking 0.16em sobre inputs

.search               — flex con icon + input + ⌘K kbd hint
.theme-toggle         — pill con dos buttons (light/dark)

.sidebar / .sidebar__btn / .sidebar__logo / .sidebar__avatar / .sidebar__divider
.topbar / .topbar__breadcrumbs / .topbar__crumb / .topbar__crumb-cur / .topbar__actions
.subheader / .subheader__right / .subheader__ctx
.urgent               — span rojo con flag para subheader

.section-head         — flex space-between con icon + title + count + link
.screen-head          — header de página con kicker + title 28px + actions

.live-dot             — círculo verde 6px con halo

.modal-overlay        — backdrop blur + flex center
.modal-content        — animate-slide-up + bg s-base + border + radius-xl

.switch / .switch__thumb  — toggle 40x22

.glass                — backdrop-filter blur(20px) saturate(160%)
.mesh-warm            — gradient mesh para hero (login/AI)
.grain                — overlay noise SVG sutil (::after)

.reveal-stagger       — fade-in escalonado para hijos directos (hasta 8 hijos)
```

### Mobile tokens (`--m-*`)

Aliasados a las superficies normales así que `.m-card` etc. funcionan automáticamente. Sólo `--m-tab-h: 64px` y `--m-radius: 14px` siguen como valores propios.

### Tailwind config

`font-sans`, `font-serif`, `font-mono` están registrados. Tags `bg-tag-purple` etc. también. Pero **prefiero las CSS vars** (`color-mix(in srgb, var(--color-primary) 14%, transparent)` etc.) sobre Tailwind utilities — es lo que usa el resto del rediseño.

---

## 4 · Sistema de calificaciones — `lib/grades.ts`

Portado 1:1 desde el canvas. Único módulo que **DEBE** usarse para todo cálculo de notas:

```ts
import {
  PASS,           // 9.5
  MAX_SCORE,      // 20
  summarize,      // (GradeItem[]) → GradeSummary
  classify,       // (score) → 'good'|'pass'|'risk'|'fail'|'pending'
  projectIfAvg,   // (grades, futureAvg) → number — para escenarios
  statusLabel,    // (status, lang) → 'APROBANDO'|'EN RIESGO'|...
  statusBg,       // (status) → CSS background color
  statusFg,       // (status) → CSS foreground color
  type GradeItem, type GradeSummary, type GradeStatus, type GradeClass,
} from '@/lib/grades'
```

**Reglas (no negociables):**
- Escala 0–20, aprueba ≥ 9.5
- Fórmula: `notaFinal = Σ (score / max) × 20 × (peso / 100)` con `Σ peso = 100`
- `score = null` → pendiente, no entra al promedio actual pero sí al "qué necesito"
- Status pasa a `'fail'` cuando `neededToPass > 20` (ya es matemáticamente imposible)

**Reglas de RLS importantes** (de `CLAUDE.md`):
- Teacher-assigned exams: `exams.assigned_by IS NOT NULL` → grades viven en `exam_grades(exam_id, student_id, grade)`, **NO** en `exams.grade`
- Student exams: `exams.assigned_by IS NULL` → grade vive en `exams.grade` (estudiante puede editar libremente)

---

## 5 · Estado actual (qué está hecho)

### Foundations + shell — commit `ef1439e`
- ✅ `app/globals.css` reescrito completo (tokens + ~30 component utilities + animaciones + ProseMirror styles)
- ✅ `tailwind.config.ts` (font-serif registrado, tag tokens, radii)
- ✅ `components/layout/Sidebar.tsx` — desktop 60px icon-only + mobile top bar 48h + bottom tab 64h + drawer + bottom-sheet "Más"
- ✅ `components/layout/Topbar.tsx` (NUEVO) — kicker breadcrumb + serif italic title (mapeo por ruta) + search ⌘K + theme toggle
- ✅ `app/(app)/layout.tsx` — wireado Sidebar + Topbar, content `max-w-1240px`
- ✅ Logos importados (`/public/logo-{icon-blue,icon-white,dark-{icon,mark,wordmark,cropped},light-{...},full-white,transparent}.png`)
- ✅ Fonts: Inter + Instrument Serif + JetBrains Mono via @import en globals.css

### Pantallas migradas a la jerarquía editorial — commit `ef1439e`
- ✅ `/login` — dual-role hero estudiante/profesor con gradient mesh + grain + serif italic display
- ✅ `/register` — mismo hero, role switch, post-submit "revisá tu correo"
- ✅ `/forgot-password` — compact card con success state mark_email
- ✅ `/dashboard` — greeting hero + serif italic name + KPI ribbon (hechas/urgentes/semana/próximas) + urgent banner rojo + announcements + 3-col grid (today/tasks/upcoming) + Quick Access tinted cards
- ✅ `/subjects` — screen-head + cards con status badge + KPI metric grid + colored top bar + schedule pills + kebab menu
- ✅ `/ai` — copiloto hero con gradient mesh + context chips (materias indexadas / apuntes / próximo examen / tareas) + tab bar lavanda
- ✅ `features/home/components/LiveClock.tsx` — mono 44px light, primary-colored colon, mono uppercase date

### Calculadora — commits `1a71889` + `88d8ea4`
- ✅ `lib/grades.ts` portado
- ✅ `features/subjects/components/SubjectDetail.tsx` rediseñado completo:
  - Header con kicker (créditos · prof) + serif italic title + status badge live + subject color accent
  - Tab bar (Calculadora / Archivos / Chat IA) con accent del color de la materia
  - **KPI strip 4 boxes**: Promedio actual / Proyección final / Para aprobar (con ✓/✕/número) / Estado
  - **Tabla editable** con `.grade-input` coloreado por classify()
  - **Auto-save on blur** para exams del estudiante (`assigned_by IS NULL`):
    - Update `exams.grade` + `exams.percentage` + `submission_status='graded'`
    - SaveBadge inline: spinner 'guardando' → ✓ verde 'guardado' (1.4s) → idle
    - No-op si el valor no cambió
    - Después del save actualiza `exams` local para próximas comparaciones
  - **Teacher exams** disabled con opacidad 0.55 + 🔒 lock icon + tooltip
  - **Validación visual**: `⚠ pesos NN%` en warn cuando totalWeight ≠ 100
  - **Panel "Escenarios"**: usa `projectIfAvg` para 10/14/18 y muestra ✓ si aprueba

### Headers editoriales (sólo screen-head, body intacto) — commit `1a71889`
- ✅ `/planner` (kanban body sin tocar — 1440 líneas)
- ✅ `/tasks`
- ✅ `/calendar` (week grid body sin tocar)
- ✅ `/notes` (editor body intacto, pero título del apunte ahora en Instrument Serif italic 32px)
- ✅ `/settings`, `/personalization`, `/ai-settings`
- ✅ `/teacher/dashboard` + `/teacher/courses` (lista)

### i18n
- ✅ Nuevas keys en `i18n/es.json` + `i18n/en.json`:
  - `auth.tag`, `auth.heroStudentTitle`, `auth.heroStudentTitleEm`, `auth.heroTeacherTitle*`, `auth.heroStudent/TeacherSub`, `auth.feat1/2/3`, `auth.welcomeBack`, `auth.welcomeTeacher`, `auth.loginSubStudent/Teacher`, `auth.orWithEmail`, `auth.submitStudent/Teacher`, `auth.studentSub`, `auth.teacherSub`
  - `dashboard.statCompleted/Urgent/Week/Upcoming`
  - `common.general`

---

## 6 · Pendientes (priorizados para próximas sesiones)

### Alta prioridad

**1) `/planner` body (kanban)** — ✅ HECHO (commit `9d3ea24`, 2026-05-06).
- Toggle Kanban/Lista en `screen-head__actions` con clase `.seg` (mono uppercase)
- Tres columnas `.kan-col` (todo/doing/done) con título coloreado (danger/primary/success) y `.section-head__count`
- `TaskKanCard` compacto (badge materia + prio + título + due chip); click expande inline al `TaskCard` completo (subtareas/notas) con botón "compactar" para volver
- `ExamKanCard` compacto (badge materia + tipo + peso + nota); click abre `EditExamModal` existente. Footer marca submitted/graded
- Buckets independientes de los del list view, respetan filtros de tipo + materia
- CSS nuevo en `globals.css`: `.kanban`, `.kan-col`, `.kan-card`, `.add-row`, `.seg`
- i18n: `planner.viewKanban/viewList/col_todo/col_doing/col_done/addTask/collapse/emptyTodo/emptyDoing/emptyDone`
- **No se implementó drag-and-drop** — las tareas cambian de columna mediante el `cycleStatus` ya existente al expandir. Si más adelante se quiere DnD: usar `@dnd-kit/core` + actualizar `tasks.status`/`is_done` desde el handler

**2) `/calendar` body (week grid)** — ✅ HECHO (commit `1729295`, 2026-05-06).
Decisión arquitectural: NO se reemplazó FullCalendar (perdería month/day/DnD/popovers + 800 líneas de SANCTUARY CSS ya bien ajustadas). En su lugar se refinó el SANCTUARY CSS para acercarse al canvas:
- Slot dividers horizontales en `dashed` (`border-top: 1px dashed var(--border-subtle)`)
- Hour-axis ensanchada a 56px con labels mono uppercase tracking 0.06em
- Today: tinte primary 7% en columna + day-name del header en color primary (week+day views)
- Eventos suavizados: schedule mix 14%, exam mix 18%, task mix 12% sobre `s-low` (antes 50/35/28% sobre `s-base` — saturado)
- Bordes laterales de evento siguen al subject color a saturación plena

**Si más adelante se quiere reemplazar FullCalendar wholesale** (canvas: `cal-grid`, `cal-day`, `cal-cell`, `cal-event`):
- Implementación de referencia: `re design/_src/skolar-2/project/components/Screens2.js`
- CSS: `re design/_src/skolar-2/project/styles.css` líneas 1463-1532 + 2242-2302
- Trade-off: perdés DnD + multi-vista + popovers a cambio de ~600 líneas de control total

**3) `/notes` body (3-pane)** — ✅ HECHO (commit `62a4e43`, 2026-05-06).
Layout desktop:
- Pane 1 (220px): kicker "CARPETAS" + lista de subjects con dot color + count mono
- Pane 2 (280px): kicker "{count} apuntes" + sort toggle + lista de notas con preview
- Pane 3: editor (flex-1, intacto — `NoteEditor` no se tocó)

Mobile: las carpetas se colapsan en un bloque al tope del pane de lista, manteniendo el flujo single-pane y la full-screen del editor cuando hay nota activa. `subjectFilterButtons` extraído como JSX reutilizable.

**Pendiente del editor (bajo riesgo, alta visibilidad si se hace):** la `.notes-toolbar` interior del `NoteEditor` (líneas 32-411 del page.tsx) sigue con su look viejo. Para migrar: agrupar text-style / formatting / lists / blocks / attachments con dividers verticales, ver canvas `Screens3.js` sección NoteEditor.

### Media prioridad

**4) `/ai` — AIChatHub interior** — `features/ai/components/AIChatHub.tsx`.
El hero del page ya está. Falta el thread:
- Sidebar con FIJADOS + RECIENTES + uso este mes
- Thread: cada `.ai-msg` con avatar 28x28 (tertiary 18% bg para AI, primary container para user) + bubble con header "name + time mono" + texto 13px line-height 1.55
- Suggestions row: `.ai-chip` border radius-full
- Composer sticky bottom: input flex-1 + attach + graphic_eq + primary button

**5) Pages internas del profesor** — `app/(teacher)/teacher/courses/[id]/{grades,announcements,documents,schedules,students}/page.tsx`.
Aplicar `screen-head` con kicker + serif italic title. El cuerpo de cada una usar `.card`, `.row`, `.btn-*`.

**6) Componentes auxiliares**:
- `features/home/components/{TaskFeed,ExamFeed,UrgentTasksSection}.tsx` — los feeds del dashboard. Visualmente OK pero podrían mejorar con `.row` pattern con tag por subject.
- `features/subjects/components/{SubjectModal,IconPicker,SubjectChat,ScheduleManager}.tsx`
- `features/ai/components/{ScheduleImportWizard,EvaluationImportWizard}.tsx`

### Baja prioridad

**7) Settings/Personalization secciones** — los headers están migrados, pero las secciones internas tienen patrón viejo. Reescribir cada section como `.card` con `.section-head` + `.row` items para los toggles/selectores.

**8) Body de Teacher Dashboard + Courses** — los headers cambiaron pero los stats cards y la grid de cursos del profesor mantienen el look viejo.

---

## 7 · Cómo hacer un cambio nuevo (workflow estándar)

```bash
cd "/Users/sebastiansequeira/Library/Mobile Documents/com~apple~CloudDocs/Scholar/skolar"

# 1. Hacer el cambio
# 2. Typecheck
npx tsc --noEmit

# 3. Build (es importante por los lint errors de Next.js)
rm -rf .next  # CRÍTICO si el dir está en iCloud, evita ENOENT
npm run build

# 4. Commit + push (Vercel auto-deploys main)
git add <files>
git commit -m "feat(<scope>): <título>

<body explicando WHY>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main

# 5. Confirmar deploy
vercel ls skolar   # debería ver Ready en ~50s
```

### Reglas duras (CLAUDE.md)

- **NEVER** uses `any` en TypeScript
- **ALWAYS** agregá strings a `i18n/es.json` Y `i18n/en.json`
- **ALWAYS** usar `createClient()` de `@/lib/supabase/client` (browser) o `/server` (server components)
- **NEVER** hardcodear hex colors — usar CSS vars (`var(--color-primary)` etc.)
- **NEVER** asumas user_id en queries de subjects/exams — RLS ya scopea + las tablas tienen casos de student-vs-teacher (ver "Reglas de RLS" arriba)
- **AI provider**: hay env flag `AI_PROVIDER` que selecciona `groq` (default) o `claude` — no cambies model constants sin chequear

### Pitfalls específicos de este proyecto
- iCloud drive: `npm run build` puede fallar con `ENOENT` rename si hay un build viejo. `rm -rf .next` antes ayuda
- `next-themes`: usa `attribute="class"` así que `.dark` y `.light` están en `<html>`, NO `data-theme`. El `data-theme` separado se usa para variantes de color (indigo/purple), aplicado en `(app)/layout.tsx` y `(auth)/login/page.tsx`.
- `tsc --noEmit` puede pasar pero `next build` falla por ESLint `no-unused-vars`. Los lint errors son CRÍTICOS, fixear.
- Sidebar offset: la rule `.sidebar-offset { padding-left: 60px }` en `globals.css` ya no usa el toggle expanded/collapsed.

---

## 8 · Files críticos (referencia rápida)

| Archivo | Qué tiene |
|---|---|
| `app/globals.css` | TODO el design system (tokens + components + animations) |
| `tailwind.config.ts` | Font families, color tokens, radii, keyframes |
| `lib/grades.ts` | Lógica de calificación (PASS=9.5, summarize, classify, projectIfAvg) |
| `components/layout/Sidebar.tsx` | Sidebar narrow + mobile shell completo |
| `components/layout/Topbar.tsx` | Topbar con CRUMBS map ruta → kicker/title |
| `app/(app)/layout.tsx` | App shell wireado |
| `features/subjects/components/SubjectDetail.tsx` | Calculadora editable persistente — modelo de referencia |
| `app/(auth)/login/page.tsx` | Hero pattern de referencia |
| `app/(app)/dashboard/page.tsx` | KPI ribbon + urgent banner pattern |
| `app/(app)/subjects/page.tsx` | Subject card pattern con status badge |

---

## 9 · Canvas original (fuente visual)

`/Users/sebastiansequeira/Library/Mobile Documents/com~apple~CloudDocs/Scholar/re design/_src/skolar-2/project/`

- `styles.css` (2719 líneas) — el CSS más completo del rediseño
- `mobile/styles.css` (714 líneas) — mobile tokens + componentes m-*
- `components/Dashboard.js` — referencia visual del dashboard
- `components/Screens1.js` — Subjects + SubjectDetail editable
- `components/Screens2.js` — Calendar (semana + día)
- `components/Screens3.js` — Tasks (kanban) + Notes (3-pane) + AI (thread)
- `components/Screens4.js` — Exams (timeline) + ExamDetail + GradeTable
- `components/Screens5.js` — Login + Settings
- `mobile/Screens1-3.jsx` — versiones mobile

**Cuando el header de una pantalla pide "serif italic + kicker"**, abrí el screen correspondiente del canvas para ver cómo se compone visualmente. Es lo que el usuario aprobó.
