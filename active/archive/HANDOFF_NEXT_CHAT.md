# Handoff — Correcciones + Deploy a Vercel (Skolar Teacher Portal)

> Pasarle este archivo entero al nuevo chat. Tiene el contexto completo para que arranque sin ramp-up.

## Contexto del proyecto

- **App:** Skolar — plataforma académica con dos portales conectados (estudiante + profesor)
- **Repo local:** `/Users/sebastiansequeira/Documents/Scholar/skolar`
- **Stack:** Next.js 14 App Router · TypeScript strict · Supabase (Postgres + Auth + Storage) · Tailwind · sonner · zod · react-markdown
- **Supabase project:** `xawgomhknzdnhkxcegqi` — usar via MCP `mcp__claude_ai_Supabase__*`
- **Sistema visual:** Swiss editorial — Inter + Instrument Serif italic + JetBrains Mono · warm slate dark / warm bone light · OKLCH accents (.acc-rose/blue/amber/green/violet/teal) · royal blue primary
- **Tokens y componentes:** definidos en `app/globals.css` (líneas finales `═ TEACHER REDESIGN ═`)

### Referencias clave
- Plan original: `/Users/sebastiansequeira/.claude/plans/cozy-rolling-kitten.md`
- Handoff de diseño: `/Users/sebastiansequeira/Documents/Scholar/re design/CLAUDE_CODE_HANDOFF_Profesores.md`
- Guía de testing: `skolar/docs/TEACHER_TESTING.md`
- Seed ya corrió. Credenciales:
  - Profesor: `prof@skolar.test` / `Test1234!`
  - Alumnos: `alumno1..6@skolar.test` / `Test1234!`

### Estado actual
- Migraciones aplicadas: `teacher_redesign_2026_05_11`, `teacher_internal_messages_2026_05_11`
- 7 rutas teacher + `/entregas` + `/mensajes` (estudiante) construidas y funcionando
- Build verde, TypeScript clean
- Seed completo en DB

### Env (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://xawgomhknzdnhkxcegqi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
SUPABASE_SECRET_KEY=sb_secret_…
```

El proyecto usa el formato nuevo de keys de Supabase (`sb_publishable_…` / `sb_secret_…`). El código de `lib/supabase/admin.ts` y `scripts/seed-teacher.ts` aceptan ya sea `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_SECRET_KEY`.

---

## Las 5 correcciones a aplicar

### Fix 1 — Storage RLS rota: subir documento falla con "new row violates row-level security policy"

**Causa raíz:** en la migración `teacher_redesign_2026_05_11` las policies de teacher para `storage.objects` referencian `storage.foldername(name)` pero adentro del subquery aliasado como `s`, el `name` bare se interpreta como `s.name` (nombre de la materia, ej. "Cálculo I"), no como `objects.name` (path del archivo). Por eso el EXISTS nunca matchea y todo INSERT/SELECT/DELETE del teacher falla.

La policy del estudiante sí usa `(storage.foldername(objects.name))[1]` correctamente.

**Fix:** aplicar esta migración via `mcp__claude_ai_Supabase__apply_migration` con `name='fix_storage_teacher_policies_2026_05_12'`:

```sql
drop policy if exists "course_docs_teacher_write"  on storage.objects;
drop policy if exists "course_docs_teacher_read"   on storage.objects;
drop policy if exists "course_docs_teacher_delete" on storage.objects;

create policy "course_docs_teacher_write"
  on storage.objects for insert
  with check (
    bucket_id = 'course-documents'
    and exists (
      select 1 from public.subjects s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
        and s.teacher_id = auth.uid()
    )
  );

create policy "course_docs_teacher_read"
  on storage.objects for select
  using (
    bucket_id = 'course-documents'
    and exists (
      select 1 from public.subjects s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
        and s.teacher_id = auth.uid()
    )
  );

create policy "course_docs_teacher_delete"
  on storage.objects for delete
  using (
    bucket_id = 'course-documents'
    and exists (
      select 1 from public.subjects s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
        and s.teacher_id = auth.uid()
    )
  );
```

**Verificar:** loguearse como `prof@skolar.test` → `/teacher/documents?course=<id-de-Cálculo I>` → seleccionar curso "Cálculo I" → arrastrar un PDF → debe subir sin error y aparecer en la lista. Click "Descargar" debe abrir el archivo via signed URL.

---

### Fix 2 — Sidebar flicker en refresh con sidebar colapsado

**Causa raíz:** `features/teacher/layout/TeacherShell.tsx` lee `localStorage` en un `useEffect`. En SSR el HTML inicial siempre se renderiza con `collapsed=false`. Después de la hidratación el effect corre y setea a `true` si estaba guardado. Eso causa el "snap" visible.

**Fix:** persistir también en cookie (no solo localStorage) y leerla en el server layout.

#### 2a. `features/teacher/layout/TeacherShell.tsx`

- Aceptar prop `initialCollapsed?: boolean` (default false).
- Inicializar el state con `initialCollapsed` directamente, sin esperar al useEffect.
- En el `setCollapsed`, escribir además una cookie:
  ```ts
  document.cookie = `teacher_sidebar_collapsed=${v ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`
  ```
- El useEffect que lee localStorage como fallback se puede mantener pero ya no es la fuente primaria.

#### 2b. `app/(teacher)/layout.tsx`

- Importar `cookies` de `next/headers`
- Leer la cookie y pasarla a TeacherShell:
  ```ts
  import { cookies } from 'next/headers'
  ...
  const collapsed = cookies().get('teacher_sidebar_collapsed')?.value === '1'
  ...
  <TeacherShell profile={profile as Profile | null} initialCollapsed={collapsed}>
  ```

**Verificar:** colapsar sidebar → refresh página → debe arrancar ya colapsado sin animación de "expandir-y-volver-a-cerrar".

---

### Fix 3 — Logo extendido + reordenar nav del teacher sidebar

El usuario adjuntó dos imágenes: la primera muestra el sidebar actual (logo chico en card con mucho padding, orden Panel/Cursos/Calificaciones/etc. sin grupo), la segunda muestra el target:
- **Logo más grande** mostrando "Skolar" wordmark + "ASISTENTE ACADÉMICO" tagline. Card del logo ocupa más altura.
- **Orden de nav:** `Panel`, `Cursos` arriba (sin "GENERAL" antes). Después separador "GENERAL". Después `Calificaciones`, `Anuncios`, `Documentos`, `Estudiantes`, `Mensajes` (nuevo — ver Fix 5).

#### 3a. `config/nav.ts`

Agregar campo `group` a `TEACHER_NAV_ITEMS`:
```ts
export const TEACHER_NAV_ITEMS = [
  { key: 'teacher.nav.panel',         href: '/teacher',                icon: 'dashboard',   group: 'top' as const },
  { key: 'teacher.nav.courses',       href: '/teacher/courses',        icon: 'menu_book',   group: 'top' as const },
  { key: 'teacher.nav.grades',        href: '/teacher/grades',         icon: 'grade',       group: 'general' as const },
  { key: 'teacher.nav.announcements', href: '/teacher/announcements',  icon: 'campaign',    group: 'general' as const },
  { key: 'teacher.nav.documents',     href: '/teacher/documents',      icon: 'description', group: 'general' as const },
  { key: 'teacher.nav.students',      href: '/teacher/students',       icon: 'group',       group: 'general' as const },
  { key: 'teacher.nav.messages',      href: '/teacher/mensajes',       icon: 'forum',       group: 'general' as const },
]
```

#### 3b. `features/teacher/layout/TeacherSidebar.tsx`

- En el render del nav, separar items por `group`:
  ```tsx
  const topItems = TEACHER_NAV_ITEMS.filter(i => i.group === 'top')
  const generalItems = TEACHER_NAV_ITEMS.filter(i => i.group === 'general')
  ```
- Render:
  ```tsx
  <nav className="t-sidebar__nav">
    {topItems.map(renderItem)}
    {!collapsed && <div className="t-sidebar__group-label">{t('teacher.nav.general')}</div>}
    {collapsed && <hr className="t-sidebar__group-hr" />}
    {generalItems.map(renderItem)}
  </nav>
  ```
- **Quitar** el bloque actual `<div className="t-sidebar__group-label">{t('teacher.nav.general')}</div>` + `<hr/>` que están entre el role pill y el `<nav>`.

#### 3c. Logo más grande

En `features/teacher/layout/TeacherSidebar.tsx`, cambiar el render del logo cuando NO está colapsado:

```tsx
{collapsed ? (
  <Image src={markLogo} alt="Skolar" width={28} height={28} priority />
) : (
  <div className="t-sidebar__logo-stack">
    <Image src={fullLogo} alt="Skolar" width={150} height={36} priority style={{ width: 'auto', height: 36, objectFit: 'contain' }} />
    <span className="t-sidebar__logo-tagline">ASISTENTE ACADÉMICO</span>
  </div>
)}
```

#### 3d. CSS en `app/globals.css`

Actualizar `.t-sidebar__logo`:
```css
.t-sidebar__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 18px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 32%, transparent);
  border-radius: 14px;
  min-height: 72px;
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
  text-decoration: none;
}
.t-sidebar__logo img { display: block; max-height: 36px; width: auto; object-fit: contain; }
.is-collapsed .t-sidebar__logo { padding: 14px 8px; min-height: 56px; }
.is-collapsed .t-sidebar__logo img { max-height: 28px; }

.t-sidebar__logo-stack {
  display: flex; flex-direction: column;
  align-items: center; gap: 4px;
}
.t-sidebar__logo-tagline {
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--color-primary) 70%, var(--on-surface-variant));
}
```

**Verificar:** sidebar expandido debe mostrar el logo Skolar wordmark grande + "ASISTENTE ACADÉMICO" debajo. Sidebar colapsado solo el ícono pequeño centrado.

---

### Fix 4 — Sidebar del estudiante también debe ser extendible (mismo diseño que el teacher)

Hoy `components/layout/Sidebar.tsx` es de ancho fijo angosto para desktop. El usuario quiere mismo diseño que teacher (colapsable 240/72) **pero con pill "ESTUDIANTE"** en vez de "PROFESOR", y nav del estudiante.

#### Approach recomendado: extraer el shell a un componente compartido

1. Renombrar `.t-sidebar*` → `.app-sidebar*` en `app/globals.css` (búsqueda+reemplazo global). Mantener compatibilidad o hacer alias temporales.
   - Más fácil: dejar `.t-sidebar*` como está y crear classes paralelas `.app-sidebar*` con los mismos estilos, O usar las `.t-sidebar*` directo en el sidebar del estudiante (no hay nada teacher-específico en las clases en sí).

2. **Más simple aún:** reusar las clases `.t-sidebar*` en el sidebar del estudiante. Solo cambiar el role pill text ("ESTUDIANTE" en vez de "PROFESOR") y la lista de items.

3. Crear `components/layout/AppSidebarShell.tsx` (paralelo a `TeacherShell`) con:
   - State `collapsed` que viene de prop `initialCollapsed`
   - Cookie `student_sidebar_collapsed`
   - Provides context via `useAppSidebar()`

4. `components/layout/Sidebar.tsx` (estudiante) — refactor:
   - Usar la misma estructura HTML que `TeacherSidebar` (logo, role pill, nav grouped, collapse button, profile card, mobile drawer)
   - Item set: `NAV_ITEMS` ya existente. Para "GENERAL" grouping, opcional: `Dashboard, Calendar, Subjects, Tareas` arriba; resto bajo "GENERAL".
   - Role pill: ícono `school`, texto "ESTUDIANTE", color primary
   - Logo: usar `logo-dark.png` / `logo-light.png` con el mismo `.t-sidebar__logo-stack` (con tagline "ASISTENTE ACADÉMICO")

5. `app/(app)/layout.tsx`:
   - Importar `cookies()` y leer `student_sidebar_collapsed`
   - Wrap children con `<AppSidebarShell initialCollapsed={...}>`
   - El layout actual usa `SidebarCollapseProvider`. Reemplazar por el shell nuevo.

**Sugerencia para minimizar churn:**
- Crear un componente unificado `<Sidebar variant="student" | "teacher" />` que tome el set de nav del prop. Hacer que `TeacherSidebar` y student `Sidebar` sean wrappers thin de éste.

**Verificar:** student logueado → sidebar 240px de ancho con logo "Skolar" + tagline + pill "ESTUDIANTE" + nav grouping. Click "Colapsar" → 72px. Reload → mantiene estado sin flicker.

---

### Fix 5 — Chat bidireccional teacher ↔ student con contexto de curso

El portal del profesor también debe tener pestaña "Mensajes" donde puede ver y responder mensajes de estudiantes, agrupados por curso.

#### 5a. Migración: ampliar tabla `messages` para soporte bidireccional

Aplicar via `mcp__claude_ai_Supabase__apply_migration` con `name='messages_bidirectional_2026_05_12'`:

```sql
-- Add sender_id (quién envió REALMENTE este mensaje individual)
alter table public.messages add column if not exists sender_id uuid references public.profiles(id);

-- Backfill: hasta ahora todos los mensajes eran teacher → student
update public.messages set sender_id = teacher_id where sender_id is null;
alter table public.messages alter column sender_id set not null;

-- Subject pasa a ser opcional (chat-style messages no lo necesitan)
alter table public.messages alter column subject drop not null;

-- Index para queries de threads
create index if not exists messages_thread_idx on public.messages(teacher_id, student_id, course_id, created_at desc);

-- Reemplazar policies de INSERT
drop policy if exists "messages_student_write"      on public.messages;
drop policy if exists "messages_teacher_write"      on public.messages;
drop policy if exists "messages_student_update"     on public.messages;
drop policy if exists "messages_teacher_delete"     on public.messages;

create policy "messages_teacher_write"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and auth.uid() = teacher_id
    and (
      course_id is null
      or exists (
        select 1 from public.subjects s
        where s.id = course_id and s.teacher_id = auth.uid()
      )
    )
  );

create policy "messages_student_write"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and auth.uid() = student_id
    and course_id is not null
    and exists (
      select 1 from public.enrollments e
      where e.subject_id = course_id and e.student_id = auth.uid() and e.status = 'active'
    )
  );

-- Recipient (el que NO mandó) puede marcar como leído
create policy "messages_recipient_mark_read"
  on public.messages for update
  using (
    (auth.uid() = student_id and sender_id <> auth.uid())
    or (auth.uid() = teacher_id and sender_id <> auth.uid())
  )
  with check (true);

-- Teacher puede borrar sus propios mensajes (sender)
create policy "messages_sender_delete"
  on public.messages for delete
  using (auth.uid() = sender_id);
```

#### 5b. Refactor de tipos

`types/index.ts`: actualizar `Message` (o crear `ChatMessage`):
```ts
export type ChatMessage = {
  id: string
  teacher_id: string
  student_id: string
  course_id: string | null
  sender_id: string
  subject: string | null
  body: string
  created_at: string
  read_at: string | null
}
```

#### 5c. Server actions

**`app/(teacher)/teacher/mensajes/actions.ts` (nuevo):**

```ts
'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function requireTeacher() { /* ... mismo patrón que las otras actions ... */ }

const ReplySchema = z.object({
  studentId: z.string().uuid(),
  courseId:  z.string().uuid(),
  body:      z.string().trim().min(1).max(20_000),
})

export async function sendChatMessageAction(input: { studentId: string; courseId: string; body: string }) {
  const parsed = ReplySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }
  const { supabase, user } = await requireTeacher()
  const { error } = await supabase.from('messages').insert({
    teacher_id: user.id,
    student_id: parsed.data.studentId,
    course_id:  parsed.data.courseId,
    sender_id:  user.id,
    subject:    null,
    body:       parsed.data.body,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/teacher/mensajes')
  return { ok: true }
}

export async function markThreadReadAction(input: { studentId: string; courseId: string }) {
  const { supabase, user } = await requireTeacher()
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('teacher_id', user.id)
    .eq('student_id', input.studentId)
    .eq('course_id', input.courseId)
    .neq('sender_id', user.id)
    .is('read_at', null)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/teacher/mensajes')
  return { ok: true }
}
```

**`app/(app)/mensajes/actions.ts` (extender):**

Agregar `sendStudentReplyAction`:
```ts
export async function sendStudentReplyAction(input: { teacherId: string; courseId: string; body: string }) {
  const { supabase, user } = await requireUser()
  // Validar enrollment via RLS (la policy ya chequea)
  const { error } = await supabase.from('messages').insert({
    teacher_id: input.teacherId,
    student_id: user.id,
    course_id:  input.courseId,
    sender_id:  user.id,
    subject:    null,
    body:       input.body.trim(),
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/mensajes')
  return { ok: true }
}
```

#### 5d. UI — Chat teacher

**`app/(teacher)/teacher/mensajes/page.tsx`:**

- Server component que fetchea todos los mensajes del teacher agrupados por `(student_id, course_id)`.
- Renderiza `<ChatThreads variant="teacher" threads={...} />`.

**`features/messages/ChatThreads.tsx` (nuevo, compartido):**

Layout 2-columnas (responsive):
- **Izquierda (lista de threads):** cada thread muestra avatar + nombre del peer + tag del curso (con `.acc-*` color) + preview del último mensaje + timestamp + badge de no-leídos.
- **Derecha (conversación activa):** seleccionada por URL `?with=<peerId>&course=<courseId>`. Muestra historia cronológica (bubbles alineados left/right según sender), input al fondo con botón "Enviar".

Detalles:
- Cada bubble propio: bg `var(--color-primary-container)`, color `var(--on-primary)`, alineado a la derecha.
- Bubble del otro: bg `var(--s-low)`, alineado a la izquierda. Mostrar avatar pequeño antes.
- Sticky header con peer + tag del curso.
- Realtime: `supabase.channel('messages')` subscribed a INSERT del `student_id=user.id` o donde aparezca el peer.

**`features/messages/MessageComposer.tsx`:** textarea + botón Enviar, con `useTransition`, optimistic update.

#### 5e. UI — Chat estudiante

**`app/(app)/mensajes/page.tsx`:** reemplazar el componente actual `MessageList` por `<ChatThreads variant="student" threads={...} />`.

El componente compartido decide variant via prop. Lógica de send action interna depende del variant.

#### 5f. i18n keys nuevas

Añadir a `i18n/es.json` y `i18n/en.json` en `teacher.nav` y `teacher.common`:
- `teacher.nav.messages` = `Mensajes` / `Messages`
- `teacher.messages.title` = `Mensajes`
- `teacher.messages.empty` = `Sin conversaciones aún`
- `teacher.messages.reply` = `Responder`
- `teacher.messages.send` = `Enviar`
- `teacher.messages.send_placeholder` = `Escribe un mensaje…`

**Verificar:**
1. Login teacher → `/teacher/mensajes` → ver lista de threads (vacía al inicio o pre-cargada del seed).
2. Click un thread → ver conversación + textarea de respuesta.
3. Mandar mensaje desde teacher → logout → login student → `/mensajes` → ver el mensaje en realtime.
4. Student responde → logout → login teacher → ver respuesta en realtime con badge de no-leído.
5. Marcar como leído al abrir el thread.

---

## Después de las 5 correcciones: chequeo previo al deploy

```bash
cd /Users/sebastiansequeira/Documents/Scholar/skolar
npx tsc --noEmit       # type check
npm run build          # production build
npm run dev            # smoke test local
```

Probar el full E2E del `TEACHER_TESTING.md` §3 (los 13 checks).

---

## Deploy a Vercel

### Pre-requisitos
- Cuenta Vercel
- CLI: `npm i -g vercel` o usar `npx vercel`
- Estar en `skolar/`

### Pasos

1. **Login y link**
   ```bash
   cd /Users/sebastiansequeira/Documents/Scholar/skolar
   npx vercel login
   npx vercel link        # crear o linkear proyecto
   ```

2. **Configurar env vars en Vercel** (production scope):
   ```bash
   npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
   # paste: https://xawgomhknzdnhkxcegqi.supabase.co

   npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
   # paste: sb_publishable_… (mismo valor que .env.local)

   npx vercel env add SUPABASE_SECRET_KEY production
   # paste: sb_secret_… (mismo valor)
   ```

   Si el código también requiere `NEXT_PUBLIC_SUPABASE_ANON_KEY`, verificar en `lib/supabase/client.ts` y agregarla con el mismo valor que el publishable.

   Repetir para `preview` y `development` scopes si se quiere usar Vercel para previews.

3. **Deploy preview primero**
   ```bash
   npx vercel
   ```
   Probar el URL preview que devuelve. Si todo bien:

4. **Deploy producción**
   ```bash
   npx vercel --prod
   ```

5. **Actualizar Supabase Auth redirect URLs**
   - Supabase Dashboard → Authentication → URL Configuration
   - **Site URL:** el URL de producción (ej. `https://skolar.vercel.app`)
   - **Redirect URLs:** agregar `https://skolar.vercel.app/**` y los URLs preview si se usan (`https://skolar-*.vercel.app/**`)

6. **Verificar producción**
   - Abrir el URL de prod
   - Login con `prof@skolar.test` / `Test1234!`
   - Correr los 13 checks de testing
   - Especialmente: subir doc (Fix 1), sidebar colapsado en refresh (Fix 2), chat bidireccional (Fix 5)

### Notas importantes

- **`vercel.json`:** el repo no tiene uno. Next.js 14 lo configura automáticamente. Si hace falta personalizar (rewrites, headers de cache, regions), crearlo. Por ahora no es necesario.
- **`output: 'standalone'`** en `next.config.js`: no necesario en Vercel (Vercel maneja todo).
- **Edge runtime:** las server actions usan node runtime por default. Si alguna falla en producción por timeout, considerar `export const runtime = 'edge'` selectivamente (pero la admin client requiere node).
- **Storage URLs:** los signed URLs apuntan al dominio Supabase (`*.supabase.co`), no a Vercel. No requiere config adicional.
- **Realtime websockets:** Vercel los soporta nativamente para clientes; el server queda en SSR/RSC. Sin config extra.

### Si hay error en el build de Vercel

Causas comunes:
- Env vars faltantes → revisar log y agregar en `vercel env add`
- TypeScript errors → ya validados localmente, no debería pasar
- Lint errors → `npm run build` los muestra; corregir y re-deploy
- Module not found → verificar que tsx/dotenv estén en `devDependencies` y no se importen en runtime

---

## Resumen de archivos a tocar

### Migraciones (via MCP)
- `fix_storage_teacher_policies_2026_05_12` — Fix 1
- `messages_bidirectional_2026_05_12` — Fix 5

### Edits
- `app/globals.css` — Fix 3 (logo) + Fix 4 (si se reusa `.t-sidebar*`)
- `features/teacher/layout/TeacherShell.tsx` — Fix 2
- `features/teacher/layout/TeacherSidebar.tsx` — Fix 3
- `app/(teacher)/layout.tsx` — Fix 2 (cookie read)
- `config/nav.ts` — Fix 3 (group field)
- `components/layout/Sidebar.tsx` — Fix 4 (refactor con extend)
- `app/(app)/layout.tsx` — Fix 4 (shell + cookie)
- `i18n/es.json` + `i18n/en.json` — Fix 5 (chat keys)
- `types/index.ts` — Fix 5 (ChatMessage type)
- `app/(app)/mensajes/page.tsx` — Fix 5 (usar ChatThreads)
- `app/(app)/mensajes/actions.ts` — Fix 5 (sendStudentReplyAction)

### Archivos nuevos
- `app/(teacher)/teacher/mensajes/page.tsx`
- `app/(teacher)/teacher/mensajes/actions.ts`
- `features/messages/ChatThreads.tsx`
- `features/messages/MessageComposer.tsx`
- `components/layout/AppSidebarShell.tsx` (opcional si se decide compartir)

### Posiblemente eliminar
- `features/messages/MessageList.tsx` (reemplazado por ChatThreads)

---

## Reglas de oro durante este trabajo

1. **No romper queries del estudiante.** Validar `/dashboard`, `/evaluaciones`, `/tareas`, `/entregas` después de cada migración o cambio grande.
2. **Migraciones aditivas.** No drop columnas. Sí drop policies y recrearlas.
3. **TypeScript strict.** Nunca `any`. Usar `unknown` + narrowing si hace falta.
4. **i18n sync.** Cada string nueva en `i18n/es.json` Y `i18n/en.json`.
5. **CSS vars, no hex.** Usar `var(--color-primary)`, `var(--accent-color)`, etc. Las pocas excepciones documentadas.
6. **Tests no automatizados** — todo se valida manualmente con los 13 checks de `TEACHER_TESTING.md`. Después de cada fix, correr los checks afectados.

---

## Cuenta corriente / Conocimiento útil

- El usuario tiene dos accounts teacher en la DB:
  - `prof@skolar.test` (id `690c3941-…`) → 4 cursos del seed
  - `carlosoma555@gmail.com` (id `3b6033b6-…`) → 1 curso viejo
  Si el usuario reporta que "no ve materias", chequear con qué email entró.
- Supabase no acepta legacy JWT keys en este proyecto. Solo formato `sb_publishable_…` / `sb_secret_…`.
- El `seed-teacher.ts` es idempotente y soporta cualquiera de los dos nombres de service key.
- El trigger `SCHEDULE_CONFLICT` en DB rechaza schedules solapados del mismo teacher. El seed ya usa slots distintos por curso.

Listo. Pasarle este archivo al nuevo chat.
