import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Zap, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle,
  Target,
  FileText,
  CreditCard,
  BarChart3,
} from 'lucide-react';
import { 
  PeriodSelector, 
  ActionableInsight,
  HeroMetric,
  QuickStat,
} from '../components';
import { Card, Button, LoadingState } from '../components/ui';
import type { InsightStep } from '../components';
import { useApp } from '../context/AppContext';
import { 
  getInsights, 
  getCollections, 
  getReservationEconomics,
  getCashMetrics,
  getActions,
  getCompletedSteps,
  completeActionStep,
  trackEvent,
} from '../api';
import { formatCurrencyShort } from '../utils/formatters';
import styles from './Actions.module.css';


// Action categories
const ACTION_CATEGORIES = [
  { value: 'all', label: 'Todas', icon: Zap },
  { value: 'collections', label: 'Cobranza', icon: CreditCard },
  { value: 'channels', label: 'Canales', icon: BarChart3 },
  { value: 'pricing', label: 'Pricing', icon: Target },
  // { value: 'cash', label: 'Caja', icon: AlertTriangle },
];

interface ActionItem {
  id: string;
  category: 'collections' | 'channels' | 'pricing' | 'cash' | 'data';
  type: 'critical' | 'warning' | 'positive' | 'info';
  title: string;
  description: string;
  impact: {
    value: number;
    label: string;
    type: 'savings' | 'revenue' | 'loss' | 'cost';
  };
  steps: InsightStep[];
  evidence: Array<{ label: string; value: string }>;
  href?: string;
  completed?: boolean;
}

export default function Actions() {
  const { property, dateRange } = useApp();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [insights, setInsights] = useState<any>(null);
  const [collections, setCollections] = useState<any>(null);
  const [economics, setEconomics] = useState<any>(null);
  const [cash, setCash] = useState<any>(null);
  const [backendActions, setBackendActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Track completed steps from backend (synced across devices)
  const [completedSteps, setCompletedSteps] = useState<Record<string, string[]>>({});

  // Use primitive values to prevent infinite re-renders
  const propertyId = property?.id;
  const days = dateRange.days;

  useEffect(() => {
    if (!propertyId) return;
    
    let isMounted = true;
    
    const loadData = async () => {
      setLoading(true);
      
      const [insightsRes, collectionsRes, economicsRes, cashRes, actionsRes, completedRes] = await Promise.all([
        getInsights(propertyId, days),
        getCollections(propertyId),
        getReservationEconomics(propertyId, days),
        getCashMetrics(propertyId, days),
        getActions(propertyId, days),
        getCompletedSteps(propertyId),
      ]);

      if (!isMounted) return;

      if (insightsRes.success) setInsights(insightsRes.data);
      if (collectionsRes.success) setCollections(collectionsRes.data);
      if (economicsRes.success) setEconomics(economicsRes.data);
      if (cashRes.success) setCash(cashRes.data);
      if (actionsRes.success) setBackendActions(actionsRes.data || []);
      if (completedRes.success && completedRes.data) {
        setCompletedSteps(completedRes.data.byActionId || {});
      }

      setLoading(false);
    };

    loadData();
    trackEvent(propertyId, 'view_actions');

    return () => {
      isMounted = false;
    };
  }, [propertyId, days]); // Only depend on primitive values

  // Generate all actions from data
  const allActions = useMemo((): ActionItem[] => {
    const actions: ActionItem[] = [];

    // COLLECTIONS: Only show reservations with very overdue payments (past check-in and unpaid)
    // Most hotels have pay-at-check-in policies, so pending payments are normal
    if (collections?.reservationsWithBalance) {
      collections.reservationsWithBalance.forEach((r: any) => {
        if (r.balanceDue < 10000) return; // Skip smaller amounts - normal for pending reservations

        const checkIn = new Date(r.checkIn);
        const today = new Date();
        const daysUntil = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const isPastCheckIn = daysUntil < -3; // Only show if check-in was more than 3 days ago

        // Only create action items for significantly past check-ins with large balances
        if (!isPastCheckIn) return;

        // Deterministic ID based on reservation number (stable across sessions)
        const actionId = `collect-${r.reservationNumber}`;
        const step1Id = `${actionId}-verify`;
        const step2Id = `${actionId}-update`;
        const actionCompletedSteps = completedSteps[actionId] || [];
        const completed = actionCompletedSteps.includes(step1Id) && actionCompletedSteps.includes(step2Id);

        actions.push({
          id: actionId,
          category: 'collections',
          type: 'info',
          title: `Verificar pago: ${r.guestName || r.reservationNumber}`,
          description: `Check-in hace ${Math.abs(daysUntil)} días. Verificar si el pago fue registrado.`,
          impact: {
            value: r.balanceDue,
            label: 'por verificar',
            type: 'revenue',
          },
          steps: [
            { id: step1Id, text: `Verificar si el pago de ${r.guestName || 'huésped'} fue registrado`, completed: actionCompletedSteps.includes(step1Id) },
            { id: step2Id, text: 'Actualizar registro si corresponde', completed: actionCompletedSteps.includes(step2Id) },
          ],
          evidence: [
            { label: 'Reserva', value: r.reservationNumber },
            { label: 'Total', value: formatCurrencyShort(r.totalAmount) },
            { label: 'Registrado', value: formatCurrencyShort(r.totalPaid) },
          ],
          href: undefined,
          completed,
        });
      });
    }

    // CHANNELS: Expensive channel optimization
    if (insights?.worstChannel && insights.worstChannel.realCostPercent > 18) {
      const ch = insights.worstChannel;
      // Deterministic ID based on channel name (normalized, stable)
      const channelSlug = ch.channel.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      const actionId = `optimize-channel-${channelSlug}`;
      const step1Id = `${actionId}-raise-rate`;
      const step2Id = `${actionId}-parity`;
      const step3Id = `${actionId}-benefit`;
      const actionCompletedSteps = completedSteps[actionId] || [];
      const completed = [step1Id, step2Id, step3Id].every(id => actionCompletedSteps.includes(id));

      actions.push({
        id: actionId,
        category: 'channels',
        type: 'warning',
        title: `Optimizar ${ch.channel}`,
        description: `Costo real del ${ch.realCostPercent.toFixed(0)}% (comisión ${(ch.commissionRate * 100).toFixed(0)}% + ADR menor). Subí la tarifa o redirigí reservas.`,
        impact: {
          value: Math.round(ch.revenue * 0.1),
          label: '/mes potencial',
          type: 'savings',
        },
        steps: [
          { id: step1Id, text: `Subir tarifa en ${ch.channel} un 10-15%`, completed: actionCompletedSteps.includes(step1Id) },
          { id: step2Id, text: 'Configurar paridad negativa (web 5% más barata)', completed: actionCompletedSteps.includes(step2Id) },
          { id: step3Id, text: 'Agregar beneficio exclusivo para reserva directa', completed: actionCompletedSteps.includes(step3Id) },
        ],
        evidence: [
          { label: 'ADR canal', value: formatCurrencyShort(ch.adr) },
          { label: 'ADR directo', value: formatCurrencyShort(insights.directAdr || ch.adr) },
          { label: 'Revenue', value: formatCurrencyShort(ch.revenue) },
        ],
        href: '/canales',
        completed,
      });
    }

    // PRICING: Loss patterns
    if (economics?.patterns) {
      economics.patterns.filter((p: any) => p.isLossPattern).forEach((pattern: any) => {
        // Deterministic ID based on source + nights bucket (stable across data changes)
        const sourceSlug = (pattern.source || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        const actionId = `pricing-${sourceSlug}-${pattern.nightsBucket}n`;
        const step1Id = `${actionId}-min-nights`;
        const step2Id = `${actionId}-raise-rate`;
        const step3Id = `${actionId}-cleaning-fee`;
        const actionCompletedSteps = completedSteps[actionId] || [];
        const completed = [step1Id, step2Id, step3Id].every(id => actionCompletedSteps.includes(id));

        actions.push({
          id: actionId,
          category: 'pricing',
          type: 'warning',
          title: `Corregir: ${pattern.source} + ${pattern.nightsBucket}N`,
          description: `${pattern.count} reservas de ${pattern.source} con ${pattern.nightsBucket} noches dieron pérdida. Ajustá mínimo de noches o pricing.`,
          impact: {
            value: Math.abs(pattern.lossAmount),
            label: 'pérdida evitable',
            type: 'loss',
          },
          steps: [
            { id: step1Id, text: `Configurar mínimo de ${parseInt(pattern.nightsBucket) + 1} noches en ${pattern.source}`, completed: actionCompletedSteps.includes(step1Id) },
            { id: step2Id, text: 'Subir tarifa base para estadías cortas', completed: actionCompletedSteps.includes(step2Id) },
            { id: step3Id, text: 'Agregar cargo de limpieza para 1 noche', completed: actionCompletedSteps.includes(step3Id) },
          ],
          evidence: [
            { label: 'Reservas', value: String(pattern.count) },
            { label: 'Profit/noche', value: formatCurrencyShort(pattern.avgProfitPerNight) },
          ],
          href: '/rentabilidad',
          completed,
        });
      });
    }

    /* CASH: Low runway warning - HIDDEN FOR NOW
    if (cash?.runway && cash.runway.days < 60 && cash.runway.days !== 999) {
      const actionId = 'cash-runway';
      const stepIds = [`${actionId}-1`, `${actionId}-2`, `${actionId}-3`];
      const completed = stepIds.every(id => completedSteps[actionId]?.includes(id));

      actions.push({
        id: actionId,
        category: 'cash',
        type: cash.runway.days < 30 ? 'critical' : 'warning',
        title: `Solo ${cash.runway.days} días de caja`,
        description: `Con el flujo actual, tu caja alcanza para ${cash.runway.days} días. Acelerá cobranza y revisá egresos.`,
        impact: {
          value: cash.runway.startingBalance,
          label: 'saldo actual',
          type: 'cost',
        },
        steps: [
          { id: stepIds[0], text: 'Revisar egresos programados y postergar no esenciales', completed: completedSteps[actionId]?.includes(stepIds[0]) },
          { id: stepIds[1], text: 'Contactar reservas con saldo pendiente', completed: completedSteps[actionId]?.includes(stepIds[1]) },
          { id: stepIds[2], text: 'Negociar plazos con proveedores', completed: completedSteps[actionId]?.includes(stepIds[2]) },
        ],
        evidence: [
          { label: 'Flujo diario', value: formatCurrencyShort(cash.runway.avgNetDaily) },
          { label: 'Por cobrar', value: formatCurrencyShort(collections?.totalBalanceDue || 0) },
        ],
        href: '/caja',
        completed,
      });
    }
    */

    // 4. ADD BACKEND GENERATED ACTIONS (Period-aware)
    backendActions.forEach((ba: any) => {
      // Avoid duplicates if already added by frontend logic
      if (actions.some(a => a.id === ba.id || a.title === ba.title)) return;

      actions.push({
        id: ba.id,
        category: ba.type === 'ota_dependency' || ba.type === 'channel_cost' ? 'channels' : 
                  ba.type === 'cash_risk' ? 'cash' : 
                  ba.type === 'unprofitable_reservations' || ba.type === 'one_night_loss_pattern' ? 'pricing' : 'data',
        type: ba.priority === 1 ? 'critical' : 'warning',
        title: ba.title,
        description: ba.description,
        impact: {
          value: ba.impact.value,
          label: ba.impact.unit,
          type: ba.impact.direction === 'down' ? 'loss' : 'savings',
        },
        steps: ba.steps.map((s: any, idx: number) => ({
          id: `${ba.id}-${idx}`,
          text: s.text,
          completed: s.completed,
        })),
        evidence: ba.evidence.map((e: any) => ({
          label: e.metric,
          value: e.value,
        })),
        href: ba.type === 'ota_dependency' || ba.type === 'channel_cost' ? '/canales' : 
              ba.type === 'unprofitable_reservations' || ba.type === 'one_night_loss_pattern' ? '/rentabilidad' : undefined,
        completed: ba.steps.every((s: any) => s.completed),
      });
    });

    // Sort: critical first, then by impact
    return actions.sort((a, b) => {
      // Completed goes last
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;
      
      // Priority order
      const typeOrder = { critical: 0, warning: 1, info: 2, positive: 3 };
      const typeDiff = typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder];
      if (typeDiff !== 0) return typeDiff;

      // Then by impact value
      return b.impact.value - a.impact.value;
    });
  }, [insights, collections, economics, cash, backendActions, completedSteps]);

  // Filtered actions
  const filteredActions = useMemo(() => {
    if (selectedCategory === 'all') return allActions;
    return allActions.filter(a => a.category === selectedCategory);
  }, [allActions, selectedCategory]);

  // Metrics
  const totalPotentialSavings = allActions
    .filter(a => !a.completed && (a.impact.type === 'savings' || a.impact.type === 'loss'))
    .reduce((sum, a) => sum + a.impact.value, 0);

  const urgentCount = allActions.filter(a => a.type === 'critical' && !a.completed).length;
  const completedCount = allActions.filter(a => a.completed).length;
  const pendingCollections = allActions.filter(a => a.category === 'collections' && !a.completed)
    .reduce((sum, a) => sum + a.impact.value, 0);

  // Handle step completion - saves to backend (Supabase)
  const handleStepComplete = async (actionId: string, stepId: string) => {
    if (!property) return;
    
    // Don't allow unchecking (already completed steps stay completed)
    const current = completedSteps[actionId] || [];
    if (current.includes(stepId)) return;
    
    // Optimistic update
    setSavingStep(stepId);
    setCompletedSteps(prev => ({
      ...prev,
      [actionId]: [...(prev[actionId] || []), stepId]
    }));
    
    try {
      await completeActionStep(property.id, actionId, stepId);
      trackEvent(property.id, 'action_step_completed', { actionId, stepId });
    } catch (error) {
      console.error('Error saving step completion:', error);
      // Rollback on error
      setCompletedSteps(prev => ({
        ...prev,
        [actionId]: (prev[actionId] || []).filter(id => id !== stepId)
      }));
    } finally {
      setSavingStep(null);
    }
  };

  // Get category counts
  const getCategoryCount = (cat: string) => {
    if (cat === 'all') return allActions.filter(a => !a.completed).length;
    return allActions.filter(a => a.category === cat && !a.completed).length;
  };

  if (loading) {
    return (
      <div className={styles.pageActions}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Acciones</h1>
            <p className="page-subtitle">Analizando oportunidades...</p>
          </div>
        </div>
        <LoadingState message="Detectando acciones prioritarias..." />
      </div>
    );
  }

  return (
    <div className={styles.pageActions}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Acciones</h1>
          <p className="page-subtitle">Oportunidades detectadas en tus datos</p>
        </div>
        <PeriodSelector />
      </div>

      {/* Hero Metric */}
      {totalPotentialSavings > 0 && (
        <section className={styles.actionsHero}>
          <HeroMetric
            title="Impacto potencial"
            value={totalPotentialSavings}
            format="currency"
            status="positive"
            icon={<DollarSign size={20} />}
            subtitle={`${allActions.filter(a => !a.completed).length} acciones pendientes`}
            tooltip="Suma de ahorro/recupero si completás todas las acciones"
          />
        </section>
      )}

      {/* Quick Stats */}
      <section className={styles.actionsStats}>
        <QuickStat
          label="Urgentes"
          value={urgentCount}
          format="number"
          icon={<AlertTriangle size={16} />}
          variant={urgentCount > 0 ? 'danger' : 'default'}
        />
        <QuickStat
          label="Por cobrar"
          value={pendingCollections}
          format="currency"
          icon={<CreditCard size={16} />}
        />
        <QuickStat
          label="Completadas"
          value={completedCount}
          format="number"
          icon={<CheckCircle size={16} />}
          variant="success"
        />
      </section>

      {/* Category Tabs */}
      <div className={styles.actionsTabs}>
        {ACTION_CATEGORIES.map(cat => {
          const count = getCategoryCount(cat.value);
          const Icon = cat.icon;
          return (
            <button
              key={cat.value}
              className={`${styles.actionsTab} ${selectedCategory === cat.value ? styles.active : ''}`}
              onClick={() => setSelectedCategory(cat.value)}
            >
              <Icon size={16} />
              <span>{cat.label}</span>
              {count > 0 && <span className={styles.actionsTabCount}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Actions List */}
      <div className={styles.actionsList}>
        {filteredActions.length === 0 ? (
          <ActionsEmptyState category={selectedCategory} />
        ) : (
          <>
            {/* Pending actions */}
            {filteredActions.filter(a => !a.completed).map(action => (
              <ActionableInsight
                key={action.id}
                type={action.type}
                title={action.title}
                description={action.description}
                impact={action.impact}
                steps={action.steps}
                evidence={action.evidence}
                action={action.href ? { label: 'Ver detalle', href: action.href } : undefined}
                onStepComplete={(stepId) => handleStepComplete(action.id, stepId)}
                expandable
                defaultExpanded={action.type === 'critical'}
              />
            ))}

            {/* Completed actions */}
            {filteredActions.some(a => a.completed) && (
              <>
                <div className={styles.actionsCompletedHeader}>
                      <CheckCircle size={18} />
                  <h3>Completadas</h3>
                </div>
                {filteredActions.filter(a => a.completed).map(action => (
                  <ActionableInsight
                    key={action.id}
                    type="positive"
                    title={action.title}
                    description={action.description}
                    impact={action.impact}
                    steps={action.steps}
                    evidence={action.evidence}
                    onStepComplete={(stepId) => handleStepComplete(action.id, stepId)}
                    expandable={false}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Sub-Components
// =====================================================

function ActionsEmptyState({ category }: { category: string }) {
  const isAll = category === 'all';
  
  return (
    <Card className={styles.actionsEmpty}>
      <FileText size={40} />
      <h3>{isAll ? '¡Sin acciones pendientes!' : 'Sin acciones de este tipo'}</h3>
      <p>
        {isAll 
          ? 'Importá más datos para descubrir oportunidades de mejora'
          : 'Probá otro filtro o importá más datos'
        }
      </p>
      {isAll && (
        <Link to="/importar">
          <Button variant="primary">
            Importar datos
          </Button>
        </Link>
      )}
    </Card>
  );
}

