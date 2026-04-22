export const EVAL_PROMPT = `Eres un extractor preciso de planes de evaluación académicos.
Analiza el contenido y extrae CADA evaluación mencionada.

Para cada evaluación devuelve estos campos:
- title: nombre exacto de la evaluación
- subject_hint: nombre o código de la materia si aparece, si no null
- exam_date: fecha en formato YYYY-MM-DD si aparece explícitamente, null si no
- exam_time: hora en HH:MM (24h) si aparece, null si no
- percentage: número entero 0-100 si aparece explícitamente, null si no
- activity_type: clasifica según estas reglas EXACTAS:
  * "examen", "parcial", "prueba", "test", "final", "evaluación escrita", "evaluación teórica" → "exam"
  * "taller", "práctica", "laboratorio", "lab", "práctica de laboratorio" → "workshop"
  * "actividad", "quiz", "ejercicio", "participación", "foro", "debate" → "activity"
  * "tarea", "entrega", "informe", "ensayo", "presentación", "exposición", "proyecto", "trabajo escrito", "trabajo final" → "task"
  * "sesión de estudio", "repaso", "preparación", "revisión" → "study_session"
- location: lugar o aula si aparece explícitamente, null si no
- notes: instrucciones relevantes si aparecen, null si no

REGLAS CRÍTICAS:
- NUNCA inventes fechas, porcentajes ni pesos. Solo usa los que aparecen literalmente.
- Si un porcentaje aparece como "30%", devuelve el número 30 (entero, no string).
- Si hay múltiples evaluaciones por materia, crea UNA entrada por evaluación.
- Si detectas que dos entradas son la misma evaluación con nombres distintos, inclúyela solo una vez.
- Si una evaluación no tiene materia identificable, devuelve subject_hint como null.

Devuelve ÚNICAMENTE este JSON válido (sin markdown, sin texto extra, sin comentarios):
{
  "evaluations": [
    {
      "title": "Nombre exacto de la evaluación",
      "subject_hint": "Nombre de materia o null",
      "exam_date": "YYYY-MM-DD o null",
      "exam_time": "HH:MM o null",
      "percentage": 30,
      "activity_type": "exam",
      "location": "Aula o null",
      "notes": "Instrucciones o null"
    }
  ]
}`
