# Plan de Implementacion - Proximos Pasos para Beta

Fecha: 2026-01-27
Proyecto: Financial OS - Cloudbeds Edition
Objetivo: preparar la app para una beta cerrada con usuarios reales enfocando en precision, confiabilidad y operacion.

---

## ✅ 1) Bloqueantes de precision (Completado)

### 1.1 Corregir typo de costos fijos (salaries)
- **Estado:** Finalizado. Se normalizó de `salpiaries` a `salaries` en todo el backend y frontend.

### 1.2 Arreglar endpoint de break-even
- **Estado:** Finalizado. El endpoint `/metrics/:propertyId/breakeven` ahora utiliza el motor de cálculo correcto.

### 1.3 Completar TODOs criticos del Command Center
- **Estado:** Finalizado. 
    - Comparacion historica para net profit (`vsLastPeriod`).
    - Decomposicion de cambios (driver de cambios).
    - Decomposicion RevPAR (occupancy vs ADR).
    - Alertas de confianza de datos.

---

## 🚀 2) Confiabilidad y Calidad (En Progreso)

### 2.1 Tests de parsers CSV
- **Objetivo:** Evitar regresiones en import.
- **Pendiente:** Implementar suite de tests para `backend/src/parsers/*.ts`.

### 2.2 Tests de calculadoras
- **Objetivo:** Asegurar resultados esperables en profit y break-even.
- **Pendiente:** Tests unitarios para `backend/src/services/calculators/*.ts`.

### 2.3 Smoke test E2E del flujo core
- **Estado:** Verificado manualmente. Import -> Command Center -> Analytics funciona correctamente.

---

## 🛠 3) Operacion para beta cerrada (Próximo)

### 3.1 Persistencia y respaldo
- **Estado:** Implementado adaptador dual (Supabase / JSON Local).
- **Próximo:** Configurar backups automáticos para la instancia de producción.

### 3.2 Multi-tenant basico
- **Estado:** Implementado vía Supabase Auth y RLS.
- **Próximo:** Mejorar la gestión de múltiples propiedades por usuario.

### 3.3 Observabilidad
- **Pendiente:** Integrar Sentry o similar para error tracking en producción.

---

## 📈 4) Preparacion de beta (Q1 2026)

### 4.1 Onboarding guiado
- **Objetivo:** Reducir friccion de import.
- **Acciones:**
    - Checklist inicial de configuración.
    - Banners de Data Health proactivos.

### 4.2 Criterios de lanzamiento beta cerrada
- [x] Todos los bloqueantes de precision corregidos.
- [x] Flujo core estable con CSVs reales.
- [x] Persistencia segura.
- [ ] Documentación de usuario final completada.

---

## Riesgos abiertos

- El límite de 10MB en imports de CSV puede afectar a hoteles con mucha historia.
- La dependencia de exports manuales de Cloudbeds requiere educación constante del usuario.

---

## Entregables actualizados

- ✅ Backend robusto con motores de cálculo unificados.
- ✅ Frontend modernizado con CSS Modules y Mobile-First.
- ✅ Documentación técnica y de producto actualizada.
- 🔜 Suite de tests automatizados.
