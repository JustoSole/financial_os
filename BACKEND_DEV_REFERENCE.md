# Financial OS - Backend Architecture & Supabase Integration Reference

Arquitectura del backend de Financial OS: infraestructura con **Supabase (PostgreSQL)** y motores de cálculo financiero.

## 1. Arquitectura General

Patrón de **Adaptador de Base de Datos** con Supabase como almacenamiento principal.

### Componentes Clave:
- **Express API (`backend/src/routes/api.ts`):** Rutas REST.
- **Database Adapter (`backend/src/db/supabase-adapter.ts`):** Implementación de la interfaz de DB.
- **Calculation Engine (`backend/src/services/calculation-engine.ts`):** Procesamiento de datos financieros en memoria.
- **Import Service (`backend/src/services/import-service.ts`):** Procesamiento de reportes CSV de Cloudbeds.

---

## 2. Esquema de Base de Datos (Supabase)

| Tabla | Descripción |
| :--- | :--- |
| `properties` | Hotel. Vinculada a `user_id` de Auth. |
| `import_files` | Registro de archivos CSV subidos. |
| `ledger_transactions` | Expanded Transaction Report (Caja y flujo). |
| `reservation_financials` | Reservations with Financials (P&L, cobranzas, canales). |
| `cost_settings` | Configuración legacy de costos (JSONB). |
| `action_completions` | Tracking de pasos completados en recomendaciones. |
| `cost_categories` | Catálogo de categorías de costos (fijos y variables). |
| `monthly_cost_entries` | Costos cargados por mes y categoría. |
| `monthly_cash_balances` | Saldo de caja por mes. |
| `import_jobs` | Tracking detallado de importaciones con cobertura. |
| `reservation_daily_snapshots` | Snapshots diarios para pacing histórico. |

### Migraciones

Las migraciones SQL están en `supabase/migrations/` y se aplican con Supabase MCP o `supabase db push`. Incluyen:
- Esquema inicial (`20260123134500_initial_schema_v1.sql`)
- Snapshots de reservas (`20260215123000_create_reservation_daily_snapshots.sql`)
- **Costos por mes** (`20260218100000_monthly_close_and_costs.sql`): crea `cost_categories` (con seed), `monthly_cost_entries`, `monthly_cash_balances`, `import_jobs`. La tabla `monthly_periods` fue eliminada en `20260218180000_drop_monthly_periods.sql`.

> **Nota:** Las tablas principales (`properties`, `ledger_transactions`, etc.) tienen RLS deshabilitado. Las tablas de costos mensuales también tienen RLS deshabilitado para mantener consistencia (el backend usa `anon key`).

---

## 3. Motores de Cálculo (Services)

### Calculation Engine
Núcleo de cálculos financieros (métricas, rentabilidad, proyecciones):
- Auto-detección de rango de datos con fallback a histórico.
- Prorrateo de reservaciones por período.
- Cálculo de KPIs, comparativas y agregaciones.

### Reservation Economics Service
P&L detallado por reserva con memoria de cálculo.

---

## 4. Endpoints de la API (resumen)

### Gestión de Datos
- `POST /api/import/batch`: Carga masiva de reportes CSV.
- `GET /api/import/jobs/:propertyId`: Historial de importaciones con filtro por mes.
- `GET /api/data-health/:propertyId`: Evaluación de calidad de datos.

### Costos mensuales
- `GET /api/costs/:propertyId/monthly/:month`: Costos del mes (read).
- `PUT /api/costs/:propertyId/monthly/:month`: Guardar costos del mes.
- `POST /api/costs/:propertyId/monthly/:month/copy-previous`: Copiar mes anterior.
- `GET /api/costs/:propertyId/categories`: Catálogo de categorías.

> Todos los endpoints `:month` validan formato `YYYY-MM` y devuelven 400 si es inválido.

### Métricas
- `GET /api/metrics/:propertyId/command-center`: Dashboard estratégico.
- `GET /api/metrics/:propertyId/reservation-economics`: P&L por reserva.
- `GET /api/metrics/:propertyId/trends`: Tendencias históricas.
- `GET /api/metrics/:propertyId/projections`: Proyecciones OTB.

---

## 5. Configuración del Entorno

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
# Opcional (bypasea RLS):
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

*Documentación actualizada: 18 de Febrero, 2026.*
