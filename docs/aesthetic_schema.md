# Aesthetic Schema: Gedoblebe Power Simulator

Este documento detalla el sistema de diseño y los elementos estéticos utilizados en el proyecto **Gedoblebe Power Simulator** (Next.js + Vanilla CSS) para que puedan ser replicados en otros proyectos de forma coherente.

## 1. Concepto Visual
- **Estilo**: Dark Modern / Glassmorphism / Industrial Elegance.
- **Atmósfera**: Profesional, técnica y de alto contraste, utilizando desenfoques (blur) y gradientes sutiles para dar profundidad.

---

## 2. Sistema de Colores (CSS Variables)

El proyecto utiliza variables CSS en `:root` para mantener la consistencia.

```css
:root {
  /* Fondos y Superficies */
  --bg-primary: #0f1117;   /* Fondo principal */
  --bg-secondary: #161923; /* Fondo de contenedores grandes */
  --bg-surface: #1c1f2e;   /* Superficie de paneles */
  --bg-elevated: #242838;  /* Superficie elevada (inputs, botones) */
  --bg-hover: #2a2f42;     /* Estado hover */

  /* Bordes */
  --border: #2e3348;
  --border-light: #363b52;

  /* Texto */
  --text-primary: #edf0f5;
  --text-secondary: #b0b8cc;
  --text-muted: #8891a8;

  /* Colores de Acento */
  --accent: #6366f1;       /* Indigo principal */
  --accent-hover: #818cf8;
  --accent-dim: rgba(99, 102, 241, 0.15);
  
  /* Colores Semánticos */
  --green: #34d399;        /* Éxito / Óptimo */
  --red: #f87171;          /* Error / Peligro */
  --amber: #fbbf24;        /* Advertencia */
  --purple: #a78bfa;       /* Datos técnicos (LMP) */
  --cyan: #22d3ee;         /* Acento secundario */
}
```

---

## 3. Tipografía
- **Fuente Principal**: `'Inter', -apple-system, sans-serif`.
- **Fuente Mono**: `'SF Mono', 'Fira Code', monospace` (utilizada para datos numéricos y celdas de tablas).
- **Tamaño Base**: `14px`.
- **Jerarquía**:
  - Títulos de Paneles: 0.9rem, Semibold (600), Uppercase opcional.
  - Títulos de Página: 1.25rem, Bold (700), Gradient text.

---

## 4. Efectos y Micro-interacciones

### Glassmorphism (Cabecera)
El header utiliza un efecto de desenfoque de fondo para simular cristal esmerilado.
```css
.header {
  backdrop-filter: blur(12px);
  background: linear-gradient(135deg, #14162a 0%, #1a1d35 100%);
}
```

### Borde Iridiscente Animado
Un detalle premium en la base del header que utiliza una animación de gradiente fluida.
```css
.header::after {
  height: 2px;
  background: linear-gradient(90deg, #6366f1, #06b6d4, #10b981, #f59e0b, #ec4899, #8b5cf6, #06b6d4, #6366f1);
  background-size: 300% 100%;
  animation: iridescent 6s linear infinite;
}

@keyframes iridescent {
  0% { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}
```

---

## 5. Componentes Clave

### A. Paneles (Containers)
Los contenedores tienen bordes definidos y esquinas redondeadas (`10px`).
```css
.panel {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem;
}
```

### B. Tarjetas KPI
Utilizan un borde lateral de color para categorizar la información visualmente.
- **Hover**: Elevación sutil (`translateY(-1px)`) y sombra suave coloreada.
- **Estilo**:
  ```css
  .kpi-card {
    border-left: 3px solid var(--accent);
    transition: all 0.2s ease;
  }
  .kpi-card:hover {
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.15);
  }
  ```

### C. Botones
- **Primary**: Background `--accent`, blanco texto, con un brillo (glow) en hover.
- **Secondary**: Estilo neutral, integrado con el fondo.
- **Danger**: Utiliza `--red-dim` para una apariencia menos agresiva pero clara.

---

## 6. Layout Estructural (App Shell)
1. **Header**: Fixed/Sticky en la parte superior.
2. **Main**: Flexbox horizontal con un `gap` sutil (0.75rem).
3. **Canvas/Centro**: El área de trabajo principal (fondo `--bg-secondary`).
4. **Sidebar**: Columna derecha para paneles de control y listas de elementos.

---

## 7. Tablas de Resultados
- **Headers**: Sticky, fondo elevado, texto en mayúsculas pequeñas.
- **Filas**: Celdas numéricas con alineación derecha y fuente mono (`tabular-nums`).
- **Zebra Striping**: Alternancia muy sutil de fondo para mejorar la legibilidad.

---

> [!TIP]
> Para replicar este estilo, empieza por definir las variables CSS en tu archivo global. El uso del color `#0f1117` como base técnica y el azul índigo `#6366f1` como acento es la clave de la elegancia del proyecto.
