# Plan de Implementacion - Proximos Pasos para Beta

Fecha: 2026-01-21
Proyecto: Financial OS - Cloudbeds Edition
Objetivo: preparar la app para una beta cerrada con usuarios reales sin escribir features nuevas, enfocando en precision, confiabilidad y operacion.

---

## 1) Bloqueantes de precision (semana 1)

### 1.1 Corregir typo de costos fijos (salaries vs salpiaries)
Impacto: rompe costos fijos y todas las metricas derivadas (GOPPAR, break-even, profit).
Ubicacion actual:
- `backend/src/db/index.ts` usa `salpiaries`
- `backend/src/routes/api.ts` usa `salpiaries`
- `backend/src/services/reservation-economics-service.ts` usa `salpiaries`

Pasos:
1. Normalizar el nombre a `salaries` en todo el backend.
2. Migrar datos existentes en `backend/data/financial_os.json` (si hay).
3. Verificar que la UI de costos guarde y recupere correctamente.

Checklist:
- [ ] Tipos y persistencia usan `salaries`
- [ ] Calculo de costos fijos refleja valores reales
- [ ] No se pierde data previa (migracion)

### 1.2 Arreglar endpoint de break-even
Impacto: el endpoint `/metrics/:propertyId/breakeven` devuelve `getProfitabilityMetrics` en lugar del calculo de equilibrio.
Ubicacion:
- `backend/src/routes/api.ts`

Pasos:
1. Usar el servicio correcto para break-even (no profitability).
2. Verificar consistencia entre Command Center y endpoint dedicado.

Checklist:
- [ ] Break-even responde datos correctos
- [ ] Command Center y endpoint dedicado coinciden

### 1.3 Completar TODOs criticos del Command Center
Impacto: respuestas incompletas en preguntas clave.
Ubicacion:
- `backend/src/services/command-center-service.ts`

Pendientes:
- Comparacion historica para net profit (`vsLastPeriod`)
- Decomposicion de cambios (driver de cambios)
- Decomposicion RevPAR (occupancy vs ADR)
- Alertas de costos por tendencia

Checklist:
- [ ] Comparaciones historicas disponibles cuando hay data
- [ ] Explicaciones de cambios consistentes
- [ ] RevPAR decomposition calculada
- [ ] Cost alerts basadas en cambios reales

---

## 2) Confiabilidad y pruebas basicas (semana 2)

### 2.1 Tests de parsers CSV
Objetivo: evitar regresiones en import.
Archivos clave:
- `backend/src/parsers/*.ts`

Casos minimos:
- CSVs reales de los 3 reportes
- Columnas faltantes
- Tipos incorrectos
- Archivos grandes

Checklist:
- [ ] Test para cada parser
- [ ] Test de validacion de columnas

### 2.2 Tests de calculadoras
Objetivo: asegurar resultados esperables en profit, break-even y unit economics.
Archivos clave:
- `backend/src/services/calculators/*.ts`
- `backend/src/services/metrics-service.ts`

Checklist:
- [ ] Casos con datos completos
- [ ] Casos con data incompleta
- [ ] Casos de borde (noches = 0, revenue = 0)

### 2.3 Smoke test E2E del flujo core
Objetivo: asegurar Time-to-First-Value.
Flujo:
- Importar 3 CSVs -> Command Center -> Canales -> Caja -> Rentabilidad

Checklist:
- [ ] Import sin errores
- [ ] Command Center muestra data
- [ ] KPIs no son NaN/Infinity

---

## 3) Operacion para beta cerrada (semana 3)

### 3.1 Persistencia y respaldo
Objetivo: evitar perdida de datos con usuarios reales.
Opciones:
- SQLite local con backup diario
- Postgres en un servicio minimo

Checklist:
- [ ] Datos persistentes por propiedad
- [ ] Backups automaticos

### 3.2 Multi-tenant basico
Objetivo: soportar multiples hoteles reales.
Minimo viable:
- Identificador de propiedad por usuario
- Separacion real de datos por propiedad

Checklist:
- [ ] Sin mezcla de datos entre propiedades
- [ ] Mecanismo simple de autenticacion (aunque sea basico)

### 3.3 Observabilidad
Objetivo: detectar fallos en import y calculos.
Minimo viable:
- Logging estructurado
- Error tracking (Sentry o similar)

Checklist:
- [ ] Errores de import quedan registrados
- [ ] Se detectan fallos de calculo

---

## 4) Preparacion de beta (semana 4)

### 4.1 Onboarding guiado
Objetivo: reducir friccion de import.
Acciones:
- Checklist inicial
- Mensajes claros de Data Health
- CTA para importar historia (13 meses)

Checklist:
- [ ] TTFV < 10 min en pruebas internas

### 4.2 Criterios de lanzamiento beta cerrada
Minimo para lanzar:
- Todos los bloqueantes de precision corregidos
- Flujo core estable con CSVs reales
- Persistencia segura

---

## Riesgos abiertos

- Base local (JSON) no escala para beta abierta.
- Sin tests, cualquier ajuste puede romper calculos.
- Import con archivos grandes puede fallar con limite de 10MB.

---

## Entregables esperados

- Correcciones de precision en backend
- Suite basica de tests
- Persistencia confiable
- Plan de beta cerrada con 5-10 usuarios


