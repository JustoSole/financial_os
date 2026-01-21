# 🚀 HOJA DE RUTA: REFRESH UX/UI & CALIDAD SAAS

Este documento es la guía técnica para elevar el Financial OS a un estándar de mercado premium (Score 85+). Diseñado para una implementación modular y eficiente.

---

## 🛠 Fase 1: Saneamiento Arquitectónico (Prioridad Alta)
**Objetivo:** Eliminar el archivo `index.css` de 7,000 líneas y hacerlo mantenible.

- **Acción:** Implementar **CSS Modules** o **Tailwind CSS**. 
- **Estrategia de Reutilización:** 
    - Extraer todos los `:root` variables a un archivo `src/styles/theme.css`.
    - Crear una carpeta `src/components/ui/` para componentes atómicos (Button, Card, Badge, Input).
    - Mover el CSS de cada página a su propio archivo `NombrePagina.module.css`.

## 📱 Fase 2: Mobile-First & Navegación (Crítico)
**Objetivo:** Hacer la app utilizable en cualquier dispositivo.

- **Tarea 1: Mobile Sidebar:**
    - Crear un componente `MobileHeader.tsx` que solo aparezca en `< 768px`.
    - Implementar un **Hamburger Menu** utilizando el `Drawer` existente en la carpeta `ui/`.
- **Tarea 2: Grid Adaptativo:**
    - Refactorizar `.grid-4` y `.grid-2` para que usen `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))`.
- **Tarea 3: Tablas Responsive:**
    - En mobile, transformar tablas en **Cards** o habilitar `overflow-x: auto` con indicadores visuales de scroll.

## 🎨 Fase 3: Identidad Visual Premium (Look & Feel)
**Objetivo:** Dejar de parecer "otro dashboard genérico".

- **Nueva Paleta:** Cambiar el Teal genérico por un **Deep Indigo & Slate** o un **Midnight Blue** con acentos en **Amber**.
- **Efectos Visuales:**
    - Implementar `glassmorphism` suave en sidebar y headers (`backdrop-filter: blur(10px)`).
    - Usar `border-radius: 12px` (standard) en lugar de los `24px` actuales que se ven desproporcionados.
- **Gráficos:** Customizar `Recharts` para que usen gradientes bajo las líneas y tooltips que sigan el diseño de la app.

## ⚡ Fase 4: UX Avanzada (Productividad SaaS)
**Objetivo:** Añadir el "delight" que esperan los usuarios de apps modernas.

- **Command Palette (Cmd+K):** 
    - Reutilizar la lógica de `GlossaryDrawer` para crear un buscador global rápido.
- **Shortcuts de Teclado:**
    - `i`: Inicio, `c`: Canales, `f`: Filtros de fecha.
- **Feedback Táctil/Visual:**
    - Añadir `Sonner` o `React-Hot-Toast` para notificaciones.
    - Implementar Skeleton loaders consistentes en cada transición de página.

---

# 📋 Guía para el Coder (Checklist de Implementación)

### 1. Componentes UI (Atomic Design)
Revisar `src/components/ui/`. Asegurar que cada componente tenga:
- [ ] Soporte para `className` para extensión de estilos.
- [ ] Estados: `loading`, `disabled`, `empty`.
- [ ] Accesibilidad: `aria-labels` y soporte de teclado.

### 2. Refactor de CSS (Limpieza)
- [ ] Crear `src/styles/variables.css` con la nueva paleta.
- [ ] Eliminar selectores globales innecesarios de `index.css`.
- [ ] Encapsular estilos por componente/página.

### 3. Navegación (UX)
- [ ] **Mobile Sidebar:** Implementar con `framer-motion` para transiciones fluidas.
- [ ] **Active States:** Mejorar el visual del link activo con indicadores laterales y cambios de peso de fuente.

### 4. Visual Refresh (Branding)
- [ ] Cambiar `--color-primary` a un color distintivo (ej: `#2D3FE0`).
- [ ] Unificar tamaños de iconos (Lucide-React) en toda la app.

--- 

## 💡 Nota de Eficiencia:
*No reconstruyas la lógica. Los archivos de `AppContext.tsx` y los parsers del backend están correctos. El enfoque debe ser 100% en la capa de presentación (estilos y componentes UI) y la estructura de archivos CSS.*

