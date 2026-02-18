# Developer Docs Hub

Esta carpeta contiene documentación de referencia para desarrollar en `financial_os_cloudbeds` con bajo riesgo de regresión.

## Objetivo

- Acelerar onboarding técnico de backend y frontend.
- Definir una guía estable para implementar cambios de forma segura.
- Servir como contexto confiable para asistentes LLM.

## Documentos recomendados (orden de lectura)

1. `docs/README_DEVELOPERS.md` (este archivo)
2. `docs/DEVELOPER_REFERENCE_BACKEND.md`
3. `docs/DEVELOPER_REFERENCE_FRONTEND.md`
4. `docs/IMPLEMENTATION_CHANGE_PLAYBOOK.md`

## Mapa rápido de documentación existente

- `docs/TESTING.md`: estrategia actual de tests y escenarios manuales/E2E sugeridos.
- `docs/costs_module_roadmap.md`: deuda, decisiones y evolución del módulo de costos.
- `docs/roomtype_integration_plan.md`: plan de integración por tipo de habitación.
- `docs/auditoria_metricas_centralizacion_2026-02-13.md`: auditoría de centralización de métricas.
- `docs/pricing_strategy_redesign.md`: evolución de pricing/estrategia comercial.
- `docs/implementation_plan_v3.md`: plan de implementación histórico.

## Arquitectura del repositorio (alto nivel)

- `backend/`: API Express, parsing CSV, cálculos de métricas, integración Supabase.
- `frontend/`: SPA React + Vite, páginas de negocio, contexto global y cliente API.
- `shared/`: tipos compartidos entre frontend y backend.
- `docs/`: documentación técnica y de implementación.

## Flujo funcional del producto

1. Usuario sube CSV(s) desde frontend (`Import`).
2. Backend valida, detecta tipo de reporte y parsea datos.
3. Datos se persisten en Supabase (reservas, transacciones, snapshots).
4. Servicios de métricas calculan KPIs, insights, acciones y proyecciones.
5. Frontend consume endpoints de `/api` y renderiza dashboards operativos.

## Cómo usar estos docs como contexto para LLM

Para tareas de desarrollo, adjuntar como contexto mínimo:

- `docs/DEVELOPER_REFERENCE_BACKEND.md`
- `docs/DEVELOPER_REFERENCE_FRONTEND.md`
- `docs/IMPLEMENTATION_CHANGE_PLAYBOOK.md`
- más 1 documento de dominio específico (por ejemplo `docs/costs_module_roadmap.md`).

## Regla operativa para cambios

- Antes de modificar: identificar capa afectada (ingesta, storage, cálculo, API, UI).
- Durante el cambio: mantener contratos de tipos compartidos (`shared/`).
- Después del cambio: validar build + tests + smoke flow funcional (importar, consultar métricas, visualizar en UI).

## Estado operativo actual (go-live)

- Snapshot histórico de pacing activo con dos fuentes:
  - `imported`: snapshot real generado al importar `reservations_financials`.
  - `reconstructed`: snapshot reconstruido as-of para cubrir histórico faltante.
- Projections expone diagnóstico de cobertura en `pacing.diagnostics` para evitar caja negra.
- Runbook operativo disponible en:
  - `docs/DEVELOPER_REFERENCE_BACKEND.md` (scripts + endpoint admin).
  - `docs/TESTING.md` (checklist de validación y smoke técnico).
