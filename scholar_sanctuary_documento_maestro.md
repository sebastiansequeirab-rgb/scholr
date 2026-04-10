# Scholar Sanctuary — Documento Maestro de Rediseño y Mejora

## Propósito
Este documento es la **fuente de verdad** para llevar la app actual a una versión premium, consistente, usable y visualmente memorable.  
Debe usarse como guía obligatoria para cualquier cambio en Claude Code.

La meta no es rehacer la app desde cero.  
La meta es **elevar la base actual** hasta una versión soñada, cuidando cada detalle visual, funcional y de experiencia.

---

## Visión del producto
Scholar Sanctuary debe sentirse como una app académica:

- premium
- limpia
- calmada
- tipo iOS
- student friendly pero no infantil
- elegante
- útil de verdad
- adictiva de abrir
- organizada
- sin ruido visual
- con sensación de control, progreso y claridad

El usuario debe sentir:

> “Aquí tengo toda mi vida académica en un solo lugar, se ve increíble, me da paz y me ayuda de verdad.”

---

## Regla principal del proyecto
**No se rediseña por rediseñar.**  
Todo cambio debe cumplir al menos una de estas funciones:

- mejorar UX real
- mejorar claridad
- mejorar belleza visual
- mejorar consistencia
- corregir un bug
- reducir fricción
- hacer la app más agradable de abrir y usar

---

## Principios no negociables

1. **No romper funcionalidades existentes.**
2. **No cambiar por completo lo que ya funciona bien.**
3. **Mantener la estructura base donde ya sea buena.**
4. **Todo debe verse más premium, no más recargado.**
5. **La legibilidad nunca puede empeorar.**
6. **Dark mode y light mode deben funcionar impecable.**
7. **Los cambios deben sentirse coherentes entre todas las páginas.**
8. **No meter elementos decorativos inútiles.**
9. **La app debe seguir viéndose rápida, clara y moderna.**
10. **Cada página debe tener más identidad sin perder consistencia global.**

---

## Orden obligatorio de implementación

### Fase 1 — Sistema visual base y bugs críticos
1. arreglar light mode
2. arreglar theme switching / color modes
3. eliminar hardcoded colors conflictivos
4. unificar tokens globales
5. asegurar contraste correcto
6. unificar spacing, radios, bordes, sombras y jerarquía tipográfica

### Fase 2 — UX crítica del calendario
1. evitar scroll excesivo hacia abajo
2. mostrar mejor las clases de 7 am / primeras horas del día
3. mejorar compactación visual de grilla
4. mejorar navegación entre vistas día / semana / mes
5. diferenciar mejor tipos de evento

### Fase 3 — Rediseño de páginas con mayor impacto
1. Home
2. Materias
3. Exámenes
4. Notas

### Fase 4 — Polish premium
1. microinteracciones
2. hover/focus/active states
3. empty states
4. pequeños refinamientos visuales
5. consistencia final

---

## Sistema de diseño deseado

### Estilo general
- visual oscuro elegante por defecto
- fondos profundos y limpios
- superficies levemente elevadas
- sensación moderna tipo app premium
- iluminación sutil, no exagerada
- gradients suaves y refinados
- diseño serio pero amigable
- nada infantil ni genérico

### Color system
Debe existir un sistema real de variables, no colores sueltos.

Definir y usar consistentemente:
- `background`
- `background-secondary`
- `surface`
- `surface-elevated`
- `surface-hover`
- `border-subtle`
- `border-strong`
- `text-primary`
- `text-secondary`
- `text-muted`
- `accent`
- `accent-soft`
- `success`
- `warning`
- `danger`
- `info`

### Colores por materia
Cada materia debe tener un color base consistente que se use en:
- calendario
- chips
- cards
- indicadores
- badges
- detalles secundarios

Ese color debe poder derivarse en:
- versión sólida
- versión suave
- gradient suave
- glow muy sutil
- texto/acento compatible

### Tipografía
Debe sentirse:
- limpia
- moderna
- clara
- premium
- con excelente jerarquía

Criterios:
- títulos fuertes y elegantes
- subtítulos con aire
- labels pequeñas pero legibles
- metadata menos contrastada
- evitar bloques visualmente densos

### Bordes y radios
- radios consistentes
- bordes muy sutiles
- nada tosco
- sensación de producto pulido

### Sombras y profundidad
- sombras suaves
- elevación ligera
- preferir contraste y layers antes que sombra pesada
- glows solo donde realmente aporten

### Animaciones
- suaves
- rápidas
- discretas
- elegantes
- nunca exageradas

---

## Problemas globales detectados

### 1. Light mode roto
La opción existe pero no funciona bien o no se ve consistente.

**Objetivo final:**  
El light mode debe verse tan intencional y premium como el dark mode.

### 2. Theme / color switching roto
Las distintas variantes de color no están funcionando correctamente.

**Objetivo final:**  
Cambiar color o tema desde settings debe actualizar la interfaz de forma consistente y sin errores visuales.

### 3. Inconsistencias visuales entre páginas
Algunas pantallas se sienten premium y otras más planas o secas.

**Objetivo final:**  
Toda la app debe sentirse parte del mismo sistema visual.

### 4. Calendario incómodo en uso real
Hay que bajar demasiado para ver clases tempranas.

**Objetivo final:**  
La vista debe ser útil para estudiantes con clases desde 7 am.

### 5. Home poco memorable
Está ordenado, pero aún no es adictivo ni especialmente emocionante.

**Objetivo final:**  
El Home debe ser la pantalla más atractiva y viva de la app.

### 6. Notas todavía poco friendly
Funciona, pero aún no transmite la experiencia de quick notes encantadora y rápida.

### 7. Exámenes algo planos
Buena base, pero necesita más jerarquía visual, personalidad y estructura.

### 8. Materias con mucho potencial visual desaprovechado
La estructura es buena, pero pueden verse mucho más bellas y premium.

---

# Cambios por pantalla

---

## Imagen 1 — Modal “Nuevo examen”

### Qué se mantiene
- estructura general del modal
- layout de campos
- distribución de botones
- claridad actual
- tamaño general
- CTA principal actual como base

### Qué se mejora
- polish visual fino en inputs
- estados focus más bonitos
- placeholders más elegantes
- selector fecha/hora más premium
- mejor separación visual entre grupos de campos
- animación suave al abrir y cerrar

### Qué se prohíbe
- no rehacer el modal desde cero
- no hacerlo más cargado
- no añadir campos innecesarios
- no empeorar legibilidad

### Resultado esperado
Un modal sobrio, limpio, premium y perfecto para uso frecuente.

### Checklist
- [ ] Se ve igual o mejor de claro
- [ ] Los inputs tienen mejor focus state
- [ ] El modal abre/cierra suave
- [ ] Sigue sintiéndose limpio y simple
- [ ] No se dañó ningún flujo de creación

---

## Imagen 2 y 10 — Página de Exámenes

### Diagnóstico
La base es buena, pero la pantalla se siente demasiado seria y un poco plana.  
Cuando hay pocos exámenes, queda vacía.  
Falta más jerarquía, color y estructura útil.

### Qué se mantiene
- layout general
- enfoque en el próximo examen / evaluación
- CTA de “Nuevo examen”
- estructura de card principal como base

### Qué se mejora
1. mejorar combinaciones de color
2. conectar más el color del examen con el color de su materia
3. hacer el countdown más protagonista
4. agregar mejor diferenciación visual de tipo de evaluación:
   - parcial
   - quiz
   - entrega
   - exposición
5. mejorar visualmente materia, fecha, hora y lugar
6. refinar botones de editar y eliminar
7. evitar sensación de vacío cuando haya solo un examen
8. crear mejor jerarquía entre:
   - próximo examen hero
   - siguientes exámenes compactos
   - historial/completados opcional

### Mejoras deseadas
- badge de countdown más fuerte
- chip de materia con color coherente
- uso elegante de glow o gradient leve
- card principal más “hero”
- mejor lectura visual del contenido
- estados:
  - próximo
  - hoy
  - vencido
  - completado

### Qué se prohíbe
- no convertir la página en un dashboard saturado
- no usar demasiados colores chillones
- no meter visuales infantiles
- no perder limpieza actual

### Resultado esperado
Una página de exámenes más importante, viva, premium y funcional.

### Checklist
- [ ] Mejor color system
- [ ] Countdown más protagonista
- [ ] Mejor estructura con pocos exámenes
- [ ] Mejor estructura con muchos exámenes
- [ ] Materia y tipo de evaluación más claros
- [ ] Botones más refinados
- [ ] Sigue viéndose limpia

---

## Imagen 3 — Notas

### Diagnóstico
La base es correcta, pero no se siente aún como una experiencia de quick notes verdaderamente encantadora.  
Se ve demasiado seria y un poco seca.

### Qué se mantiene
- editor actual como base
- estructura sidebar + editor
- toolbar base
- capacidad de filtrar por materia

### Qué se mejora
1. agregar más identidad visual a cada nota
2. usar iconos sutiles o indicadores visuales por tipo de nota
3. hacer la lista lateral más bonita y agradable
4. mejorar jerarquía entre:
   - título
   - materia
   - fecha
   - preview
5. transmitir mejor sensación de captura rápida
6. mejorar estados vacíos
7. hacer más friendly el quick note sin hacerlo infantil

### Ideas concretas
- mini icono por nota
- punto o badge de color por materia
- pequeña línea/acento cromático
- preview de una línea más clara
- cards laterales más agradables
- mejor selección activa
- posibilidad futura de tipos de nota:
  - idea
  - clase
  - examen
  - pendiente
  - importante

### Qué se prohíbe
- no convertirlo en una app de notas decorativa
- no meter stickers ni elementos infantiles
- no recargar el editor principal

### Resultado esperado
Una experiencia de notas rápida, bella, amigable y con personalidad.

### Checklist
- [ ] La sidebar se ve más linda
- [ ] Cada nota tiene más identidad visual
- [ ] El editor sigue limpio
- [ ] Se siente más quick note y menos documento seco
- [ ] La experiencia vacía también se ve bien

---

## Imagen 4 — Materias

### Diagnóstico
La pantalla está bien estructurada, pero tiene muchísimo potencial visual adicional.  
Las cards aún se sienten informativas más que memorables.

### Qué se mantiene
- grid de materias
- estructura de cada card
- info principal: profesor, salón, horario, créditos
- botones base de acción

### Qué se mejora
1. aplicar gradients suaves basados en el color de cada materia
2. mejorar tipografía y jerarquía visual
3. hacer la card más bella y cómoda de leer
4. refinar spacing interno
5. mejorar presentación de horarios
6. estilizar mejor créditos, iconos y metadatos
7. usar color de materia de forma más intencional
8. elevar cada materia de “ficha” a “espacio académico”

### Extensión ideal
Si cabe sin sobrecargar:
- próxima clase
- próxima tarea
- próximo examen
- progreso de la materia

### Qué se prohíbe
- no meter demasiada información en una sola card
- no hacer gradients agresivos
- no usar contraste deficiente
- no romper la lectura rápida

### Resultado esperado
Cards de materias premium, bellas, cómodas, con identidad y coherencia con el calendario.

### Checklist
- [ ] Cada card refleja mejor el color de su materia
- [ ] Mejor lectura del nombre de la materia
- [ ] Profesor/salón/horario se leen mejor
- [ ] La card se siente más premium
- [ ] El grid sigue ordenado

---

## Imágenes 5, 6, 7 y 8 — Calendario

### Diagnóstico
Visualmente va bien, pero funcionalmente tiene un problema fuerte:  
hay que bajar demasiado para ver clases tempranas.

### Objetivo prioritario
Resolver primero UX real antes de hacer polish cosmético.

### Qué se mantiene
- estructura general del calendario
- vistas mes / semana / día
- leyenda superior de colores
- navegación base
- sidebar

### Qué se mejora sí o sí
1. reducir necesidad de scroll vertical excesivo
2. mostrar mejor las clases desde 7 am
3. autoscroll inteligente hacia la primera clase o primer bloque relevante
4. compactar la altura por hora sin perder legibilidad
5. mejorar densidad visual en semana y día
6. pulir la vista mes para que se lea más limpia
7. diferenciar mejor:
   - clases
   - tareas
   - exámenes

### Reglas funcionales
- si el usuario abre la vista día, no debe tener que bajar demasiado para ver su primera clase
- si la primera clase del día está a las 7 am, esa zona debe aparecer razonablemente visible
- el viewport inicial debe priorizar utilidad real
- el calendario debe sentirse hecho para estudiantes, no genérico

### Posibles soluciones válidas
- autoscroll a primer evento del día
- start hour configurable
- compact mode
- scroll inicial calculado
- botón “ir a primera clase”
- mejor proporción vertical del grid

### Vista mes
También mejorar:
- densidad de labels
- separación visual entre eventos
- limpieza general
- claridad del día actual
- equilibrio entre cantidad de eventos y lectura

### Qué se prohíbe
- no sacrificar legibilidad
- no volverlo diminuto
- no romper navegación entre mes/semana/día
- no tocarlo solo cosméticamente sin resolver el scroll

### Resultado esperado
Un calendario mucho más usable, limpio, claro y adaptado al ritmo real del estudiante.

### Checklist
- [ ] Ya no obliga a bajar demasiado
- [ ] Las clases tempranas se ven mejor
- [ ] Día y semana son más utilizables
- [ ] Mes se ve más limpio
- [ ] Tipos de evento se distinguen mejor
- [ ] Sigue viéndose premium

---

## Imagen 9 — Home / Inicio

### Diagnóstico
Está ordenado y útil, pero todavía no se siente suficientemente especial ni adictivo.  
Es la pantalla con mayor oportunidad de elevar el producto.

### Qué se mantiene
- estructura general de resumen
- bloques actuales como base
- resumen de hoy
- tareas urgentes
- próximos exámenes
- accesos directos

### Qué se mejora
1. hacer el home más emocionante y placentero de abrir
2. crear un hero principal más memorable
3. mejorar el resumen del día
4. aumentar recompensa visual y sensación de control
5. dar más variedad jerárquica entre bloques
6. convertirlo en la página más viva del sistema

### Mejoras deseadas
- saludo más inteligente y bonito
- micro resumen contextual:
  - cuántas clases tienes hoy
  - qué vence hoy
  - qué viene después
- card principal con más presencia
- mejor uso de espacio visual
- más sensación de progreso real
- gamificación sutil, no infantil:
  - streak
  - progreso del día
  - control de semana
  - energía del día / focus level
- quick actions más visibles
- mejores empty/low-data states

### Qué se prohíbe
- no hacer un dashboard saturado
- no meter widgets innecesarios
- no volverlo infantil
- no quitar claridad actual

### Resultado esperado
Una pantalla de inicio adictiva, emocional, útil y visualmente top.

### Checklist
- [ ] Se siente más viva
- [ ] Se siente más premium
- [ ] El resumen del día es mejor
- [ ] Tiene más personalidad
- [ ] Da ganas de abrirla constantemente
- [ ] No se volvió caótica

---

## Settings / Themes

### Diagnóstico
Existe la intención de cambiar temas o colores, pero no está funcionando correctamente.

### Objetivo
Crear un sistema de settings real, confiable y consistente.

### Qué se mejora
1. dark mode impecable
2. light mode impecable
3. accent themes funcionales
4. persistencia correcta de tema/color
5. todos los componentes deben responder al tema:
   - sidebar
   - cards
   - calendario
   - editor
   - badges
   - modals
   - botones
   - inputs

### Qué se prohíbe
- no dejar componentes sin tematizar
- no mezclar hardcoded styles con token styles
- no hacer un light mode grisáceo sin intención

### Resultado esperado
El usuario cambia tema o color y toda la app responde de forma coherente y bonita.

### Checklist
- [ ] Dark mode bien
- [ ] Light mode bien
- [ ] Accent colors bien
- [ ] Persistencia bien
- [ ] No hay componentes rotos
- [ ] Calendario también responde bien

---

# Reglas de implementación para Claude Code

## Regla 1
Trabajar **una fase a la vez**.

## Regla 2
No tocar páginas no solicitadas en cada fase.

## Regla 3
Antes de implementar, resumir exactamente:
- qué entendió
- qué va a cambiar
- qué no va a tocar

## Regla 4
Después de implementar, entregar:
- resumen de cambios
- archivos tocados
- razones de cada cambio
- checklist de cumplimiento

## Regla 5
No improvisar features no pedidas.

## Regla 6
No romper estilos existentes que ya funcionen bien.

## Regla 7
Mantener responsive y consistencia general.

## Regla 8
Todo cambio visual debe sentirse:
- más premium
- más limpio
- más útil
- más coherente

---

# Método de trabajo recomendado

## Bloque 1
Sistema visual + themes + light mode

## Bloque 2
Calendario UX

## Bloque 3
Home

## Bloque 4
Materias

## Bloque 5
Exámenes

## Bloque 6
Notas

## Bloque 7
Polish final

---

# Checklist global final de calidad

## Visual
- [ ] Dark mode impecable
- [ ] Light mode impecable
- [ ] Themes funcionales
- [ ] Tipografía consistente
- [ ] Colores coherentes
- [ ] Cards premium
- [ ] Iconografía refinada
- [ ] Hover/focus/active states cuidados

## UX
- [ ] Calendario usable de verdad
- [ ] Home más adictivo
- [ ] Materias más cómodas y bellas
- [ ] Exámenes más claros y vivos
- [ ] Notas más friendly

## Producto
- [ ] La app se siente más soñada
- [ ] La app da más placer de abrir
- [ ] La app reduce mejor el estrés
- [ ] La app transmite control y orden
- [ ] La app se siente hecha con detalle

---

# Instrucción final obligatoria
El objetivo no es simplemente “hacerla más bonita”.  
El objetivo es que Scholar Sanctuary se convierta en una app académica premium, clara, encantadora, coherente y altamente disfrutable, donde cada pantalla aporte valor real y se sienta pensada al detalle.
