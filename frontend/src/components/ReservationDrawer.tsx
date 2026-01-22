import { Drawer, DrawerSection, BreakdownRow, InfoGrid } from './ui';
import { TrustBadge, ConfidenceBadge } from './ui';
import { formatCurrency, formatDateShort } from '../utils/formatters';
import styles from './ReservationDrawer.module.css';

// Shared reservation economics data type
export interface ReservationEconomicsData {
  reservationNumber: string;
  guestName: string;
  source: string;
  sourceCategory: string;
  checkIn: string;
  roomNights: number;
  revenue: number;
  commissionRate: number;
  commissionAmount: number;
  variableCosts: number;
  fixedCostAllocated: number;
  totalCosts: number;
  netProfit: number;
  profitPerNight: number;
  marginPercent: number;
  isUnprofitable: boolean;
  trust: 'real' | 'estimado' | 'incompleto';
  confidence: 'high' | 'medium' | 'low';
  confidenceReasons: string[];
  calcNotes: string[];
}

interface ReservationDrawerProps {
  reservation: ReservationEconomicsData | null;
  loading: boolean;
  open: boolean;
  onClose: () => void;
}

export default function ReservationDrawer({
  reservation,
  loading,
  open,
  onClose,
}: ReservationDrawerProps) {
  // Generate "why it happened" text
  const getWhyText = (r: ReservationEconomicsData): string => {
    const reasons: string[] = [];

    if (r.roomNights === 1 && r.variableCosts > r.revenue * 0.3) {
      reasons.push('1 noche + costos de limpieza altos');
    }
    if (r.commissionRate > 0.15) {
      reasons.push(`Comisión alta (${(r.commissionRate * 100).toFixed(0)}%)`);
    }
    if (r.profitPerNight < 0 && r.revenue / r.roomNights < 50000) {
      reasons.push('Revenue bajo por noche');
    }
    if (r.fixedCostAllocated > r.revenue * 0.2) {
      reasons.push('Alta proporción de costos fijos');
    }

    return reasons.length > 0 ? reasons.join(' + ') : 'Mix de costos vs revenue';
  };

  // Generate suggested action
  const getSuggestedAction = (r: ReservationEconomicsData): string => {
    if (r.roomNights === 1 && r.sourceCategory === 'OTA') {
      return `Para ${r.source}, configurar mínimo de estadía de 2 noches`;
    }
    if (r.commissionRate > 0.15) {
      return 'Negociar mejor comisión o mover demanda a canal directo';
    }
    if (r.revenue / r.roomNights < 50000) {
      return 'Revisar pricing mínimo para este canal';
    }
    return 'Revisar costos y pricing para optimizar margen';
  };

  return (
    <Drawer open={open} onClose={onClose} title="Detalle de Reserva" loading={loading}>
      {reservation && (
        <>
          {/* Summary Section */}
          <DrawerSection variant="highlight" className={styles.summarySection}>
            <div className={styles.summaryMain}>
              <div className={styles.profitDisplay}>
                <span
                  className={styles.profitAmount}
                  style={{
                    color:
                      reservation.netProfit < 0
                        ? 'var(--color-error)'
                        : 'var(--color-success)',
                  }}
                >
                  {formatCurrency(reservation.netProfit)}
                </span>
                <span className={styles.profitLabel}>Net Profit</span>
              </div>
              <div className={styles.summaryBadges}>
                <TrustBadge trust={reservation.trust} />
                <ConfidenceBadge confidence={reservation.confidence} showLabel />
              </div>
            </div>
            <div className={styles.summaryKpis}>
              <div className={styles.kpi}>
                <span className={styles.kpiValue}>{formatCurrency(reservation.profitPerNight)}</span>
                <span className={styles.kpiLabel}>Profit/noche</span>
              </div>
              <div className={styles.kpi}>
                <span className={styles.kpiValue}>{reservation.marginPercent.toFixed(1)}%</span>
                <span className={styles.kpiLabel}>Margen</span>
              </div>
            </div>
          </DrawerSection>

          {/* Breakdown Section - Fórmula Explícita */}
          <DrawerSection title="Desglose P&L">
            <div className={styles.formulaBox}>
              <span className={styles.formulaText}>
                Profit = Revenue - Comisión - Variables - Fijos
              </span>
            </div>
            <div className="breakdown-rows">
              <BreakdownRow 
                label="Revenue" 
                value={formatCurrency(reservation.revenue)} 
                variant="positive" 
              />
              <BreakdownRow
                label={`(-) Comisión canal (${(reservation.commissionRate * 100).toFixed(0)}%)`}
                value={`-${formatCurrency(reservation.commissionAmount)}`}
              />
              <BreakdownRow
                label="(-) Costos variables"
                value={`-${formatCurrency(reservation.variableCosts)}`}
              />
              <BreakdownRow
                label="(-) Costos fijos prorrateados"
                value={`-${formatCurrency(reservation.fixedCostAllocated)}`}
              />
              <div className={styles.breakdownDivider} />
              <BreakdownRow
                label="= Net Profit"
                value={formatCurrency(reservation.netProfit)}
                variant={reservation.netProfit >= 0 ? 'positive' : 'negative'}
                className="breakdown-row--total"
              />
            </div>
            
            {/* Breakdown Visual Explicativo */}
            <div className={styles.profitBreakdownVisual}>
              <div className={styles.profitBreakdownBar}>
                <div 
                  className={styles.profitBreakdownSegment} 
                  style={{ 
                    width: `${reservation.revenue > 0 ? (reservation.commissionAmount / reservation.revenue) * 100 : 0}%`,
                    background: 'var(--color-warning)'
                  }}
                  title={`Comisión: ${formatCurrency(reservation.commissionAmount)}`}
                />
                <div 
                  className={styles.profitBreakdownSegment} 
                  style={{ 
                    width: `${reservation.revenue > 0 ? (reservation.variableCosts / reservation.revenue) * 100 : 0}%`,
                    background: 'var(--color-info)'
                  }}
                  title={`Variables: ${formatCurrency(reservation.variableCosts)}`}
                />
                <div 
                  className={styles.profitBreakdownSegment} 
                  style={{ 
                    width: `${reservation.revenue > 0 ? (reservation.fixedCostAllocated / reservation.revenue) * 100 : 0}%`,
                    background: 'var(--color-text-muted)'
                  }}
                  title={`Fijos: ${formatCurrency(reservation.fixedCostAllocated)}`}
                />
                <div 
                  className={styles.profitBreakdownSegment} 
                  style={{ 
                    width: `${reservation.revenue > 0 ? Math.max(0, reservation.netProfit / reservation.revenue) * 100 : 0}%`,
                    background: reservation.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-error)'
                  }}
                  title={`Profit: ${formatCurrency(reservation.netProfit)}`}
                />
              </div>
              <div className={styles.profitBreakdownLegend}>
                <span style={{ color: 'var(--color-warning)' }}>● Comisión</span>
                <span style={{ color: 'var(--color-info)' }}>● Variables</span>
                <span style={{ color: 'var(--color-text-muted)' }}>● Fijos</span>
                <span style={{ color: reservation.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>● Profit</span>
              </div>
            </div>
          </DrawerSection>

          {/* Why Section */}
          {reservation.isUnprofitable && (
            <DrawerSection title="¿Por qué pasó?">
              <p className={styles.whyText}>{getWhyText(reservation)}</p>
            </DrawerSection>
          )}

          {/* Suggested Action */}
          {reservation.isUnprofitable && (
            <DrawerSection title="Acción sugerida" variant="action">
              <p className={styles.actionText}>💡 {getSuggestedAction(reservation)}</p>
            </DrawerSection>
          )}

          {/* Reservation Info */}
          <DrawerSection title="Info de la reserva">
            <InfoGrid
              items={[
                { label: 'Número', value: reservation.reservationNumber },
                { label: 'Huésped', value: reservation.guestName },
                { label: 'Canal', value: `${reservation.source} (${reservation.sourceCategory})` },
                { label: 'Check-in', value: formatDateShort(reservation.checkIn) },
                { label: 'Noches', value: String(reservation.roomNights) },
              ]}
            />
          </DrawerSection>

          {/* Confidence Reasons */}
          {reservation.confidenceReasons.length > 0 && (
            <DrawerSection title="Calidad de los Datos">
              <ul className={styles.confidenceList}>
                {reservation.confidenceReasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </DrawerSection>
          )}

          {/* Calculation Notes */}
          {reservation.calcNotes && reservation.calcNotes.length > 0 && (
            <DrawerSection title="Memoria de Cálculo">
              <div className={styles.calcNotes}>
                {reservation.calcNotes.map((note, i) => (
                  <div key={i} className={note.includes('══') ? styles.calcDivider : styles.calcNote}>
                    {note}
                  </div>
                ))}
              </div>
            </DrawerSection>
          )}
        </>
      )}
    </Drawer>
  );
}
