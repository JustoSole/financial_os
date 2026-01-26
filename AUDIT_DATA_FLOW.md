# Auditoría Completa del Flujo de Datos - Financial OS

Este documento detalla los hallazgos de la auditoría técnica realizada sobre el flujo de datos de la aplicación, identificando áreas de mejora, riesgos críticos y propuestas de optimización para asegurar la integridad financiera y la escalabilidad del sistema.

---

## 1. Mapa del Flujo de Datos Actual

El sistema opera bajo un modelo de procesamiento asíncrono basado en archivos CSV exportados de Cloudbeds:

1.  **Ingesta (Frontend):** El usuario carga archivos CSV a través de `Import.tsx`. Se realiza una validación preliminar de tipos de reporte.
2.  **Transporte (API):** Los archivos se envían al Backend mediante `multipart/form-data`. Se utiliza Supabase Auth para asegurar que los datos pertenezcan a la `property_id` correcta.
3.  **Procesamiento (Backend):**
    *   `parsers/`: Detectan columnas y normalizan tipos (fechas, decimales).
    *   `import-service/`: Orquesta la limpieza de datos previos y la inserción de nuevos registros.
4.  **Persistencia (DB):** Adaptador dual que soporta `JSON local` (desarrollo) y `Supabase/PostgreSQL` (producción).
5.  **Cálculo (Engine):** El `CalculationEngine` centraliza la lógica de métricas financieras (ADR, RevPAR, Net Profit).

---

## 2. Hallazgos Críticos (Errores y Riesgos)

### 🚨 A. Inconsistencia por Falta de Atomicidad
**Ubicación:** `backend/src/services/import-service-*.ts`
*   **Problema:** El flujo actual borra registros previos (`clearByFile`) y luego inserta nuevos en lotes. Si la inserción falla a mitad del proceso (ej. error de red o timeout de DB), los datos antiguos se pierden y los nuevos quedan incompletos.
*   **Riesgo:** Reportes financieros rotos y pérdida de confianza del usuario.
*   **Solución:** Implementar transacciones SQL (BEGIN/COMMIT) para asegurar que el proceso sea atómico.

### 🚨 B. Fragilidad en la Identificación de Registros
**Ubicación:** `backend/src/parsers/csv-parser.ts`
*   **Problema:** El sistema depende del nombre del archivo o un ID de carga para "limpiar" datos. No existe una clave única natural robusta (ej. hash del contenido o ID único de transacción de Cloudbeds) que evite duplicados si se sube el mismo reporte con distinto nombre.
*   **Riesgo:** Duplicación de ingresos o gastos en los dashboards.
*   **Solución:** Implementar un `UPSERT` basado en una clave compuesta (ej: `property_id` + `reservation_number` + `txn_id`).

### 🚨 C. Silos de Lógica de Cálculo
**Ubicación:** `backend/src/services/metrics-service.ts`, `calculators/`, `reservation-economics-service.ts`, `insights-service.ts`
*   **Problema:** Existen cálculos de comisiones, márgenes y CPOR dispersos en múltiples servicios que no utilizan el `CalculationEngine`. Por ejemplo, `reservation-economics-service.ts` redefine su propia lógica de asignación de costos fijos y comisiones.
*   **Riesgo:** El usuario recibe información contradictoria entre diferentes pantallas (ej: la utilidad neta en "Home" no coincide con la de "Profitability").
*   **Solución:** Migrar toda lógica de margen, comisión y asignación de costos exclusivamente al `CalculationEngine` como única fuente de verdad.

### 🚨 D. Gestión de Caché Inconsistente
**Ubicación:** `backend/src/services/cache-service.ts`
*   **Problema:** El sistema utiliza un caché en memoria con un TTL de 5 minutos. Sin embargo, la invalidación del caché (`clear()`) solo se llama explícitamente en algunas rutas (ej: `PUT /property/:id` y `PUT /costs/:id`), pero no se integra automáticamente tras una importación exitosa de CSV en todos los casos.
*   **Riesgo:** El usuario importa datos nuevos pero sigue viendo métricas viejas durante 5 minutos, generando confusión sobre si la carga funcionó.
*   **Solución:** Implementar un middleware o un sistema de eventos que asegure la invalidación total del caché tras cualquier cambio en los datos persistidos.

### 🚨 E. Manejo de Decimales y Redondeo Prematuro
**Ubicación:** `backend/src/parsers/csv-parser.ts` y `services/calculators/`
*   **Problema:** Se observan redondeos (`Math.round`) en etapas tempranas del procesamiento de datos y en los servicios de cálculo.
*   **Riesgo:** Pérdida de precisión acumulada (errores de redondeo) en reportes agregados de largo plazo.
*   **Solución:** Mantener la precisión decimal máxima en la base de datos y cálculos intermedios, aplicando redondeo únicamente en la capa de presentación (Frontend) o en el paso final de la API.

---

## 3. Áreas de Mejora y Optimización

### 📈 Rendimiento y Escalabilidad
*   **Caché Distribuido:** El `cache-service` actual es en memoria. Para entornos multi-instancia (como Render o Heroku con varios dynos), esto causará inconsistencias. Se recomienda migrar a Redis.
*   **Procesamiento en Segundo Plano:** Archivos CSV de >10,000 líneas pueden bloquear el event loop. Se recomienda usar `Worker Threads` o colas de tareas para el procesamiento de archivos grandes.

### 🛡️ Seguridad y Privacidad
*   **RLS (Row Level Security):** Es imperativo activar y auditar las políticas de RLS en Supabase para todas las tablas (`ledger_transactions`, `reservation_financials`, etc.) para garantizar el aislamiento total entre hoteles. Actualmente, la seguridad depende de filtros manuales en el Backend.
*   **Sanitización:** Mejorar la limpieza de caracteres especiales en nombres de huéspedes y descripciones de transacciones que a veces vienen mal codificados en el CSV de Cloudbeds.

### 📊 Calidad de Datos (Data Health)
*   **Detección de Gaps:** El sistema debe alertar si hay días sin transacciones entre la fecha más antigua y la más reciente, lo que indicaría que el usuario olvidó subir un período intermedio.
*   **Validación de Moneda:** No hay una validación cruzada para asegurar que el CSV importado esté en la misma moneda que la configurada en la propiedad.

---

## 4. Hoja de Ruta de Implementación (Roadmap)

| Fase | Tarea | Prioridad |
| :--- | :--- | :--- |
| **1. Integridad** | Implementar Transacciones SQL en el flujo de importación. | Alta |
| **2. Consistencia** | Unificar cálculos de comisiones en `CalculationEngine`. | Alta |
| **3. Robustez** | Cambiar lógica de "Delete + Insert" por "Upsert" con claves naturales. | Media |
| **4. UX** | Agregar validación de "Gaps de Fechas" en el dashboard de salud de datos. | Media |
| **5. Seguridad** | Auditoría y refuerzo de políticas RLS en Supabase. | Crítica |

---

**Auditoría realizada por:** AI Assistant
**Fecha:** 23 de Enero, 2026
**Estado:** Finalizada - Pendiente de ejecución de mejoras.

