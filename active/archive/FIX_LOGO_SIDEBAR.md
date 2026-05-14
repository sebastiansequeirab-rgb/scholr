# Hotfix — Logo del sidebar colapsable (portal del profesor)

**Tipo:** Hotfix visual · sin cambios de schema · sin lógica nueva
**Alcance:** Sólo `/teacher/*` (Next.js + Tailwind)
**Tiempo estimado:** 15 min · 1 PR · 1 archivo de componente + 1 stylesheet
**Estado anterior:** intento previo introdujo dos bugs — leer §0 antes de tocar nada.

---

## 0 · ⚠️ LEE ESTO PRIMERO — qué se rompió la vez pasada

El intento anterior dejó esto en producción (ver `uploads/pasted-1778682841442-0.png`
en el repo de diseño):

- Un **rectángulo navy** detrás del lockup "Skolar". → Causa: se usó el asset
  `logo-dark-wordmark.png` que tiene **fondo navy horneado y opaco** (745×130,
  0 % píxeles transparentes).
- Un texto **gigante "ASISTENTE ACADÉMICO"** debajo del logo. → Causa: se
  agregó un `<h1>` o `<div>` con ese string como hermano del `<img>`.

### Reglas inviolables de este PR

1. **El asset correcto para dark theme es `logo-full-white.png`** (326×75,
   ~85 % transparente, wordmark blanco). **NO usar** `logo-dark-wordmark.png`
   bajo ninguna circunstancia — tiene fondo navy baked-in.
2. **NUNCA agregar texto "ASISTENTE ACADÉMICO" en HTML.** Ese texto ya viene
   horneado dentro del PNG, debajo de "Skolar". Si parece muy chiquito, **sube
   el `max-height` del `<img>`, no agregues HTML extra**.
3. El contenedor `.t-logo` en estado expandido va **sin fondo, sin borde, sin
   padding grueso**. Cualquier tinte azul detrás del logo es un bug.

Si alguno de estos tres puntos no se cumple al hacer el QA visual, **el PR no
se mergea**.

---

## 1 · Problema original

En el portal del profesor, al **expandir** el sidebar el logo se ve mal:
el wordmark PNG ya contiene el lockup completo (icono + "Skolar" + "ASISTENTE
ACADÉMICO") sobre fondo transparente. Hoy lo estamos metiendo dentro de
`.t-logo`, un contenedor con fondo azul tintado, borde y padding grueso.
Resultado: marco-dentro-de-marco, pesado.

Además, la transición de `width` entre dos `var(--t-sidebar-w…)` se queda
"atascada" en algunos navegadores y deja el sidebar en un estado intermedio
hasta el siguiente reflow.

---

## 2 · Solución exacta

### 2.1 Inventario de assets en `public/assets/`

Verificar antes de empezar. **Usar estos cuatro nombres exactos:**

| Archivo                  | Dimensiones | Transparente | Uso                          |
|--------------------------|-------------|--------------|------------------------------|
| `logo-full-white.png`    | 326×75      | ✅ sí        | Dark theme · **expandido**   |
| `logo-light.png`         | ~          | ✅ sí        | Light theme · **expandido**  |
| `logo-icon-white.png`    | ~           | ✅ sí        | Dark theme · **colapsado**   |
| `logo-light-mark.png`    | ~           | ✅ sí        | Light theme · **colapsado**  |

**Archivos a evitar** (causaron el bug anterior):

| Archivo                    | Por qué NO                                  |
|----------------------------|---------------------------------------------|
| `logo-dark-wordmark.png`   | Fondo navy opaco horneado — produce el rectángulo azul detrás del lockup. |
| `logo-light-wordmark.png`  | Fondo blanco opaco horneado — equivalente al anterior en light theme.    |

### 2.2 Componente — `app/teacher/_components/TeacherSidebar.tsx`

**Markup completo del bloque del logo. No agregar nada más adentro.**

```tsx
<aside className={cn('t-sidebar', collapsed && 'is-collapsed')}>
  {/* ─── LOGO BLOCK ─── 
       NO agregar <h1>, <span>, <p> ni ningún otro elemento de texto aquí.
       El PNG ya contiene "Skolar" + "ASISTENTE ACADÉMICO" horneado. */}
  <div className="t-logoBlock">
    <div className="t-logo">
      {collapsed ? (
        <img
          className="t-logoMark"
          src={theme === 'light' ? '/assets/logo-light-mark.png' : '/assets/logo-icon-white.png'}
          alt="Skolar"
        />
      ) : (
        <img
          src={theme === 'light' ? '/assets/logo-light.png' : '/assets/logo-full-white.png'}
          alt="Skolar — Asistente Académico"
        />
      )}
    </div>
  </div>
  {/* ─── /LOGO BLOCK ─── */}

  {/* …resto del sidebar (role badge "PROFESOR", nav, collapse btn, profile card)… */}
</aside>
```

### 2.3 Estilos — `app/teacher/teacher.css` (o `@layer components`)

Reemplazar los bloques actuales por **exactamente** estos:

```css
/* Sidebar shell — animar SÓLO padding, no width.
   width entre dos var() causa frame stuck en Chromium 122+. */
.t-sidebar {
  width: var(--t-sidebar-w);            /* 240px */
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 22px 16px 18px;
  border-right: 1px solid var(--color-outline-low);
  background: color-mix(in oklab, var(--color-surface) 60%, var(--color-background));
  transition: padding 220ms cubic-bezier(0.4, 0, 0.2, 1);
}
.t-sidebar.is-collapsed {
  width: var(--t-sidebar-w-collapsed);  /* 72px */
  padding: 22px 10px 18px;
}

/* Logo — EXPANDIDO: SIN marco, SIN tinte, SIN padding grueso.
   El PNG es el lockup completo y no debe tener nada detrás. */
.t-logoBlock {
  padding: 0 0 14px;
  border-bottom: 1px solid var(--color-outline-low);
  margin-bottom: 4px;
}
.t-logo {
  background: transparent;   /* ← CRÍTICO. Si pones color acá vuelve el bug. */
  border: 0;
  border-radius: 0;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 0;
}
.t-logo img {
  max-height: 44px;          /* sube esto si el texto del PNG se ve chico */
  max-width: 100%;
  width: auto;
  height: auto;
  display: block;
  object-fit: contain;
}

/* Logo — COLAPSADO: chip 44×44 con tinte sutil. Sólo el icono. */
.t-sidebar.is-collapsed .t-logoBlock {
  border-bottom: 0;
  padding-bottom: 8px;
}
.t-sidebar.is-collapsed .t-logo {
  background: color-mix(in oklab, var(--color-primary) 14%, var(--color-surface));
  border: 1px solid color-mix(in oklab, var(--color-primary) 28%, transparent);
  border-radius: 12px;
  padding: 10px;
  min-height: 44px;
  width: 44px;
  margin: 0 auto;
}
.t-sidebar.is-collapsed .t-logo img { display: none; }
.t-sidebar.is-collapsed .t-logo .t-logoMark { display: block; }
.t-logoMark { display: none; max-height: 28px; max-width: 32px; width: auto; }
```

---

## 3 · QA visual antes de mergear

Comparar contra `teacher/teacher.css` líneas 17–95 del repo de diseño Skolar 2,
que es la referencia 1:1.

- [ ] **Dark expandido:** wordmark blanco respira sobre el fondo del sidebar. **Nada de rectángulo navy detrás.**
- [ ] **Dark expandido:** **no hay** texto "ASISTENTE ACADÉMICO" suelto. Sólo el PNG.
- [ ] **Dark colapsado:** chip 44×44 centrado con tinte azul sutil, icono blanco al medio.
- [ ] **Light expandido:** `logo-light.png` se lee sobre fondo claro, sin caja de fondo.
- [ ] **Light colapsado:** `logo-light-mark.png` dentro del chip.
- [ ] **Toggle:** 240↔72px instantáneo, padding transiciona suave, no se queda a medias.
- [ ] **Persistencia:** `localStorage('teacher.sidebar.collapsed')` sigue funcionando.
- [ ] **a11y:** alt expandido = `"Skolar — Asistente Académico"`. Alt colapsado = `"Skolar"`.
- [ ] **Mobile:** sidebar oculto bajo `<lg` igual que antes; drawer intacto.

---

## 4 · Lo que **NO** hacer (lista negra completa)

- ❌ No usar `logo-dark-wordmark.png` ni `logo-light-wordmark.png` — tienen fondo opaco baked-in.
- ❌ No agregar `<h1>`, `<h2>`, `<span>`, `<p>` ni ningún texto "ASISTENTE ACADÉMICO" en HTML. Ya viene horneado en el PNG.
- ❌ No poner `background:` distinto de `transparent` en `.t-logo` cuando NO está `.is-collapsed`.
- ❌ No reemplazar el PNG por SVG inline en este PR — ticket aparte.
- ❌ No tocar el sidebar del estudiante (`/student/*` o `/app/*`).
- ❌ No reactivar `transition: width …` sobre `.t-sidebar`.

---

## 5 · Archivos de referencia (este repo de diseño)

Si el resultado no coincide con lo esperado, abrir estos archivos para comparar
pixel a pixel:

- `teacher/Sidebar.js` — estructura final, traducible 1:1 a TSX.
- `teacher/teacher.css` líneas 17–95 — CSS canónico ya verificado en el preview.
- `Skolar Profesor.html` — host para abrir y comparar lado a lado.
