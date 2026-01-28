import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  CheckCircle2, 
  DollarSign, 
  LayoutDashboard, 
  Zap
} from 'lucide-react';
import { Button } from '../components/ui';
import { supabase } from '../lib/supabase';
import styles from './Landing.module.css';

export default function Landing() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    hotel_web: '',
    pms: '',
    room_count: '1-10',
    priority: '',
    uses_cloudbeds: 'si'
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('leads')
        .insert([{
          email: formData.email,
          hotel_web: formData.hotel_web,
          pms: formData.uses_cloudbeds === 'si' ? 'cloudbeds' : formData.pms,
          room_count: formData.room_count,
          priority: formData.priority,
          metadata: { 
            uses_cloudbeds: formData.uses_cloudbeds,
            room_count: formData.room_count,
            main_problem: formData.priority
          }
        }]);

      if (insertError) throw insertError;
      
      if (formData.uses_cloudbeds === 'si') {
        // Redirect to register flow for Cloudbeds users
        navigate('/registro', { state: { email: formData.email } });
      } else {
        setSubmitted(true);
      }
    } catch (err: any) {
      console.error('Error submitting lead:', err);
      setError('Hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className={styles.landingContainer}>
      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={styles.logo}>Financial OS</div>
          <div className={styles.navLinks}>
            <Link to="/login" className={styles.loginLink}>Iniciar Sesión</Link>
            <a href="#solicitar" className={styles.navCta}>Solicitar acceso</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.h1}>
            Tu rentabilidad real,<br />
            <span>sin planillas eternas.</span>
          </h1>
          <p className={styles.sub}>
            Financial OS convierte tus reportes de tu PMS en un panel simple para <strong>ver cuánto te queda</strong>, <strong>ordenar cuentas</strong> y <strong>tomar decisiones con claridad</strong>.
          </p>
          <div className={styles.heroCtas}>
            <a href="#solicitar" className={styles.primaryCta}>Probar con mis datos</a>
            <a href="#como-funciona" className={styles.secondaryCta}>Ver cómo funciona</a>
          </div>
          <div className={styles.microTrust}>
            <Zap size={16} /> Especializado en PMS · Resultado en minutos
          </div>
        </div>
      </header>

      {/* Problem Section */}
      <section className={styles.problem}>
        <div className={styles.sectionContent}>
          <h2>La mayoría de hoteles ve facturación, pero no ve rentabilidad.</h2>
          <p>
            Entre comisiones, canales, cobros pendientes y costos dispersos, terminás decidiendo por intuición.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <div className={styles.sectionContent}>
          <h3>Con Financial OS podés:</h3>
          <div className={styles.featureGrid}>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}><BarChart3 /></div>
              <h4>Rentabilidad operativa real</h4>
              <p>Mirá el resultado neto después de comisiones y costos, no solo ventas brutas.</p>
            </div>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}><DollarSign /></div>
              <h4>Entender qué la explica</h4>
              <p>Analizá el impacto de cada canal, comisión y costo en tu margen final.</p>
            </div>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}><CheckCircle2 /></div>
              <h4>Ordenar cuentas</h4>
              <p>Seguimiento de cobranzas pendientes y pagos por verificar en un solo lugar.</p>
            </div>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}><Zap /></div>
              <h4>Decidir con claridad</h4>
              <p>Un resumen claro para saber exactamente qué ajustar esta semana.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works - Modern & Sleek */}
      <section id="como-funciona" className={styles.howItWorks}>
        <div className={styles.sectionContent}>
          <div className={styles.howItWorksHeader}>
            <div className={styles.carouselTag}>Simplicidad radical</div>
            <h3>Tu panel listo en menos de 2 minutos</h3>
            <p>Sin integraciones complejas ni llamadas con soporte técnico.</p>
          </div>
          
          <div className={styles.modernSteps}>
            <div className={styles.modernStep}>
              <div className={styles.modernStepVisual}>
                <div className={styles.modernStepIcon}>
                  <LayoutDashboard size={32} />
                </div>
                <div className={styles.modernStepLine}></div>
              </div>
              <div className={styles.modernStepContent}>
                <h4>Exportás de tu PMS</h4>
                <p>Descargás el reporte de <strong>Transacciones</strong> y <strong>Reservas</strong>. Son solo dos clics desde tu panel actual.</p>
              </div>
            </div>

            <div className={styles.modernStep}>
              <div className={styles.modernStepVisual}>
                <div className={styles.modernStepIcon}>
                  <Zap size={32} />
                </div>
                <div className={styles.modernStepLine}></div>
              </div>
              <div className={styles.modernStepContent}>
                <h4>Subís a Financial OS</h4>
                <p>Arrastrás los archivos. Nuestro motor procesa, limpia y organiza los datos por vos al instante.</p>
              </div>
            </div>

            <div className={styles.modernStep}>
              <div className={styles.modernStepVisual}>
                <div className={styles.modernStepIcon}>
                  <CheckCircle2 size={32} />
                </div>
              </div>
              <div className={styles.modernStepContent}>
                <h4>Tomás el control</h4>
                <p>Tu rentabilidad real, el mix de canales y la lista de pendientes aparecen listos para la acción.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Differentiation - High Impact Card */}
      <section className={styles.diff}>
        <div className={styles.sectionContent}>
          <div className={styles.diffContainer}>
            <div className={styles.diffContent}>
              <div className={styles.diffBadge}>El diferencial</div>
              <h3>No es otro dashboard.<br/>Es control operativo.</h3>
              <p>
                Las herramientas típicas te inundan con gráficos de facturación. 
                Financial OS te da la <strong>explicación del resultado</strong> y los <strong>pendientes</strong> para que sepas exactamente qué hacer al cerrar el día.
              </p>
              <div className={styles.diffFeatures}>
                <div className={styles.diffFeatureItem}>
                  <CheckCircle2 size={20} />
                  <span>Resultado Neto Real</span>
                </div>
                <div className={styles.diffFeatureItem}>
                  <CheckCircle2 size={20} />
                  <span>Explicación por Canal</span>
                </div>
                <div className={styles.diffFeatureItem}>
                  <CheckCircle2 size={20} />
                  <span>Agenda de Pendientes</span>
                </div>
              </div>
            </div>
            <div className={styles.diffVisual}>
              <div className={styles.orderVisual}>
                <div className={styles.orderRow}>Métricas de ventas...</div>
                <div className={styles.orderRow}>Gráficos confusos...</div>
                <div className={styles.orderRowActive}>Financial OS: Rentabilidad + Acción</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Preview - Carousel Style */}
      <section className={styles.preview}>
        <div className={styles.sectionContent}>
          <div className={styles.previewHeader}>
            <h3>Explorá el control total de tu hotel</h3>
            <p>Una interfaz diseñada para la claridad, no para la complejidad.</p>
          </div>
          
          <div className={styles.carouselContainer}>
            <div className={styles.carouselTrack}>
              <div className={styles.carouselItem}>
                <div className={styles.carouselImage}>
                  <img src="/screenshots/panel_control.png" alt="Panel de Control" />
                </div>
                <div className={styles.carouselInfo}>
                  <div className={styles.carouselTag}>Dashboard Principal</div>
                  <h4>Todo tu negocio en una sola vista</h4>
                  <p>Rentabilidad neta real, ocupación, punto de equilibrio y OTB. Dejá de saltar entre pestañas de tu PMS.</p>
                </div>
              </div>

              <div className={styles.carouselItem}>
                <div className={styles.carouselImage}>
                  <img src="/screenshots/Proyecciones.png" alt="Proyecciones y Pacing" />
                </div>
                <div className={styles.carouselInfo}>
                  <div className={styles.carouselTag}>Proyecciones</div>
                  <h4>Anticipate al futuro</h4>
                  <p>Visualizá tu ocupación confirmada (OTB) y compará tu ritmo de venta (Pacing) contra el año pasado para detectar baches antes de que ocurran.</p>
                </div>
              </div>

              <div className={styles.carouselItem}>
                <div className={styles.carouselImage}>
                  <img src="/screenshots/canales.png" alt="Análisis de Canales" />
                </div>
                <div className={styles.carouselInfo}>
                  <div className={styles.carouselTag}>Distribución</div>
                  <h4>¿Qué canal te deja más dinero?</h4>
                  <p>No mires solo la tarifa. Compará el ADR neto real después de comisiones por cada canal de venta.</p>
                </div>
              </div>

              <div className={styles.carouselItem}>
                <div className={styles.carouselImage}>
                  <img src="/screenshots/acciones.png" alt="Cuentas Pendientes" />
                </div>
                <div className={styles.carouselInfo}>
                  <div className={styles.carouselTag}>Operaciones</div>
                  <h4>Cuentas claras, siempre</h4>
                  <p>Controlá cobranzas pendientes y pagos por verificar. Que no se te escape ni un centavo por falta de seguimiento.</p>
                </div>
              </div>

              <div className={styles.carouselItem}>
                <div className={styles.carouselImage}>
                  <img src="/screenshots/rentablidiad.png" alt="Rentabilidad Detallada" />
                </div>
                <div className={styles.carouselInfo}>
                  <div className={styles.carouselTag}>Rentabilidad</div>
                  <h4>Análisis reserva por reserva</h4>
                  <p>Detectá patrones de rentabilidad y entendé exactamente por qué algunas reservas rinden más que otras.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Whom */}
      <section className={styles.target}>
        <div className={styles.sectionContent}>
          <h3>Para quién es</h3>
          <p>
            Para <strong>dueños y administradores</strong> de hoteles chicos/medianos que quieren <strong>claridad financiera sin contabilidad</strong> ni planillas eternas.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className={styles.faq}>
        <div className={styles.sectionContent}>
          <h3>Preguntas Frecuentes</h3>
          <div className={styles.faqAccordion}>
            <details className={styles.faqItem}>
              <summary>¿Necesito integrar mi PMS por API?</summary>
              <div className={styles.faqAnswer}>
                <p>No es necesario. Podés empezar hoy mismo subiendo tus reportes CSV de forma manual y segura. Es la forma más rápida de obtener claridad sin procesos técnicos complejos.</p>
              </div>
            </details>

            <details className={styles.faqItem}>
              <summary>¿Esto reemplaza a mi PMS?</summary>
              <div className={styles.faqAnswer}>
                <p>No. Tu PMS es tu motor operativo (reservas, check-ins, disponibilidad). Financial OS es tu cerebro financiero: toma la información de tu PMS y la transforma en decisiones de rentabilidad, control de costos y proyecciones.</p>
              </div>
            </details>

            <details className={styles.faqItem}>
              <summary>¿Mis datos financieros están seguros?</summary>
              <div className={styles.faqAnswer}>
                <p>Absolutamente. Utilizamos protocolos de seguridad de nivel bancario. Tus datos se procesan de forma privada y solo vos tenés acceso a la información de tu propiedad.</p>
              </div>
            </details>

            <details className={styles.faqItem}>
              <summary>¿Cuánto tiempo toma ver mi primer reporte?</summary>
              <div className={styles.faqAnswer}>
                <p>Menos de 5 minutos. Una vez que subís los reportes de tu PMS, nuestro motor de cálculo procesa todo instantáneamente para mostrarte tu rentabilidad real.</p>
              </div>
            </details>

            <details className={styles.faqItem}>
              <summary>¿Qué pasa si mis costos no están claros?</summary>
              <div className={styles.faqAnswer}>
                <p>No te preocupes. Podés empezar con un modelo simple y la app te ayudará a identificar y categorizar tus costos (comisiones, limpieza, fijos) para que tu visión financiera sea cada vez más precisa.</p>
              </div>
            </details>

            <details className={styles.faqItem}>
              <summary>¿Por qué Financial OS y no un Excel?</summary>
              <div className={styles.faqAnswer}>
                <p>El Excel es manual, propenso a errores y requiere horas de mantenimiento. Financial OS automatiza el cruce de datos, detecta discrepancias en pagos y te da insights que una planilla estática no puede ver.</p>
              </div>
            </details>
          </div>

          <div className={styles.faqContact}>
            <p>¿Tenés alguna otra duda?</p>
            <a href="https://wa.me/your-number" target="_blank" rel="noopener noreferrer" className={styles.wppButton}>
              Chateá con nosotros por WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA / Registration Form */}
      <section id="solicitar" className={styles.ctaFinal}>
        <div className={styles.sectionContent}>
          <div className={styles.formCard}>
            {submitted ? (
              <div className={styles.successMessage}>
                <CheckCircle2 size={48} color="#2563eb" />
                <h3>¡Gracias por tu interés!</h3>
                <p>Te hemos anotado en la lista de espera. Te contactaremos pronto para darte acceso a Financial OS.</p>
                <a 
                  href="https://wa.me/5492944806519?text=Hola!%20Me%20anot%C3%A9%20en%20la%20waitlist%20de%20Financial%20OS%20pero%20me%20gustar%C3%ADa%20acceder%20antes."
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.wppButton}
                  style={{ marginTop: '1rem' }}
                >
                  Hablar por WhatsApp
                </a>
              </div>
            ) : (
              <>
                <h3>Probar con mis datos</h3>
                <p>Si usás Cloudbeds, podés acceder hoy mismo.</p>
                
                <form onSubmit={handleSubmit} className={styles.form}>
                  <div className={styles.formGroup}>
                    <label>¿Usás Cloudbeds como PMS?</label>
                    <select 
                      name="uses_cloudbeds" 
                      value={formData.uses_cloudbeds} 
                      onChange={handleChange}
                      required
                    >
                      <option value="si">Sí, uso Cloudbeds</option>
                      <option value="no">No, uso otro</option>
                    </select>
                  </div>

                  {formData.uses_cloudbeds === 'no' && (
                    <div className={styles.formGroup}>
                      <label>¿Qué PMS usás?</label>
                      <input 
                        type="text" 
                        name="pms" 
                        placeholder="Ej: Mews, Opera, Amenitiz..."
                        value={formData.pms}
                        onChange={handleChange}
                        required 
                      />
                    </div>
                  )}

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Email profesional</label>
                      <input 
                        type="email" 
                        name="email" 
                        placeholder="tu@hotel.com"
                        value={formData.email}
                        onChange={handleChange}
                        required 
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Nro. de habitaciones</label>
                      <select 
                        name="room_count" 
                        value={formData.room_count} 
                        onChange={handleChange}
                        required
                      >
                        <option value="1-10">1-10</option>
                        <option value="11-30">11-30</option>
                        <option value="31-50">31-50</option>
                        <option value="50+">50+</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Web del Hotel</label>
                    <input 
                      type="text" 
                      name="hotel_web" 
                      placeholder="www.tu-hotel.com"
                      value={formData.hotel_web}
                      onChange={handleChange}
                      required 
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>¿Cuál es tu principal problema hoy?</label>
                    <textarea 
                      name="priority" 
                      placeholder="Ej: No sé mi rentabilidad real, pierdo mucho tiempo con planillas, comisiones muy altas..."
                      value={formData.priority}
                      onChange={handleChange}
                      required
                      className={styles.textarea}
                    />
                  </div>

                  {error && <div className={styles.errorText}>{error}</div>}

                  <Button 
                    type="submit" 
                    variant="primary" 
                    size="lg" 
                    loading={loading}
                  >
                    {formData.uses_cloudbeds === 'si' ? 'Acceder ahora' : 'Anotarme en la lista'}
                  </Button>

                  <div className={styles.wppDivider}>
                    <span>o también podés</span>
                  </div>

                  <a 
                    href="https://wa.me/5492944806519?text=Hola!%20Vengo%20de%20la%20landing%20de%20Financial%20OS.%20Me%20gustar%C3%ADa%20probarlo%20con%20mis%20datos%20de%20Cloudbeds."
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.wppButtonOutline}
                  >
                    Consultar por WhatsApp
                  </a>

                  <p className={styles.microcopy}>
                    {formData.uses_cloudbeds === 'si' 
                      ? 'Entrás directo a subir tus reportes.' 
                      : 'Te avisaremos cuando abramos para otros PMS.'}
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.sectionContent}>
          <p>© 2026 Financial OS. Diseñado para hoteleros.</p>
        </div>
      </footer>
    </div>
  );
}

