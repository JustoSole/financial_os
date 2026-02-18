# Financial OS - Backend Architecture & Supabase Integration Reference

Este documento detalla la arquitectura del backend de Financial OS, enfocándose en la infraestructura escalable con **Supabase (PostgreSQL)** y los motores de cálculo financiero.

## 1. Arquitectura General

El backend utiliza un patrón de **Adaptador de Base de Datos** que permite alternar entre almacenamiento local (JSON) y almacenamiento en la nube (Supabase) mediante variables de entorno.

### Componentes Clave:
- **Express API (`backend/src/routes/api.ts`):** Rutas REST que exponen los servicios de métricas y gestión de datos.
- **Database Switcher (`backend/src/db/index.ts`):** Lógica que decide qué adaptador usar (`DB_TYPE=supabase`).
- **Supabase Adapter (`backend/src/db/supabase-adapter.ts`):** Implementación de la interfaz de base de datos usando el cliente de Supabase.
- **Calculation Engine (`backend/src/services/calculation-engine.ts`):** Clase centralizada para el procesamiento de datos financieros en memoria para un periodo dado.
- **Command Center Service (`backend/src/services/command-center-service.ts`):** Orquestador que unifica todas las métricas estratégicas.
- **Import Service (`backend/src/services/import-service.ts`):** Servicio unificado para procesar múltiples tipos de reportes de Cloudbeds.

---

## 2. Esquema de Base de Datos (Supabase)

El esquema relacional está optimizado para los reportes de Cloudbeds y el aislamiento multi-inquilino:

| Tabla | Descripción |
| :--- | :--- |
| `properties` | Entidad principal (Hotel). Vinculada a un `user_id` de Auth. |
| `import_files` | Registro de archivos CSV subidos para auditoría. |
| `ledger_transactions` | Datos del *Expanded Transaction Report* (Caja y flujo). Incluye `room_type` para segmentación por tipo de habitación. |
| `reservation_financials` | Datos del *Reservations with Financials* (P&L, cobranzas y mix de canales). |
| `cost_settings` | Configuración de costos V4 (Flexible Categories en `JSONB`). |
| `action_completions` | Tracking de pasos completados en recomendaciones. |

---

## 3. Motores de Cálculo (Services)

### Command Center Engine
El servicio unificado responde a las 40 preguntas clave mediante:
- **Health Snapshot**: Estado neto, tendencias y alertas críticas.
- **Break-even Analysis**: Cálculo dinámico del punto de equilibrio basado en costos fijos y margen de contribución.
- **Unit Economics**: Desglose de rentabilidad por noche (ADR vs CPOR).
- **Channel Economics**: Análisis de dependencia de OTAs y profit neto por canal.
- **Cash Reconciliation**: Comparativa entre lo cargado en el PMS y lo efectivamente cobrado.

### Reservation Economics Service
Genera un P&L detallado para cada reserva individual:
- **Memoria de Cálculo**: Expone cada paso del cálculo (Revenue - Comisiones - Costos Variables - Costos Fijos).
- **AI Insights**: Explicaciones textuales automáticas sobre la rentabilidad de la reserva.
- **Confidence Badges**: Clasificación de datos como `Real` o `Estimado`.

### Segmentación por Tipo de Habitación (Room Type)
El sistema soporta análisis segmentado por tipo de habitación:
- **Fuente de Datos**: `room_type` se extrae del CSV de Transactions (columna "Room Type") con alta cobertura.
- **Normalización**: Función `normalizeRoomType()` limpia y valida valores, detectando basura y valores vacíos.
- **Filtrado en CalculationEngine**: Las reservaciones se filtran automáticamente basándose en las transacciones del `roomType` especificado.
- **Endpoints con Filtro**: Los endpoints de métricas aceptan parámetro opcional `?roomType=` para análisis segmentado.
- **Compatibilidad**: Si no se especifica `roomType`, el comportamiento es idéntico al anterior (sin filtro).

**Migración Requerida**: Ejecutar `backend/migrations/add_room_type_to_ledger_transactions.sql` para agregar la columna `room_type` a `ledger_transactions`.

---

## 4. Seguridad y Aislamiento

- **Supabase Auth**: Integración con JWT para autenticación de rutas.
- **Row Level Security (RLS)**: Políticas en PostgreSQL que garantizan que un usuario solo acceda a los datos de sus propias propiedades.
- **Data Health Score**: Algoritmo que evalúa la calidad y cobertura de los datos importados antes de generar métricas.

---

## 5. Configuración del Entorno (`.env`)

Para activar la conexión con Supabase:

```bash
DB_TYPE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Si `DB_TYPE` no es `supabase`, el sistema vuelve automáticamente al modo **JSON Local** (`backend/data/financial_os.json`).

---

## 6. Endpoints de la API

### Gestión de Datos
- `POST /api/import/batch`: Carga masiva de reportes.
- `GET /api/data-health/:propertyId`: Evaluación de calidad de datos.

### Inteligencia de Negocio
- `GET /api/metrics/:propertyId/command-center`: Dashboard estratégico unificado.
- `GET /api/metrics/:propertyId/reservation-economics/:resNumber`: P&L detallado de reserva.
- `GET /api/metrics/:propertyId/trends`: Evolución histórica de KPIs.
- `GET /api/metrics/:propertyId/projection`: Proyección de ingresos On-the-books.

### Segmentación y Filtros
- `GET /api/meta/:propertyId/room-types`: Lista de tipos de habitación disponibles con count y share.
- `GET /api/metrics/:propertyId/structure?roomType=`: Métricas de estructura filtradas por tipo de habitación.
- `GET /api/metrics/:propertyId/reservation-economics?roomType=`: Análisis de rentabilidad filtrado por tipo de habitación.

---

## 7. Integración de Room Type

### Pipeline de Datos
1. **Parseo CSV**: El parser extrae la columna "Room Type" del Expanded Transaction Report.
2. **Normalización**: `normalizeRoomType()` aplica reglas de limpieza (trim, detección de basura, sanitización).
3. **Persistencia**: Se guarda en `ledger_transactions.room_type` (TEXT NULL).
4. **Filtrado**: `CalculationEngine` filtra transacciones y reservaciones por `roomType` cuando se especifica en opciones.

### Uso en Cálculos
Cuando se especifica `roomType` en `CalculationEngineOptions`:
- Las transacciones se filtran directamente por `room_type` en la consulta a la base de datos.
- Las reservaciones se filtran indirectamente: solo se incluyen aquellas cuyo `reservation_number` aparece en transacciones del `roomType` especificado.
- Todas las métricas (Structure, Reservation Economics, etc.) se calculan sobre el conjunto filtrado.

### Componentes Modificados
- `backend/src/parsers/csv-parser.ts`: Mapeo de columnas y función de normalización.
- `backend/src/parsers/index.ts`: Extracción de `roomType` en `parseTransactions()`.
- `backend/src/db/supabase-adapter.ts`: Filtrado opcional en `getTransactionsByProperty()`.
- `backend/src/services/calculation-engine.ts`: Soporte de `roomType` en opciones y filtrado de reservaciones.
- `backend/src/routes/api.ts`: Endpoints meta y filtros opcionales.
- `frontend/src/pages/Profitability.tsx`: Selector de roomType en la UI.

---
*Documentación actualizada: 28 de Enero, 2026.*
