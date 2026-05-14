# Student Portal — Spec

> Last refresh: 2026-05-13 · Fuente de verdad del comportamiento del producto: [/skolar/SPEC.md](../../SPEC.md). Este doc detalla rutas, queries y archivos clave.

## Modelo de cuenta

- `profiles.role = 'student'` (definido al registro vía role picker en `/register`).
- Middleware (`lib/supabase/middleware.ts`) redirige cualquier acceso a `/teacher/*` hacia `/dashboard`.
- Cuentas separadas: un mismo humano que también es profesor necesita una segunda cuenta con `role = 'teacher'`.

## Materias: dos tipos

| Tipo | Cómo se crea | Identificación | Edita datos académicos |
|---|---|---|---|
| Propia del alumno | `/subjects` → botón crear (modal) | `subjects.user_id = auth.uid()` + `teacher_id IS NULL` | Sí (alumno) |
| Del profesor (enrolled) | `/subjects` → "Unirse con código" → `/api/subjects/join` | `enrollments` row + `subjects.teacher_id IS NOT NULL` | No (sólo el profesor) |

El alumno enrolled SÍ puede crear sus propias notas (`notes.subject_id = <subjectId>`) y tasks (`tasks.subject_id = <subjectId>`) atadas a la materia del profesor, pero no puede tocar evaluaciones, horarios ni calificaciones de esa materia.

## Rutas vivas

| Ruta | Función | Tablas / fuente |
|---|---|---|
| `/dashboard` | Home v2.2: greeting, 4 stat cards, urgent banner (eval próxima con countdown — = "vista de alerta" del SPEC §2.5), 3 cards (Agenda/Tareas/Evaluaciones), anuncios strip | profiles, schedules, tasks, exams, exam_grades, announcements |
| `/subjects` | Lista propias + enrolled; click abre `SubjectDetail` con tabs **Calculadora** / Chat / Documentos | subjects, enrollments, exams, exam_grades, schedules |
| `/calendar` | FullCalendar; `?view=day\|week\|month` | subjects, schedules, exams, tasks |
| `/tareas` | Task Manager **Kanban** con drag & drop (@dnd-kit) | tasks, subjects |
| `/evaluaciones` | Panel global de evaluaciones (lista) | exams, exam_grades, subjects |
| `/anuncios` | Anuncios del profesor para alumnos enrolled | announcements, announcement_reads, enrollments |
| `/entregas` | Submissions a evaluaciones del profesor | submissions, exams |
| `/mensajes` | Chat 1↔1 con profesores | messages |
| `/notes` | Notas Tiptap por materia | notes, subjects |
| `/ai` | Chat IA con tool calling (max 5 rondas) | ai_sessions, ai_session_messages, subject_ai_contexts |
| `/ai-settings`, `/settings`, `/personalization` | Configuración | profiles |

## Promedios y calculadora

Toda la lógica está en `lib/grades.ts`:
- `currentAverage` — promedio actual ponderado por `percentage`.
- `projectedFinal` — proyección asumiendo el resto pasa con el peso esperado.
- `neededToPass` — qué falta para llegar a 9.5/20.
- Escala 0–20, aprueba con ≥ 9.5.

La UI vive en `features/subjects/components/SubjectDetail.tsx` tab **"Calculadora"** (id `progress`, líneas 297, 387–438). El plan de evaluación es editable inline.

## Sincronización con el profesor

- Profesor publica calificación → `exam_grades` row → realtime channel emite → UI del alumno actualiza promedio sin reload.
- Profesor publica anuncio → `announcements` row → strip del `/dashboard` + `/anuncios` lo reflejan.
- Profesor crea exam/schedule en su curso → al estar el alumno enrolled, las queries de `/subjects`, `/calendar` y `/evaluaciones` lo traen.

## Chat IA

`features/ai/tools.ts` declara las tools: crear task, consultar pendientes, consultar notas, próximas evaluaciones, etc. El handler (`app/api/ai/route.ts`) carga contexto desde `subject_ai_contexts.summary` cuando hay materia activa. Provider switch vía env `AI_PROVIDER` (groq default, claude path listo).

## Pitfalls específicos del portal
- Para queries de `subjects` y `exams` NO usar `.eq('user_id', user.id)` — excluye contenido del profesor. RLS y `enrollments` ya scopen correctamente.
- Para mostrar calificaciones de evaluaciones del profesor, hacer overlay de `exam_grades` (cuando `exams.assigned_by IS NOT NULL`) — la `exams.grade` queda NULL.

## Pendientes

- UI **"Subir documento" para alumno enrolled** en `SubjectDetail.tsx` tab Documentos. RLS storage + `documents` ya permiten escritura desde 2026-05-14 (migración `2026_05_14_docs_bidirectional.sql`).
