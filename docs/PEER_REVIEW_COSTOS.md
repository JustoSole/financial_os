# Peer review: implementación módulo de costos

**Fecha:** 19 Feb 2026  
**Alcance:** Cambios post-auditoría (mes en URL, P&L desde monthly_cost_entries, copiar mes anterior, UX).

---

## 1. Resumen

Se revisó la implementación en frontend (Import, Costs, CSS) y backend (reservation-economics-service, api routes). La lógica es correcta y alineada con la auditoría. Se aplicó una mejora menor (documentación de costos extraordinarios) y se dejaron documentadas observaciones y recomendaciones.

---

## 2. Frontend

### 2.1 Import.tsx

**Qué hace bien**
- `parseMonthFromSearchParams`: valida `YYYY-MM` con regex; si falta o es inválido usa mes actual. Evita meses inválidos (ej. 2024-13).
- Inicialización de `selectedMonth` y `activeTab` desde URL en el primer render.
- El selector de mes actualiza la URL con `setSearchParams(..., { replace: true })`, así no se llena el historial en cada cambio.
- Al abrir el tab "Cargar costos" se añade `month` a la URL solo si no existe (`if (!next.has('month'))`), respetando un mes ya presente.
- El `useEffect` que sincroniza desde la URL usa `searchParams.get('month')` y `searchParams.get('tab')` en las dependencias, de modo que solo reacciona a cambios reales de mes/tab y no a otras partes del query string.

**Observaciones**
- El efecto de sincronización se ejecuta también en el primer mount y vuelve a hacer `setSelectedMonth` y, si aplica, `setActiveTab`. Los valores ya vienen del inicializador de `useState`, así que es redundante pero no incorrecto; a lo sumo un render extra.
- Si en el futuro se añaden más query params, conviene seguir actualizando la URL con `new URLSearchParams(prev)` para no pisarlos.

**Conclusión:** Sin cambios necesarios; comportamiento correcto.

### 2.2 Costs.tsx

**Qué hace bien**
- Todos los enlaces a "Editar costos" / "Ir a Datos" usan `` `/importar?tab=costos&month=${selectedMonth}` ``, de modo que al volver de Control financiero se abre el mismo mes en Datos.
- `selectedMonth` está en el array de dependencias del `useMemo` de recomendaciones, así que los links de las recomendaciones llevan el mes actual.

**Conclusión:** Correcto.

### 2.3 Import.module.css

**Qué hace bien**
- `.costosDelMesActionsCopy` y `.costosCopyHint` dan estructura y legibilidad al bloque "Copiar mes anterior" + hint.

**Conclusión:** Correcto.

---

## 3. Backend

### 3.1 reservation-economics-service.ts

**Qué hace bien**
- `buildCostSettingsForMonth`: agrega solo entradas `fixed` y `variable`; si no hay entradas o no hay `cost_settings` devuelve `null` y el motor sigue con la config legacy.
- El `cost_settings` sintético mantiene `room_count`, `tax_rules`, `channel_commissions` y el resto de `settings`; solo se reemplazan `fixed_costs`, `variable_categories` y `variable_costs`, que es lo que el motor usa para el P&L.
- Uso de `variable_categories: [{ categoryKey: 'aggregate', monthlyAmount: variableTotal }]`: el calculation-engine solo suma `monthlyAmount`, así que un único elemento agregado es suficiente.
- En `calculateReservationEconomicsSummary` se hace merge con `options` cuando hay `preloadedCostSettings` (`...(options ?? {})`), de modo que opciones como `disableFallback` se respetan.
- La clave de caché incluye `startStr` y `endStr`, así que distintos meses no comparten caché. Al guardar costos, el PUT llama a `cacheService.clear()`, por lo que los datos se actualizan bien.

**Mejora aplicada**
- Se documentó en comentario que los costos de tipo `extraordinary` en `monthly_cost_entries` no se incluyen en los totales del P&L (comportamiento aceptado por ahora; se puede extender después si el producto lo requiere).

**Observación**
- `getReservationEconomicsList` no recibe `CalculationEngineOptions`; cuando no hay `preloadedCostSettings` se pasa `{}`. Si en el futuro se añade un parámetro `options` a esta función, habría que pasarlo ahí para mantener paridad con el summary.

**Conclusión:** Lógica correcta; solo añadida documentación.

### 3.2 api.ts (routes)

**Qué hace bien**
- El mensaje 404 de "copiar mes anterior" es claro y orienta a cargar primero el mes anterior en Datos → Cargar costos.

**Conclusión:** Correcto.

---

## 4. Contrato API y flujo de datos

- **GET /costs/:propertyId/monthly/:month:** Sigue devolviendo `entries`, `cashBalance`, `categories`. El frontend ya mapea `entries` por `categoryKey` y `costType`; no hay cambio de contrato.
- **Reservation economics:** El front pide por `startDate` y `endDate` (rango del mes). El backend deriva el mes con `startStr.slice(0, 7)` y usa ese mes para `getMonthlyCosts`. Para Control financiero el rango es siempre 1–N del mismo mes, así que el mes derivado es el correcto.
- **Caché:** Al hacer PUT en monthly costs o POST copy-previous se llama a `cacheService.clear()`, por lo que la próxima petición de reservation-economics recalcula con los costos actualizados.

---

## 5. Edge cases revisados

| Caso | Comportamiento |
|------|----------------|
| URL con `month` inválido (ej. 2024-13) | `parseMonthFromSearchParams` no matchea el regex y devuelve mes actual. |
| Entradas mensuales con solo 0 | `buildCostSettingsForMonth` sigue devolviendo merged settings con totales 0; el P&L muestra 0 para ese mes. Correcto. |
| `getCostSettings(propertyId)` devuelve null | `buildCostSettingsForMonth` devuelve null y se usa config legacy. Correcto. |
| Período que cruza dos meses | En Control financiero el front siempre envía inicio/fin del mismo mes; el backend usa el mes de `startStr`. Correcto. |
| Copiar mes anterior con mes anterior sin datos | 404 con mensaje claro; el front muestra `res.error` vía `useAsyncActionFeedback`. Correcto. |

---

## 6. Recomendaciones futuras (no bloqueantes)

1. **Costos extraordinarios:** Si más adelante el P&L debe incluir `extraordinary` de `monthly_cost_entries`, en `buildCostSettingsForMonth` se puede sumar ese tipo e incorporarlo (por ejemplo en `fixed_costs.other` o en un campo dedicado según el modelo).
2. **Opciones en getReservationEconomicsList:** Si se expone algo tipo `disableFallback` también para el listado, añadir un parámetro `options` y pasarlo al `CalculationEngine` cuando no haya `preloadedCostSettings`.
3. **Accesibilidad:** El selector de mes en Import no tiene `aria-label`; el de Costs sí (`aria-label="Seleccionar mes para el control financiero"`). Opcional: añadir uno en Import, por ejemplo "Seleccionar mes para cargar reportes y costos".

---

## 7. Verificación

- Build: `npm run build` (shared + backend + frontend) correcto.
- Linter: sin errores en los archivos modificados.
- Tests: los tests de frontend pasan; el único fallo es el test preexistente de cache TTL en backend.

---

## 8. Conclusión

La implementación cumple los objetivos de la auditoría, el flujo de datos y la API son coherentes, y los edge cases revisados están bien resueltos. Cambio aplicado en esta revisión: documentar en backend que los costos `extraordinary` no se incluyen en el P&L. El resto se deja como está; no se detectaron bugs ni incoherencias que exijan más cambios para considerarlo listo.
