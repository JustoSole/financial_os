# Auditoría del Sistema de Acciones

## Errores recurrentes: módulo `@financial-os/shared`

### Síntoma
La pestaña "Importar datos" (y otras que usan constantes de shared) fallan con:
```text
The requested module '.../shared/dist/index.js' does not provide an export named 'DEFAULT_COST_CATEGORIES'
```

### Causa raíz
1. El **frontend** en dev resuelve `@financial-os/shared` por el `main` del package (`shared/dist/index.js`). Si `shared` no se ha compilado o el `dist` está desactualizado, faltan exports nuevos (p. ej. `DEFAULT_COST_CATEGORIES`, `DEFAULT_TAX_RULES`, `PLAN_INFO`).
2. El **backend** también depende de `shared/dist` en runtime; sin build previo, puede fallar al importar constantes o tipos.

### Medidas aplicadas
- **Vite (frontend)**: alias en `frontend/vite.config.ts` que apunta `@financial-os/shared` a `../shared/src`, para que en dev se use el código fuente y no dependa de `dist`.
- **Build previo a dev**: el script `dev` en la raíz ejecuta primero `npm run build --workspace=shared`, de modo que el backend y cualquier uso de `dist` tengan siempre el bundle actualizado antes de arrancar.
- Tras añadir o cambiar exports en `shared/src` (p. ej. en `constants/costs.ts`, `constants/tax.ts`, `constants/plans.ts`), hacer **build de shared** antes de probar el backend o un build de producción.

### Evitar que se repita
- No quitar el alias de Vite para `@financial-os/shared` en dev.
- Mantener el paso `build --workspace=shared` en el script `dev` (o equivalente en tu flujo).
- Si aparece un "does not provide an export named 'X'" desde shared, comprobar que `X` exista en `shared/src` y que esté re-exportado en `shared/src/constants/index.ts` y/o `shared/src/index.ts`, y luego ejecutar `npm run build --workspace=shared`.

---

## Resumen Ejecutivo

El sistema de acciones presenta una **fragmentación significativa** entre el frontend y el backend, lo que resulta en duplicación de lógica, inconsistencia de tipos y deuda técnica en el seguimiento de completitud. Se recomienda encarecidamente **centralizar toda la generación de acciones en el backend** y unificar las definiciones de tipos.

## Hallazgos Principales

### 1. Descentralización y Duplicación de Lógica
La lógica de negocio para generar acciones está dividida:
- **Frontend (`Actions.tsx`)**: Genera acciones de Cobranza (`collections`), Optimización de Canales (`optimize-channel`) y Patrones de Precios (`pricing`). Contiene reglas de negocio hardcodeadas (ej: `balanceDue < 10000`, `daysUntil < -3`).
- **Backend (`actions-service.ts`)**: Genera acciones de Salud de Datos, Reservas No Rentables, Fuga de 1 Noche, Dependencia de OTAs y Fuga de Profit.
- **Consecuencia**: Existe riesgo de inconsistencia (ej: lógica de "Patrones de Precios" en FE vs "Fuga de 1 Noche" en BE) y hace difícil mantener las reglas de negocio en un solo lugar.

### 2. Inconsistencia de Tipos
No existe una definición única de "Acción" en todo el sistema:
- **Shared/Backend**: Usa `RecommendedAction` (`shared/src/types/api.ts`) con campos como `priority` y `type` (enum).
- **Frontend**: Define su propia interfaz `ActionItem` localmente, con campos diferentes como `category` y `type` (severidad: critical/warning).
- **Mapeo Manual**: El frontend realiza una transformación manual de las acciones que vienen del backend para adaptarlas a su formato, lo cual es propenso a errores.

### 3. Deuda Técnica en Identificación y Seguimiento
El sistema soporta dos mecanismos de tracking simultáneamente:
- **Legacy**: Basado en `actionType` + `stepIndex` (numérico).
- **Nuevo**: Basado en `actionId` + `stepId` (string).
- El modelo de base de datos (`ActionCompletion` en `shared`) parece estar desactualizado en su definición TypeScript, aunque el código del adaptador de base de datos maneja ambos formatos. Esto añade complejidad innecesaria al servicio de completitud.

### 4. Performance y Carga de Datos
El frontend solicita múltiples endpoints pesados (`insights`, `collections`, `economics`, `cash`) para calcular acciones en el cliente. Si la lógica se moviera al backend, el frontend solo necesitaría llamar a `/actions`, reduciendo la carga de red y procesamiento en el cliente.

## Plan de Acción Recomendado

### Fase 1: Unificación de Tipos y Backend
1.  **Actualizar `RecommendedAction`**: En `shared/src/types/api.ts`, expandir la interfaz para incluir `category` y `severity` (o derivarlos consistentemente).
2.  **Migrar Lógica al Backend**: Mover la lógica de generación de `collect-*`, `optimize-channel-*` y `pricing-*` desde `Actions.tsx` hacia `actions-service.ts`.
3.  **Centralizar Reglas**: Mover las constantes y umbrales (ej: 18% costo real) a constantes configurables en el backend.

### Fase 2: Limpieza de Frontend y API
1.  **API Única**: El endpoint `GET /actions/:propertyId` debe devolver TODAS las acciones listas para renderizar.
2.  **Refactor Frontend**: Simplificar `Actions.tsx` para que solo consuma la lista de acciones del API, eliminando toda la lógica de cálculo y filtrado de datos crudos.
3.  **Estandarizar Tracking**: Deprecar el formato legacy en el frontend y asegurar que todas las nuevas acciones usen `actionId` + `stepId`.

### Fase 3: Base de Datos
1.  **Actualizar Modelos**: Asegurar que las interfaces en `shared/src/types/models.ts` reflejen las columnas `action_id` y `step_id` de la base de datos.
