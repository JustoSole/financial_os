import { Sparkles, ArrowRight, Lock, Zap } from 'lucide-react';

interface UpgradeBannerProps {
  feature?: string;
  plan?: 'pro';  // MVP: solo upgrade a pro
  variant?: 'inline' | 'card' | 'minimal';
}

export default function UpgradeBanner({
  feature = 'esta función',
  plan = 'pro',
  variant = 'card',
}: UpgradeBannerProps) {
  const planNames: Record<string, string> = {
    pro: 'Pro',
  };

  if (variant === 'minimal') {
    return (
      <a href="/configuracion" className="upgrade-minimal">
        <Lock size={14} />
        <span>Upgrade para usar {feature}</span>
        <ArrowRight size={14} />

        <style>{`
          .upgrade-minimal {
            display: inline-flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-1) var(--space-3);
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%);
            border: 1px solid rgba(139, 92, 246, 0.3);
            border-radius: var(--radius-full);
            font-size: 0.75rem;
            font-weight: 500;
            color: #8b5cf6;
            transition: all var(--transition-fast);
          }

          .upgrade-minimal:hover {
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(99, 102, 241, 0.15) 100%);
          }
        `}</style>
      </a>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="upgrade-inline">
        <div className="upgrade-icon">
          <Sparkles size={18} />
        </div>
        <div className="upgrade-content">
          <strong>Desbloquear {feature}</strong>
          <span>Disponible en plan {planNames[plan]}</span>
        </div>
        <a href="/configuracion" className="btn btn-sm upgrade-btn">
          Upgrade
          <ArrowRight size={14} />
        </a>

        <style>{`
          .upgrade-inline {
            display: flex;
            align-items: center;
            gap: var(--space-4);
            padding: var(--space-4);
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%);
            border: 1px solid rgba(139, 92, 246, 0.3);
            border-radius: var(--radius-xl);
          }

          .upgrade-inline .upgrade-icon {
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
            border-radius: var(--radius-lg);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            flex-shrink: 0;
          }

          .upgrade-inline .upgrade-content {
            flex: 1;
          }

          .upgrade-inline .upgrade-content strong {
            display: block;
            font-size: 0.875rem;
            color: var(--color-text);
            margin-bottom: 2px;
          }

          .upgrade-inline .upgrade-content span {
            font-size: 0.75rem;
            color: var(--color-text-muted);
          }

          .upgrade-inline .upgrade-btn {
            background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
            color: white;
            border: none;
          }

          .upgrade-inline .upgrade-btn:hover {
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="upgrade-card">
      <div className="upgrade-header">
        <div className="upgrade-icon">
          <Sparkles size={32} />
        </div>
        <span className="badge badge-pro">{planNames[plan]}</span>
      </div>

      <h3>Desbloquear {feature}</h3>
      <p>
        Upgrade a {planNames[plan]} para acceder a funcionalidades avanzadas 
        y llevar tu gestión financiera al siguiente nivel.
      </p>

      <div className="upgrade-features">
        <div className="upgrade-feature">
          <Zap size={16} />
          <span>Insights personalizados</span>
        </div>
        <div className="upgrade-feature">
          <Zap size={16} />
          <span>Proyecciones avanzadas</span>
        </div>
        <div className="upgrade-feature">
          <Zap size={16} />
          <span>Automatización</span>
        </div>
      </div>

      <a href="/configuracion" className="btn btn-primary btn-lg upgrade-btn">
        <Sparkles size={18} />
        Ver planes
      </a>

      <style>{`
        .upgrade-card {
          text-align: center;
          padding: var(--space-8);
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: var(--radius-2xl);
        }

        .upgrade-card .upgrade-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .upgrade-card .upgrade-icon {
          width: 72px;
          height: 72px;
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          border-radius: var(--radius-xl);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 0 30px rgba(139, 92, 246, 0.4);
        }

        .upgrade-card h3 {
          font-size: 1.25rem;
          margin-bottom: var(--space-2);
        }

        .upgrade-card > p {
          color: var(--color-text-secondary);
          max-width: 400px;
          margin: 0 auto var(--space-6);
          line-height: 1.6;
        }

        .upgrade-features {
          display: flex;
          justify-content: center;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        .upgrade-feature {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--color-bg-card);
          border-radius: var(--radius-full);
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }

        .upgrade-feature svg {
          color: #8b5cf6;
        }

        .upgrade-card .upgrade-btn {
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          border: none;
          box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
        }

        .upgrade-card .upgrade-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px rgba(139, 92, 246, 0.5);
        }

        @media (max-width: 640px) {
          .upgrade-features {
            flex-direction: column;
            align-items: center;
          }
        }
      `}</style>
    </div>
  );
}
