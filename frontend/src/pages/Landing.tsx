import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart3, 
  CheckCircle2, 
  ChevronRight, 
  DollarSign, 
  LayoutDashboard, 
  ShieldCheck, 
  Zap,
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import { Button } from '../components/ui';
import { supabase } from '../lib/supabase';
import styles from './Landing.module.css';

export default function Landing() {
  const [formData, setFormData] = useState({
    email: '',
    hotel_web: '',
    pms: 'cloudbeds',
    room_count: '1-10',
    priority: 'rentabilidad'
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
          pms: formData.pms,
          room_count: formData.room_count,
          priority: formData.priority
        }]);

      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting lead:', err);
      setError('Hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
            Entendé cuánto te queda.<br />
            <span>No cuánto facturás.</span>
          </h1>
          <p className={styles.sub}>
            Financial OS convierte tus reportes de Cloudbeds en un panel simple para <strong>ver cuánto te queda</strong>, <strong>ordenar cuentas</strong> y <strong>tomar decisiones con claridad</strong> (sin planillas).
          </p>
          <div className={styles.heroCtas}>
            <a href="#solicitar" className={styles.primaryCta}>Solicitar acceso</a>
            <a href="#como-funciona" className={styles.secondaryCta}>Ver cómo funciona</a>
          </div>
          <div className={styles.microTrust}>
            <Zap size={16} /> Sin integraciones · Subís reportes · Resultado en minutos
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
                <h4>Exportás de Cloudbeds</h4>
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
                  <p>Rentabilidad neta real, ocupación, punto de equilibrio y OTB. Dejá de saltar entre pestañas de Cloudbeds.</p>
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
          <div className={styles.faqGrid}>
            <div className={styles.faqItem}>
              <h4>¿Necesito integrar Cloudbeds por API?</h4>
              <p>No. Empezás subiendo reportes (CSV) de forma manual y segura.</p>
            </div>
            <div className={styles.faqItem}>
              <h4>¿Esto reemplaza Cloudbeds?</h4>
              <p>No. Cloudbeds opera; Financial OS ordena y explica el resultado financiero.</p>
            </div>
            <div className={styles.faqItem}>
              <h4>¿Y si mis costos no están perfectos?</h4>
              <p>Podés empezar simple y mejorar el modelo de costos con el tiempo dentro de la app.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA / Form */}
      <section id="solicitar" className={styles.ctaFinal}>
        <div className={styles.sectionContent}>
          <div className={styles.formCard}>
            {submitted ? (
              <div className={styles.successMessage}>
                <CheckCircle2 size={48} color="var(--color-success)" />
                <h3>¡Solicitud enviada!</h3>
                <p>Te contactaremos pronto para ayudarte con tu primer import.</p>
              </div>
            ) : (
              <>
                <h3>Probalo con tus datos.</h3>
                <p>Si te da claridad, lo seguís. Si no, lo dejás.</p>
                
                <form onSubmit={handleSubmit} className={styles.form}>
                  <div className={styles.formGroup}>
                    <label>Email</label>
                    <input 
                      type="email" 
                      name="email" 
                      required 
                      placeholder="tu@email.com" 
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Hotel / Web</label>
                    <input 
                      type="text" 
                      name="hotel_web" 
                      required 
                      placeholder="Nombre de tu hotel" 
                      value={formData.hotel_web}
                      onChange={handleChange}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>¿Qué PMS usás?</label>
                      <select name="pms" value={formData.pms} onChange={handleChange}>
                        <option value="cloudbeds">Cloudbeds</option>
                        <option value="mews">Mews</option>
                        <option value="amenitiz">Amenitiz</option>
                        <option value="sirvoy">Sirvoy</option>
                        <option value="otro">Otro / Ninguno</option>
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label>Habitaciones</label>
                      <select name="room_count" value={formData.room_count} onChange={handleChange}>
                        <option value="1-10">1-10</option>
                        <option value="11-30">11-30</option>
                        <option value="31-50">31-50</option>
                        <option value="50+">50+</option>
                      </select>
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>¿Qué querés ordenar primero?</label>
                    <select name="priority" value={formData.priority} onChange={handleChange}>
                      <option value="rentabilidad">Rentabilidad real</option>
                      <option value="canales">Canales y comisiones</option>
                      <option value="cobranzas">Cobranzas y pendientes</option>
                      <option value="costos">Control de costos</option>
                    </select>
                  </div>
                  
                  {error && <p className={styles.errorText}>{error}</p>}
                  
                  <Button type="submit" fullWidth disabled={loading}>
                    {loading ? 'Enviando...' : 'Solicitar acceso'}
                  </Button>
                  <p className={styles.microcopy}>Te ayudamos con el primer import.</p>
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

