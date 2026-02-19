# Cómo testear el módulo de costos

Guía paso a paso para verificar que las correcciones del módulo de costos funcionan bien.

---

## Antes de empezar

1. **Levantá el proyecto**
   ```bash
   npm run dev
   ```
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001 (o el que uses)

2. **Entrá con un usuario que tenga una propiedad** (login normal de la app).

---

## 1. Mes al ir a “Editar costos”

**Objetivo:** Que al ir a editar costos desde Control financiero se abra el **mismo mes** que estabas viendo, no el mes actual.

1. Entrá a **Control financiero** (menú lateral → “Control Financiero” o `/costos`).
2. En el selector **“Período”**, elegí un mes distinto al actual (ej. **Enero 2026**).
3. Hacé clic en **“Editar en Datos”** (arriba a la derecha) o en **“Ir a Datos”** si no hay datos.
4. **Verificá:**
   - Te lleva a la página **Datos** con el tab **“Cargar costos”** abierto.
   - El **selector de mes** arriba muestra **el mismo mes** que habías elegido (ej. Enero 2026).
   - La URL debe tener algo como: `.../importar?tab=costos&month=2026-01`.

**Si falla:** Verificá que los links en Control financiero incluyan `month=...` en la URL y que en Import se lea ese parámetro.

---

## 2. Cargar y ver costos en el mes correcto

**Objetivo:** Que los costos que cargás se guarden por mes y se muestren cuando volvés a ese mes.

1. En **Datos** → tab **“Cargar costos”**, dejá el mes en **Enero 2026** (o el que uses).
2. Completá algunos importes (ej. Sueldos 100000, Alquiler 80000, Lavandería 15000).
3. Clic en **“Guardar costos”**.
4. **Verificá:** Mensaje de éxito (“Costos guardados”).
5. Cambiá el selector de mes a **Febrero 2026**.
6. **Verificá:** Los campos aparecen en **0** (porque febrero aún no tiene datos).
7. Volvé a elegir **Enero 2026** en el selector.
8. **Verificá:** Los valores que habías guardado (100000, 80000, 15000) **vuelven a aparecer**.

**Si falla:** Revisá que al cambiar el mes se llame a la API con ese mes y que el estado/URL se actualice.

---

## 3. P&L usa los costos cargados (Control financiero)

**Objetivo:** Que en Control financiero las líneas “Costos variables” y “Costos fijos” del P&L muestren los importes que cargaste para ese mes, no siempre 0.

1. Con costos guardados para **Enero 2026** (como en el punto 2), andá a **Control financiero**.
2. En el selector **“Período”** elegí **Enero 2026**.
3. **Verificá:**
   - Si hay reservas/revenue para ese mes: en el **Estado de resultados**, las líneas **“Costos variables”** y **“Costos fijos”** muestran números (no 0) y el **“Resultado operativo”** se calcula con esos costos.
   - Si no hay reservas: el bloque “Costos por categoría” debe mostrar los importes que cargaste para enero.
4. Cambiá el período a **Febrero 2026** (sin haber cargado costos para febrero).
5. **Verificá:** Costos en 0 o solo el desglose vacío, según si hay revenue o no.

**Si falla:** Revisá en backend que `reservation-economics-service` use `monthly_cost_entries` para ese mes y los inyecte como `preloadedCostSettings`.

---

## 4. Copiar mes anterior

**Objetivo:** Poder copiar los costos del mes anterior y ver un mensaje claro si ese mes no tiene datos.

**Caso A – Mes anterior con datos**

1. En **Datos** → **Cargar costos**, elegí **Febrero 2026** (teniendo ya costos en Enero 2026).
2. Clic en **“Copiar mes anterior”**.
3. **Verificá:** Los campos se completan con los mismos valores que tenías en enero y aparece mensaje de éxito (“Costos copiados del mes anterior”).
4. Opcional: **Guardar costos** y luego en Control financiero elegir Febrero y comprobar que el P&L usa esos números.

**Caso B – Mes anterior sin datos**

1. Elegí un mes cuyo **mes anterior** no tenga costos cargados (ej. si marzo tiene datos pero febrero no, usá **Marzo** y “Copiar mes anterior”).
2. Clic en **“Copiar mes anterior”**.
3. **Verificá:** Aparece un **mensaje de error** claro, tipo: “No hay costos cargados para 2026-02. Cargá y guardá primero los costos de ese mes en Datos → Cargar costos.”
4. **Verificá:** Debajo del botón se ve el **hint**: “Copia los costos del mes anterior. Si ese mes no tiene datos, cargalos y guardalos primero.”

**Si falla:** Revisá el 404 del backend y que el front muestre `res.error` en el Alert.

---

## 5. URL y pestaña

**Objetivo:** Que el mes y el tab queden en la URL y que al refrescar o compartir el link se mantenga el contexto.

1. En **Datos**, abrí el tab **“Cargar costos”** y elegí **Marzo 2026**.
2. **Verificá** que la URL sea algo como: `.../importar?tab=costos&month=2026-03`.
3. **Refrescá** la página (F5).
4. **Verificá:** Sigue en tab “Cargar costos” y mes Marzo 2026.
5. Pegá en otra pestaña la misma URL.
6. **Verificá:** Se abre Directo en “Cargar costos” y en el mes de la URL.

**Si falla:** Revisá en Import el `useEffect` que sincroniza `selectedMonth` y `activeTab` desde `searchParams`, y que los botones de tabs y el selector de mes actualicen la URL.

---

## 6. Tests automáticos (opcional)

```bash
# Frontend
npm run test --workspace=frontend

# Backend (puede fallar el test de cache TTL; es preexistente)
npm run test --workspace=backend

# Build completo
npm run build
```

Si el build pasa y los tests de frontend pasan, la base está bien; el test que suele fallar es el de cache en backend y no está relacionado con costos.

---

## Checklist rápido

- [ ] Desde Control financiero (mes X) → “Editar en Datos” → se abre Datos con **mes X** y tab costos.
- [ ] Cargar costos en un mes → guardar → cambiar a otro mes → volver al primero → **se ven los valores guardados**.
- [ ] En Control financiero, para un mes con costos cargados, el **P&L muestra** esos costos (no 0).
- [ ] “Copiar mes anterior” con mes anterior con datos → **se copian**.
- [ ] “Copiar mes anterior” con mes anterior sin datos → **mensaje claro** de error + hint visible.
- [ ] URL con `?tab=costos&month=YYYY-MM` → al refrescar o abrir en nueva pestaña **se mantiene** tab y mes.

Si todos los ítems se cumplen, el módulo de costos quedó bien testeado.
