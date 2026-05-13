# Skolar — Testing del Portal del Profesor

## 1. Preparación

1. Asegurate de tener `.env.local` con:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xawgomhknzdnhkxcegqi.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   # Service role key — usá UNO de los dos nombres, el código acepta ambos:
   SUPABASE_SERVICE_ROLE_KEY=...
   # ó
   SUPABASE_SECRET_KEY=...
   ```

   Los mensajes profesor → estudiante son **internos** (tabla `messages`). No hay integración con email, así que no necesitás `RESEND_API_KEY` ni dominio verificado.

2. Instalá deps y corré el seed:
   ```bash
   npm install
   npm run seed:teacher
   ```

3. Arrancá el dev server:
   ```bash
   npm run dev
   ```

## 2. Credenciales

| Rol       | Email                  | Password   |
|-----------|------------------------|------------|
| Profesor  | `prof@skolar.test`     | `Test1234!`|
| Alumno 1  | `alumno1@skolar.test`  | `Test1234!`|
| Alumno 2..6| `alumno2..6@skolar.test` | `Test1234!`|

El seed crea 3 cursos para el profesor:
- **Cálculo I** (rose) · `CAL-2026-AAA`
- **Programación I** (blue) · `PRG-2026-AAA`
- **Estadística** (amber) · `EST-2026-AAA`

## 3. Flujo end-to-end

1. Logout. Login como **profesor** → `/teacher`.
   - Hero "Hola, *Carlos*." con badge "EN VIVO".
   - 4 KPIs (Cursos · Estudiantes · Por revisar · Promedio general).
   - Lista de 3 cursos. Click en uno → resumen sin tabs.
2. En `/teacher/courses` clickea "+ Nuevo curso". Crear "Test E2E", swatch verde.
   Verificar que el código generado tiene formato `TES-2026-XXX`.
3. Logout. Login como **alumno1**. Ir a `/subjects`, inscribirse con `TES-2026-XXX` (o `CAL-2026-AAA` si no creaste curso). El curso aparece.
4. Logout. Login como **profesor**. `/teacher/grades?course=<id>`. Editar nota → toast.
5. Logout. Login como **alumno1**. `/evaluaciones`. La nueva nota aparece **sin recargar** (realtime).
6. Profesor publica anuncio en `/teacher/announcements?course=<id>` → estudiante lo ve en `/dashboard`.
7. Profesor sube un PDF en `/teacher/documents?course=<id>`. Descarga el doc via signed URL. La URL pública NO debe funcionar (RLS storage).
8. Refresh en `/teacher/grades?course=<id>` → el filtro persiste.
9. Colapsar sidebar (botón "Colapsar" abajo). Reload → estado persiste (`localStorage[teacher.sidebar.collapsed]`).
10. Logout limpia sesión.
11. Como alumno, navegá a `/teacher` → redirect a `/dashboard`.
12. Como alumno, navegá a `/entregas` → ves los exámenes asignados por profesor y podés entregar.

## 4. Componentes en aislamiento

En desarrollo: visitá `/dev/components` para ver cada componente del portal en sus estados (cards, KPIs, chips, empty, thresholds, skeletons).

En producción: la ruta retorna 404 a menos que `NEXT_PUBLIC_DEV_COMPONENTS=1`.

## 5. Mensajes internos

En `/teacher/students` el profesor puede enviar un mensaje a todos los estudiantes visibles (filtrados por curso). Cada destinatario recibe una fila en `messages` y lo ve en su portal `/mensajes` con realtime. El estudiante puede marcar individual o "Marcar todos" como leídos.

- Sin dependencias externas (no email, no Resend).
- RLS: estudiante solo ve sus propios mensajes; profesor solo escribe a estudiantes de cursos que él dicta.

## 6. Re-ejecutar seed

El seed es **idempotente**. Podés correrlo varias veces sin duplicar datos:
- Usuarios: identifica por email
- Cursos: identifica por `(teacher_id, name)`
- Schedules/Exams/Anuncios: identifican por combinaciones únicas
- Grades/Submissions: `upsert` con onConflict

## 7. Cleanup

Si querés borrar usuarios seed (para empezar fresco):
```sql
-- En Supabase Studio → SQL Editor
delete from auth.users where email like '%@skolar.test';
```
Los `subjects`, `enrollments`, `exams`, `submissions` se borran en cascada vía `on delete cascade`.
