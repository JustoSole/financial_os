# Developer Docs Hub

Documentación de referencia para desarrollar en `financial_os_cloudbeds`.

## Objetivo

- Acelerar onboarding técnico de backend y frontend.
- Definir una guía estable para implementar cambios de forma segura.
- Servir como contexto confiable para asistentes LLM.

## Documentos recomendados (orden de lectura)

1. `docs/README_DEVELOPERS.md` (este archivo)
2. `docs/DEVELOPER_REFERENCE_BACKEND.md`
3. `docs/DEVELOPER_REFERENCE_FRONTEND.md`

## Mapa rápido de documentación

- `BACKEND_DEV_REFERENCE.md` (raíz): Arquitectura backend, esquema de DB y endpoints.
- `docs/TESTING.md`: Tests y escenarios de validación.
- Plan de costos mensuales: ver migraciones `20260218100000_monthly_close_and_costs.sql` y documentación en BACKEND_DEV_REFERENCE.

## Arquitectura del repositorio

```
backend/    → API Express, parsing CSV, cálculos, integración Supabase.
frontend/   → SPA React + Vite, páginas de negocio, cliente API.
shared/     → Tipos TypeScript compartidos entre frontend y backend.
supabase/   → Migraciones SQL para el esquema de datos.
docs/       → Documentación técnica y de implementación.
```

## Flujo funcional del producto

### Flujo mensual (PLG)
1. Usuario va a **Datos** > tab **Cargar reportes** > sube CSVs de Cloudbeds.
2. Usuario va a **Datos** > tab **Cargar costos** > completa montos del mes > Guardar.
3. El checklist de cierre se completa > click en **Cerrar mes**.
4. El resumen queda disponible en **Costos** (read-only).

### Flujo de métricas
1. Backend parsea CSVs, detecta tipo, valida estructura.
2. Datos se persisten en Supabase (reservas, transacciones, snapshots).
3. Servicios de métricas calculan KPIs, insights, acciones y proyecciones.
4. Frontend consume endpoints de `/api` y renderiza dashboards.

## Navegación de la app (sidebar)

| Orden | Tab | Ruta | Función |
|-------|-----|------|---------|
| 1 | Inicio | `/` | Dashboard principal |
| 2 | Acciones | `/acciones` | Acciones recomendadas |
| 3 | Canales | `/canales` | Mix de canales y comisiones |
| 4 | Rentabilidad | `/rentabilidad` | P&L por reserva |
| 5 | Proyecciones | `/proyecciones` | Ocupación y revenue OTB |
| 6 | Costos | `/costos` | Resumen de costos (read-only) |
| 7 | Datos | `/importar` | Importar reportes + cargar costos + cerrar mes |

## Regla operativa para cambios

- Antes de modificar: identificar capa afectada (ingesta, storage, cálculo, API, UI).
- Durante: mantener contratos de tipos compartidos (`shared/`).
- Después: validar `npm run build` + smoke flow funcional.
