export function buildScheduleParsePrompt(params: {
  todayStr: string
  currentYear: number
  colorPalette: string
}): string {
  const { todayStr, currentYear, colorPalette } = params
  return `Eres un extractor preciso de horarios académicos. Hoy es ${todayStr}. Año académico en curso: ${currentYear}. Analiza la imagen y extrae CADA bloque horario visible.

PROCESO OBLIGATORIO — sigue estos pasos en orden:
1. Identifica la estructura de la tabla: ¿las columnas son días o las filas son días?
2. Lee los encabezados de columnas y filas para mapear días y horas exactas.
3. Para CADA celda no vacía: determina a qué día (columna) y rango horario (fila) corresponde.
4. Cuenta visualmente cuántas filas horarias abarca la celda antes de asignar hora_fin.
5. Agrupa los bloques de la misma materia (aunque tengan distintos días/horas).
6. Verifica que ningún bloque se solape con otro de la misma materia.
7. Si hay bloques LEC, LAB o DIS de la misma materia, agrúpalos todos bajo esa materia.

REGLAS CRÍTICAS para horarios:
- Lee hora_inicio y hora_fin directamente de los encabezados de fila, NO los inventes.
- Si la tabla muestra "7:00 – 8:30", start_time="07:00" end_time="08:30" EXACTAMENTE.
- Si ves "7:00" como inicio de fila y la siguiente fila es "8:30", ese bloque dura 1h30.
- NUNCA asumas duraciones estándar (ej. 50min, 1h, 1h30); siempre lee los valores reales de la imagen.
- Si una celda ocupa VARIAS FILAS HORARIAS CONSECUTIVAS: la hora_fin es el límite inferior de la ÚLTIMA fila que ocupa. Ejemplo: celda en filas "9:00" y "10:00" con siguiente fila "11:00" → end_time="11:00". Celda en filas "9:00" y "10:50" con siguiente marca "10:50" → end_time="10:50". Nunca uses la hora de inicio de la segunda fila como fin; usa el límite de la última fila abarcada.
- Si los intervalos de fila son de 50min (9:00, 9:50, 10:40...) y la celda abarca 2 filas, la duración es ~100min, NO 50min.
- Si una celda abarca múltiples COLUMNAS de día (celda fusionada horizontal), crea un bloque separado para CADA día que abarca.
- day_of_week: 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb

NORMALIZACIÓN de nombres:
- El campo "name" debe ser el nombre completo de la materia, sin prefijos de sección.
- Si la celda muestra "LEC Cálculo I" o "LAB-Física", el name es "Cálculo I" o "Física".
- Si el prefijo (LEC/LAB/DIS/TUT) es el único identificador, inclúyelo en "professor".
- Agrupa LEC, LAB y DIS de la misma materia bajo un solo objeto con múltiples bloques.

VERIFICACIÓN FINAL antes de responder:
- Para cada bloque, confirma en qué columna (día) aparece la celda. No asumas; léelo de la cabecera de columna.
- Si una celda está en la columna "Martes", day_of_week=2. No mezcles columnas.
- ¿Cada bloque tiene un día específico (0-6)?
- ¿Los horarios tienen formato HH:MM en 24h?
- ¿start_time < end_time para todos los bloques?
- ¿No hay duplicados del mismo bloque?
Si algo es ambiguo, omítelo antes que inventarlo.

Devuelve ÚNICAMENTE este JSON válido (sin markdown, sin texto extra):
{
  "subjects": [
    {
      "name": "nombre exacto de la materia",
      "professor": "código, sección o nombre del profesor si aparece, si no null",
      "color": "#185FA5",
      "icon": "menu_book",
      "schedules": [
        { "day_of_week": 1, "start_time": "14:00", "end_time": "15:30", "room": "aula/salón o null" }
      ]
    }
  ]
}

Colores disponibles (asigna uno distinto a cada materia, en este orden):
${colorPalette}

Icons disponibles:
menu_book calculate science speed biotech history_edu translate code palette music_note fitness_center trending_up business_center engineering gavel architecture medical_services lab_research assignment school psychology bar_chart`
}
