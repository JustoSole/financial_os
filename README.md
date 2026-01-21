# 💰 Financial OS — Cloudbeds Edition

**Tu hotel, números claros.**

Convertimos tus reportes de Cloudbeds en decisiones de ganancia y caja, sin Excel.

![Financial OS Screenshot](./docs/screenshot.png)

---

## 🎯 ¿Qué hace?

En **menos de 5 minutos**, un hotelero puede:

1. **Subir 3 CSVs** exportados desde Cloudbeds
2. **Ver su Command Center** con respuestas a las 40 preguntas clave del negocio en 60 segundos
3. **Recibir la acción de la semana** con impacto estimado en $ y prioridad visual
4. **Analizar tendencias** de los últimos 6 meses y proyecciones de ingresos
5. **Confiar en los datos** — con sellos de `Real` vs `Estimado` e indicadores de confianza `●/◐/○`

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
| ¿Qué tengo que hacer hoy? | **Acción de la Semana** (priorizada por impacto en $) |
| ¿Estoy ganando o perdiendo? | **Ganancia Neta** con contexto (vs período anterior y vs break-even) |
| ¿Mi ocupación es saludable? | **Status Card** de Ocupación con semáforo |
| ¿Gano por cada noche? | **Status Card** de Margen por Noche |
| ¿Cubrí mis costos? | **Status Card** de Punto de Equilibrio (Real vs Necesario) |

### 2. Canales y Distribución (Resumen)
| Pregunta | Respuesta |
|----------|-----------|
| ¿Dependo mucho de OTAs? | **OTA vs Direct share** bar con alerta visual |
| ¿Cuáles son mis extremos? | **Best vs Worst channel** por profit real por noche |

### 3. Análisis Profundo (Exploración)
El análisis detallado se distribuye en vistas especializadas para no saturar el mando:
*   **Rentabilidad**: P&L por reserva, **Tendencias Históricas** (6 meses), **Comparativas MoM/YoY** y simuladores.
*   **Canales**: Tabla completa de comisiones, ADR neto y mix detallado.
*   **Caja**: Reconciliación, Runway y Aging de cobranzas.

### 5. Caja, Cobranzas y Proyección
| Pregunta | Respuesta |
|----------|-----------|
| ¿Cuánto cobré vs cuánto cargué? | **Reconciliación** con gap explicado |
| ¿Cuánta plata tengo pendiente? | **Aging**: Vencido / 7 días / 30 días / Futuro |
| ¿Mi caja aguanta? | **Runway** en días basado en saldo actual y burn-rate |
| ¿Cuánta plata va a entrar? | **Proyección de ingresos** a 4 semanas (on-the-books) |

### 6. Acción de la Semana
La **única acción más importante** que debés tomar esta semana, con impacto en $ y prioridad visual generada por el Decision Engine.

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

## 🚀 Instalación

### Requisitos

- Node.js 18+
- npm 9+

### Desarrollo local

```bash
# Clonar el repositorio
git clone <repo-url>
cd financial-os-cloudbeds

# Instalar dependencias
npm install

# Iniciar en modo desarrollo (backend + frontend)
npm run dev
```

El backend corre en `http://localhost:3001` y el frontend en `http://localhost:3000`.

### Producción

```bash
# Build
npm run build

# Iniciar servidor
npm start
```

### Deploy en Render

1. **Conecta tu repositorio de GitHub** a Render:
   - Ve a [render.com](https://render.com)
   - Crea una cuenta o inicia sesión
   - Click en "New" → "Web Service"
   - Conecta tu repositorio de GitHub

2. **Configuración automática**:
   - Render detectará el archivo `render.yaml` automáticamente
   - El build y deploy se ejecutarán automáticamente

3. **Variables de entorno** (opcionales):
   - `NODE_ENV=production` (ya configurado en render.yaml)
   - `PORT` (Render lo asigna automáticamente)

4. **Persistencia de datos**:
   - Render creará un disco persistente para `/backend/data`
   - Tus datos se guardarán automáticamente

5. **¡Listo!** Tu app estará disponible en `https://tu-app.onrender.com`

---

## 🗂️ Estructura del proyecto

```
financial-os-cloudbeds/
├── backend/               # API Node.js + Express
│   ├── src/
│   │   ├── db/           # In-memory JSON storage con persistencia
│   │   ├── parsers/      # Parsers de CSV específicos para Cloudbeds
│   │   ├── services/     # Lógica de negocio y motores de decisión
│   │   │   ├── calculators/      # Profit engine, Pricing engine
│   │   │   ├── command-center-service.ts  # ⭐ Nuevo: Servicio unificado
│   │   │   ├── insights-service.ts
│   │   │   ├── metrics-service.ts
│   │   │   └── ...
│   │   └── routes/       # Endpoints API (Rest)
│   └── data/             # Archivo financial_os.json
├── frontend/             # React + Vite + Tailwind + Recharts
│   └── src/
│       ├── components/   # UI Library (MetricCards, ActionCards, etc.)
│       ├── pages/        # Command Center (Home), Caja, Canales, Costos, etc.
│       └── context/      # Estado global de la aplicación
└── shared/               # Tipos TypeScript compartidos
```

---

## 🔧 API Endpoints Principales

### Import & Data
- `POST /api/import` — Procesar CSV de Cloudbeds
- `GET /api/import/history/:propertyId` — Historial de carga
- `GET /api/data-health/:propertyId` — Score de calidad de datos y cobertura histórica

### Command Center (Unificado)
- `GET /api/metrics/:propertyId/command-center` — **Todas las métricas unificadas** (responde 40 preguntas, MoM, YoY, Alertas)

### Business Intelligence & Analytics
- `GET /api/metrics/:propertyId/trends?months=6` — Gráficos de evolución histórica
- `GET /api/metrics/:propertyId/projection` — Proyección de ingresos futura (OTB)
- `GET /api/metrics/:propertyId/dow` — Performance por día de la semana
- `GET /api/metrics/:propertyId/channels` — Mix de distribución con profit/noche real
- `GET /api/metrics/:propertyId/reconcile` — Reconciliación cargado vs cobrado
- `GET /api/metrics/:propertyId/ar-aging` — Aging de cuentas por cobrar visual
- `GET /api/metrics/:propertyId/reservation-economics/:resNumber` — Detalle P&L con memoria de cálculo
- `GET /api/costs/:propertyId` — Configuración de costos V4 (Flexible Categories)

---

## 📈 Planes

| Feature | Free | Pro | Partner |
|---------|------|-----|---------|
| Propiedades | 1 | 1 | Ilimitadas |
| Historial | 30 días | 365 días | 365 días |
| Command Center | ✅ Básico | ✅ Completo | ✅ Completo |
| Comparativas | ❌ | ✅ MoM / YoY | ✅ MoM / YoY |
| Rentabilidad por Reserva | Básica | Detallada (Memory) | Avanzada |
| Inbox Connect (Auto) | ❌ | ✅ | ✅ |
| Análisis DOW | ❌ | ❌ | ✅ |

---

## 🛡️ Seguridad y privacidad

- Los archivos CSV se procesan en memoria y los datos se guardan localmente en un archivo JSON encriptable.
- **Trust Layer**: Cada número indica si es `Real`, `Estimado` o `Incompleto` mediante badges visuales.
- Trazabilidad total: los insights se basan directamente en tus reportes mediante la Memoria de Cálculo.

---

## 📝 Roadmap

- [x] **v1.0** — Command Center con 40 preguntas respondidas
- [x] **v1.1** — Break-even analysis y simulador de margen
- [x] **v2.0** — Análisis Histórico (MoM, YoY) y Gráficos de Tendencia
- [x] **v2.1** — P&L Detallado por Reserva con Memoria de Cálculo y Categorías V4
- [ ] **v2.2** — Análisis de Día de Semana (DOW) y Proyecciones OTB
- [ ] **v3.0** — Inbox Connect (auto-ingesta por email)
- [ ] **v3.1** — Integración API Cloudbeds Directa
- [ ] **v3.2** — Multi-propiedad y portfolio

---

## 🤝 Contribuir

1. Fork el repositorio
2. Creá tu branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agrega X'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Abrí un Pull Request

---

## 📄 Licencia

MIT © 2026

---

**Hecho con ❤️ para hoteleros que quieren números claros, sin Excel.**
