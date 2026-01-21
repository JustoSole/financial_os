A continuación tenés la **versión final** (curada con criterio de industria) de las **preguntas que un dueño de hotel debe poder responder**. Están ordenadas por “loops” de decisión reales (salud del negocio, rentabilidad, distribución, caja y control). Incluyo solo preguntas que típicamente se apoyan en KPIs estándar de revenue/profit (Occupancy/ADR/RevPAR/GOPPAR), distribución (net revenue / costo de distribución) y control de pace/pickup. ([Tripleseat][1])

---

## 1) Salud del negocio en 60 segundos

1. **¿Estoy ganando o perdiendo dinero en el período?** (profit neto operativo)
2. **¿Mi desempeño base de revenue está sano?**

   * ¿Cómo están **Occupancy, ADR y RevPAR**? ([Tripleseat][1])
3. **¿Mi rentabilidad está sana, no solo el revenue?**

   * ¿Cómo está mi **GOPPAR**? ([Canary Technologies][2])
4. **¿Qué cambió vs el período comparable anterior y por qué?** (drivers: noches, ADR, comisiones, costos)
5. **¿Qué número me debería preocupar hoy?** (alerta principal: bajo break-even / caída net revenue / gap de caja)

---

## 2) Rentabilidad y punto de equilibrio (las preguntas que mandan)

6. **¿Cuál es mi punto de equilibrio en ocupación (%) para este período?**
7. **¿Cuántas noches necesito vender para cubrir costos fijos?**
8. **¿Cuál es mi “tarifa mínima” para no perder plata (break-even price)?**
9. **Si apunto a un margen objetivo (10% / 20% / 30%), ¿cuál es la tarifa mínima?** (slider de margen, sin “reco engine”)
10. **¿Qué tan lejos estoy del equilibrio hoy?** (gap en $ y en noches)
11. **¿Qué pasa con mi break-even si suben costos variables por noche?** (sensibilidad simple)
12. **¿Estoy empeorando por precio (ADR) o por ocupación (noches)?** (decomposición RevPAR: Occupancy vs ADR)

---

## 3) Unit economics (por noche) — claridad brutal

13. **¿Cuánto gano “por noche ocupada” en promedio?** (profit / nights)
14. **¿Cuál es mi margen de contribución por noche?** (ADR neto − costo variable por noche)
15. **¿Cuánto me cuesta operar cada habitación ocupada?** (CPOR / costo por habitación ocupada) ([Priority Software][3])
16. **¿Qué parte del costo total es fijo vs variable?** (mix)
17. **¿Qué variable de costo se disparó y cuándo?** (housekeeping/amenities/lavandería, etc.)

---

## 4) Distribución y canales (la verdad de dónde viene el margen)

18. **¿Cuál es mi mix de canales por revenue y por noches?**
19. **¿Cuál es mi “costo de distribución” por canal?** (comisión + fees asociados) ([Your Site NAME Goes HERE][4])
20. **¿Cuál es el ingreso neto por canal (después de comisión/fees)?** (Net Revenue)
21. **¿Cuál canal aporta más profit por noche?** (no el que más vende)
22. **¿Estoy sobre-dependiente de OTAs?** (direct share vs OTA share; foco en neto) ([سويتش هوتيل سوليوشنز][5])
23. **¿Cuánto estoy pagando en comisión promedio efectiva?** (ponderada por revenue)
24. **¿Qué canal “se ve bien” en revenue pero es malo en margen?** (alerta canal tóxico por neto)

---

## 5) Caja, cobranzas y reconciliación (operación real, no teoría)

25. **¿Cuánto cobré realmente vs cuánto “cargué/reconocí” en el PMS?** (gap y explicación)
26. **¿Cuánta plata tengo pendiente por cobrar (balance due) y de qué reservas viene?**
27. **¿Qué parte de mi pending está vencida vs futura?** (aging simple)
28. **¿Mi caja aguanta X días si todo sigue igual?** (runway operativo)
29. **¿Qué eventos me están rompiendo caja?** (refunds/voids/ajustes)

---

## 6) Pace / Pickup (sin forecasting complejo, pero con control real)

Estas preguntas son estándar en revenue management para entender “cómo viene el mes” en reservas **on-the-books** y su evolución. ([HSMAI Academy][6])

30. **¿Cómo viene el pace del mes vs el mismo punto del mes anterior?**
31. **¿Cuánto pick-up tuve en los últimos 7 días para las próximas 30 noches?**
32. **¿Qué fechas futuras están flojas (huecos) y cuáles están fuertes?**
33. **¿Mi ADR on-the-books está subiendo o bajando a medida que se llena?** (señal de pricing/estrategia)

---

## 7) Calidad de datos y confianza (sin esto, el BI es humo)

34. **¿Tengo data suficiente para confiar en estos números?** (score y razones)
35. **¿Qué inputs faltan para que la rentabilidad sea “HIGH confidence”?** (room count, costos, comisiones reales, etc.)
36. **¿Qué parte es “real” y qué parte es “estimada”?** (con etiquetas claras)
37. **¿Qué reportes faltan importar para completar el análisis?** (transactions / reservations / channel summary)

---

## 8) Preguntas “de acción” (para que no sea un dashboard pasivo)

38. **¿Cuál es la 1 acción con más impacto esta semana?** (reducir comisión efectiva / subir ADR mínimo / recortar variable cost)
39. **¿Qué canal debería empujar si quiero mejorar margen sin perder demasiada ocupación?** (basado en profit/night y net revenue)
40. **¿Qué ajuste de margen objetivo es realista para mi estacionalidad?** (simulación con slider, no recomendación automática)

---

# Prioridad para tu producto (para no sobredesarrollar)

Si querés que el sistema sea **simple pero potente**, hacé que V1 responda impecable estas 15 (y el resto puede ir “progressive disclosure”):

**Core V1 (deberían quedar perfectas):** 1–3, 6–10, 18–21, 25–27, 34–36.
Estas cubren: Big 3 + GOPPAR, break-even completo, unit economics por canal, caja/reconciliación, y data trust. ([Tripleseat][1])

---

Si querés, el siguiente paso lógico es que convierta esta lista final en un **“Question → Metric → Data Source → Endpoint → UI Component”** para tu coder LLM, de forma que cada pregunta tenga su implementación cerrada (sin ambigüedad).

[1]: https://tripleseat.com/blog/understanding-the-hotel-industrys-most-critical-kpis-and-leveraging-data-to-succeed/?utm_source=chatgpt.com "The Hotel KPIs You Need to Track: A Guide to Data-Driven ..."
[2]: https://www.canarytechnologies.com/post/hotel-revenue-management?utm_source=chatgpt.com "​​Advanced Hotel Revenue Management: A Guide for 2026"
[3]: https://www.priority-software.com/resources/hotel-performance-metrics/?utm_source=chatgpt.com "15 Hotel Performance Metrics & KPIs In 2026"
[4]: https://rategain.com/blog/how-channel-management-impacts-revenue-in-the-hotel-business/?utm_source=chatgpt.com "How Channel Management Impacts Hotel Revenue"
[5]: https://switchhotelsolutions.com.au/10-kpis-for-direct-booking-success/?utm_source=chatgpt.com "10 KPIs for Direct Booking Success"
[6]: https://academy.hsmai.org/glossary/pick-up-or-pace-report/?utm_source=chatgpt.com "Pick-up or Pace report"
