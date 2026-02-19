# Auditoría: Módulo de Costos (Cargar costos + Control financiero)

**Fecha:** 19 Feb 2026  
**Alcance:** Flujo de costos mensuales: Datos → Cargar costos, Control financiero (Costs), y uso de esos datos en P&L.  
**Objetivo:** Explicar por qué la beta tester ve costos en $0, no puede “copiar mes anterior” y “Cargar costos” no hace nada, sin proponer código aún.

---

## 1. Resumen ejecutivo

Hay **tres tipos de problemas** que explican los comentarios de la beta tester:

1. **Contexto de mes perdido al navegar** → “Editar costos” muestra siempre el mes actual; si cargó enero, al ir a editar ve febrero en $0.
2. **Dos fuentes de verdad para costos** → Lo que se carga en “Cargar costos” (tabla `monthly_cost_entries`) **no** alimenta el P&L; el P&L usa `cost_settings`. Por eso en Control financiero “siempre aparecen en 0$” en las líneas de costos.
3. **UX del tab y del botón** → “Cargar costos” puede ser el tab en Datos o el botón Guardar; si el tab no se destaca bien o el guardado falla sin feedback claro, parece que “no pasa nada”.

---

## 2. Flujos relevantes (cómo está hoy)

### 2.1 Dónde se cargan y guardan los costos

- **Página:** Datos (`/importar`).
- **Tab:** “Cargar costos” (segundo tab; el primero es “Cargar reportes”).
- **Selector de mes:** Arriba de los tabs; por defecto **mes actual** (`new Date().toISOString().slice(0, 7)`).
- **API de lectura:** `GET /api/costs/:propertyId/monthly/:month` → lee `monthly_cost_entries` + `monthly_cash_balances` para ese mes.
- **API de guardado:** `PUT /api/costs/:propertyId/monthly/:month` → escribe en `monthly_cost_entries` y opcionalmente en `monthly_cash_balances`.
- **Copiar mes anterior:** `POST /api/costs/:propertyId/monthly/:month/copy-previous` → lee costos del mes anterior desde `monthly_cost_entries` y los inserta/actualiza para el mes actual. Si el mes anterior no tiene filas, responde **404** con mensaje tipo “No hay costos en YYYY-MM”.

### 2.2 Dónde se muestran los costos

- **Página:** Control financiero (`/costos`, componente `Costs.tsx`).
- **Selector de mes:** Por defecto también **mes actual**.
- **Datos que usa:**
  - **Desglose “Costos por categoría” y totales del mes:** vienen de `getMonthlyCosts(propertyId, selectedMonth)` → **sí** usa `monthly_cost_entries`.
  - **P&L (Revenue, Comisiones, Costos variables, Costos fijos, Resultado):** vienen de `getReservationEconomics(propertyId, start, end)` → este endpoint usa el **CalculationEngine**, que a su vez usa **solo** `cost_settings` (tabla `cost_settings`), **no** `monthly_cost_entries`.

### 2.3 De dónde sale el P&L (motor de cálculo)

- **CalculationEngine** (`backend/src/services/calculation-engine.ts`):
  - En `init()` carga `database.getCostSettings(propertyId)` → tabla **cost_settings** (fixed_costs, variable_costs, fixed_categories, variable_categories, tax_rules, etc.).
  - No llama a `getMonthlyCosts` ni lee `monthly_cost_entries` en ningún lado.
- **Reservation economics** (resumen y lista por reserva) y por tanto las líneas del P&L en Control financiero se calculan con esos `cost_settings`. Si la usuaria **solo** cargó costos en “Cargar costos” (Datos), eso actualiza solo `monthly_cost_entries`; `cost_settings` puede seguir vacío o con valores viejos → **Costos variables y Costos fijos en el P&L siguen en 0 (o desactualizados)**.

---

## 3. Análisis por comentario de la beta tester

### 3.1 “Al dirigirme a editar costos me aparecen todos los costos en 0$. Lo probé en enero, que es el mes en que los cargué.”

- Los enlaces a “Editar costos” / “Ir a Datos” desde Control financiero y otros sitios apuntan a **`/importar?tab=costos`** y **no llevan el mes** en la URL.
- En la página Import, el estado `selectedMonth` se inicializa con **mes actual** (p. ej. febrero 2026), no con el mes que estaba viendo en Control financiero (p. ej. enero).
- Consecuencia: entra a Datos → tab “Cargar costos” con **febrero** seleccionado. Para febrero no hay nada en `monthly_cost_entries` → el formulario muestra todos los importes en **0**.
- Aunque en enero sí tenga datos cargados, **no hay indicación ni deep-link del mes** al ir a “editar costos”, por lo que la experiencia es confusa (“ya los cargué y me aparecen en 0”).

**Conclusión:** El mes con el que se “edita” no se preserva al navegar desde Control financiero (ni desde ningún otro lado). Siempre se abre el formulario para el mes actual.

---

### 3.2 “En distintos meses, cuando ingresás en Control financiero, siempre aparecen en 0$ y no me permite ‘copiar mes anterior’.”

- **Por qué “siempre 0” en Control financiero:**
  - El selector de mes en Control financiero también arranca en **mes actual**. Si solo cargó enero, al abrir Control financiero ve el mes actual (p. ej. febrero) → no hay entradas para ese mes en `monthly_cost_entries` → el desglose por categoría puede estar vacío o en 0.
  - Además, las **líneas del P&L** (Costos variables, Costos fijos, Resultado) vienen del motor que usa **cost_settings**. Si ahí no hay datos (porque la usuaria solo usa “Cargar costos” y no la configuración legacy), esas líneas serán **0** aunque en “Costos por categoría” (que sí usa `monthly_cost_entries`) pudiera haber algo al cambiar a enero.
- **“No me permite copiar mes anterior”:**
  - El botón **“Copiar mes anterior”** está **solo en Datos → tab “Cargar costos”**, no en la página Control financiero. Si la usuaria busca copiar desde Control financiero, no lo encuentra.
  - Si sí está en Datos y hace clic:
    - La API exige que el **mes anterior** tenga al menos una fila en `monthly_cost_entries`. Si nunca guardó costos para ese mes (o solo usó meses sueltos), el backend responde **404** (“No hay costos en YYYY-MM”) y el front muestra el mensaje de error del `costsCopyFeedback`. No hay otra explicación en UI de “por qué no se puede copiar”.

**Conclusión:** La sensación de “siempre 0” viene de (1) mes por defecto = actual, (2) P&L alimentado por `cost_settings` y no por lo que se carga en “Cargar costos”. “No permite copiar” puede ser no encontrar el botón (está en otra pantalla) o 404 porque el mes anterior no tiene costos guardados.

---

### 3.3 “No me está permitiendo cargar costos de manera personalizada como antes. Cliqueo ‘Cargar costos’ y no sucede nada.”

- **“Cargar costos” puede referirse a:**
  1. **El tab “Cargar costos”** en Datos: al hacer clic debería mostrarse el formulario de costos del mes seleccionado. Si “no sucede nada” podría ser:
     - Que entra por el menú a **“Datos”** (`/importar` sin `tab=costos`) → ve primero “Cargar reportes”. Si no identifica el segundo tab como “Cargar costos” o el tab no cambia bien (estado, estilos, accesibilidad), parece que no pasa nada.
     - Que hay un error de JS o que `property` aún es null y el formulario queda en “Cargando costos…” o en blanco/ceros sin feedback claro.
  2. **El botón “Guardar costos”** dentro del tab: si hace clic en guardar y hay error de red, validación, o el backend devuelve error y el mensaje no se muestra bien (o se pierde), también da la sensación de “no pasa nada”.

- No se encontró en el código que el tab “Cargar costos” esté deshabilitado ni que el clic no actualice `activeTab`; el problema es más plausible por **claridad de UX** (qué es “Cargar costos”, dónde está, qué se espera después) o por **errores no visibles** al guardar.

**Conclusión:** Hay que aclarar si “Cargar costos” es el tab o el guardado, y revisar (1) visibilidad y comportamiento del tab, (2) feedback ante fallos al guardar o al copiar mes anterior.

---

## 4. Dualidad de fuentes de datos (crítico)

| Dónde | Fuente de datos | Tabla / API |
|-------|------------------|-------------|
| Datos → Cargar costos (formulario) | Costos por mes | `monthly_cost_entries`, `monthly_cash_balances` → GET/PUT `/costs/:propertyId/monthly/:month` |
| Control financiero → “Costos por categoría” y totales del mes | Mismo | `getMonthlyCosts` → `monthly_cost_entries` |
| Control financiero → P&L (Costos variables, Costos fijos, Resultado) | Config global por propiedad | `cost_settings` vía CalculationEngine (getCostSettings) |
| Break-even, métricas, otros dashboards | Config global | `cost_settings` (getCostSettings, getTotalMonthlyFixedCosts, getTotalMonthlyVariableCosts) |

- **cost_settings:** modelo “legacy” (fixed_costs, variable_costs, categorías en JSON, etc.). Lo usa el motor de cálculo para reservas y P&L.
- **monthly_cost_entries:** modelo “por mes” que la usuaria usa en “Cargar costos”. No se usa en el CalculationEngine.

Mientras el P&L y el resto de métricas sigan leyendo solo `cost_settings`, **aunque cargue bien los costos en Datos para un mes, el Control financiero seguirá mostrando 0 en las líneas de costos del P&L** a menos que esa misma información esté (o se derive) en `cost_settings`.

---

## 5. Otros puntos revisados

- **Formato de mes:** Backend valida `YYYY-MM`; front y DB usan el mismo formato. No se detectó desfase por timezone en el mes.
- **Categorías:** Vienen del catálogo global `cost_categories`; no dependen de la propiedad. El formulario usa `getCostCategories()` y, si falla, `DEFAULT_CATEGORIES` en el front; no explica por sí solo los 0.
- **RLS / propiedad:** Las políticas de `monthly_cost_entries` y `monthly_cash_balances` atan a `property_id` y usuario; si la propiedad no está bien resuelta, podría haber errores al guardar o al cargar, pero no se vio en el código un manejo específico que haga “silent fail” sin mensaje.
- **Copy previous:** Cálculo de `prevMonth` en el backend es correcto (mes anterior al dado). El 404 es esperado cuando no hay filas para ese mes anterior.

---

## 6. Resumen de hallazgos (para priorizar correcciones)

1. **Mes no persistido al ir a “Editar costos”**  
   Los enlaces a `/importar?tab=costos` no llevan el mes. El formulario siempre se abre para el mes actual → se ven 0 para meses donde sí hay datos.

2. **P&L no usa lo cargado en “Cargar costos”**  
   El motor usa solo `cost_settings`. Todo lo que se guarda en “Cargar costos” va a `monthly_cost_entries` y no alimenta Costos variables / Costos fijos del P&L ni el resultado. Es la causa principal de “siempre 0” en las cifras grandes de Control financiero.

3. **“Copiar mes anterior” solo en Datos**  
   El botón está solo en Datos → Cargar costos. No existe en Control financiero, y si el mes anterior no tiene costos guardados, la API devuelve 404 sin guiar al usuario.

4. **UX de “Cargar costos”**  
   Posible confusión entre el tab y el botón Guardar; posible falta de feedback claro si el guardado o la copia fallan. Conviene verificar en sesión real con la beta tester qué hace exactamente cuando dice “cliqueo Cargar costos”.

5. **Posible refactor futuro**  
   Unificar en un solo modelo (p. ej. que el motor use `monthly_cost_entries` para el período solicitado, o que “Cargar costos” actualice también `cost_settings” para el mes) evitaría la dualidad y la confusión actual.

---

## 7. Archivos clave tocados en la auditoría

- **Front:** `frontend/src/pages/Import.tsx` (tab, mes, loadMonthlyCosts, guardar/copiar), `frontend/src/pages/Costs.tsx` (Control financiero, getMonthlyCosts, getReservationEconomics), enlaces a `/importar?tab=costos` en la app.
- **Backend:** `backend/src/routes/api.ts` (GET/PUT monthly costs, copy-previous), `backend/src/db/supabase-adapter.ts` (getMonthlyCosts, upsertMonthlyCosts, getCostSettings, getTotalMonthlyFixedCosts/Variable), `backend/src/services/calculation-engine.ts` (init con getCostSettings, cálculo de economics sin monthly_cost_entries).
- **DB:** Tablas `monthly_cost_entries`, `monthly_cash_balances`, `cost_categories`; tabla `cost_settings` para el motor.

---

## 8. Correcciones implementadas (post-auditoría)

**Fecha:** 19 Feb 2026

1. **Mes en la URL (Datos):** En Import se lee y persiste el mes con `?month=YYYY-MM`; los enlaces desde Control financiero incluyen el mes seleccionado.
2. **P&L usa costos del mes:** En reservation-economics-service se cargan `monthly_cost_entries` del mes del período y se inyectan como preloadedCostSettings en el CalculationEngine.
3. **Copiar mes anterior:** Mensaje 404 más claro en backend; hint bajo el botón en el front.
4. **Build:** Completo (shared + backend + frontend) pasa.

*Documento de auditoría; sección 8 añadida tras implementar las correcciones.*
