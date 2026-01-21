import { useState, useEffect } from 'react';
import { User, Building, Bell, Sparkles, Check, Crown, Star, Lock, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getCosts, trackEvent, updateCosts, updateProperty } from '../api';
import { Button } from '../components/ui';
import styles from './Settings.module.css';

type PlanType = 'free' | 'pro';

interface PlanConfig {
  name: string;
  price: string;
  period: string;
  description: string;
  features: { text: string; included: boolean }[];
  popular?: boolean;
}

const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    name: 'Free', price: '$0', period: '/mes',
    description: 'Probalo gratis con lo esencial',
    features: [
      { text: 'Carga manual de CSVs', included: true },
      { text: 'Métricas básicas', included: true },
      { text: 'Data Health Score', included: true },
      { text: 'Historial limitado', included: false },
      { text: 'Proyección de caja', included: false },
    ],
  },
  pro: {
    name: 'Financial OS', price: '$49', period: '/mes',
    description: 'Todo el poder para tu hotel',
    features: [
      { text: 'Historial ilimitado', included: true },
      { text: 'Proyección de caja', included: true },
      { text: 'Acciones ilimitadas', included: true },
      { text: 'Exportes PDF/Excel', included: true },
      { text: 'Soporte prioritario', included: true },
    ],
    popular: true,
  },
};

export default function Settings() {
  const { property, refreshProperty } = useApp();
  const [activeTab, setActiveTab] = useState('plans');
  const rawPlan = property?.plan;
  const currentPlan: PlanType = rawPlan === 'pro' ? 'pro' : 'free';
  const [propertyName, setPropertyName] = useState('');
  const [currency, setCurrency] = useState('ARS');
  const [roomCount, setRoomCount] = useState(13);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (property) trackEvent(property.id, 'view_settings');
  }, [property]);

  useEffect(() => {
    if (!property) return;
    setPropertyName(property.name || '');
    setCurrency(property.currency || 'ARS');
  }, [property]);

  useEffect(() => {
    let active = true;
    async function loadCosts() {
      if (!property) return;
      const res = await getCosts(property.id);
      if (!active) return;
      if (res.success && res.data) {
        const currentRoomCount = res.data.room_count || 0;
        setRoomCount(currentRoomCount > 0 ? currentRoomCount : 13);
      }
    }
    loadCosts();
    return () => {
      active = false;
    };
  }, [property]);

  const handleSave = async () => {
    if (!property) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);

    const trimmedName = propertyName.trim() || property.name;
    const safeRoomCount = Number.isFinite(roomCount) && roomCount > 0 ? Math.round(roomCount) : 13;

    try {
      const [propertyRes, costsRes] = await Promise.all([
        updateProperty(property.id, {
          name: trimmedName,
          currency,
          timezone: property.timezone,
        }),
        updateCosts(property.id, { roomCount: safeRoomCount }),
      ]);

      if (!propertyRes.success) {
        throw new Error(propertyRes.error || 'No se pudo guardar la propiedad');
      }
      if (!costsRes.success) {
        throw new Error(costsRes.error || 'No se pudo guardar la configuración');
      }

      await refreshProperty();
      setSaved(true);
    } catch (error: any) {
      setSaveError(error.message || 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'plans', label: 'Planes', icon: Crown },
    { id: 'property', label: 'Propiedad', icon: Building },
    { id: 'notifications', label: 'Notificaciones', icon: Bell },
    { id: 'account', label: 'Cuenta', icon: User },
  ];

  return (
    <div className="page-settings">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Administrá tu cuenta y plan</p>
        </div>
      </div>

      <div className={styles.settingsLayout}>
        {/* Tabs */}
        <div className={styles.settingsTabs}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`${styles.tabBtn} ${activeTab === tab.id ? styles.active : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="settings-content">
          {activeTab === 'plans' && (
            <div className="tab-plans">
              <div className={styles.currentPlan}>
                <span className={styles.currentLabel}>Tu Plan Actual</span>
                <h3>{PLANS[currentPlan].name}</h3>
                <p>{PLANS[currentPlan].description}</p>
              </div>

              <div className={styles.plansGrid}>
                {Object.entries(PLANS).map(([id, plan]) => (
                  <div 
                    key={id} 
                    className={`${styles.planCard} ${currentPlan === id ? styles.current : ''} ${plan.popular ? styles.popular : ''}`}
                  >
                    {plan.popular && (
                      <div className={styles.popularBadge}>
                        <Star size={12} fill="white" />
                        RECOMENDADO
                      </div>
                    )}
                    <h4>{plan.name}</h4>
                    <div className={styles.planPricing}>
                      <span className={styles.planPrice}>{plan.price}</span>
                      <span className={styles.planPeriod}>{plan.period}</span>
                    </div>
                    <p>{plan.description}</p>
                    
                    <ul className={styles.planFeatures}>
                      {plan.features.map((f, i) => (
                        <li key={i} className={f.included ? styles.included : ''}>
                          {f.included ? <Check size={14} /> : <Lock size={12} />}
                          {f.text}
                        </li>
                      ))}
                    </ul>

                    {currentPlan === id ? (
                      <div className={styles.planCurrent}>
                        <Check size={16} /> Plan Actual
                      </div>
                    ) : (
                      <Button variant={plan.popular ? 'primary' : 'secondary'} fullWidth>
                        Cambiar Plan
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'property' && (
            <div className={styles.cardSection}>
              <h3>Información de la Propiedad</h3>
              <p className={styles.sectionDesc}>Configurá los datos base de tu hotel</p>
              
              <div className={styles.formGrid}>
                <div className="form-group">
                  <label>Nombre del Hotel</label>
                  <input
                    type="text"
                    value={propertyName}
                    onChange={(event) => {
                      setPropertyName(event.target.value);
                      setSaved(false);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Moneda</label>
                  <select
                    value={currency}
                    onChange={(event) => {
                      setCurrency(event.target.value);
                      setSaved(false);
                    }}
                  >
                    <option value="USD">Dólar (USD)</option>
                    <option value="ARS">Peso Argentino (ARS)</option>
                    <option value="MXN">Peso Mexicano (MXN)</option>
                    <option value="BRL">Real (BRL)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Total de Habitaciones</label>
                  <input
                    type="number"
                    min={1}
                    value={roomCount}
                    onChange={(event) => {
                      setRoomCount(Number(event.target.value));
                      setSaved(false);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Categoría</label>
                  <select defaultValue="hotel">
                    <option value="hotel">Hotel</option>
                    <option value="hostel">Hostel</option>
                    <option value="apart">Apart Hotel</option>
                    <option value="cabins">Cabañas</option>
                  </select>
                </div>
              </div>

              <div className={styles.infoBox}>
                <Info size={18} />
                <p>Estos datos se usan para calcular ocupación y proyecciones. Asegurate de que sean correctos.</p>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Cambios'}
                </Button>
              </div>
              {saveError && <p className={styles.errorText}>{saveError}</p>}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className={styles.cardSection}>
              <h3>Alertas y Notificaciones</h3>
              <p className={styles.sectionDesc}>Elegí cómo y cuándo querés que te avisemos</p>

              <div className={styles.notificationList}>
                <div className={styles.notificationItem}>
                  <div>
                    <strong>Resumen Semanal</strong>
                    <span>Un reporte consolidado de tu performance los lunes</span>
                  </div>
                  <label className={styles.toggle}>
                    <input type="checkbox" defaultChecked />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                <div className={styles.notificationItem}>
                  <div>
                    <strong>Alertas de Pérdida</strong>
                    <span>Avisame inmediatamente si detectás una reserva con pérdida</span>
                  </div>
                  <label className={styles.toggle}>
                    <input type="checkbox" defaultChecked />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                <div className={styles.notificationItem}>
                  <div>
                    <strong>Riesgo de Liquidez</strong>
                    <span>Alerta cuando el runway proyectado sea menor a 15 días</span>
                  </div>
                  <div className={styles.upgradePrompt}>
                    <Sparkles size={18} />
                    <div>
                      <strong>Disponible en Plan Starter</strong>
                      <span>Pasate a un plan pago para habilitar alertas avanzadas</span>
                    </div>
                    <Button variant="ghost" size="sm">Ver Planes</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className={styles.cardSection}>
              <h3>Mi Cuenta</h3>
              <p className={styles.sectionDesc}>Gestioná tus datos personales y seguridad</p>

              <div className={styles.formGrid}>
                <div className="form-group">
                  <label>Nombre</label>
                  <input type="text" defaultValue="Usuario Financial OS" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" defaultValue="admin@hotel.com" disabled />
                </div>
              </div>

              <Button variant="secondary">Cambiar Contraseña</Button>

              <div className={styles.dangerZone}>
                <h4>Zona de Peligro</h4>
                <div className={styles.dangerActions}>
                  <Button variant="ghost" className="danger">Cerrar Sesión</Button>
                  <Button variant="ghost" className="danger">Eliminar Cuenta</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

