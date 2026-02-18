# Frontend Developer Reference

Referencia técnica del frontend en `frontend/` para implementar cambios de producto sin romper flujos existentes.

## Stack y runtime

- React 18 + TypeScript.
- Vite (build/dev server).
- React Router v6.
- Supabase Auth.
- CSS Modules.
- Vitest + React Testing Library.

Scripts clave (`frontend/package.json`):

- `npm run dev --workspace=frontend`
- `npm run build --workspace=frontend`
- `npm run test --workspace=frontend`

## Estructura y responsabilidades

### `frontend/src/main.tsx`

- Entry point de la app.
- Inicializa Router y estilos base.

### `frontend/src/App.tsx`

- Define rutas públicas y privadas.
- Enruta a páginas lazy-loaded.
- Compone layout principal (`Sidebar`, `MobileHeader`, `ConfidenceHeader`).

### `frontend/src/context/`

- `AuthContext.tsx`: sesión de Supabase, usuario, loading, signOut.
- `AppContext.tsx`: estado global de propiedad, rango de fechas, métricas y acciones; expone `refreshData` y `refreshProperty`.

### `frontend/src/api.ts`

- Cliente API centralizado (`request<T>`).
- Inserta `Authorization: Bearer <token>` automáticamente.
- Expone funciones por dominio (`getMetrics`, `getActions`, `getCosts`, `importFile`, etc.).
- Ante 401, limpia sesión local para evitar loops con token inválido.
- Operaciones admin de snapshots:
  - `backfillSnapshots(propertyId, { limit?, dryRun? })`
  - `reconstructSnapshotAsOf(propertyId, { snapshotDate, dryRun? })`

### `frontend/src/pages/`

- Páginas funcionales por dominio (`Home`, `Actions`, `Channels`, `Costs`, `Profitability`, `Projections`, `Import`, `Settings`, `Login`, `Register`).
- `Projections` muestra estado de pacing:
  - `pacing.isApproximate`
  - `pacing.diagnostics` (`requestedAsOfSnapshotDate`, `exactCoveragePercent`, `importedWeeks`, `reconstructedWeeks`, `approximatedWeeks`).

### `frontend/src/components/`

- Componentes de producto y layout.
- `components/ui/`: base reusable del design system.
- `components/strategy/`: componentes de lógica de negocio más específica.

## Flujo de estado y datos

1. `AuthProvider` obtiene sesión inicial y escucha cambios auth.
2. Con sesión activa, `AppProvider` carga la propiedad.
3. Cambios de property/rango de fechas disparan `refreshData`.
4. Páginas consumen datos de contexto o llaman endpoints específicos vía `api.ts`.

## Patrones recomendados para cambios

### Agregar una nueva página

1. Crear archivo en `frontend/src/pages/`.
2. Agregar lazy import en `App.tsx`.
3. Registrar ruta en el bloque de rutas privadas.
4. Si corresponde, agregar navegación en `SidebarContent.tsx`.

### Agregar integración con endpoint nuevo

1. Crear función tipada en `frontend/src/api.ts`.
2. Definir tipos de respuesta (idealmente compartidos con `shared/`).
3. Consumir desde página/componente.
4. Manejar loading/error explícitamente en UI.

### Agregar un componente reusable

1. Crear componente + CSS module en `components/` o `components/ui/`.
2. Tipar props con interfaces TypeScript.
3. Exportar desde barrel correspondiente si aplica.
4. Agregar test unitario cuando tenga comportamiento relevante.

### Agregar estado global

- Si es transversal a varias pantallas, considerar `AppContext`.
- Si es específico de una vista, mantener estado local.
- Evitar introducir estado global para casos de uso aislados.

## Convenciones de UI y UX en este repo

- Rutas de negocio están en español (`/acciones`, `/costos`, etc.).
- Estados vacíos y errores deben ser accionables.
- El rango de fechas es un eje principal de casi todas las vistas.
- Evitar bloqueos de render: preferir fallback/loading por sección.
- Si una métrica es aproximada, la UI debe explicitar por qué y mostrar cobertura disponible (no ocultar incertidumbre).

## Variables de entorno (frontend)

- `VITE_API_URL` (default `/api`).
- `VITE_SUPABASE_URL`.
- `VITE_SUPABASE_ANON_KEY`.

En desarrollo, `vite.config.ts` proxya `/api` hacia backend local.

## Riesgos comunes al modificar frontend

- Duplicar lógica de fetch y estado fuera de `api.ts`/contextos.
- Romper contrato de tipos entre backend y frontend.
- Cambiar rutas sin ajustar navegación y redirects.
- No contemplar usuarios sin datos (empty states).

## Checklist de cambio frontend

- Confirmar endpoint/contrato de datos.
- Implementar UI con estados `loading`, `error`, `empty`, `success`.
- Verificar navegación desktop/mobile.
- Ejecutar `npm run test --workspace=frontend`.
- Ejecutar `npm run build --workspace=frontend`.
- Smoke test de flujo funcional de la página tocada.
