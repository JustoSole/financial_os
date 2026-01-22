/**
 * Glosario de términos financieros y hoteleros
 * Explicaciones en español simple para usuarios de LATAM
 */

export interface GlossaryTerm {
  term: string;
  shortExplanation: string;
  fullExplanation: string;
  example?: string;
  category: 'metrics' | 'financial' | 'channels' | 'operations';
}

export const glossary: Record<string, GlossaryTerm> = {
  // ==========================================
  // MÉTRICAS HOTELERAS
  // ==========================================
  adr: {
    term: 'ADR (Tarifa Promedio)',
    shortExplanation: 'Precio promedio por noche vendida',
    fullExplanation: 'El ADR o "Average Daily Rate" es el precio promedio que cobrás por cada noche que vendés. Se calcula dividiendo tus ingresos totales por habitación entre las noches vendidas.',
    example: 'Si ganaste $100,000 en 50 noches vendidas, tu ADR es $2,000 por noche.',
    category: 'metrics',
  },
  adrNet: {
    term: 'ADR Neto',
    shortExplanation: 'Lo que realmente te queda después de comisiones',
    fullExplanation: 'Es tu tarifa promedio MENOS las comisiones que pagás a los canales de venta (Booking, Airbnb, etc). Este es el dinero real que llega a tu bolsillo.',
    example: 'Si tu ADR es $2,000 y pagás 15% de comisión, tu ADR Neto es $1,700.',
    category: 'metrics',
  },
  revpar: {
    term: 'RevPAR (Ingreso por Habitación)',
    shortExplanation: 'Cuánto genera cada habitación en promedio',
    fullExplanation: 'El RevPAR combina tu ocupación con tu tarifa. Es útil porque no solo importa a qué precio vendés, sino cuántas noches lográs vender. Tener precios altos pero habitaciones vacías no sirve.',
    example: 'Si tenés 60% de ocupación y ADR de $2,000, tu RevPAR es $1,200.',
    category: 'metrics',
  },
  goppar: {
    term: 'GOPPAR (Ganancia por Habitación)',
    shortExplanation: 'Ganancia operativa real por habitación',
    fullExplanation: 'Similar al RevPAR, pero después de restar TODOS tus gastos operativos. Este número te dice si realmente estás ganando plata o solo moviendo dinero.',
    example: 'Si tu RevPAR es $1,200 y tus costos por habitación son $800, tu GOPPAR es $400.',
    category: 'metrics',
  },
  occupancy: {
    term: 'Ocupación',
    shortExplanation: 'Porcentaje de noches vendidas vs disponibles',
    fullExplanation: 'Mide qué tan lleno está tu hotel. Si tenés 10 habitaciones y vendiste 7 anoche, tu ocupación fue del 70%. Una ocupación muy baja significa oportunidad perdida, muy alta puede significar que podrías cobrar más.',
    example: '21 noches vendidas de 30 disponibles = 70% de ocupación.',
    category: 'metrics',
  },
  cpor: {
    term: 'CPOR (Costo por Noche Ocupada)',
    shortExplanation: 'Cuánto te cuesta cada noche que vendés',
    fullExplanation: 'Incluye todos los gastos asociados a una noche vendida: limpieza, amenities, lavandería, más una parte proporcional de tus costos fijos. Es clave para saber tu precio mínimo.',
    example: 'Si limpiar cuesta $500, amenities $200, y fijos prorrateados $800, tu CPOR es $1,500.',
    category: 'metrics',
  },

  // ==========================================
  // TÉRMINOS FINANCIEROS
  // ==========================================
  breakeven: {
    term: 'Punto de Equilibrio',
    shortExplanation: 'Nivel mínimo para no perder plata',
    fullExplanation: 'Es el punto donde tus ingresos cubren exactamente tus gastos. Por debajo de este nivel, perdés plata. Por encima, ganás. Puede medirse en noches necesarias, ocupación mínima, o tarifa mínima.',
    example: 'Si necesitás vender 25 noches al mes para cubrir todos tus gastos, ese es tu punto de equilibrio.',
    category: 'financial',
  },
  breakEvenPrice: {
    term: 'Tarifa de Equilibrio',
    shortExplanation: 'Precio mínimo para no perder en cada venta',
    fullExplanation: 'Es el precio por noche más bajo que podés aceptar sin perder dinero. Incluye tus costos variables más una parte de tus costos fijos. Vender por debajo de esto significa pérdida segura.',
    example: 'Si tu tarifa de equilibrio es $1,500, cualquier reserva por menos te hace perder plata.',
    category: 'financial',
  },
  netProfit: {
    term: 'Ganancia Neta',
    shortExplanation: 'Lo que realmente ganaste después de todo',
    fullExplanation: 'Es lo que te queda después de restar TODOS los gastos: comisiones, costos variables, costos fijos, impuestos. Si este número es positivo, ganaste. Si es negativo, perdiste.',
    example: 'Ingresos $500,000 - Comisiones $75,000 - Costos $300,000 = Ganancia Neta $125,000',
    category: 'financial',
  },
  contributionMargin: {
    term: 'Margen de Contribución',
    shortExplanation: 'Lo que aporta cada venta para cubrir fijos',
    fullExplanation: 'Después de pagar los costos directos de una reserva (limpieza, comisión, etc), lo que sobra "contribuye" a pagar tus gastos fijos. Si este margen es muy bajo, necesitás muchísima ocupación para ser rentable.',
    example: 'Si vendés a $2,000 y tus costos directos son $700, tu margen de contribución es $1,300.',
    category: 'financial',
  },
  margin: {
    term: 'Margen',
    shortExplanation: 'Porcentaje de ganancia sobre el precio',
    fullExplanation: 'Expresa tu ganancia como porcentaje del precio de venta. Un margen del 20% significa que de cada $100 que cobrás, $20 son ganancia. Márgenes bajos requieren mucho volumen para ser rentable.',
    example: 'Precio $2,000, ganancia $400 = margen del 20%.',
    category: 'financial',
  },
  runway: {
    term: 'Días de Caja (Runway)',
    shortExplanation: 'Cuántos días podés operar con lo que tenés',
    fullExplanation: 'Divide tu dinero disponible entre tu gasto diario promedio. Te dice cuántos días podés seguir operando sin nuevos ingresos. Menos de 30 días es señal de alerta.',
    example: 'Si tenés $300,000 en caja y gastás $10,000 por día, tenés 30 días de runway.',
    category: 'financial',
  },
  cashFlow: {
    term: 'Flujo de Caja',
    shortExplanation: 'Movimiento de dinero que entra y sale',
    fullExplanation: 'Es el registro de todo el dinero que entra (cobros) y sale (pagos) de tu negocio. Flujo positivo significa que entra más de lo que sale. Flujo negativo significa que estás gastando más de lo que ingresás.',
    example: 'Cobros del mes $500,000 - Pagos $450,000 = Flujo positivo de $50,000.',
    category: 'financial',
  },
  reconciliation: {
    term: 'Conciliación',
    shortExplanation: 'Comparar lo que cobraste vs lo que deberías',
    fullExplanation: 'Proceso de verificar que el dinero que efectivamente recibiste coincide con lo que facturaste. Las diferencias pueden ser pagos pendientes, comisiones no previstas, o errores.',
    example: 'Facturaste $100,000 pero solo recibiste $85,000. La diferencia de $15,000 necesita explicación.',
    category: 'financial',
  },
  arAging: {
    term: 'Antigüedad de Cobros',
    shortExplanation: 'Cuánto tiempo llevan sin pagarte',
    fullExplanation: 'Clasifica tus cuentas por cobrar según cuánto tiempo llevan pendientes. Dinero vencido hace más de 30 días es difícil de recuperar. Te ayuda a priorizar a quién perseguir primero.',
    example: 'Tenés $50,000 vencidos, $30,000 a 7 días, $80,000 a 30 días.',
    category: 'financial',
  },
  goppar: {
    term: 'GOPPAR',
    definition: 'Gross Operating Profit Per Available Room. Es la ganancia neta real por cada habitación que tenés (esté ocupada o no). A diferencia del RevPAR, el GOPPAR descuenta todos los costos operativos.',
  },
  goppar: {
    term: 'GOPPAR',
    definition: 'Gross Operating Profit Per Available Room. Es la ganancia neta real por cada habitación que tenés (esté ocupada o no). A diferencia del RevPAR, el GOPPAR descuenta todos los costos operativos.',
  },
  unitEconomics: {
    term: 'Economía por Reserva',
    shortExplanation: 'Cuánto ganás o perdés en cada reserva',
    fullExplanation: 'Analiza los números de cada reserva individual: ingreso, comisión, costos, ganancia. Te permite identificar qué tipo de reservas son las más rentables y cuáles te hacen perder plata.',
    example: 'Reserva de 3 noches por Booking: Ingreso $6,000 - Comisión $900 - Costos $2,100 = Ganancia $3,000.',
    category: 'financial',
  },
  profitPerNight: {
    term: 'Ganancia por Noche',
    shortExplanation: 'Cuánto ganás realmente por cada noche vendida',
    fullExplanation: 'Después de descontar todos los costos asociados a esa noche (limpieza, comisión, costos fijos prorrateados), esto es lo que te queda. Es la métrica más importante para comparar canales.',
    example: 'ADR $2,000 - Comisión $300 - CPOR $1,200 = Ganancia por noche $500.',
    category: 'financial',
  },

  // ==========================================
  // CANALES DE DISTRIBUCIÓN
  // ==========================================
  ota: {
    term: 'OTA (Portal de Reservas Online)',
    shortExplanation: 'Sitios como Booking, Airbnb, Expedia',
    fullExplanation: 'Las OTAs (Online Travel Agencies) son plataformas donde los viajeros buscan y reservan alojamiento. Cobran comisión por cada reserva (típicamente 10-20%). Te dan visibilidad pero reducen tu margen.',
    example: 'Booking.com cobra ~15%, Airbnb ~3% al host, Expedia ~18%.',
    category: 'channels',
  },
  directChannel: {
    term: 'Canal Directo',
    shortExplanation: 'Reservas sin intermediarios',
    fullExplanation: 'Cuando el huésped reserva directamente contigo (teléfono, email, tu web, walk-in). No pagás comisión a terceros, así que tu ganancia es mayor. El objetivo es aumentar este tipo de reservas.',
    example: 'Un huésped te llama y reserva: 0% comisión, máxima ganancia.',
    category: 'channels',
  },
  commission: {
    term: 'Comisión',
    shortExplanation: 'Porcentaje que se lleva el canal',
    fullExplanation: 'Es el porcentaje del precio de la reserva que le pagás a la OTA o canal por traerte esa reserva. Varía según el canal y tu acuerdo. Reducir comisiones promedio aumenta tu rentabilidad.',
    example: 'Reserva de $10,000 con 15% de comisión = pagás $1,500 al canal.',
    category: 'channels',
  },
  effectiveCommission: {
    term: 'Comisión Efectiva',
    shortExplanation: 'El costo real de usar ese canal',
    fullExplanation: 'No solo la comisión declarada, sino considerando también si el canal trae tarifas más bajas, descuentos, o promociones que reducen tu ingreso. Un canal con "15% de comisión" puede costarte más si sus huéspedes pagan menos.',
    example: 'Comisión 15% + descuento canal 10% = costo efectivo cercano al 25%.',
    category: 'channels',
  },
  channelMix: {
    term: 'Mix de Canales',
    shortExplanation: 'De dónde vienen tus reservas',
    fullExplanation: 'La distribución porcentual de tus reservas entre diferentes canales. Un mix saludable tiene buen porcentaje de reservas directas (al menos 30%). Depender mucho de un solo canal es riesgoso.',
    example: '40% Booking, 25% Directo, 20% Airbnb, 15% otros = tu mix de canales.',
    category: 'channels',
  },
  otaDependency: {
    term: 'Dependencia de OTAs',
    shortExplanation: 'Qué tanto dependés de las plataformas',
    fullExplanation: 'Si más del 70% de tus reservas vienen de OTAs, tenés alta dependencia. Esto es riesgoso porque: pagás muchas comisiones, no controlás la relación con el huésped, y estás expuesto a cambios en sus políticas.',
    example: 'Si 85% de tus reservas son de Booking, estás muy expuesto a ese canal.',
    category: 'channels',
  },

  // ==========================================
  // OPERACIONES
  // ==========================================
  fixedCosts: {
    term: 'Costos Fijos',
    shortExplanation: 'Gastos que pagás aunque no vendas nada',
    fullExplanation: 'Son los gastos que tenés todos los meses sin importar tu ocupación: sueldos, alquiler, servicios básicos, seguros. Debés cubrirlos aunque tengas el hotel vacío.',
    example: 'Sueldos $200,000 + Alquiler $150,000 + Servicios $50,000 = $400,000 fijos/mes.',
    category: 'operations',
  },
  variableCosts: {
    term: 'Costos Variables',
    shortExplanation: 'Gastos que aumentan con la ocupación',
    fullExplanation: 'Gastos que solo tenés cuando vendés: limpieza, lavandería, amenities, comisiones. Cuantas más noches vendés, más gastás en esto. Son directamente proporcionales a tu actividad.',
    example: 'Cada checkout te cuesta: limpieza $500 + amenities $200 + lavandería $300 = $1,000 variable.',
    category: 'operations',
  },
  revenue: {
    term: 'Ingresos (Revenue)',
    shortExplanation: 'Todo el dinero que generás por ventas',
    fullExplanation: 'El total de dinero que facturás por tus servicios de alojamiento, antes de descontar cualquier gasto o comisión. Es tu "línea superior" de donde parten todos los cálculos.',
    example: '100 noches × $2,000 promedio = $200,000 de revenue.',
    category: 'operations',
  },
  forecast: {
    term: 'Proyección',
    shortExplanation: 'Estimación de lo que va a pasar',
    fullExplanation: 'Basándose en datos históricos y reservas confirmadas, se estima cuánto vas a ganar/gastar en el futuro. Te ayuda a anticipar problemas de caja y tomar decisiones a tiempo.',
    example: 'Proyección de caja para los próximos 30 días basada en reservas confirmadas.',
    category: 'operations',
  },
  pnl: {
    term: 'P&L (Estado de Resultados)',
    shortExplanation: 'Resumen de ganancias y pérdidas',
    fullExplanation: 'Un reporte que muestra todos tus ingresos, todos tus gastos, y la diferencia (ganancia o pérdida). Es la foto financiera de un período específico.',
    example: 'P&L del mes: Ingresos $500K - Gastos $400K = Ganancia $100K.',
    category: 'operations',
  },
  dataConfidence: {
    term: 'Confianza de Datos',
    shortExplanation: 'Qué tan precisos son los cálculos',
    fullExplanation: 'Indica si tenemos suficiente información para darte números confiables. Si faltan datos (costos, reservas, transacciones), los cálculos son estimaciones. Con datos completos, los números son más precisos.',
    example: 'Confianza ALTA = todos los datos cargados. MEDIA = faltan algunos. BAJA = muy incompleto.',
    category: 'operations',
  },
};

/**
 * Buscar un término en el glosario
 */
export function getTerm(key: string): GlossaryTerm | undefined {
  return glossary[key.toLowerCase()];
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
  metrics: '📊 Métricas Hoteleras',
  financial: '💰 Términos Financieros', 
  channels: '🌐 Canales de Venta',
  operations: '⚙️ Operaciones',
};

