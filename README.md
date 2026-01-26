# 💰 Financial OS — Cloudbeds Edition

**Tu hotel, números claros.**

Convertimos tus reportes de Cloudbeds en decisiones de ganancia y caja, sin Excel.

![Financial OS Screenshot](./docs/screenshot.png)

---

## 🎯 ¿Qué hace?

En **menos de 5 minutos**, un hotelero puede:

1. **Subir 3 CSVs** exportados desde Cloudbeds (Transactions, Reservations, Channels).
2. **Ver su Command Center** con respuestas a las 40 preguntas clave del negocio en 60 segundos.
3. **Recibir la acción de la semana** con impacto estimado en $ y prioridad visual.
4. **Analizar Rentabilidad Detallada**: P&L por reserva con **Memoria de Cálculo** y explicación de "por qué pasó".
5. **Analizar tendencias** de los últimos 6 meses y comparativas **MoM / YoY** automáticas.
6. **Confiar en los datos** — con sellos de `Real` vs `Estimado` e indicadores de confianza `●/◐/○`.

---

## 🏨 Para quién es

| Persona | Qué quiere | Qué ofrece Financial OS |
|---------|-----------|-------------------------|
| **Dueño/Gerente** | "¿Estoy ganando plata?" | Command Center con profit neto, break-even y KPIs |
| **Administrador** | Conciliar, ordenar, cobrar | Aging de cobranzas y reconciliación cargado vs cobrado |
| **Consultor** | Ver varios hoteles | Multi-propiedad, benchmark y análisis DOW (Plan Partner) |

---

## 📊 Command Center - Centro de Mando
El **Command Center** es el cerebro de la aplicación, diseñado para la toma de decisiones rápidas en 90 segundos:

### 1. Estado Actual (Decisión inmediata)
| Pregunta | Respuesta |
|----------|-----------|
| ¿Estoy ganando o perdiendo? | **Ganancia Neta** con contexto (vs período anterior y vs break-even) |
| ¿Mi ocupación es saludable? | **Status Card** de Ocupación con semáforo y comparativa vs anterior |
| ¿Gano por cada noche? | **Status Card** de Ganancia por Noche con contexto |
| ¿Cubrí mis costos? | **Status Card** de Punto de Equilibrio (con pp sobre/bajo el mínimo) |

### 2. Resumen del Período
| Métrica | Descripción |
|---------|-------------|
| Revenue | Ingresos totales con comparativa vs anterior |
| ADR | Tarifa promedio con comparativa vs anterior |
| Noches vendidas | Total de room nights del período |
| Reservas | Cantidad estimada de reservas |

### 3. Cobranzas Pendientes (Alerta contextual)
Solo aparece si hay más de $10K pendiente:
- Total pendiente por cobrar
- Monto vencido (si hay)
- Próximos 7 días
- Acceso directo a gestión de cobranzas

### 4. Canales y Distribución (Resumen)
| Pregunta | Respuesta |
|----------|-----------|
| ¿Cuál es mi mix de canales? | **Barra visual Directo vs OTAs** con leyenda clara |
| ¿Dependo mucho de OTAs? | Alerta visual si dependencia > 70% |
| ¿Cuáles son mis extremos? | **Best vs Worst channel** por rentabilidad/noche |

### 5. Análisis Profundo (Exploración)
El análisis detallado se distribuye en vistas especializadas para no saturar el mando:
*   **Rentabilidad**: P&L por reserva, **Tendencias Históricas** (6 meses), **Comparativas MoM/YoY** y simuladores.
*   **Canales**: Tabla completa de comisiones, ADR neto y mix detallado.
*   **Caja**: Reconciliación, Runway y Aging de cobranzas.
*   **Costos**: Configuración flexible de costos fijos y variables (V4).

---

## 📁 CSVs requeridos de Cloudbeds

Para un análisis completo (incluyendo YoY), podés subir **hasta 3 años de historia**. Recomendamos al menos **13 meses** para ver comparativas MoM/YoY precisas.

1. **Expanded Transaction Report with Details** — Fuente de verdad para caja y cobranza.
2. **Reservations with Financials** — Detalle de reservas, estados y saldos pendientes.
3. **Channel Performance Summary** — Mix de canales y noches vendidas.

### Cómo exportar
1. En Cloudbeds, abrí el reporte correspondiente.
2. Seleccioná el rango de fechas (recomendado: últimos 30 o 90 días).
3. Asegurate de que la vista sea **Table** o **Details Only** (no Summary).
4. Hacé clic en **Export** y elegí **CSV**.
5. Subí el archivo a Financial OS.

---

## 🚀 Instalación y Setup

### Requisitos

- Node.js 18+
- npm 9+
- Cuenta en Supabase (para modo producción)

### Desarrollo local

```bash
# Clonar el repositorio
git clone <repo-url>
cd financial-os-cloudbeds

# Instalar dependencias
npm install

# Configurar variables de entorno (opcional para Supabase)
# Copia .env.example a .env en la carpeta /backend
# Si no se configura, usará almacenamiento JSON local

# Iniciar en modo desarrollo (backend + frontend)
npm run dev
```

El backend corre en `http://localhost:3001` y el frontend en `http://localhost:3000`.

### Producción & Deploy

#### Deploy en Render
1. **Conecta tu repositorio** a Render.
2. Render detectará `render.yaml` automáticamente.
3. Configura las variables de entorno `SUPABASE_URL` y `SUPABASE_ANON_KEY` si usas Supabase.

---

## 🗂️ Estructura del proyecto

```
financial-os-cloudbeds/
├── backend/               # API Node.js + Express + TypeScript
│   ├── src/
│   │   ├── db/           # Adaptador Dual (Supabase / JSON Local)
│   │   ├── parsers/      # Parsers de CSV específicos para Cloudbeds
│   │   ├── services/     # Motores de cálculo (Profit, Pricing, Metrics)
│   │   └── routes/       # Endpoints API (Rest)
│   └── data/             # Almacenamiento JSON local (fallback)
├── frontend/             # React + Vite + Tailwind + Recharts
│   └── src/
│       ├── components/   # Librería de UI (MetricCards, ActionCards)
│       ├── pages/        # Command Center, Caja, Canales, Rentabilidad
│       └── context/      # Auth y App Context (Supabase Auth)
└── shared/               # Tipos TypeScript compartidos
```

---

## 🔧 API Endpoints Principales

### Auth & Property
- `GET /api/property` — Obtiene o crea la propiedad del usuario autenticado.
- `PUT /api/property/:id` — Actualiza configuración del hotel.

### Import & Data
- `POST /api/import` — Procesar CSV de Cloudbeds.
- `POST /api/import/batch` — Procesar múltiples CSVs simultáneamente.
- `GET /api/import/history/:propertyId` — Historial de carga.

### Command Center & Analytics
- `GET /api/metrics/:propertyId/command-center` — **Métricas unificadas** (40 preguntas).
- `GET /api/metrics/:propertyId/trends` — Gráficos de evolución (6 meses).
- `GET /api/metrics/:propertyId/reservation-economics/:resNumber` — P&L con memoria de cálculo.
- `GET /api/metrics/:propertyId/breakeven` — Análisis de punto de equilibrio.
- `GET /api/costs/:propertyId` — Configuración de costos V4.

---

## 🛡️ Seguridad y Tecnología

- **Arquitectura Híbrida**: Soporta Supabase (PostgreSQL) para escalabilidad o JSON local para simplicidad.
- **Row Level Security (RLS)**: Aislamiento total de datos entre usuarios en Supabase.
- **Trust Layer**: Indicadores visuales de precisión (`Real`, `Estimado`, `Incompleto`).
- **Memoria de Cálculo**: Trazabilidad total de cada número mostrado.

---

## 📝 Roadmap

- [x] **v1.0** — Command Center Básico
- [x] **v2.0** — Integración Supabase & Auth
- [x] **v2.1** — P&L Detallado por Reserva & Categorías de Costos V4
- [x] **v2.2** — Command Center Unificado (40 preguntas)
- [ ] **v3.0** — Inbox Connect (Auto-ingesta por email)
- [ ] **v3.1** — Integración API Cloudbeds Directa

---

MIT © 2026 | **Hecho con ❤️ para hoteleros que quieren números claros.**
