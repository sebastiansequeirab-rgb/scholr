# Sprint 3 — AI Power + Fixes
**Goal:** Features de AI que ningún competidor tiene. Más fix crítico de progress bar.
**Basado en:** Revisión completa del sistema post-Sprint 2 (2026-04-23)
**Duración estimada:** 1-2 semanas

---

## Estado del sistema — Revisión Sprint 2

### Portal Estudiante ✅ Funcional
| Ruta | Estado | Notas |
|---|---|---|
| `/dashboard` | ✅ | Feed de exámenes + tareas urgentes |
| `/subjects` | ⚠️ | Barra de progreso rota (ver bug crítico abajo) |
| `/subjects` → SubjectDetail | ✅ | Tab Progreso, Chat, Documentos |
| `/calendar` | ✅ | FullCalendar integrado |
| `/tasks` | ✅ | |
| `/notes` | ✅ | Tiptap v3 + voz + auto-título |
| `/exams` | ✅ | |
| `/ai` | ✅ | AIChatHub + imagen + voz |
| `/ai-settings` | ✅ | |
| `/personalization` | ✅ | Temas + modo color |
| `/settings` | ✅ | |

### Portal Profesor ✅ Funcional
| Ruta | Estado | Notas |
|---|---|---|
| `/teacher/dashboard` | ✅ | TeacherDashboard |
| `/teacher/courses` | ✅ | CoursesClient + CourseModal |
| `/teacher/courses/[id]` | ✅ | CourseOverview |
| `/teacher/courses/[id]/grades` | ✅ | GradeTable |
| `/teacher/courses/[id]/announcements` | ✅ | AnnouncementsClient |
| `/teacher/courses/[id]/documents` | ✅ | DocumentsClient |
| `/teacher/courses/[id]/schedules` | ✅ | CourseScheduleManager |
| `/teacher/courses/[id]/students` | ✅ | |

### APIs ✅
- `/api/ai` — Claude sonnet-4-5
- `/api/ai/summarize-context` — subject_ai_contexts
- `/api/parse-schedule` — scan horario imagen
- `/api/parse-evaluations` — scan plan evaluativo imagen
- `/api/parse-pdf` — PDF parsing
- `/api/subjects/join` — join con access_code
- `/api/teacher/courses/[id]/schedules` — sync horarios profesor

### Wizards de AI ya construidos (Sprint 2)
- `EvaluationImportWizard` — foto → exámenes confirmados → INSERT
- `ScheduleImportWizard` — foto → horario confirmado → INSERT
> Nota: estas dos tareas del SPRINT3.md original ya están hechas.

---

## BUG CRÍTICO — Barra de progreso de materia (rota desde Sprint 2)

### Síntoma
La barra de progreso en las tarjetas de `/subjects` muestra `—` o `0.0/20` en materias con exámenes calificados.

### Causa raíz
La tabla `exams` tiene RLS ON con política `user_id = auth.uid()`.

En Sprint 2 se agregó `assigned_by UUID → profiles` para exámenes de profesor.
Cuando un **profesor asigna exámenes** a una materia, los inserta con su propio `user_id` o con un `user_id` distinto al del estudiante.
El query en `app/(app)/subjects/page.tsx:39` solo devuelve exámenes donde `user_id = auth.uid()` (RLS implícita). Los exámenes del profesor no pasan ese filtro → barra vacía.

### Localización exacta del bug
```
app/(app)/subjects/page.tsx:39
  supabase.from('exams')
    .select('id,subject_id,percentage,grade,submission_status,activity_type')
    .neq('activity_type', 'study_session')
```

### Fix — SQL en Supabase (Tarea 0)
```sql
-- Permite a estudiantes inscritos ver los exámenes de esa materia
CREATE POLICY "Enrolled students see subject exams" ON exams
  FOR SELECT USING (
    subject_id IN (
      SELECT subject_id FROM enrollments
      WHERE student_id = auth.uid() AND status = 'active'
    )
  );
```
Después de aplicar el SQL: verificar en `/subjects` que la barra muestre nota correcta en materias de profesor.

---

## Tareas Sprint 3

### Tarea 0 — Fix barra de progreso ⚡ URGENTE
**Acción:** Ejecutar SQL de RLS en Supabase Dashboard → SQL Editor.
**Test:** Inscribirse a una materia de profesor con exámenes calificados → barra debe mostrar nota.
**Archivos:** Solo Supabase, no tocar código.

---

### Tarea 1 — AI lee notas del cuaderno
**Descripción:** El agente puede buscar y resumir notas del estudiante al chatear.

**Archivos:**
- `lib/ai/tools.ts` — agregar tool `get_notes`
- `app/api/ai/route.ts` — registrar tool y manejar resultado

**Tool spec:**
```typescript
{
  name: 'get_notes',
  description: 'Fetches the student notes for context. Use when the student asks about their notes or study material.',
  input_schema: {
    type: 'object',
    properties: {
      subject_id: { type: 'string', description: 'Filter notes by subject. Optional.' },
      limit: { type: 'number', description: 'Max notes to return. Default 5.' }
    }
  }
}
```

**Query en el handler:**
```sql
SELECT title, content, updated_at FROM notes
WHERE user_id = auth.uid()
[AND subject_id = $subject_id]
ORDER BY updated_at DESC LIMIT 5
```

---

### Tarea 2 — Predicción de nota final
**Descripción:** "Si sacas X en el próximo parcial, tu nota final será Y".

**Archivos:**
- `lib/ai/tools.ts` — agregar tool `predict_grade`
- `app/api/ai/route.ts` — registrar tool

**Tool spec:**
```typescript
{
  name: 'predict_grade',
  description: 'Predicts the final grade based on current graded exams and hypothetical future scores.',
  input_schema: {
    type: 'object',
    properties: {
      subject_id: { type: 'string' }
    },
    required: ['subject_id']
  }
}
```

**Lógica del handler:**
```typescript
// Fetch exams for subject
// earned = sum(grade * percentage / 100) WHERE submission_status = 'graded'
// remaining_weight = sum(percentage) WHERE grade IS NULL
// best_case = earned + remaining_weight / 100 * 20
// worst_case = earned + 0
// Return all data → model does the "if you score X" reasoning
```

---

### Tarea 3 — Generación de flashcards
**Descripción:** Botón en nota → AI genera 5-10 pares Q&A → flip card UI.

**Archivos:**
- `app/api/ai/flashcards/route.ts` — nueva ruta
- `features/notes/components/FlashcardViewer.tsx` — nueva UI
- `app/(app)/notes/page.tsx` — agregar botón en header de nota abierta

**API:**
```typescript
// POST /api/ai/flashcards
// Body: { content: string }  ← tiptap content como texto plano
// Response: { cards: Array<{ question: string; answer: string }> }
```

**Prompt:**
```
Generate 5-10 flashcard pairs (question + answer) from the following notes.
Respond only with a JSON array: [{"question": "...", "answer": "..."}].
Same language as the notes.
```

**FlashcardViewer:** flip card CSS transform rotateY, navegación con ← → o teclado, counter "3/8".

---

### Tarea 4 — Análisis avanzado de imagen en AI
**Descripción:** El agente resuelve matemáticas, transcribe pizarrones, explica diagramas desde foto.

**Estado actual:** Upload de imagen ya funciona en `AIChatHub.tsx`. Solo falta instruir al modelo.

**Archivos:**
- `app/api/ai/route.ts` — actualizar system prompt

**Adición al system prompt:**
```
When the user sends an image:
- Math problems: solve step by step, show your work
- Whiteboards or slides: transcribe completely, then explain
- Diagrams or charts: describe structure and interpret meaning
- Handwritten notes: transcribe accurately
Always respond in the same language the user writes in.
```

---

### Tarea 5 — AI lee documentos del profesor
**Descripción:** El agente accede a PDFs de la materia como contexto.

**Pre-requisito:** `/api/parse-pdf/route.ts` ya existe.

**Archivos:**
- `lib/ai/tools.ts` — agregar tool `get_subject_documents`
- `app/api/ai/route.ts` — registrar tool, parsear PDF, pasar texto como contexto

**Tool spec:**
```typescript
{
  name: 'get_subject_documents',
  description: 'Fetches and reads teacher documents for a subject.',
  input_schema: {
    type: 'object',
    properties: {
      subject_id: { type: 'string' }
    },
    required: ['subject_id']
  }
}
```

**Lógica:** Query `documents` WHERE subject_id → fetch `file_url` → parse PDF → retornar texto al modelo (truncado a 4000 chars por doc para no explotar contexto).

---

## Orden de ejecución

```
0  → Fix RLS exams (SQL, 5 min, urgente)
1  → get_notes tool
2  → predict_grade tool
3  → Flashcards (API + UI)
4  → System prompt visión
5  → get_subject_documents tool
```

---

## Definición de "done"

- [ ] Barra de progreso funciona en materias propias Y materias inscritas
- [ ] El agente responde preguntas sobre notas del estudiante
- [ ] El agente predice nota final dado un hipotético
- [ ] Botón "Flashcards" genera tarjetas desde cualquier nota
- [ ] Flip card navegable con teclado
- [ ] El agente resuelve problemas matemáticos desde imagen
- [ ] El agente referencia documentos del profesor en el chat de materia
