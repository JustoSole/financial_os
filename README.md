# 💰 Financial OS — Cloudbeds Edition

**Tu hotel, números claros.**

Convertimos tus reportes de Cloudbeds en decisiones de ganancia y caja, sin Excel.

![Financial OS Screenshot](./docs/screenshot.png)

---

## 🎯 ¿Qué hace?

En **menos de 5 minutos**, un hotelero puede:

1. **Subir 3 CSVs** exportados desde Cloudbeds
2. **Ver su Command Center** con respuestas a las 40 preguntas clave del negocio
3. **Recibir la acción de la semana** con impacto estimado en $
4. **Confiar en los datos** — con sellos de `Real` vs `Estimado` e indicadores de confianza `●/◐/○`

---

## 🏨 Para quién es

| Persona | Qué quiere | Qué ofrece Financial OS |
|---------|-----------|-------------------------|
| **Dueño/Gerente** | "¿Estoy ganando plata?" | Command Center con profit neto, break-even y KPIs |
| **Administrador** | Conciliar, ordenar, cobrar | Aging de cobranzas y reconciliación cargado vs cobrado |
| **Consultor** | Ver varios hoteles | Multi-propiedad y benchmark (Plan Partner) |

---

## 📊 Command Center - Las 40 preguntas respondidas

El nuevo **Command Center** responde las preguntas clave que todo hotelero necesita saber, ahora potenciado con **análisis histórico**:

### 1. Salud del negocio en 60 segundos
| Pregunta | Métrica |
|----------|---------|
| ¿Estoy ganando o perdiendo? | **Net Profit** del período (hero metric) |
| ¿Cómo vengo respecto al mes pasado? | **Comparativa MoM** (Revenue, Occ, ADR) |
| ¿Cómo vengo respecto al año pasado? | **Comparativa YoY** (vs mismo período '25) |
| ¿Cuál es la tendencia de fondo? | **Trend Charts** (últimos 6 meses) |
| ¿Rentabilidad sana? | **GOPPAR** (Gross Operating Profit per Available Room) |

### 2. Punto de Equilibrio (Break-even)
| Pregunta | Respuesta |
|----------|-----------|
| ¿Cuál es mi punto de equilibrio en ocupación? | **% necesario** vs actual |
| ¿Cuántas noches necesito vender? | **Noches** para cubrir costos fijos |
| ¿Cuál es mi tarifa mínima? | **Break-even price** |
| Si quiero X% margen, ¿cuánto cobro? | **Simulador** dinámico de margen |
| ¿Qué tan lejos estoy del equilibrio? | **Gap en $ y noches** |

### 3. Unit Economics (por noche)
| Pregunta | Métrica |
|----------|---------|
| ¿Cuánto gano por noche ocupada? | **Profit per night** |
| ¿Cuál es mi margen de contribución? | **Contribution margin** (ADR net - Variable) |
| ¿Cómo se calcula mi profit? | **Memoria de Cálculo** detallada por reserva |
| ¿Qué parte es fijo vs variable? | **Cost mix** visual |

### 4. Canales - La verdad del margen
| Pregunta | Respuesta |
|----------|-----------|
| ¿Cuál canal aporta más profit por noche? | **Ranking** por profit/night (no solo revenue) |
| ¿Estoy sobre-dependiente de OTAs? | **OTA vs Direct share** con alerta |
| ¿Cuál es mi comisión promedio efectiva? | **Weighted commission %** |
| ¿Hay algún canal "tóxico"? | **Alerta** si alto revenue + bajo margen |

### 5. Caja y Cobranzas
| Pregunta | Respuesta |
|----------|-----------|
| ¿Cuánto cobré vs cuánto cargué? | **Reconciliación** con gap explicado |
| ¿Cuánta plata tengo pendiente? | **Aging**: Vencido / 7 días / 30 días / Futuro |
| ¿Mi caja aguanta? | **Runway** en días con status |
| ¿Qué reservas debo cobrar ya? | **Top pendientes** con días al check-in |

### 6. Acción de la Semana
La **única acción más importante** que debés tomar esta semana, con impacto en $ y prioridad visual.

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
- `GET /api/data-health/:propertyId` — Score de calidad de datos

### Command Center (Nuevo)
- `GET /api/metrics/:propertyId/command-center?days=30` — **Todas las métricas unificadas** (responde 40 preguntas)

### Business Intelligence
- `GET /api/metrics/:propertyId` — Dashboard básico (4 tiles)
- `GET /api/metrics/:propertyId/cash` — Runway y flujo de caja
- `GET /api/metrics/:propertyId/channels` — Mix de distribución con profit/noche
- `GET /api/metrics/:propertyId/collections` — Cobranzas pendientes
- `GET /api/metrics/:propertyId/structure` — Occupancy, ADR, RevPAR, GOPPAR
- `GET /api/metrics/:propertyId/breakeven` — Punto de equilibrio
- `GET /api/metrics/:propertyId/minimum-price?margin=X` — Tarifa mínima para margen objetivo
- `GET /api/metrics/:propertyId/ar-aging` — Aging de cuentas por cobrar
- `GET /api/metrics/:propertyId/reconcile` — Reconciliación cargado vs cobrado
- `GET /api/actions/:propertyId` — Decision Engine (acciones)

---

## 📈 Planes

| Feature | Free | Pro | Partner |
|---------|------|-----|---------|
| Propiedades | 1 | 1 | Ilimitadas |
| Imports/mes | 1 | ∞ | ∞ |
| Command Center | ✅ Básico | ✅ Completo | ✅ Completo |
| Break-even Analysis | ✅ | ✅ | ✅ |
| Channel Profit/Night | ✅ | ✅ | ✅ |
| Rentabilidad por Reserva | Básica | Detallada | Avanzada |
| Inbox Connect | ❌ | ✅ | ✅ |
| Portfolio view | ❌ | ❌ | ✅ |
| White-label export | ❌ | ❌ | ✅ |

---

## 🛡️ Seguridad y privacidad

- Los archivos CSV se procesan en memoria y los datos se guardan localmente.
- **Trust Layer**: Cada número indica si es `Real`, `Estimado` o `Incompleto`.
- Trazabilidad total: los insights se basan directamente en tus reportes.
- Sin envío de datos financieros a servidores externos de terceros.

---

## 📝 Roadmap

- [x] **v1.0** — Command Center con 40 preguntas respondidas
- [x] **v1.1** — Break-even analysis y simulador de margen
- [x] **v1.2** — Channel profit per night (no solo revenue)
- [x] **v2.0** — Análisis Histórico (MoM, YoY) y Gráficos de Tendencia
- [x] **v2.1** — P&L Detallado por Reserva con Memoria de Cálculo
- [ ] **v3.0** — Inbox Connect (auto-ingesta por email)
- [ ] **v3.1** — Integración API Cloudbeds
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
