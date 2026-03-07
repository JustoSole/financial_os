import { useState, useEffect, useCallback } from 'react';
import { User, Building, Bell, Sparkles, Check, Crown, Star, Lock, Info, LogOut, Receipt, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getCosts, trackEvent, updateCosts, updateProperty } from '../api';
import { Button, Alert } from '../components/ui';
import { useAsyncActionFeedback } from '../hooks/useAsyncActionFeedback';
import { supabase } from '../lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './Settings.module.css';
import { DEFAULT_TAX_RULES, PLAN_INFO } from '@financial-os/shared';
import type { TaxRule, PlanType } from '@financial-os/shared';

const TAX_TYPE_LABELS: Record<TaxRule['type'], string> = {
  VAT: 'IVA / VAT',
  OCCUPANCY: 'Tasa de ocupación',
  CITY_TAX: 'Tasa municipal',
  OTHER: 'Otro',
};

const TAX_METHOD_LABELS: Record<TaxRule['method'], string> = {
  percentage: 'Porcentaje (%)',
  fixed_per_night: 'Fijo por noche',
  fixed_per_stay: 'Fijo por estadía',
};

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
    name: PLAN_INFO.free.displayName,
    price: PLAN_INFO.free.priceLabel,
    period: '',
    description: 'Probalo gratis con lo esencial',
    features: [
      ...PLAN_INFO.free.features.map(f => ({ text: f, included: true })),
      { text: 'Proyección de caja', included: false },
      { text: 'Exportes PDF/Excel', included: false },
    ],
  },
  pro: {
    name: PLAN_INFO.pro.displayName,
    price: `$${PLAN_INFO.pro.price}`,
    period: '/mes',
    description: 'Todo el poder para tu hotel',
    features: PLAN_INFO.pro.features.map(f => ({ text: f, included: true })),
    popular: true,
  },
};

export default function Settings() {
  const { property, refreshProperty } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'plans');
  const rawPlan = property?.plan;
  const currentPlan: PlanType = rawPlan === 'pro' ? 'pro' : 'free';
  const [propertyName, setPropertyName] = useState('');
  const [currency, setCurrency] = useState('ARS');
  const [roomCount, setRoomCount] = useState(0);
  const [taxRules, setTaxRules] = useState<TaxRule[]>(DEFAULT_TAX_RULES);
  const [taxRulesLoaded, setTaxRulesLoaded] = useState(false);
  const saveFeedback = useAsyncActionFeedback({
    successMessage: 'Cambios guardados',
    errorMessage: 'No se pudieron guardar los cambios',
    successResetMs: 3000,
  });
  const taxFeedback = useAsyncActionFeedback({
    successMessage: 'Impuestos guardados',
    errorMessage: 'No se pudieron guardar los impuestos',
    successResetMs: 3000,
  });

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
        setRoomCount(currentRoomCount);
        if (res.data.tax_rules && res.data.tax_rules.length > 0) {
          setTaxRules(res.data.tax_rules.map((r: any) => ({
            id: r.id || crypto.randomUUID(),
            name: r.name || TAX_TYPE_LABELS[r.type as TaxRule['type']] || r.type,
            type: r.type || 'VAT',
            appliesTo: r.appliesTo || 'room_rate',
            method: r.method || 'percentage',
            value: r.value ?? 21,
            includedInRate: r.includedInRate ?? true,
          })));
        }
        setTaxRulesLoaded(true);
      }
    }
    loadCosts();
    return () => {
      active = false;
    };
  }, [property]);

  const handleAddTaxRule = useCallback(() => {
    setTaxRules(prev => [...prev, {
      id: crypto.randomUUID(),
      name: '',
      type: 'OTHER',
      appliesTo: 'room_rate',
      method: 'percentage',
      value: 0,
      includedInRate: true,
    }]);
    taxFeedback.reset();
  }, [taxFeedback]);

  const handleRemoveTaxRule = useCallback((id: string) => {
    setTaxRules(prev => prev.filter(r => r.id !== id));
    taxFeedback.reset();
  }, [taxFeedback]);

  const handleUpdateTaxRule = useCallback((id: string, field: keyof TaxRule, value: any) => {
    setTaxRules(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === 'type' && !r.name) {
        updated.name = TAX_TYPE_LABELS[value as TaxRule['type']] || '';
      }
      return updated;
    }));
    taxFeedback.reset();
  }, [taxFeedback]);

  const handleSaveTaxRules = async () => {
    if (!property) return;
    await taxFeedback.run(async () => {
      const res = await updateCosts(property.id, { tax_rules: taxRules });
      if (!res.success) throw new Error(res.error || 'No se pudieron guardar los impuestos');
    });
  };

  const handleSave = async () => {
    if (!property) return;
    const trimmedName = propertyName.trim() || property.name;
    const safeRoomCount = Number.isFinite(roomCount) && roomCount > 0 ? Math.round(roomCount) : 1;

    await saveFeedback.run(async () => {
      const [propertyRes, costsRes] = await Promise.all([
        updateProperty(property.id, {
          name: trimmedName,
          currency,
          timezone: property.timezone,
        }),
        updateCosts(property.id, { roomCount: safeRoomCount }),
      ]);
      if (!propertyRes.success) throw new Error(propertyRes.error || 'No se pudo guardar la propiedad');
      if (!costsRes.success) throw new Error(costsRes.error || 'No se pudo guardar la configuración');
      await refreshProperty();
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const tabs = [
    { id: 'plans', label: 'Planes', icon: Crown },
    { id: 'property', label: 'Propiedad', icon: Building },
    { id: 'fiscal', label: 'Fiscal', icon: Receipt },
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
                      saveFeedback.reset();
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Moneda</label>
                  <select
                    value={currency}
                    onChange={(event) => {
                      setCurrency(event.target.value);
                      saveFeedback.reset();
                    }}
                  >
                    <option value="ARS">Peso Argentino (ARS)</option>
                    <option value="MXN">Peso Mexicano (MXN)</option>
                    <option value="COP">Peso Colombiano (COP)</option>
                    <option value="USD">Dólar (USD)</option>
                    <option value="BRL">Real (BRL)</option>
                    <option value="EUR">Euro (EUR)</option>
                  </select>
                  <small style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Esta moneda se usa para mostrar todos los valores. Debería coincidir con la de tus archivos CSV.
                  </small>
                </div>
                <div className="form-group">
                  <label>Total de Habitaciones</label>
                  <input
                    type="number"
                    min={1}
                    value={roomCount}
                    onChange={(event) => {
                      setRoomCount(Number(event.target.value));
                      saveFeedback.reset();
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

              {saveFeedback.error && (
                <Alert variant="error" title="Error" dismissible onDismiss={saveFeedback.reset}>
                  {saveFeedback.error}
                </Alert>
              )}
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={handleSave} disabled={saveFeedback.loading}>
                  {saveFeedback.loading ? 'Guardando...' : saveFeedback.success ? 'Guardado' : 'Guardar Cambios'}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'fiscal' && (
            <div className={styles.cardSection}>
              <h3>Impuestos y Tasas</h3>
              <p className={styles.sectionDesc}>
                Configurá los impuestos que aplican a tu tarifa. Estos se descuentan del revenue para calcular el resultado operativo real.
              </p>

              {taxRules.length === 0 && taxRulesLoaded && (
                <div className={styles.infoBox} style={{ marginBottom: 'var(--space-4)' }}>
                  <Info size={18} />
                  <p>No tenés impuestos configurados. Sin impuestos, el P&L no refleja la carga fiscal real. Agregá al menos el IVA.</p>
                </div>
              )}

              <div className={styles.taxRulesList}>
                {taxRules.map((rule, idx) => (
                  <div key={rule.id} className={styles.taxRuleCard}>
                    <div className={styles.taxRuleHeader}>
                      <span className={styles.taxRuleNumber}>#{idx + 1}</span>
                      <button
                        className={styles.taxRuleRemoveBtn}
                        onClick={() => handleRemoveTaxRule(rule.id)}
                        title="Eliminar impuesto"
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className={styles.taxRuleFields}>
                      <div className="form-group">
                        <label>Nombre</label>
                        <input
                          type="text"
                          value={rule.name}
                          placeholder="Ej: IVA, Tasa municipal..."
                          onChange={(e) => handleUpdateTaxRule(rule.id, 'name', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Tipo</label>
                        <select
                          value={rule.type}
                          onChange={(e) => handleUpdateTaxRule(rule.id, 'type', e.target.value)}
                        >
                          {Object.entries(TAX_TYPE_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Método</label>
                        <select
                          value={rule.method}
                          onChange={(e) => handleUpdateTaxRule(rule.id, 'method', e.target.value)}
                        >
                          {Object.entries(TAX_METHOD_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>
                          {rule.method === 'percentage' ? 'Porcentaje (%)' : `Monto (${currency})`}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={rule.method === 'percentage' ? 0.5 : 1}
                          value={rule.value}
                          onChange={(e) => handleUpdateTaxRule(rule.id, 'value', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Aplica sobre</label>
                        <select
                          value={rule.appliesTo}
                          onChange={(e) => handleUpdateTaxRule(rule.id, 'appliesTo', e.target.value)}
                        >
                          <option value="room_rate">Tarifa de habitación</option>
                          <option value="total">Total facturado</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={rule.includedInRate}
                            onChange={(e) => handleUpdateTaxRule(rule.id, 'includedInRate', e.target.checked)}
                          />
                          <span>Incluido en la tarifa</span>
                        </label>
                        <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '0.25rem' }}>
                          Si está incluido, se descuenta del revenue en el P&L
                        </small>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className={styles.addTaxRuleBtn}
                onClick={handleAddTaxRule}
              >
                <Plus size={16} /> Agregar impuesto
              </button>

              <div className={styles.infoBox} style={{ marginTop: 'var(--space-4)' }}>
                <Info size={18} />
                <p>
                  <strong>¿Incluido en tarifa?</strong> Si tu tarifa ya incluye el impuesto (ej: publicás $12,100 con IVA incluido),
                  marcá la casilla. El sistema calculará que $2,100 son impuestos y $10,000 revenue neto.
                </p>
              </div>

              {taxFeedback.error && (
                <Alert variant="error" title="Error" dismissible onDismiss={taxFeedback.reset}>
                  {taxFeedback.error}
                </Alert>
              )}
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={handleSaveTaxRules} disabled={taxFeedback.loading}>
                  {taxFeedback.loading ? 'Guardando...' : taxFeedback.success ? 'Guardado' : 'Guardar Impuestos'}
                </Button>
              </div>
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
                  <Button 
                    variant="ghost" 
                    className="danger" 
                    onClick={handleLogout}
                  >
                    <LogOut size={16} style={{ marginRight: '0.5rem' }} />
                    Cerrar Sesión
                  </Button>
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

