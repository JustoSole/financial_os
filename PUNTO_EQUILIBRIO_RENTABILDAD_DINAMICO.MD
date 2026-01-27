Propuesta Técnica: Punto de Equilibrio Dinámico (Simulador de Elasticidad)
1. Concepto Visual y UX
En lugar de añadir una página nueva, integraremos un "Modo Simulación" dentro de la tarjeta actual de "Precio Sugerido" o "Punto de Equilibrio".
El Trigger: Un pequeño interruptor (toggle) que diga: "¿Qué pasa si ajusto mis precios?".
La Interacción: Un slider intuitivo que permita al usuario jugar con el precio (ej. de -15% a +30%).
El Resultado: Una respuesta en lenguaje natural que elimine la fricción cognitiva.
2. Lógica de Cálculo (Eficiencia)
Utilizaremos los datos que ya tienes en el AppContext o MetricsService:
P<sub>actual</sub>: Precio promedio actual.
CV: Costo Variable por noche (limpieza, insumos).
CF: Costos Fijos totales del periodo.
Com%: Comisión promedio de canales.
N<sub>actual</sub>: Noches vendidas actualmente.
La fórmula mágica (Margen de Seguridad):
Calcularemos cuántas noches ($N_{sim}$) se necesitan vender al nuevo precio ($P_{sim}$) para igualar la utilidad actual ($U_{actual}$):
$N_{sim} = \frac{U_{actual} + CF}{P_{sim} \times (1 - Com\%) - CV}$
3. Guion de Interfaz (Copywriting UI)
La clave de la intuición es el lenguaje. El componente mostrará:
> "Si subes tu precio un [10%]..."
> * Tu nuevo precio sería: $58.500
> * Podrías vender hasta [4] noches menos y seguirías ganando lo mismo ($1.2M).
> * Tu ocupación necesaria baja del 65% al 58%.
4. Hoja de Ruta de Implementación
Fase A: Preparación de Datos (Frontend)
Identificar en frontend/src/pages/Profitability.tsx (o el componente de costos) dónde se reciben los metrics.
Crear un hook local useDynamicBreakEven que tome el precio base y los costos fijos/variables.
Fase B: Componente UI (Moderno y Limpio)
Slider Custom: Usar un slider con colores semánticos (Verde si subes precio, Azul si bajas).
Tarjeta de Resultados: Un pequeño cuadro con un borde animado sutil que destaque el "Margen de Seguridad" (las noches que puede permitirse perder).
Tooltips Educativos: Explicar brevemente que el cálculo incluye comisiones y costos variables para que el usuario confíe en el número.
Fase C: Feedback Visual
Indicador de Riesgo: Si el usuario baja el precio tanto que el punto de equilibrio supera la capacidad del hotel, el sistema mostrará una alerta: "Cuidado: Este precio requiere una ocupación imposible (>100%)".
5. Por qué es eficiente
Cero llamadas al API: Todo el "juego" ocurre en el navegador del usuario. Es instantáneo.
Reutilización: Usamos los estilos de theme.css y los componentes de UI que ya tienes (probablemente basados en Tailwind o CSS Modules).
Valor Inmediato: Transforma un dato contable aburrido (Break-even) en una herramienta estratégica de ventas.