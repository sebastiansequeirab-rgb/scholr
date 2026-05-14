# Teacher Portal — Spec

> Last refresh: 2026-05-13 · Portal v2 deployado. Fuente de verdad del comportamiento: [/skolar/SPEC.md](../../SPEC.md). Este doc detalla rutas, queries y archivos clave.

## Modelo de cuenta

- `profiles.role = 'teacher'` (definido al registro vía role picker en `/register`).
- Middleware (`lib/supabase/middleware.ts`) redirige cualquier acceso a rutas del alumno (`/dashboard`, `/calendar`, etc.) hacia `/teacher`.
- El portal profesor **NO tiene** Chat IA, Calendario ni Note Taking — son features exclusivas del portal alumno (SPEC §3.2).

## Rutas implementadas (v2 — 2026-05-13)

| Ruta | Función |
|---|---|
| `/teacher` | **Home real** (NO `/teacher/dashboard`). KPIs, My Courses, próximas clases, anuncios recientes. |
| `/teacher/dashboard` | `permanentRedirect('/teacher')` — solo para URLs legacy. |
| `/teacher/courses` | Listado + crear curso (genera `access_code`). |
| `/teacher/courses/[id]` | Overview del curso. |
| `/teacher/courses/[id]/grades` | Tabla editable (filas = exams, columnas = alumnos enrolled). |
| `/teacher/courses/[id]/announcements` | Anuncios del curso. |
| `/teacher/courses/[id]/schedules` | Horarios del curso (con `sync-schedules`). |
| `/teacher/courses/[id]/students` | Alumnos enrolled. |
| `/teacher/courses/[id]/documents` | Documentos del curso. |
| `/teacher/grades` | Vista global de calificaciones (todos los cursos). |
| `/teacher/announcements` | Vista global de anuncios. |
| `/teacher/documents` | Vista global de documentos. |
| `/teacher/students` | Vista global de alumnos. |
| `/teacher/mensajes` | Chat 1↔1 con cada alumno (`messages.sender_id` activo). |

**Pitfall**: NUNCA agregar redirect `/teacher → /teacher/dashboard` en middleware. Crearía loop infinito porque `/teacher/dashboard/page.tsx` ya redirige a `/teacher`.

## Flujo de conexión profesor → alumno

1. Profesor se registra → role picker selecciona "Profesor".
2. Middleware lo redirige a `/teacher`.
3. Profesor crea curso → `subjects` row con `teacher_id = auth.uid()` + `access_code` único generado (formato `XXX-2026-XXX`).
4. Profesor comparte el código con sus alumnos.
5. Alumno entra el código en `/subjects` → POST `/api/subjects/join` → crea `enrollments` row.
6. Profesor crea evaluaciones (`exams` con `assigned_by = teacher_id`) y horarios (`schedules`) → aparecen en `/calendar`, `/evaluaciones` y `/subjects` del alumno.
7. Profesor asigna calificación → `exam_grades` row (NO `exams.grade`) → realtime channel actualiza el promedio del alumno sin reload.
8. Profesor publica anuncio → `announcements` row → visible en `/dashboard` y `/anuncios` del alumno enrolled.
9. Profesor sube documento → archivo en bucket `course-documents/<courseId>/...` + `documents` row.
10. **Alumno también puede subir** (RLS desde 2026-05-14) — UI pendiente.

## Tabla de calificaciones — `/teacher/courses/[id]/grades`

- Filas: exams del curso (`exams.assigned_by = teacher_id`).
- Columnas: alumnos enrolled (`enrollments.subject_id = course_id AND status = 'active'`).
- Celdas: input editable 0–20 → upsert en `exam_grades(exam_id, student_id, grade)`.
- Realtime: `supabase_realtime` está publicado en `exam_grades`, así que el alumno ve la nota al instante.

## Documentos — RLS (2026-05-14)

| Acción | Profesor (owner del subject) | Alumno enrolled (active) |
|---|---|---|
| Subir | ✅ | ✅ (desde 2026-05-14) |
| Leer | ✅ | ✅ |
| Borrar | ✅ (cualquiera de su curso) | ✅ (solo los propios) |

Path en storage: `<courseId>/<uuid>-<filename>`. Bucket privado, signed URLs para descarga.

## Mensajes — flujo bidireccional

- Tabla `messages`: `teacher_id`, `student_id`, `course_id`, `sender_id`, `body`.
- `sender_id` permite distinguir quién mandó cada mensaje (Fix 5 cerrado).
- `/teacher/mensajes` y `/mensajes` (alumno) usan el mismo componente `ChatThreads`.

## Archivos clave

- `features/teacher/layout/TeacherShell.tsx` + `TeacherSidebar.tsx` — shell de la sección.
- `features/teacher/dashboard/TeacherDashboard.tsx` + `LiveBadge.tsx` — home.
- `features/teacher/courses/{CoursesClient,CourseOverview,CourseModal,CourseCodeBlock}.tsx` — cursos.
- `features/teacher/grades/{GradesGlobal,AddExamModal,GradeCell}.tsx` — calificaciones.
- `features/teacher/announcements/{AnnouncementsGlobal,AnnouncementModal}.tsx` — anuncios.
- `features/teacher/documents/{DocumentsGlobal,DocumentRow,UploadDropzone}.tsx` — docs.
- `features/teacher/students/{StudentsGlobal,StudentDrawer,BulkMessageModal}.tsx` — alumnos.
- `app/(teacher)/teacher/mensajes/{page.tsx,actions.ts}` — chat.

## Pendiente

- UI para que el alumno enrolled suba docs desde su `SubjectDetail.tsx`. RLS ya está abierto desde la migración 2026-05-14; falta el botón + integración con `UploadDropzone`.
