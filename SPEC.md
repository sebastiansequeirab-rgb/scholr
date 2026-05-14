# SKOLAR — Especificación del Sistema

> Last refresh: 2026-05-13 · Fuente de verdad del producto.
> Este documento manda. CLAUDE.md cubre stack y workflow técnico; portals/*.md amplían detalle por portal.

## 1. Visión general

Skolar es una app de gestión académica con **2 portales independientes**: **Alumno** y **Profesor**. Son **cuentas separadas** (una persona que cumpla ambos roles necesita dos cuentas distintas).

**Meta del sistema:** funcionalidad impecable en cada feature y una relación alumno↔profesor perfectamente sincronizada. Cada dato, cada valor y cada botón debe funcionar perfecto.

---

## 2. Portal Alumno

### 2.1 Materias

El alumno trabaja con dos tipos de materias:

#### A. Materias del profesor (inscripción por **código**)
- El alumno se une introduciendo un código que da el profesor.
- **El profesor controla:** evaluaciones, horarios y calificaciones.
- **El alumno puede agregar dentro de esa materia:** sus propias **notas** (note-taking) y sus propias **tasks** asociadas.
- Las **calificaciones** que el profesor publica se reflejan automáticamente en la evaluación correspondiente y alimentan los promedios y proyecciones del alumno.

#### B. Materias propias (creadas por el alumno)
- **Privadas**, solo para seguimiento personal del alumno. No se comparten.
- El alumno tiene control total: agrega evaluaciones, horarios, notas y calificaciones él mismo.

### 2.2 Información por materia
Cada materia muestra:
- Evaluaciones
- Horarios
- Calificaciones de evaluaciones
- **Promedio actual**
- **Proyección de promedio**
- **Calculadora de promedios** (sección "Calculadora" dentro de la materia)

### 2.3 Calendario
- Vistas: **mes, semana, día**.
- Muestra: horarios de clase + tasks + evaluaciones.

### 2.4 Task Manager
- Crear tasks con notas internas.
- **Vista Kanban** con drag & drop para cambiar de estado.

### 2.5 Panel de Evaluaciones
- Seguimiento global de todas las evaluaciones (de todas las materias).
- **Vista de alerta** (banner urgente en el dashboard) que muestra la evaluación más próxima con countdown.

### 2.6 Note Taking
- Notas **divididas por asignatura**.

### 2.7 Chat IA
- Tiene acceso completo al contexto del alumno: **notas, evaluaciones, calificaciones, tasks, calendario**.
- Permite: crear tasks, consultar pendientes, consultar notas, etc.

---

## 3. Portal Profesor

### 3.1 Funciones disponibles
- **Anuncios**: por materia. Solo los alumnos inscritos en esa materia los ven.
- **Mensajes**: comunicación **1 a 1** con cada alumno.
- **Calificaciones**: el profesor las publica y se reflejan automáticamente en la evaluación del alumno.
- **Documentos**: tanto el profesor como el alumno pueden **subir y descargar**.

### 3.2 Lo que NO tiene el portal profesor
- Chat IA
- Calendario
- Note Taking

---

## 4. Sincronización Alumno ↔ Profesor

### 4.1 Flujo
1. El alumno se inscribe a una materia introduciendo el **código** del profesor.
2. El profesor crea evaluaciones y horarios → aparecen en el portal del alumno.
3. El profesor publica una calificación → se refleja en la evaluación correspondiente del alumno y actualiza promedio y proyección.
4. El profesor publica un anuncio en su materia → visible para los alumnos inscritos.
5. Los mensajes fluyen 1 a 1 entre profesor y alumno.
6. Los documentos son bidireccionales: ambos pueden subir y descargar.

### 4.2 Notificaciones
- **No hay sistema de notificaciones por ahora.**
- La actualización es directa en la UI (Supabase realtime): cuando el profesor publica una nota, queda reflejada en la evaluación del alumno sin reload.

---

## 5. Reglas clave del sistema

1. **Aislamiento de roles**: alumno y profesor son cuentas separadas con UIs distintas. Nunca mezclar funciones entre portales.
2. **Materias del profesor = lectura para datos académicos**: el alumno no puede modificar evaluaciones, horarios ni calificaciones de materias del profesor. Solo puede sumar sus propias notas y tasks personales.
3. **Materias propias del alumno = privadas**: no se comparten, no se envían a profesores.
4. **Cálculos reactivos**: cualquier cambio en una calificación debe recalcular automáticamente promedio actual y proyección.
5. **El calendario centraliza**: horarios de clase + tasks + evaluaciones aparecen todos en el calendario del alumno.
6. **El Chat IA ve todo lo del alumno**: notas, evaluaciones, calificaciones, tasks, calendario. Es el asistente integral del alumno.
7. **Cada dato, cada valor y cada botón debe funcionar perfecto.**

---

## 6. Mapeo técnico (verdad operativa al 2026-05-13)

### 6.1 Rutas vivas

**Portal Alumno** (`app/(app)/`):
- `/dashboard` — home con greeting, 4 stat cards, urgent banner (eval más próxima con countdown), 3 cards (Agenda/Tareas/Evaluaciones), anuncios strip
- `/subjects` — lista de materias propias + enrolled, click abre `SubjectDetail` con tabs **Calculadora** / Chat / Documentos
- `/calendar` — FullCalendar, acepta `?view=day|week|month`
- `/tareas` — Task Manager Kanban con drag & drop (@dnd-kit)
- `/evaluaciones` — Panel global de evaluaciones (lista pasiva)
- `/anuncios` — vista de anuncios del profesor para el alumno
- `/entregas` — submissions (entregas de evaluaciones del profesor)
- `/mensajes` — chat 1↔1 con profesores
- `/notes` — Note Taking por asignatura (Tiptap v3)
- `/ai` — Chat IA con tool calling
- `/ai-settings`, `/settings`, `/personalization` — config

**Portal Profesor** (`app/(teacher)/teacher/`):
- `/teacher` — home con KPIs + My Courses + upcoming + recent announcements (NO `/teacher/dashboard` — esa redirige acá)
- `/teacher/courses` (+ `[id]/grades`, `[id]/announcements`, `[id]/schedules`, `[id]/students`, `[id]/documents`)
- `/teacher/grades` — vista global de calificaciones
- `/teacher/announcements` — anuncios globales
- `/teacher/documents` — documentos globales
- `/teacher/students` — alumnos
- `/teacher/mensajes` — chat 1↔1 con alumnos

**Auth** (`app/(auth)/`): `/login`, `/register` (con role picker alumno/profesor), `/forgot-password`

**API** (`app/api/`):
- `/api/ai` — handler Groq con tool calling (max 5 rondas)
- `/api/ai/summarize-context` — auto-refresh de `subject_ai_contexts`
- `/api/subjects/join` — enrollment vía código
- `/api/teacher/courses/[id]/schedules` + `/sync-schedules`
- `/api/auth/callback`
- `/api/parse-evaluations`, `/api/parse-pdf`, `/api/parse-schedule`

### 6.2 Tablas Supabase (proyecto `xawgomhknzdnhkxcegqi`)

| Tabla | Notas |
|---|---|
| `profiles` | `role` ∈ {student, teacher} distingue cuenta |
| `subjects` | `user_id` (dueño/creador). `teacher_id` NULL = materia propia del alumno; NOT NULL = materia del profesor. Tiene `access_code`, `evaluation_plan`, `semester`, `accent`. |
| `enrollments` | `student_id` + `subject_id`. Alumno inscrito a una materia del profesor (status active/dropped). |
| `schedules` | `subject_id`, `day_of_week`, `start_time`, `end_time`, `room` |
| `exams` | `subject_id`, `title`, `exam_date`, `percentage`, `grade`, `assigned_by` (cuando es del profesor → notas viven en `exam_grades`) |
| `exam_grades` | `exam_id` + `student_id` + `grade` — calificaciones del profesor (realtime ON) |
| `submissions` | entregas del alumno a evaluaciones del profesor (status pending_review/graded/returned/draft) |
| `tasks` | `user_id`, `subject_id` (puede ser propio o enrolled), `status`, `position`, kanban |
| `notes` | `user_id`, `subject_id` — Tiptap content |
| `ai_sessions` + `ai_session_messages` | historial del chat IA |
| `subject_ai_contexts` | summary acumulado por materia |
| `announcements` + `announcement_reads` | anuncios del profesor (realtime ON) |
| `documents` | metadata. Storage en bucket `course-documents` |
| `messages` | `teacher_id`, `student_id`, `course_id`, `sender_id` (Fix 5 ya cerrado) |

Storage bucket: `course-documents` — RLS desde 2026_05_14: profesor write/delete su course, alumno enrolled write/delete propios + read de todos.

### 6.3 Archivos clave por feature

| Feature | Archivo |
|---|---|
| Cálculo promedios | `lib/grades.ts` (currentAverage, projectedFinal, neededToPass) |
| Tab Calculadora | `features/subjects/components/SubjectDetail.tsx` (tab "progress") |
| Banner urgente | `features/home/UrgentCountdown.tsx` |
| Kanban tasks | `app/(app)/tareas/page.tsx` |
| AI tools | `features/ai/tools.ts` (`TOOL_DECLARATIONS`, `executeTool`) |
| Provider AI | `features/ai/provider.ts` (env `AI_PROVIDER`: groq default, claude path ready) |
| Middleware roles | `lib/supabase/middleware.ts` |
| Shell profesor | `features/teacher/layout/TeacherShell.tsx` + `TeacherSidebar.tsx` |

### 6.4 Env vars críticas

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (NO `SERVICE_ROLE_KEY`), `GROQ_API_KEY`, `AI_PROVIDER` (groq|claude).

### 6.5 Pendientes conocidos
- Activación manual: Supabase Dashboard → Auth → Password Strength.
- Documentos bidireccionales — migración `2026_05_14_docs_bidirectional.sql` aplicada; UI de "Subir doc" para alumno enrolled en `SubjectDetail.tsx` tab Documents — **pendiente de implementación**.
