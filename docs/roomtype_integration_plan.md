# Plan de integración de `roomType` (fuente: Transactions) + normalización “excelente”

## Contexto y motivación
Hoy el sistema calcula métricas (rentabilidad, canales, trends, mínimo precio, etc.) a partir de:
- `reservation_financials` (import de **Reservations with Financials**)
- `ledger_transactions` (import de **Expanded Transaction Report with Details**)

En `sample-data/` ya existe data de tipo de habitación:
- **Transactions**: columna **`Room Type`** (alta cobertura, baja tasa de vacíos).
- **Reservations**: columna **`Room Types`** (cobertura baja y puede venir con múltiples tipos).

Para pricing/segmentación (y para la UX propuesta en `docs/pricing_strategy_redesign.md`), `roomType` es una dimensión clave para:
- entender ADR / Rev/Night / profit por segmento,
- aplicar reglas por canal/LOS/DOW/lead time **por segmento** (sin llegar a un RM engine),
- mejorar explicación (“evidencia”) y confianza (“trust layer”).

**Decisión central del plan**: *integrar `roomType` leyendo primero desde Transactions* (por calidad), y usar Reservations solo como fallback / raw reference.

---

## Objetivo (MVS) y definición de éxito
### Objetivo MVS
1) Guardar `roomType` a nivel de transacción (`ledger_transactions`) desde el CSV.  
2) Exponer `roomType` como dimensión para breakdowns y filtros en al menos una vista de rentabilidad/pricing.

### Definición de éxito
- `ledger_transactions.room_type` poblado para la mayoría de transacciones relevantes (room rate/charges).
- Endpoints pueden devolver:
  - lista de roomTypes disponibles,
  - métricas agregadas por roomType,
  - filtros opcionales por roomType (sin romper respuestas previas).
- UX: el usuario puede ver **“Piso / reglas / evidencia”** segmentado por tipo de habitación cuando aplique.

---

## Estado actual del pipeline (dónde se engancha)
### Import y parseo
- El import usa `backend/src/services/import-service.ts`:
  - `parseCSV(content)` (papaparse) → `data: Record<string,string>[]`
  - `parseTransactions(data, propertyId, fileId)` o `parseReservations(...)`
  - DB insert vía `database.insertTransactions()` / `insertReservations()`

### Transform “rows → DB model”
La capa correcta para enganchar `roomType` (sin duplicar lógica) es:
- `backend/src/parsers/index.ts`
  - `parseTransactions(...)` (para `ledger_transactions`)
  - `parseReservations(...)` (para `reservation_financials`)

### Persistencia
La persistencia a Supabase se arma en:
- `backend/src/db/supabase-adapter.ts`
  - `insertTransactions(...)` formatea columnas hacia `ledger_transactions`
  - `insertReservations(...)` formatea hacia `reservation_financials`

---

## Diseño de datos propuesto
### 1) `ledger_transactions` (P0)
Agregar columna:
- `room_type TEXT NULL`

**Por qué acá**:
- `Room Type` en Transactions tiene alta cobertura.
- Transactions es el “source of truth” operativo (room charges/pagos).
- Permite breakdown por roomType sin depender del reporte de reservas.

**Índices recomendados** (si el volumen crece):
- `(property_id, room_type)` para queries de breakdown.
- Opcional: `(property_id, reservation_number)` ya se usa para joins conceptuales.

### 2) `reservation_financials` (P1 opcional)

Opciones (de mejor a peor, según simplicidad/calidad):

**Opción A (recomendada)**: agregar `room_type TEXT NULL` derivado **desde transacciones** (enrichment).  
- Pros: consistente con P0, alta cobertura, estable.  
- Contras: requiere proceso de “enrichment/backfill”.

**Opción B (raw)**: agregar `room_types_raw TEXT NULL` desde `Room Types` del CSV de reservas.  
- Pros: cero joins, refleja export original.  
- Contras: baja cobertura y puede venir “multi” + valores corruptos si el CSV está sucio.

**Opción C (modelo “correcto” pero más pesado)**: `room_types JSONB` (array) + `room_type_primary TEXT`.  
- Pros: conserva multi-type real.  
- Contras: más complejidad en DB/queries/UX para el MVS.

> Recomendación: **P0 = solo Transactions**. En P1 sumar **Opción A** (room_type enriquecido) y opcionalmente `room_types_raw` para auditoría.

---

## Normalización: estándar canónico de `roomType`
### Principios
La normalización debe:
- Ser **determinística**: mismo input → mismo output.
- Ser **segura**: nunca inventar un tipo si la evidencia es dudosa.
- Ser **audit-able**: conservar opcionalmente `room_type_raw` en logs (o solo en memoria durante import).
- Ser **tolerante a basura**: `-`, vacío, strings con notas, etc. → `null`.

### Contrato de salida
Definimos:
- `roomTypeRaw: string | null` (valor original del CSV, trim)
- `roomTypeNormalized: string | null` (canónico)
- `roomTypeKey: string | null` (slug/clave estable para agrupar, opcional)

**Formato recomendado**:
- `roomTypeNormalized`: mantener el valor del PMS si ya viene consistente (ej. `"SINGLE/DOBLE STANDARD"`) para minimizar sorpresas.
- `roomTypeKey`: `SINGLE_DOBLE_STANDARD`, `TINY_HOUSE`, etc. (útil si después querés alias/merge).

### Reglas de normalización (propuesta)
Dado un input `v`:
1) `trim()` + colapsar whitespace.
2) Si `v` es vacío o `v` en `{ '-', '—', 'N/A', 'NA' }` → `null`.
3) Sanitizar separadores y espacios:
   - colapsar múltiples espacios
   - colapsar espacios alrededor de `/` y `,`
4) **Detección de “basura”** (crítico para `Room Types` de reservas):
   - si contiene señales de notas: `dni`, `abonado`, `fc`, `$`, `%`, `vto`, `transfer`, `pago`, `pagado`, etc. → `null`
   - si longitud > 80 chars → `null` (heurística)
5) Alias mapping (solo si se confirma por datos reales):
   - Ej: `"SGL MAT"` → `"SINGLE/DOBLE STANDARD"` (si se confirma)
6) Multi-room (solo en Reservations, `Room Types`):
   - parseo `split(',')` → lista
   - normalizar cada item con el mismo pipeline
   - output opcional: `roomTypesNormalized: string[]` y `roomTypePrimary`.

### Pseudocódigo (orientativo)

```ts
type RoomTypeNorm = {
  raw: string | null;
  normalized: string | null;
  key: string | null;
  reasons?: string[];
};

function normalizeRoomType(input: unknown): RoomTypeNorm {
  const raw0 = (input ?? '').toString();
  const raw = raw0.trim();
  if (!raw) return { raw: null, normalized: null, key: null };

  const v = raw.replace(/\s+/g, ' ').trim();
  const lower = v.toLowerCase();

  const emptyTokens = new Set(['-', '—', 'n/a', 'na']);
  if (emptyTokens.has(lower)) return { raw: v, normalized: null, key: null };

  const garbageHints = [
    'dni', 'abonado', 'fc', '$', '%', 'vto', 'transfer', 'pago', 'pagado', 'ok',
    'agencia', 'factura'
  ];
  if (v.length > 80 || garbageHints.some(h => lower.includes(h))) {
    return { raw: v, normalized: null, key: null, reasons: ['garbage_detected'] };
  }

  const aliases: Record<string, string> = {
    // 'sgl mat': 'SINGLE/DOBLE STANDARD',
  };
  const aliased = aliases[lower] || v;

  const normalized = aliased.replace(/\s*\/\s*/g, '/').replace(/\s*,\s*/g, ', ').trim();
  const key = normalized
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  return { raw: v, normalized, key: key || null };
}
```

> Nota: el alias mapping debe ser *data-driven* (se alimenta mirando frecuencias reales) para no “inventar” equivalencias.

---

## Cambios en parsers (ingesta)
### 1) Column mapping (Cloudbeds headers)
Agregar soporte en `backend/src/parsers/csv-parser.ts` (`COLUMN_MAPPINGS`) para:
- `room_type` (transactions): `['room type', 'tipo de habitacion', 'roomtype', ...]`
- `room_types` (reservations): `['room types', 'tipos de habitacion', ...]`

### 2) Parse a DB model (wrapper)
En `backend/src/parsers/index.ts`:
- en `parseTransactions(...)`:
  - `const roomTypeCol = findColumn(headers, 'room_type');`
  - `roomType = normalizeRoomType(row[roomTypeCol]).normalized`
  - setear `roomType` en el objeto a insertar.
- en `parseReservations(...)` (solo si implementamos P1 raw):
  - `const roomTypesCol = findColumn(headers, 'room_types');`
  - setear `roomTypesRaw` o `roomTypePrimary` con el pipeline multi.

### 3) Persistencia a Supabase
En `backend/src/db/supabase-adapter.ts`:
- mapear `roomType` hacia `room_type` en `ledger_transactions`.
- si se implementa P1, mapear a `reservation_financials`.

---

## Enrichment: `roomType` por reserva (derivado desde Transactions)
### Problema
- `reservation_financials` es el dataset que usa gran parte del engine para reservas (LOS, lead time, etc.).
- Pero `Room Types` en Reservations viene incompleto y puede tener basura.

### Solución (P1 recomendado)
Derivar `roomType` por `reservation_number` desde Transactions:
1) Agrupar transacciones por `reservation_number`.
2) Filtrar transacciones relevantes para “tipo de habitación”:
   - preferir cargos de habitación (ej. `description` contiene `"Room rate"`), si está disponible.
   - fallback: cualquier txn con `room_type` no nulo.
3) Elegir `roomType` final:
   - **modo** por cantidad de transacciones; si empatan, usar el de **mayor monto** acumulado.
4) Persistir:
   - update a `reservation_financials.room_type` (si agregamos la columna)
   - o crear tabla `reservation_room_type` (si preferís no tocar el raw).

### Reglas anti-sorpresa
- Si no hay `reservation_number` → no se enriquece.
- Si hay múltiples `room_type` sin claro ganador → `null` y `confidence=low` (o warning).

---

## API / métricas: cómo exponer `roomType` sin romper contratos
### Endpoints nuevos (recomendados)
1) `GET /api/meta/:propertyId/room-types`
   - devuelve `[{ roomType, count, share }]` (basado en `ledger_transactions.room_type` en un período)

2) `GET /api/metrics/:propertyId/structure?groupBy=roomType`
   - retorna breakdowns de ADR/Rev/Night/profit proxy por roomType

### Filtros opcionales (compatibles hacia atrás)
Agregar query param:
- `roomType=<normalized value>` a endpoints clave (rentabilidad/trends/reservation economics)

**Regla**: si no se pasa `roomType`, comportamiento actual idéntico.

---

## Frontend: UX mínima (alineada con estrategia de pricing)
### Dónde aparece primero
Recomendación: `/rentabilidad` → “Estrategia de Pricing” (según `docs/pricing_strategy_redesign.md`)
- Selector **Room Type** (Todos + top room types).
- En “Piso Financiero”:
  - break-even / min price **por roomType** (si hay datos suficientes)
  - si no hay suficiente data: fallback a global + badge “insuficiente data por tipo”.

### Evidencia (“por qué”)
Sumar evidencia segmentada:
- ADR neto / profit por noche por roomType
- peor canal para ese roomType

---

## Confianza / Data Health
Checks específicos:
- “Transactions tienen `room_type` presente en ≥ X% de room charges” → confianza alta.
- Si está por debajo: recomendar re-export del reporte (sin editarlo).

---

## Rollout seguro (sin romper imports)
### Fase 0 (infra)
- Migración Supabase: agregar `room_type` a `ledger_transactions`.
- Deploy backend con cambios “write-only”.

### Fase 1 (read path + meta)
- Endpoint `room-types` + breakdown simple.
- UI: dropdown + tabla simple por roomType (top 4 + Otros).

### Fase 2 (enrichment reservas)
- Backfill por property (batch + idempotente).
- UI: habilitar segmentación por roomType en vistas basadas en reservas.

### Fase 3 (pricing por roomType)
- Mínimo precio por roomType + reglas por segmento (canal/LOS/DOW/lead time).

---

## QA / validación con `sample-data/`
Checklist:
- `Room Type` se detecta y persiste para:
  - `SINGLE/DOBLE STANDARD`, `DOBLE/TRIPLE STANDARD`, `TRIPLE/CUADRUPLE STANDARD`, `TINY HOUSE`
- `Room Types` en Reservations:
  - multi-type `A, B` parsea a lista
  - strings basura (notas) → `null`

---

## Riesgos conocidos y mitigaciones
- **CSV sucio en Reservations**: mitigado al depender de Transactions para la señal principal.
- **Inconsistencias de nombres**: mitigado con normalización + alias mapping controlado.
- **Volumen**: índices y paginación; cardinalidad de roomType suele ser baja.
- **Backfill**: por lotes e idempotente (update solo si cambia).

