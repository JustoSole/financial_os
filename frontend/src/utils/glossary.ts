/**
 * Glosario de términos financieros y hoteleros
 * Explicaciones en español simple para usuarios de LATAM
 *
 * TODAS las fórmulas aquí documentadas son consistentes con:
 *   - shared/src/helpers/calculations.ts (fórmulas canónicas)
 *   - backend/src/services/calculation-engine.ts (motor de cálculo)
 *   - backend/src/services/metrics-service.ts (servicio de métricas)
 *   - backend/src/services/command-center-service.ts (dashboard)
 */

export interface GlossaryTerm {
  term: string;
  shortExplanation: string;
  fullExplanation: string;
  formula?: string;
  example?: string;
  category: 'metrics' | 'financial' | 'channels' | 'operations' | 'projections';
}

export const glossary: Record<string, GlossaryTerm> = {
  // ==========================================
  // MÉTRICAS HOTELERAS (KPIs de Estructura)
  // ==========================================
  occupancy: {
    term: 'Ocupación',
    shortExplanation: 'Porcentaje de noches vendidas vs disponibles',
    fullExplanation:
      'Mide qué tan lleno está tu hotel. Si tenés 10 habitaciones y vendiste 7 anoche, tu ocupación fue del 70%. Una ocupación muy baja significa oportunidad perdida; muy alta puede significar que podrías cobrar más.',
    formula: '(Noches Vendidas / Noches Disponibles) × 100',
    example: '21 noches vendidas de 30 disponibles = 70% de ocupación.',
    category: 'metrics',
  },
  availableNights: {
    term: 'Noches Disponibles',
    shortExplanation: 'Total de noches que podrías vender en el período',
    fullExplanation:
      'Es la capacidad máxima de tu hotel en un período. Se calcula multiplicando la cantidad de habitaciones por los días del período. Es el denominador clave para calcular ocupación y RevPAR.',
    formula: 'Cantidad de Habitaciones × Días del Período',
    example: '10 habitaciones × 30 días = 300 noches disponibles.',
    category: 'metrics',
  },
  roomNights: {
    term: 'Noches Vendidas (Room Nights)',
    shortExplanation: 'Total de noches efectivamente ocupadas',
    fullExplanation:
      'Cuenta cuántas noches se vendieron en el período. Si una reserva abarca noches fuera del período seleccionado, solo se cuentan las que caen dentro (prorrateo). Es el numerador de la ocupación y el denominador del ADR.',
    formula: 'Suma de noches de cada reserva dentro del período',
    example: 'Reserva de 5 noches, pero solo 3 caen en el mes → se cuentan 3.',
    category: 'metrics',
  },
  adr: {
    term: 'ADR (Tarifa Promedio Diaria)',
    shortExplanation: 'Precio promedio por noche vendida',
    fullExplanation:
      'El ADR o "Average Daily Rate" es el precio promedio que cobrás por cada noche vendida. Se calcula dividiendo los ingresos totales por habitación entre las noches vendidas. No incluye noches vacías.',
    formula: 'Ingresos Totales / Noches Vendidas',
    example: 'Si ganaste $100,000 en 50 noches vendidas, tu ADR es $2,000 por noche.',
    category: 'metrics',
  },
  adrNet: {
    term: 'ADR Neto',
    shortExplanation: 'Lo que realmente te queda por noche después de comisiones',
    fullExplanation:
      'Es tu tarifa promedio MENOS las comisiones que pagás a los canales de venta (Booking, Airbnb, etc). Este es el dinero real que te queda por cada noche antes de costos operativos.',
    formula: 'ADR × (1 − Tasa de Comisión)',
    example: 'Si tu ADR es $2,000 y pagás 15% de comisión, tu ADR Neto es $1,700.',
    category: 'metrics',
  },
  revpar: {
    term: 'RevPAR (Ingreso por Habitación Disponible)',
    shortExplanation: 'Cuánto genera cada habitación en promedio (vendida o no)',
    fullExplanation:
      'El RevPAR combina tu ocupación con tu tarifa. Se calcula sobre TODAS las habitaciones, incluyendo las vacías. Tener precios altos pero habitaciones vacías baja tu RevPAR. Es la métrica estándar de la industria hotelera.',
    formula: 'Ingresos Totales / Noches Disponibles',
    example: 'Si tenés 60% de ocupación y ADR de $2,000, tu RevPAR es $1,200.',
    category: 'metrics',
  },
  nrevpar: {
    term: 'NRevPAR (Ingreso Neto por Habitación)',
    shortExplanation: 'RevPAR después de descontar comisiones',
    fullExplanation:
      'Similar al RevPAR, pero resta las comisiones pagadas a los canales de venta. Te muestra cuánto realmente generás por habitación disponible después de pagar a las OTAs. Útil para evaluar el impacto real del mix de canales.',
    formula: '(Ingresos Totales − Comisiones Totales) / Noches Disponibles',
    example: 'Ingresos $300,000, Comisiones $45,000, 300 noches disponibles → NRevPAR = $850.',
    category: 'metrics',
  },
  goppar: {
    term: 'GOPPAR (Ganancia Operativa por Habitación)',
    shortExplanation: 'Ganancia real por habitación disponible, después de todos los costos',
    fullExplanation:
      'El GOPPAR divide la ganancia neta entre las noches disponibles (no las vendidas). Es la métrica definitiva porque muestra cuánto dinero real genera cada habitación de tu hotel, incluyendo el peso de las vacías. Si este número es positivo, estás ganando.',
    formula: 'Ganancia Neta / Noches Disponibles',
    example: 'Ganancia Neta $120,000 / 300 noches disponibles = GOPPAR $400.',
    category: 'metrics',
  },
  cpor: {
    term: 'CPOR (Costo por Noche Ocupada)',
    shortExplanation: 'Cuánto te cuesta operar cada noche que vendés',
    fullExplanation:
      'Incluye la parte proporcional de tus costos fijos (basada en capacidad total) más los costos variables por noche (lavandería, amenities). Las comisiones de canal se muestran aparte en el desglose. Sirve como referencia para tu precio mínimo.',
    formula: 'Costo Fijo por Noche + Costo Variable por Noche',
    example: 'Fijo prorrateado $800 + Variable $200 = CPOR $1,000 por noche.',
    category: 'metrics',
  },

  // ==========================================
  // TÉRMINOS FINANCIEROS
  // ==========================================
  netProfit: {
    term: 'Ganancia Neta',
    shortExplanation: 'Lo que realmente ganaste después de todo',
    fullExplanation:
      'Es lo que te queda después de restar TODOS los gastos: comisiones de canales, costos variables, costos fijos e impuestos. Si este número es positivo, ganaste. Si es negativo, perdiste plata en el período.',
    formula: 'Ingresos − Costos Fijos − Costos Variables − Comisiones − Impuestos',
    example: 'Ingresos $500,000 − Comisiones $75,000 − Costos $300,000 − Impuestos $25,000 = Ganancia Neta $100,000.',
    category: 'financial',
  },
  profitMargin: {
    term: 'Margen de Ganancia',
    shortExplanation: 'Porcentaje de ganancia sobre tus ingresos',
    fullExplanation:
      'Expresa tu ganancia neta como porcentaje del ingreso total. Un margen del 20% significa que de cada $100 que facturás, $20 son ganancia. Márgenes bajos requieren mucho volumen para ser rentable. Es la forma más directa de medir eficiencia.',
    formula: '(Ganancia Neta / Ingresos Totales) × 100',
    example: 'Ganancia $100,000 sobre Ingresos $500,000 = 20% de margen.',
    category: 'financial',
  },
  profitPerNight: {
    term: 'Ganancia por Noche',
    shortExplanation: 'Cuánto ganás realmente por cada noche vendida',
    fullExplanation:
      'Después de descontar todos los costos asociados (comisión, limpieza, costos fijos prorrateados, impuestos), esto es lo que te queda por noche. Es la métrica más importante para comparar canales entre sí.',
    formula: 'Ganancia Neta / Noches Vendidas',
    example: 'Ganancia Neta $100,000 / 200 noches = $500 por noche.',
    category: 'financial',
  },
  contributionMargin: {
    term: 'Margen de Contribución',
    shortExplanation: 'Lo que aporta cada noche para cubrir costos fijos',
    fullExplanation:
      'Después de pagar los costos variables de una noche (limpieza, amenities, lavandería), lo que sobra "contribuye" a pagar tus gastos fijos. En el punto de equilibrio se usa una versión más completa que también resta la comisión del canal.',
    formula: 'ADR − Costo Variable por Noche',
    example: 'ADR $2,000 − Variable por noche $300 = Margen de Contribución $1,700.',
    category: 'financial',
  },
  contributionPerNight: {
    term: 'Contribución por Noche (Break-Even)',
    shortExplanation: 'Lo que queda por noche después de comisión y costos variables',
    fullExplanation:
      'Es la versión completa del margen de contribución, usada para calcular el punto de equilibrio. Resta tanto la comisión promedio como los costos variables. Si este número es negativo o cero, es imposible cubrir los costos fijos.',
    formula: 'ADR × (1 − Tasa Comisión Promedio) − Costo Variable por Noche',
    example: 'ADR $2,000 × (1 − 0.15) − $300 = $1,400 de contribución por noche.',
    category: 'financial',
  },
  breakeven: {
    term: 'Punto de Equilibrio',
    shortExplanation: 'Nivel mínimo para no perder plata',
    fullExplanation:
      'Es el punto donde tus ingresos cubren exactamente tus gastos. Por debajo de este nivel, perdés plata; por encima, ganás. Puede medirse como ocupación mínima necesaria o como tarifa mínima.',
    example: 'Si necesitás vender 25 noches al mes para cubrir todos tus gastos, ese es tu punto de equilibrio.',
    category: 'financial',
  },
  breakEvenOccupancy: {
    term: 'Ocupación de Equilibrio',
    shortExplanation: 'Porcentaje mínimo de ocupación para no perder',
    fullExplanation:
      'Es el porcentaje de ocupación que necesitás alcanzar para cubrir exactamente tus costos fijos. Se calcula dividiendo tu costo fijo diario entre lo que contribuye cada noche vendida multiplicado por tu cantidad de habitaciones. Devuelve 100% si la contribución por noche es cero o negativa.',
    formula: '(Costo Fijo Diario / (Contribución por Noche × Habitaciones)) × 100',
    example: 'Fijos diarios $13,000 / ($1,400 contribución × 10 habs) = 93% de ocupación necesaria.',
    category: 'financial',
  },
  breakEvenPrice: {
    term: 'Tarifa de Equilibrio',
    shortExplanation: 'Precio mínimo por noche para no perder en cada venta',
    fullExplanation:
      'Es el precio más bajo que podés aceptar sin perder dinero. Se calcula sumando tu costo fijo por noche (basado en capacidad total) más el costo variable, y dividiendo por el margen después de comisión. Vender por debajo de esto significa pérdida segura.',
    formula: '(Costo Fijo por Noche + Costo Variable por Noche) / (1 − Tasa de Comisión)',
    example: 'Fijo $800 + Variable $200 = $1,000 base. Con 15% comisión: $1,000 / 0.85 = $1,176 mínimo.',
    category: 'financial',
  },
  marginSimulation: {
    term: 'Simulación de Margen',
    shortExplanation: 'Precios sugeridos para alcanzar un margen objetivo',
    fullExplanation:
      'Partiendo de tu tarifa de equilibrio, calcula qué precio necesitás para lograr márgenes del 10%, 20% o 30%. Útil para definir tu estrategia de precios según el nivel de ganancia que buscás.',
    formula: 'Tarifa de Equilibrio / (1 − Margen Deseado)',
    example: 'Equilibrio $1,176. Para 20% margen: $1,176 / 0.80 = $1,470.',
    category: 'financial',
  },
  unitEconomics: {
    term: 'Economía por Reserva (Unit Economics)',
    shortExplanation: 'Cuánto ganás o perdés en cada reserva individual',
    fullExplanation:
      'Analiza los números de cada reserva: ingreso, comisión del canal, costos variables (limpieza, amenities), costos fijos prorrateados e impuestos. Permite identificar qué tipo de reservas son rentables y cuáles generan pérdida.',
    formula: 'Ganancia = Ingreso − Comisión − Costos Variables − Costos Fijos Prorrateados − Impuestos',
    example: 'Reserva 3 noches Booking: $6,000 − $900 comisión − $2,100 costos = $3,000 ganancia.',
    category: 'financial',
  },
  unprofitableReservations: {
    term: 'Reservas No Rentables',
    shortExplanation: 'Reservas donde los costos superan al ingreso',
    fullExplanation:
      'Son las reservas donde después de sumar todos los costos (comisión, variables, fijos, impuestos), la ganancia neta es negativa. El sistema muestra cuántas son, qué porcentaje representan del total, y cuánto perdés en ellas.',
    formula: 'Reservas donde Ganancia Neta < 0',
    example: 'De 50 reservas, 8 son no rentables (16%) con una pérdida total de $24,000.',
    category: 'financial',
  },
  runway: {
    term: 'Días de Caja (Runway)',
    shortExplanation: 'Cuántos días podés operar con el efectivo que tenés',
    fullExplanation:
      'Divide tu saldo de caja inicial entre tu gasto neto diario promedio. Te dice cuántos días podés seguir operando si dejaran de entrar ingresos. Solo se calcula cuando el flujo neto diario es negativo. Menos de 30 días es señal de alerta.',
    formula: 'Saldo Inicial de Caja / |Flujo Neto Diario Promedio|',
    example: 'Si tenés $300,000 en caja y gastás neto $10,000 por día, tenés 30 días de runway.',
    category: 'financial',
  },
  cashFlow: {
    term: 'Flujo de Caja',
    shortExplanation: 'Movimiento real de dinero que entra y sale',
    fullExplanation:
      'Es el registro diario de todo el dinero que entra (créditos/cobros) y sale (débitos/pagos) de tu negocio. Flujo positivo significa que entra más de lo que sale. Basado en las transacciones reales del ledger.',
    formula: 'Flujo Neto Diario = Créditos del día − Débitos del día',
    example: 'Cobros del mes $500,000 − Pagos $450,000 = Flujo positivo de $50,000.',
    category: 'financial',
  },
  avgNetDaily: {
    term: 'Flujo Neto Diario Promedio',
    shortExplanation: 'Promedio de entrada/salida de dinero por día',
    fullExplanation:
      'Suma todos los flujos netos diarios del período y divide entre los días. Si es positivo, en promedio entra más de lo que sale. Si es negativo, estás gastando más de lo que cobrás y el runway se activa.',
    formula: 'Suma de Flujos Netos / Días del Período',
    example: 'Flujo neto total $150,000 en 30 días = $5,000 promedio diario.',
    category: 'financial',
  },
  reconciliation: {
    term: 'Conciliación',
    shortExplanation: 'Comparar lo que cargaste vs lo que cobraste',
    fullExplanation:
      'Proceso de verificar que el dinero que efectivamente recibiste (créditos) coincide con lo que cargaste/facturaste (débitos). Las diferencias pueden ser pagos pendientes, comisiones deducidas, reembolsos o errores.',
    formula: 'Gap = Total Débitos − Total Créditos',
    example: 'Cargaste $100,000 pero recibiste $85,000. El gap de $15,000 necesita explicación.',
    category: 'financial',
  },
  arAging: {
    term: 'Antigüedad de Cobros (A/R Aging)',
    shortExplanation: 'Clasificación de deudas pendientes por tiempo',
    fullExplanation:
      'Clasifica tus cuentas por cobrar en 4 buckets según cuándo vence el pago: Vencido (ya pasó), Próximos 7 días, Próximos 30 días, y Futuro (más de 30 días). Te ayuda a priorizar a quién cobrar primero.',
    formula: 'Total por bucket = Suma de balance_due según fecha de check-in',
    example: 'Vencido $50,000, próx. 7 días $30,000, próx. 30 días $80,000, futuro $40,000.',
    category: 'financial',
  },
  taxes: {
    term: 'Impuestos',
    shortExplanation: 'Cargos fiscales aplicados a cada reserva',
    fullExplanation:
      'Incluye IVA, tasas de ocupación y tasas turísticas configuradas. Se pueden definir como porcentaje del ingreso, monto fijo por noche, o monto fijo por estadía. Se descuentan para calcular la ganancia neta.',
    formula: 'Según tipo: (Ingreso × Tasa%) o (Fijo × Noches) o (Fijo por Estadía)',
    example: 'IVA 16%: $6,000 × 0.16 = $960. Tasa turística $50/noche × 3 = $150.',
    category: 'financial',
  },

  // ==========================================
  // MÉTRICAS DEL DASHBOARD (Home Metrics)
  // ==========================================
  cobrado: {
    term: 'Cobrado',
    shortExplanation: 'Dinero efectivamente recibido en el período',
    fullExplanation:
      'Suma de todos los créditos (pagos recibidos) registrados en las transacciones del período. Representa el dinero real que entró a tu cuenta. Puede diferir de lo cargado si hay pagos pendientes.',
    formula: 'Suma de Créditos del Período (Ledger Transactions)',
    example: 'Recibiste 45 pagos en enero, totalizando $380,000 cobrados.',
    category: 'financial',
  },
  cargado: {
    term: 'Cargado',
    shortExplanation: 'Ingresos por habitación asignados al período',
    fullExplanation:
      'Suma del ingreso por habitación (room revenue) de todas las reservas, prorrateado al período seleccionado. Si una reserva abarca dos meses, solo se cuenta la porción de noches que cae dentro del período.',
    formula: 'Suma de (room_revenue_total × noches_en_período / noches_totales)',
    example: 'Reserva de $10,000 por 5 noches, pero solo 3 están en enero → $6,000 cargados a enero.',
    category: 'financial',
  },
  pendiente: {
    term: 'Pendiente',
    shortExplanation: 'Dinero que te deben y aún no cobraste',
    fullExplanation:
      'Suma del saldo pendiente (balance due) de todas las reservas que tienen balance mayor a cero. Incluye depósitos faltantes, pagos parciales y deudas vencidas. Es el total de tu cartera por cobrar.',
    formula: 'Suma de balance_due donde balance_due > 0',
    example: 'Tenés 12 reservas con saldo pendiente que suman $95,000.',
    category: 'financial',
  },
  ahorroPotencial: {
    term: 'Ahorro Potencial',
    shortExplanation: 'Cuánto podrías ahorrar moviendo reservas a venta directa',
    fullExplanation:
      'Estima cuánto ahorrarías si movieras un 10% de las reservas de tu canal más caro a venta directa. Es una simulación rápida para visualizar el impacto de reducir la dependencia de OTAs.',
    formula: '10% del Ingreso del Canal Principal × Tasa de Comisión de ese Canal',
    example: 'Canal top factura $200,000 con 15% comisión → Ahorro: $200,000 × 10% × 15% = $3,000.',
    category: 'financial',
  },

  // ==========================================
  // CANALES DE DISTRIBUCIÓN
  // ==========================================
  ota: {
    term: 'OTA (Agencia de Viajes Online)',
    shortExplanation: 'Sitios como Booking, Airbnb, Expedia',
    fullExplanation:
      'Las OTAs (Online Travel Agencies) son plataformas donde los viajeros buscan y reservan alojamiento. Cobran comisión por cada reserva (típicamente 10-20%). Te dan visibilidad pero reducen tu margen.',
    example: 'Booking.com cobra ~15%, Airbnb ~3% al host, Expedia ~18%.',
    category: 'channels',
  },
  directChannel: {
    term: 'Canal Directo',
    shortExplanation: 'Reservas sin intermediarios (0% comisión)',
    fullExplanation:
      'Cuando el huésped reserva directamente contigo (teléfono, email, tu web, walk-in). No pagás comisión a terceros, así que tu ganancia por noche es la máxima posible. El objetivo es aumentar este tipo de reservas.',
    example: 'Un huésped te llama y reserva: 0% comisión, máxima ganancia por noche.',
    category: 'channels',
  },
  commission: {
    term: 'Comisión',
    shortExplanation: 'Porcentaje que se lleva el canal de venta',
    fullExplanation:
      'Es el porcentaje del precio de la reserva que le pagás a la OTA o canal por traerte esa reserva. Varía según el canal y tu acuerdo. Reducir la comisión promedio aumenta directamente tu rentabilidad.',
    formula: 'Comisión = Ingreso de la Reserva × Tasa de Comisión del Canal',
    example: 'Reserva de $10,000 con 15% de comisión = pagás $1,500 al canal.',
    category: 'channels',
  },
  effectiveCommission: {
    term: 'Comisión Efectiva',
    shortExplanation: 'El costo real promedio de usar ese canal',
    fullExplanation:
      'No solo la comisión declarada, sino el costo real considerando también si el canal trae tarifas más bajas, descuentos o promociones. Un canal con "15% de comisión" puede costarte más si sus huéspedes pagan menos que en otros canales.',
    formula: 'Comisiones Totales del Canal / Ingresos Totales del Canal × 100',
    example: 'Comisión 15% + descuento canal 10% = costo efectivo cercano al 25%.',
    category: 'channels',
  },
  revenueShare: {
    term: 'Revenue Share (Participación de Ingresos)',
    shortExplanation: 'Qué porcentaje del ingreso total aporta cada canal',
    fullExplanation:
      'Muestra cuánto del ingreso total viene de cada canal de venta. Sirve para entender la composición de tu negocio y detectar dependencia excesiva de un solo canal.',
    formula: 'Ingreso del Canal / Ingreso Total × 100',
    example: 'Booking $200,000 de $500,000 totales = 40% de revenue share.',
    category: 'channels',
  },
  profitShare: {
    term: 'Profit Share (Participación de Ganancia)',
    shortExplanation: 'Qué porcentaje de la ganancia total aporta cada canal',
    fullExplanation:
      'Más importante que el revenue share, muestra qué canales realmente contribuyen a tu ganancia. Un canal puede traer mucho ingreso pero poca ganancia por sus altas comisiones. Solo cuenta canales con ganancia positiva.',
    formula: 'max(0, Ganancia del Canal) / Ganancia Total Positiva × 100',
    example: 'Directo aporta 50% de la ganancia pero solo 25% del ingreso → es tu canal más eficiente.',
    category: 'channels',
  },
  channelMix: {
    term: 'Mix de Canales',
    shortExplanation: 'De dónde vienen tus reservas',
    fullExplanation:
      'La distribución porcentual de tus reservas y revenue entre los diferentes canales. Un mix saludable tiene buen porcentaje de reservas directas (al menos 30%). Depender mucho de un solo canal es riesgoso.',
    example: '40% Booking, 25% Directo, 20% Airbnb, 15% otros = tu mix de canales.',
    category: 'channels',
  },
  otaDependency: {
    term: 'Dependencia de OTAs',
    shortExplanation: 'Qué tanto dependés de las plataformas',
    fullExplanation:
      'Si más del 70% de tus reservas vienen de OTAs, tenés alta dependencia. Esto es riesgoso porque: pagás muchas comisiones, no controlás la relación con el huésped, y estás expuesto a cambios en sus políticas o algoritmos.',
    formula: 'Noches OTA / Noches Totales × 100',
    example: 'Si 85% de tus noches vendidas son de Booking, estás muy expuesto.',
    category: 'channels',
  },
  channelProfitPerNight: {
    term: 'Ganancia por Noche por Canal',
    shortExplanation: 'Cuánto dejás por noche según el canal de venta',
    fullExplanation:
      'Calcula la ganancia neta por noche de cada canal, considerando: ingreso menos comisión, costos variables, costos fijos prorrateados e impuestos. Es la mejor forma de comparar canales entre sí.',
    formula: 'Ganancia Neta del Canal / Noches del Canal',
    example: 'Directo: $800/noche, Booking: $450/noche, Airbnb: $520/noche.',
    category: 'channels',
  },

  // ==========================================
  // OPERACIONES Y COSTOS
  // ==========================================
  revenue: {
    term: 'Ingresos (Revenue)',
    shortExplanation: 'Todo el dinero que generás por ventas de habitaciones',
    fullExplanation:
      'El total de dinero que facturás por tus servicios de alojamiento, antes de descontar cualquier gasto o comisión. Es tu "línea superior" de donde parten todos los cálculos de rentabilidad. Se prorratea al período seleccionado.',
    formula: 'Suma de room_revenue_total (prorrateado al período)',
    example: '100 noches × $2,000 promedio = $200,000 de revenue.',
    category: 'operations',
  },
  fixedCosts: {
    term: 'Costos Fijos',
    shortExplanation: 'Gastos que pagás aunque no vendas nada',
    fullExplanation:
      'Son los gastos que tenés todos los meses sin importar tu ocupación: sueldos, alquiler, servicios básicos, seguros. Debés cubrirlos aunque tengas el hotel vacío. Se prorratean al período usando 30.44 días por mes.',
    formula: 'Total Mensual = Sueldos + Alquiler + Servicios + Otros. Fijo Diario = Total / 30.44',
    example: 'Sueldos $200,000 + Alquiler $150,000 + Servicios $50,000 = $400,000 fijos/mes.',
    category: 'operations',
  },
  variableCosts: {
    term: 'Costos Variables',
    shortExplanation: 'Gastos que aumentan con cada noche vendida',
    fullExplanation:
      'Gastos que solo tenés cuando vendés: limpieza por estadía, lavandería mensual y amenities mensuales. La lavandería y amenities se dividen entre las noches del período para obtener un costo por noche. La limpieza se cobra por cada estadía (check-out).',
    formula: 'Por Noche = (Lavandería + Amenities mensuales) / Noches. Por Estadía = Limpieza.',
    example: 'Lavandería + Amenities = $600/noche. Limpieza $500/checkout.',
    category: 'operations',
  },
  pnl: {
    term: 'P&L (Estado de Resultados)',
    shortExplanation: 'Resumen completo de ganancias y pérdidas',
    fullExplanation:
      'Un reporte que muestra todos tus ingresos, desglosa todos tus gastos (comisiones, variables, fijos, impuestos), y la diferencia es tu ganancia o pérdida. Es la foto financiera completa de un período.',
    example: 'P&L del mes: Ingresos $500K − Comisiones $75K − Variables $100K − Fijos $250K − Impuestos $25K = Ganancia $50K.',
    category: 'operations',
  },
  dataConfidence: {
    term: 'Confianza de Datos',
    shortExplanation: 'Qué tan confiables son los cálculos según los datos disponibles',
    fullExplanation:
      'Indica si tenemos suficiente información para darte números confiables. Se evalúa: si hay transacciones importadas, si hay reservas con financials, cobertura de meses, y configuración de costos. Con datos completos, la confianza es alta.',
    formula: 'Score 0-100 basado en: reportes importados, meses cubiertos, costos configurados',
    example: 'ALTA (80+) = todo cargado. MEDIA (60-79) = faltan algunos datos. BAJA (<60) = muy incompleto.',
    category: 'operations',
  },
  confidenceScore: {
    term: 'Score de Confianza (Cierre Mensual)',
    shortExplanation: 'Puntuación que indica si el mes está listo para cerrar',
    fullExplanation:
      'Evaluación de 0 a 100 que combina 5 checks: cobranza reconciliada, comisiones verificadas, costos configurados, impuestos configurados, y consistencia de datos. Un score de 80+ permite cerrar con confianza.',
    formula: 'Promedio ponderado de checks (required + recommended)',
    example: 'Cobranza ✓, Comisiones ✓, Costos ✓, Impuestos ✗, Consistencia ✓ = Score 80.',
    category: 'operations',
  },

  // ==========================================
  // PROYECCIONES Y COMPARATIVAS
  // ==========================================
  projectedRevenue: {
    term: 'Ingreso Proyectado',
    shortExplanation: 'Cuánto vas a facturar según reservas confirmadas',
    fullExplanation:
      'Suma del ingreso de todas las reservas futuras confirmadas, prorrateadas al período de proyección. Incluye solo reservas con check-in futuro o que se extienden al futuro.',
    formula: 'Suma de room_revenue_total de reservas futuras (prorrateado)',
    example: 'Tenés 30 reservas futuras que suman $450,000 de ingreso proyectado.',
    category: 'projections',
  },
  projectedOccupancy: {
    term: 'Ocupación Proyectada',
    shortExplanation: 'Qué tan lleno vas a estar según reservas confirmadas',
    fullExplanation:
      'Porcentaje de noches ya vendidas sobre el total de noches disponibles en el horizonte de proyección. Te ayuda a ver si necesitás impulsar ventas o si podés subir tarifas.',
    formula: 'Noches Confirmadas Futuras / Noches Disponibles Futuras × 100',
    example: 'Tenés 180 noches confirmadas de 300 disponibles = 60% de ocupación proyectada.',
    category: 'projections',
  },
  totalOTB: {
    term: 'Total OTB (On The Books)',
    shortExplanation: 'Ingreso total de reservas ya confirmadas',
    fullExplanation:
      'Suma de los ingresos de todas las reservas que ya tenés confirmadas para el futuro. Es tu "piso" de ingresos garantizados. Todo lo que se venda de ahora en más es adicional.',
    formula: 'Suma de room_revenue_total de todas las reservas futuras',
    example: 'Tenés $600,000 OTB para los próximos 3 meses.',
    category: 'projections',
  },
  avgBookingWindow: {
    term: 'Ventana de Reserva Promedio',
    shortExplanation: 'Con cuánta anticipación reservan tus huéspedes',
    fullExplanation:
      'Promedio de días entre la fecha de reserva y el check-in. Una ventana corta (menos de 7 días) indica reservas de última hora. Una ventana larga indica planificación. Útil para definir políticas de precio y cancelación.',
    formula: 'Promedio de (Fecha Check-in − Fecha de Reserva)',
    example: 'Promedio de 14 días → la mayoría reserva con 2 semanas de anticipación.',
    category: 'projections',
  },
  pickup: {
    term: 'Pickup (Reservas Nuevas)',
    shortExplanation: 'Reservas y revenue captados en los últimos 7 días',
    fullExplanation:
      'Mide cuántas reservas nuevas y cuánto revenue captaste en la última semana. Un pickup bajo con baja ocupación futura es señal de alerta. Uno alto indica buen momentum de ventas.',
    formula: 'Conteo y suma de reservas creadas en los últimos 7 días',
    example: 'Pickup últimos 7 días: 12 reservas nuevas, $85,000 en revenue.',
    category: 'projections',
  },
  pacing: {
    term: 'Pacing (Ritmo de Ventas)',
    shortExplanation: 'Cómo vas comparado con el mismo período del año pasado',
    fullExplanation:
      'Compara tus reservas actuales para un período futuro vs las que tenías al mismo punto el año anterior. Si estás "ahead" (adelante), vas mejor que antes. Si estás "behind" (atrás), necesitás actuar.',
    formula: 'Delta = Ocupación Actual OTB − Ocupación Histórica al mismo punto',
    example: 'Para marzo: 65% OTB vs 58% el año pasado al mismo punto → estás 7pp adelante.',
    category: 'projections',
  },
  forecast: {
    term: 'Forecast (Pronóstico)',
    shortExplanation: 'Estimación de ingresos futuros',
    fullExplanation:
      'Basándose en reservas confirmadas, pacing histórico y tendencias, estima cuánto vas a facturar. Incluye 3 escenarios: conservador, base y optimista. Te ayuda a anticipar problemas de caja y tomar decisiones a tiempo.',
    example: 'Forecast marzo: Base $480K, Conservador $420K, Optimista $540K.',
    category: 'projections',
  },
  momComparison: {
    term: 'Comparación MoM (Mes a Mes)',
    shortExplanation: 'Este mes vs el mes anterior',
    fullExplanation:
      'Compara las métricas clave del período actual contra el período anterior de la misma duración. Muestra revenue, ADR, ocupación, noches, comisiones y share directo/OTA, con el porcentaje de cambio.',
    formula: 'Cambio % = ((Actual − Anterior) / |Anterior|) × 100',
    example: 'Revenue: $500K vs $450K anterior = +11.1% de mejora.',
    category: 'projections',
  },
  yoyComparison: {
    term: 'Comparación YoY (Año a Año)',
    shortExplanation: 'Este período vs el mismo período del año pasado',
    fullExplanation:
      'Compara las métricas del período actual contra el mismo período del año anterior. Elimina la estacionalidad para ver si tu negocio está creciendo realmente. Compara revenue, ADR y ocupación.',
    formula: 'Cambio % = ((Actual − Año Anterior) / |Año Anterior|) × 100',
    example: 'Enero 2026 vs Enero 2025: Revenue +15%, ADR +8%, Ocupación +5pp.',
    category: 'projections',
  },
  dowPerformance: {
    term: 'Rendimiento por Día de la Semana',
    shortExplanation: 'Qué días de la semana son más rentables',
    fullExplanation:
      'Analiza ocupación, revenue y ganancia por noche para cada día de la semana. Útil para definir estrategias de precios diferenciados (fines de semana vs entre semana) y minimum stays.',
    formula: 'Para cada día: Ocupación, Revenue, Ganancia Neta y Ganancia por Noche',
    example: 'Sábados: 95% ocupación, $800/noche ganancia. Martes: 40% ocupación, $200/noche.',
    category: 'projections',
  },
  decisionPlan: {
    term: 'Plan de Decisión Semanal',
    shortExplanation: 'Acciones recomendadas para los próximos 21 días',
    fullExplanation:
      'Basado en gaps de ocupación, pacing y forecast, genera acciones concretas priorizadas: ajustes de precio, boost de visibilidad, minimum stay o promociones. Incluye escenarios y nivel de confianza.',
    example: 'Semana 2: Gap de -15pp vs histórico → Acción: Bajar precio 10% en Booking para esa semana.',
    category: 'projections',
  },
};

/**
 * Normalized lookup map: supports camelCase, lowercase, and underscore_case keys.
 * E.g. "breakEvenPrice", "breakevenPrice", "break_even_price" all resolve.
 */
const _normalizedMap = new Map<string, string>();
Object.keys(glossary).forEach(key => {
  _normalizedMap.set(key, key);
  _normalizedMap.set(key.toLowerCase(), key);
  const underscored = key.replace(/([A-Z])/g, '_$1').toLowerCase();
  _normalizedMap.set(underscored, key);
});

/**
 * Buscar un término en el glosario (case-insensitive, soporta camelCase y snake_case)
 */
export function getTerm(key: string): GlossaryTerm | undefined {
  if (glossary[key]) return glossary[key];
  const resolved = _normalizedMap.get(key) ?? _normalizedMap.get(key.toLowerCase());
  return resolved ? glossary[resolved] : undefined;
}

/**
 * Obtener términos por categoría
 */
export function getTermsByCategory(category: GlossaryTerm['category']): GlossaryTerm[] {
  return Object.values(glossary).filter(term => term.category === category);
}

/**
 * Obtener todos los términos ordenados alfabéticamente
 */
export function getAllTerms(): GlossaryTerm[] {
  return Object.values(glossary).sort((a, b) => a.term.localeCompare(b.term, 'es'));
}

/**
 * Categorías con sus nombres amigables
 */
export const categoryNames: Record<GlossaryTerm['category'], string> = {
  metrics: 'Métricas Hoteleras',
  financial: 'Términos Financieros',
  channels: 'Canales de Venta',
  operations: 'Operaciones',
  projections: 'Proyecciones y Comparativas',
};
