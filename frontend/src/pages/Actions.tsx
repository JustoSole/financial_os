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
import { Card, Button, LoadingState, Alert, ConfirmDialog } from '../components/ui';
import type { InsightStep } from '../components';
import { useApp } from '../context/AppContext';
import { useApiQuery, useInvalidate } from '../hooks/useApiQuery';
import {
  getActions,
  completeActionStep,
  setActionStatus,
  trackEvent,
} from '../api';
import type { RecommendedAction, ActionCategory, ActionSeverity } from '@financial-os/shared';
import styles from './Actions.module.css';

const TAB_CATEGORIES: { value: 'all' | ActionCategory; label: string; icon: typeof Zap }[] = [
  { value: 'all', label: 'Todas', icon: Zap },
  { value: 'collections', label: 'Cobranza', icon: CreditCard },
  { value: 'channels', label: 'Canales', icon: BarChart3 },
  { value: 'pricing', label: 'Pricing', icon: Target },
];

type ActionStatus = 'pending' | 'done' | 'dismissed';

interface ActionItem {
  id: string;
  category: ActionCategory;
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
  status?: ActionStatus;
  completedAt?: string;
}

function backendActionToItem(ba: RecommendedAction): ActionItem {
  const severityToType: Record<ActionSeverity, ActionItem['type']> = {
    critical: 'critical',
    warning: 'warning',
    info: 'info',
    positive: 'positive',
  };
  const impactType = ba.impact.direction === 'down' ? 'loss' : (ba.category === 'collections' ? 'revenue' : 'savings');
  return {
    id: ba.id,
    category: ba.category,
    type: severityToType[ba.severity] ?? 'warning',
    title: ba.title,
    description: ba.description,
    impact: {
      value: ba.impact.value,
      label: ba.impact.unit,
      type: impactType,
    },
    steps: (ba.steps || []).map((s) => ({
      id: s.id ?? `${ba.id}-${s.text.slice(0, 8)}`,
      text: s.text,
      completed: s.completed,
    })),
    evidence: (ba.evidence || []).map((e) => ({ label: e.metric, value: e.value })),
    href: ba.href,
    status: (ba.status as ActionStatus) ?? 'pending',
    completedAt: ba.completedAt,
  };
}

export default function Actions() {
  const { property, dateRange } = useApp();
  const invalidate = useInvalidate();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done' | 'dismissed'>('all');
  const [settingStatusId, setSettingStatusId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ actionId: string; status: 'done' | 'dismissed' } | null>(null);

  const propertyId = property?.id;
  const days = dateRange.days;
  const enabled = !!propertyId;

  const { data: backendActionsRaw, isLoading: loading } = useApiQuery<RecommendedAction[]>(
    ['actions', propertyId, days],
    () => getActions(propertyId!, days),
    { enabled }
  );

  const backendActions: RecommendedAction[] = Array.isArray(backendActionsRaw) ? backendActionsRaw : [];
  const allActions: ActionItem[] = useMemo(
    () => backendActions.map(backendActionToItem),
    [backendActions]
  );

  useEffect(() => {
    if (propertyId) trackEvent(propertyId, 'view_actions');
  }, [propertyId]);

  const isResolved = (a: ActionItem) => a.status === 'done' || a.status === 'dismissed';

  const filteredActions = useMemo(() => {
    let list = allActions;
    if (selectedCategory !== 'all') {
      list = list.filter((a) => a.category === selectedCategory);
    }
    if (statusFilter !== 'all') {
      list = list.filter((a) => (a.status ?? 'pending') === statusFilter);
    }
    return list;
  }, [allActions, selectedCategory, statusFilter]);

  const totalPotentialSavings = allActions
    .filter((a) => !isResolved(a) && (a.impact.type === 'savings' || a.impact.type === 'loss'))
    .reduce((sum, a) => sum + a.impact.value, 0);
  const urgentCount = allActions.filter((a) => a.type === 'critical' && !isResolved(a)).length;
  const completedCount = allActions.filter((a) => isResolved(a)).length;
  const pendingCollections = allActions
    .filter((a) => a.category === 'collections' && !isResolved(a))
    .reduce((sum, a) => sum + a.impact.value, 0);

  const handleStepComplete = async (actionId: string, stepId: string) => {
    if (!property?.id) return;
    try {
      await completeActionStep(property.id, actionId, stepId);
      trackEvent(property.id, 'action_step_completed', { actionId, stepId });
      setActionError(null);
      invalidate(['actions', property.id, days]);
    } catch (error: any) {
      setActionError(error?.message ?? 'No se pudo guardar. Reintentá.');
    }
  };

  const getCategoryCount = (cat: string) => {
    if (cat === 'all') return allActions.filter((a) => !isResolved(a)).length;
    return allActions.filter((a) => a.category === cat && !isResolved(a)).length;
  };

  const handleSetActionStatus = (actionId: string, status: 'done' | 'dismissed') => {
    if (!property?.id) return;
    setConfirmState({ actionId, status });
  };

  const onConfirmStatus = async () => {
    if (!property?.id || !confirmState) return;
    const { actionId, status } = confirmState;
    setConfirmState(null);
    setSettingStatusId(actionId);
    setActionError(null);
    try {
      await setActionStatus(property.id, actionId, status);
      invalidate(['actions', property.id, days]);
      trackEvent(property.id, 'action_status_set', { actionId, status });
    } catch (err: any) {
      setActionError(err?.message ?? 'No se pudo actualizar el estado. Reintentá.');
    } finally {
      setSettingStatusId(null);
    }
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

      {actionError && (
        <Alert variant="error" title="Error" dismissible onDismiss={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.status === 'done' ? 'Marcar como hecha' : 'Descartar acción'}
        message={
          confirmState?.status === 'done'
            ? '¿Marcar esta acción como hecha?'
            : '¿Descartar esta acción? No se mostrará como pendiente.'
        }
        confirmLabel={confirmState?.status === 'done' ? 'Marcar hecha' : 'Descartar'}
        cancelLabel="Cancelar"
        variant={confirmState?.status === 'dismissed' ? 'danger' : 'primary'}
        onConfirm={onConfirmStatus}
        onCancel={() => setConfirmState(null)}
      />

      {totalPotentialSavings > 0 && (
        <section className={styles.actionsHero}>
          <HeroMetric
            title="Impacto potencial"
            value={totalPotentialSavings}
            format="currency"
            status="positive"
            icon={<DollarSign size={20} />}
            subtitle={`${allActions.filter((a) => !isResolved(a)).length} acciones pendientes`}
            tooltip="Suma de ahorro/recupero si completás todas las acciones"
          />
        </section>
      )}

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

      <div className={styles.actionsTabs}>
        {TAB_CATEGORIES.map((cat) => {
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

      <div className={styles.statusFilter}>
        <span className={styles.statusFilterLabel}>Estado:</span>
        {(['all', 'pending', 'done', 'dismissed'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`${styles.statusFilterBtn} ${statusFilter === value ? styles.statusFilterBtnActive : ''}`}
            onClick={() => setStatusFilter(value)}
          >
            {value === 'all' ? 'Todas' : value === 'pending' ? 'Pendientes' : value === 'done' ? 'Hechas' : 'Descartadas'}
          </button>
        ))}
      </div>

      <div className={styles.actionsList}>
        {filteredActions.length === 0 ? (
          <ActionsEmptyState category={selectedCategory} />
        ) : (
          <>
            {filteredActions.filter((a) => !isResolved(a)).map((action) => (
              <div key={action.id} className={styles.actionCardWrap}>
                <ActionableInsight
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
                <div className={styles.actionCardFooter}>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={settingStatusId === action.id}
                    onClick={() => handleSetActionStatus(action.id, 'done')}
                  >
                    {settingStatusId === action.id ? '...' : 'Marcar como hecha'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={settingStatusId === action.id}
                    onClick={() => handleSetActionStatus(action.id, 'dismissed')}
                  >
                    Descartar
                  </Button>
                </div>
              </div>
            ))}
            {filteredActions.some((a) => isResolved(a)) && (
              <>
                <div className={styles.actionsCompletedHeader}>
                  <CheckCircle size={18} />
                  <h3>Completadas</h3>
                </div>
                {filteredActions.filter((a) => isResolved(a)).map((action) => (
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

function ActionsEmptyState({ category }: { category: string }) {
  const isAll = category === 'all';
  return (
    <Card className={styles.actionsEmpty}>
      <FileText size={40} />
      <h3>{isAll ? '¡Sin acciones pendientes!' : 'Sin acciones de este tipo'}</h3>
      <p>{isAll ? 'Importá más datos para descubrir oportunidades de mejora' : 'Probá otro filtro o importá más datos'}</p>
      {isAll && (
        <Link to="/importar">
          <Button variant="primary">Importar datos</Button>
        </Link>
      )}
    </Card>
  );
}
