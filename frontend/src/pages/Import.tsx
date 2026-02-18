import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  CheckCircle, Circle, AlertTriangle, Lock, Unlock,
  ChevronDown, ChevronUp, Shield, Calendar, Save, Copy,
  Upload, Calculator, Plus, Trash2, Receipt, Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { 
  getImportJobs, trackEvent,
  getMonthlyCloseDetail, closeMonth, reopenMonth,
  getMonthlyCosts, updateMonthlyCosts, copyPreviousMonthCosts, getCostCategories,
  getCosts, updateCosts,
  MonthlyCloseDetail, MonthlyCloseCheck,
  type MonthlyCostEntry, type CostCategoryOption,
} from '../api';
import { useAsyncActionFeedback } from '../hooks/useAsyncActionFeedback';
import { formatMonth, generateMonthOptions } from '../utils/formatters';
import ImportWizard from '../components/ImportWizard';
import { Button, Alert } from '../components/ui';
import styles from './Import.module.css';

interface TaxRule {
  id: string;
  name: string;
  type: 'VAT' | 'OCCUPANCY' | 'CITY_TAX' | 'OTHER';
  appliesTo: 'room_rate' | 'total';
  method: 'percentage' | 'fixed_per_night' | 'fixed_per_stay';
  value: number;
  includedInRate: boolean;
}

const DEFAULT_TAX_RULES: TaxRule[] = [
  { id: 'iva', name: 'IVA', type: 'VAT', appliesTo: 'room_rate', method: 'percentage', value: 21, includedInRate: true },
];

const TAX_TYPE_OPTIONS: { value: TaxRule['type']; label: string }[] = [
  { value: 'VAT', label: 'IVA / VAT' },
  { value: 'OCCUPANCY', label: 'Tasa de ocupación' },
  { value: 'CITY_TAX', label: 'Tasa municipal' },
  { value: 'OTHER', label: 'Otro' },
];

const TAX_METHOD_OPTIONS: { value: TaxRule['method']; label: string }[] = [
  { value: 'percentage', label: 'Porcentaje (%)' },
  { value: 'fixed_per_night', label: 'Fijo por noche' },
  { value: 'fixed_per_stay', label: 'Fijo por estadía' },
];

const CONFIDENCE_COLORS: Record<string, string> = {
  high: '#16a34a',
  medium: '#d97706',
  low: '#dc2626',
};

function ConfidenceBadge({ score, band }: { score: number; band: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
      background: `${CONFIDENCE_COLORS[band]}15`, color: CONFIDENCE_COLORS[band],
    }}>
      <Shield size={12} /> {score}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    open: { label: 'Abierto', bg: '#dbeafe', color: '#1d4ed8' },
    closed: { label: 'Cerrado', bg: '#dcfce7', color: '#16a34a' },
    closed_with_warnings: { label: 'Cerrado c/alertas', bg: '#fef3c7', color: '#d97706' },
  };
  const s = map[status] || map.open;
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

export default function Import() {
  const { property, refreshData } = useApp();
  const [searchParams] = useSearchParams();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [closeDetail, setCloseDetail] = useState<MonthlyCloseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showChecks, setShowChecks] = useState(true);
  const [monthlyEntries, setMonthlyEntries] = useState<MonthlyCostEntry[]>([]);
  const [monthlyCashBalance, setMonthlyCashBalance] = useState<number | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CostCategoryOption[]>([]);
  const [costsLoading, setCostsLoading] = useState(false);
  const [taxRules, setTaxRules] = useState<TaxRule[]>(DEFAULT_TAX_RULES);
  const [taxRulesLoaded, setTaxRulesLoaded] = useState(false);
  const [showTaxSection, setShowTaxSection] = useState(false);
  const [activeTab, setActiveTab] = useState<'reportes' | 'costos'>(
    searchParams.get('tab') === 'costos' ? 'costos' : 'reportes'
  );

  const closeFeedback = useAsyncActionFeedback({
    successMessage: 'Mes cerrado exitosamente',
    errorMessage: 'No se pudo cerrar el mes',
    successResetMs: 5000,
  });

  const reopenFeedback = useAsyncActionFeedback({
    successMessage: 'Mes reabierto',
    errorMessage: 'Error al reabrir',
    successResetMs: 3000,
  });

  const costsSaveFeedback = useAsyncActionFeedback({
    successMessage: 'Costos guardados',
    errorMessage: 'Error al guardar costos',
    successResetMs: 3000,
  });
  const costsCopyFeedback = useAsyncActionFeedback({
    successMessage: 'Costos copiados del mes anterior',
    errorMessage: 'Error al copiar',
    successResetMs: 3000,
  });
  const taxSaveFeedback = useAsyncActionFeedback({
    successMessage: 'Impuestos guardados',
    errorMessage: 'Error al guardar impuestos',
    successResetMs: 3000,
  });

  useEffect(() => {
    let active = true;
    async function loadTaxRules() {
      if (!property?.id) return;
      const res = await getCosts(property.id);
      if (!active) return;
      if (res.success && res.data?.tax_rules?.length > 0) {
        setTaxRules(res.data.tax_rules.map((r: any) => ({
          id: r.id || crypto.randomUUID(),
          name: r.name || r.type,
          type: r.type || 'VAT',
          appliesTo: r.appliesTo || 'room_rate',
          method: r.method || 'percentage',
          value: r.value ?? 21,
          includedInRate: r.includedInRate ?? true,
        })));
      }
      setTaxRulesLoaded(true);
    }
    loadTaxRules();
    return () => { active = false; };
  }, [property?.id]);

  const handleSaveTaxRules = async () => {
    if (!property?.id) return;
    await taxSaveFeedback.run(async () => {
      const res = await updateCosts(property.id, { tax_rules: taxRules });
      if (!res.success) throw new Error(res.error || 'Error al guardar impuestos');
    });
  };

  const loadMonthlyCosts = useCallback(async () => {
    if (!property?.id) return;
    setCostsLoading(true);
    try {
      const [costsRes, catsRes] = await Promise.all([
        getMonthlyCosts(property.id, selectedMonth),
        getCostCategories(property.id),
      ]);
      if (costsRes.success && costsRes.data) {
        setMonthlyEntries(costsRes.data.entries || []);
        setMonthlyCashBalance(costsRes.data.cashBalance ?? null);
        setCategoryOptions(costsRes.data.categories?.length ? costsRes.data.categories : (catsRes.data || []));
      } else if (catsRes.success && catsRes.data) {
        setCategoryOptions(catsRes.data);
      }
    } catch (err) {
      console.error('Error loading costs:', err);
    } finally {
      setCostsLoading(false);
    }
  }, [property?.id, selectedMonth]);

  useEffect(() => { loadMonthlyCosts(); }, [loadMonthlyCosts]);

  const updateEntry = (categoryKey: string, costType: string, amount: number) => {
    setMonthlyEntries(prev => {
      const idx = prev.findIndex(e => e.categoryKey === categoryKey && e.costType === costType);
      if (idx >= 0) {
        const u = [...prev];
        u[idx] = { ...u[idx], amount };
        return u;
      }
      const cat = categoryOptions.find(c => c.categoryKey === categoryKey);
      return [...prev, { categoryKey, displayName: cat?.displayName || categoryKey, costType: costType as any, amount, source: 'manual' }];
    });
  };

  const handleSaveCosts = async () => {
    if (!property?.id) return;
    await costsSaveFeedback.run(async () => {
      const entries = monthlyEntries
        .filter(e => e.amount >= 0)
        .map(e => ({ categoryKey: e.categoryKey, costType: e.costType, amount: e.amount, note: e.note }));
      const res = await updateMonthlyCosts(property.id, selectedMonth, { entries, cashBalance: monthlyCashBalance });
      if (!res.success) throw new Error(res.error || 'Error al guardar');
      await loadMonthlyCosts();
      await loadCloseDetail();
      refreshData();
    });
  };

  const handleCopyCosts = async () => {
    if (!property?.id) return;
    await costsCopyFeedback.run(async () => {
      const res = await copyPreviousMonthCosts(property.id, selectedMonth);
      if (!res.success) throw new Error(res.error || 'Error al copiar');
      await loadMonthlyCosts();
      await loadCloseDetail();
    });
  };

  const formatInputValue = (v: number) => v === 0 ? '0' : v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const parseInput = (v: string) => { const d = v.replace(/[^\d]/g, ''); return d ? Number(d) : 0; };

  const DEFAULT_CATEGORIES: CostCategoryOption[] = [
    { categoryKey: 'salaries', displayName: 'Sueldos', costTypeDefault: 'fixed', sortOrder: 10 },
    { categoryKey: 'rent', displayName: 'Alquiler', costTypeDefault: 'fixed', sortOrder: 20 },
    { categoryKey: 'utilities', displayName: 'Servicios (luz, gas, agua)', costTypeDefault: 'fixed', sortOrder: 30 },
    { categoryKey: 'software', displayName: 'Software (PMS, etc)', costTypeDefault: 'fixed', sortOrder: 40 },
    { categoryKey: 'insurance', displayName: 'Seguros', costTypeDefault: 'fixed', sortOrder: 50 },
    { categoryKey: 'maintenance', displayName: 'Mantenimiento', costTypeDefault: 'fixed', sortOrder: 60 },
    { categoryKey: 'laundry', displayName: 'Lavandería', costTypeDefault: 'variable', sortOrder: 70 },
    { categoryKey: 'amenities', displayName: 'Amenities', costTypeDefault: 'variable', sortOrder: 80 },
    { categoryKey: 'supplies', displayName: 'Insumos', costTypeDefault: 'variable', sortOrder: 90 },
    { categoryKey: 'cleaning', displayName: 'Limpieza por estadía', costTypeDefault: 'variable', sortOrder: 95 },
    { categoryKey: 'marketing', displayName: 'Marketing', costTypeDefault: 'fixed', sortOrder: 100 },
  ];

  const activeCats = categoryOptions.length > 0 ? categoryOptions : DEFAULT_CATEGORIES;

  const loadAll = useCallback(async () => {
    if (!property?.id) return;
    setLoading(true);
    try {
      const jobsRes = await getImportJobs(property.id, selectedMonth);
      if (jobsRes.success && jobsRes.data) {
        const mapped = jobsRes.data.map((j: any) => ({
          id: j.id,
          filename: j.file_name || '—',
          report_type: j.job_type,
          rows: j.rows_total ?? j.rows_ok ?? 0,
          uploaded_at: j.created_at,
          status: j.status === 'completed' ? 'processed' : j.status,
        }));
        setHistory(mapped);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error('Error loading:', err);
    } finally {
      setLoading(false);
    }
  }, [property?.id, selectedMonth]);

  useEffect(() => {
    if (property?.id) {
      loadAll();
      trackEvent(property.id, 'view_import');
    }
  }, [property?.id, loadAll]);

  const loadCloseDetail = useCallback(async () => {
    if (!property?.id) return;
    setDetailLoading(true);
    try {
      const res = await getMonthlyCloseDetail(property.id, selectedMonth);
      if (res.success && res.data) setCloseDetail(res.data);
    } catch (err) {
      console.error('Error loading close detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, [property?.id, selectedMonth]);

  useEffect(() => {
    loadCloseDetail();
  }, [loadCloseDetail]);

  const handleClose = async () => {
    if (!property?.id) return;
    await closeFeedback.run(async () => {
      const res = await closeMonth(property.id, selectedMonth);
      if (!res.success) throw new Error(res.error || 'Faltan requisitos para cerrar');
      refreshData();
      await loadCloseDetail();
      await loadAll();
    });
  };

  const handleReopen = async () => {
    if (!property?.id) return;
    await reopenFeedback.run(async () => {
      const res = await reopenMonth(property.id, selectedMonth);
      if (!res.success) throw new Error(res.error || 'Error al reabrir');
      await loadCloseDetail();
      await loadAll();
    });
  };

  const monthOptions = useMemo(() => generateMonthOptions(12, 1), []);

  const reportNames: Record<string, string> = {
    expanded_transactions: 'Transacciones',
    reservations_financials: 'Reservas',
    unknown: 'Desconocido',
  };

  const isClosed = closeDetail?.status === 'closed' || closeDetail?.status === 'closed_with_warnings';
  const requiredChecks = closeDetail?.checks?.filter(c => c.type === 'required') || [];
  const recommendedChecks = closeDetail?.checks?.filter(c => c.type === 'recommended') || [];
  const allRequiredPassed = requiredChecks.every(c => c.passed);

  return (
    <div className={styles.pageImport}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Datos</h1>
          <p className={styles.pageSubtitle}>Subí reportes, cargá costos y cerrá {formatMonth(selectedMonth)}</p>
        </div>
      </div>

      {/* Month selector + status bar */}
      <div className={styles.closeBar}>
        <Calendar size={18} className={styles.closeBarIcon} />
        <select
          className={styles.closeBarSelect}
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {monthOptions.map(m => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>

        {closeDetail && (
          <>
            <StatusBadge status={closeDetail.status} />
            <ConfidenceBadge score={closeDetail.confidenceScore} band={closeDetail.confidenceBand} />
          </>
        )}

        <div className={styles.closeBarActions}>
          {isClosed ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReopen}
              loading={reopenFeedback.loading}
              icon={<Unlock size={14} />}
            >
              Reabrir
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleClose}
              loading={closeFeedback.loading}
              disabled={!allRequiredPassed}
              icon={<Lock size={14} />}
            >
              Cerrar mes
            </Button>
          )}
        </div>
      </div>

      {/* Feedback */}
      {closeFeedback.error && (
        <Alert variant="error" title="No se pudo cerrar" dismissible onDismiss={closeFeedback.reset}>
          {closeFeedback.error}
        </Alert>
      )}
      {closeFeedback.success && (
        <Alert variant="success" title="Mes cerrado" dismissible onDismiss={closeFeedback.reset}>
          El mes {formatMonth(selectedMonth)} fue cerrado exitosamente.
        </Alert>
      )}

      {/* Tabs */}
      <div className={styles.dataTabs}>
        <button
          type="button"
          className={`${styles.dataTab} ${activeTab === 'reportes' ? styles.dataTabActive : ''}`}
          onClick={() => setActiveTab('reportes')}
        >
          <Upload size={16} /> Cargar reportes
        </button>
        <button
          type="button"
          className={`${styles.dataTab} ${activeTab === 'costos' ? styles.dataTabActive : ''}`}
          onClick={() => setActiveTab('costos')}
        >
          <Calculator size={16} /> Cargar costos
        </button>
      </div>

      {/* ── Tab: Cargar reportes ── */}
      {activeTab === 'reportes' && (
        <>
          <div className={styles.importSection}>
            <ImportWizard onComplete={loadCloseDetail} />
          </div>

          {/* Checklist de cierre */}
          {closeDetail && !detailLoading && (
            <div className={styles.checksSection}>
              <button
                type="button"
                className={styles.checksToggle}
                onClick={() => setShowChecks(!showChecks)}
              >
                <span>Checklist de cierre — {formatMonth(selectedMonth)}</span>
                {showChecks ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {showChecks && (
                <div className={styles.checksBody}>
                  {requiredChecks.length > 0 && (
                    <div>
                      <div className={styles.checksGroupLabel}>Requerido</div>
                      {requiredChecks.map(c => <CheckItem key={c.key} check={c} />)}
                    </div>
                  )}
                  {recommendedChecks.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div className={styles.checksGroupLabel}>Recomendado</div>
                      {recommendedChecks.map(c => <CheckItem key={c.key} check={c} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className={styles.historySection}>
            <h3 className={styles.sectionTitle}>Historial de importaciones</h3>
        {loading ? (
          <div className={styles.historyLoading}>Cargando historial...</div>
        ) : history && history.length > 0 ? (
          <div className={styles.historyList}>
            {history.map((file) => (
              <div key={file.id} className={styles.historyItem}>
                <div className={styles.historyContent}>
                  <span className={styles.historyName}>{file.filename}</span>
                  <span className={styles.historyMeta}>
                    {reportNames[file.report_type] || file.report_type} • {file.rows} filas
                  </span>
                </div>
                <div className={styles.historyRight}>
                  <div className={styles.historyDate}>
                    {new Date(file.uploaded_at).toLocaleDateString()}
                  </div>
                  <span className={`${styles.badge} ${file.status === 'processed' ? styles.badgeSuccess : styles.badgeError}`}>
                    {file.status === 'processed' ? 'Éxito' : 'Error'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.historyEmpty}>No hay importaciones aún</div>
        )}
          </div>
        </>
      )}

      {/* ── Tab: Cargar costos ── */}
      {activeTab === 'costos' && (
        <div className={styles.importSection}>
          {costsLoading ? (
            <div className={styles.historyLoading}>Cargando costos...</div>
          ) : (
            <div className={styles.costosDelMesCard}>
              {activeCats.filter(c => c.costTypeDefault === 'fixed').length > 0 && (
                <div className={styles.costosDelMesGroup}>
                  <div className={styles.costosDelMesGroupTitle}>Costos fijos</div>
                  <div className={styles.costosDelMesGrid}>
                    {activeCats.filter(c => c.costTypeDefault === 'fixed').map(cat => {
                      const entry = monthlyEntries.find(e => e.categoryKey === cat.categoryKey && e.costType === 'fixed');
                      return (
                        <div key={cat.categoryKey} className={styles.costosDelMesRow}>
                          <label className={styles.costosDelMesLabel}>{cat.displayName}</label>
                          <div className={styles.costosDelMesInputWrap}>
                            <span className={styles.costosDelMesPrefix}>$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatInputValue(entry?.amount || 0)}
                              onChange={e => updateEntry(cat.categoryKey, 'fixed', parseInput(e.target.value))}
                              className={styles.costosDelMesInput}
                              placeholder="0"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeCats.filter(c => c.costTypeDefault === 'variable').length > 0 && (
                <div className={styles.costosDelMesGroup}>
                  <div className={styles.costosDelMesGroupTitle}>Costos variables</div>
                  <div className={styles.costosDelMesGrid}>
                    {activeCats.filter(c => c.costTypeDefault === 'variable').map(cat => {
                      const entry = monthlyEntries.find(e => e.categoryKey === cat.categoryKey && e.costType === 'variable');
                      return (
                        <div key={cat.categoryKey} className={styles.costosDelMesRow}>
                          <label className={styles.costosDelMesLabel}>{cat.displayName}</label>
                          <div className={styles.costosDelMesInputWrap}>
                            <span className={styles.costosDelMesPrefix}>$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatInputValue(entry?.amount || 0)}
                              onChange={e => updateEntry(cat.categoryKey, 'variable', parseInput(e.target.value))}
                              className={styles.costosDelMesInput}
                              placeholder="0"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className={styles.costosDelMesGroup}>
                <div className={styles.costosDelMesGroupTitle}>Saldo de caja (opcional)</div>
                <div className={styles.costosDelMesGrid}>
                  <div className={styles.costosDelMesRow}>
                    <label className={styles.costosDelMesLabel}>Efectivo + bancos al cierre del mes</label>
                    <div className={styles.costosDelMesInputWrap}>
                      <span className={styles.costosDelMesPrefix}>$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={monthlyCashBalance === null ? '' : formatInputValue(monthlyCashBalance)}
                        onChange={e => {
                          const raw = e.target.value.trim();
                          setMonthlyCashBalance(raw === '' ? null : parseInput(e.target.value));
                        }}
                        className={styles.costosDelMesInput}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tax rules section */}
              <div className={styles.costosDelMesGroup}>
                <button
                  type="button"
                  className={styles.taxToggleBtn}
                  onClick={() => setShowTaxSection(!showTaxSection)}
                >
                  <Receipt size={16} />
                  <span>Impuestos ({taxRules.length > 0 ? taxRules.map(r => `${r.name} ${r.method === 'percentage' ? r.value + '%' : ''}`).join(', ') : 'sin configurar'})</span>
                  {showTaxSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showTaxSection && (
                  <div className={styles.taxRulesPanel}>
                    {taxRules.length === 0 && taxRulesLoaded && (
                      <div className={styles.taxInfoBox}>
                        <Info size={16} />
                        <span>Sin impuestos configurados. Agregá al menos el IVA para un P&L preciso.</span>
                      </div>
                    )}

                    {taxRules.map((rule, idx) => (
                      <div key={rule.id} className={styles.taxRuleRow}>
                        <div className={styles.taxRuleInputs}>
                          <input
                            type="text"
                            value={rule.name}
                            placeholder="Nombre (ej: IVA)"
                            onChange={e => {
                              const v = e.target.value;
                              setTaxRules(prev => prev.map(r => r.id === rule.id ? { ...r, name: v } : r));
                            }}
                            className={styles.taxInputName}
                          />
                          <select
                            value={rule.type}
                            onChange={e => setTaxRules(prev => prev.map(r => r.id === rule.id ? { ...r, type: e.target.value as TaxRule['type'] } : r))}
                            className={styles.taxSelect}
                          >
                            {TAX_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <select
                            value={rule.method}
                            onChange={e => setTaxRules(prev => prev.map(r => r.id === rule.id ? { ...r, method: e.target.value as TaxRule['method'] } : r))}
                            className={styles.taxSelect}
                          >
                            {TAX_METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <div className={styles.costosDelMesInputWrap}>
                            <span className={styles.costosDelMesPrefix}>{rule.method === 'percentage' ? '%' : '$'}</span>
                            <input
                              type="number"
                              min={0}
                              step={rule.method === 'percentage' ? 0.5 : 1}
                              value={rule.value}
                              onChange={e => setTaxRules(prev => prev.map(r => r.id === rule.id ? { ...r, value: parseFloat(e.target.value) || 0 } : r))}
                              className={styles.costosDelMesInput}
                            />
                          </div>
                          <label className={styles.taxCheckLabel}>
                            <input
                              type="checkbox"
                              checked={rule.includedInRate}
                              onChange={e => setTaxRules(prev => prev.map(r => r.id === rule.id ? { ...r, includedInRate: e.target.checked } : r))}
                            />
                            <span>Incl. en tarifa</span>
                          </label>
                          <button
                            type="button"
                            className={styles.taxRemoveBtn}
                            onClick={() => setTaxRules(prev => prev.filter(r => r.id !== rule.id))}
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className={styles.taxRuleActions}>
                      <button
                        type="button"
                        className={styles.taxAddBtn}
                        onClick={() => setTaxRules(prev => [...prev, {
                          id: crypto.randomUUID(), name: '', type: 'OTHER', appliesTo: 'room_rate',
                          method: 'percentage', value: 0, includedInRate: true,
                        }])}
                      >
                        <Plus size={14} /> Agregar impuesto
                      </button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleSaveTaxRules}
                        loading={taxSaveFeedback.loading}
                        icon={taxSaveFeedback.success ? <CheckCircle size={14} /> : <Save size={14} />}
                      >
                        {taxSaveFeedback.success ? 'Guardado' : 'Guardar impuestos'}
                      </Button>
                    </div>
                    {taxSaveFeedback.error && <Alert variant="error" dismissible onDismiss={taxSaveFeedback.reset}>{taxSaveFeedback.error}</Alert>}
                  </div>
                )}
              </div>

              {costsSaveFeedback.error && <Alert variant="error" dismissible onDismiss={costsSaveFeedback.reset}>{costsSaveFeedback.error}</Alert>}
              {costsCopyFeedback.error && <Alert variant="error" dismissible onDismiss={costsCopyFeedback.reset}>{costsCopyFeedback.error}</Alert>}

              <div className={styles.costosDelMesActions}>
                <Button variant="secondary" size="sm" onClick={handleCopyCosts} loading={costsCopyFeedback.loading} icon={<Copy size={14} />}>
                  Copiar mes anterior
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveCosts} loading={costsSaveFeedback.loading} icon={costsSaveFeedback.success ? <CheckCircle size={14} /> : <Save size={14} />}>
                  {costsSaveFeedback.success ? 'Guardado' : 'Guardar costos'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CheckItem({ check }: { check: MonthlyCloseCheck }) {
  const itemClass = [
    styles.checkItem,
    check.passed ? styles.checkItemPassed : styles.checkItemFailed,
  ].filter(Boolean).join(' ');
  return (
    <div className={itemClass}>
      {check.passed
        ? <CheckCircle size={16} style={{ color: '#16a34a' }} />
        : check.type === 'required'
          ? <AlertTriangle size={16} style={{ color: '#dc2626' }} />
          : <Circle size={16} style={{ color: '#d97706' }} />
      }
      <div className={styles.checkLabel}>
        <div>{check.label}</div>
        {check.detail && <div className={styles.checkDetail}>{check.detail}</div>}
      </div>
    </div>
  );
}
