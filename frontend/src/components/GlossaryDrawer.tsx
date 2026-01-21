import { useState, useMemo } from 'react';
import { X, Search, BookOpen, Lightbulb, ChevronRight } from 'lucide-react';
import { getAllTerms, getTermsByCategory, categoryNames, GlossaryTerm } from '../utils/glossary';

interface GlossaryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlossaryDrawer({ isOpen, onClose }: GlossaryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<GlossaryTerm['category'] | 'all'>('all');

  const allTerms = getAllTerms();

  const filteredTerms = useMemo(() => {
    let terms = selectedCategory === 'all' 
      ? allTerms 
      : getTermsByCategory(selectedCategory);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      terms = terms.filter(
        term =>
          term.term.toLowerCase().includes(query) ||
          term.shortExplanation.toLowerCase().includes(query) ||
          term.fullExplanation.toLowerCase().includes(query)
      );
    }

    return terms;
  }, [searchQuery, selectedCategory, allTerms]);

  const groupedTerms = useMemo(() => {
    if (selectedCategory !== 'all') {
      return { [selectedCategory]: filteredTerms };
    }

    const groups: Record<string, GlossaryTerm[]> = {};
    filteredTerms.forEach(term => {
      if (!groups[term.category]) {
        groups[term.category] = [];
      }
      groups[term.category].push(term);
    });
    return groups;
  }, [filteredTerms, selectedCategory]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="glossary-backdrop" onClick={onClose} />
      
      {/* Drawer */}
      <div className="glossary-drawer">
        {/* Header */}
        <header className="glossary-header">
          <div className="glossary-header__title">
            <BookOpen size={24} />
            <div>
              <h2>Glosario de Términos</h2>
              <p>Explicaciones simples para entender tu negocio</p>
            </div>
          </div>
          <button className="glossary-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        {/* Search */}
        <div className="glossary-search">
          <Search size={18} className="glossary-search__icon" />
          <input
            type="text"
            placeholder="Buscar término..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              className="glossary-search__clear"
              onClick={() => setSearchQuery('')}
              aria-label="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category filters */}
        <div className="glossary-categories">
          <button
            className={`glossary-category ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            Todos
          </button>
          {(Object.keys(categoryNames) as GlossaryTerm['category'][]).map(cat => (
            <button
              key={cat}
              className={`glossary-category ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {categoryNames[cat]}
            </button>
          ))}
        </div>

        {/* Terms list */}
        <div className="glossary-content">
          {filteredTerms.length === 0 ? (
            <div className="glossary-empty">
              <Search size={32} />
              <p>No encontramos términos que coincidan con "{searchQuery}"</p>
              <button onClick={() => setSearchQuery('')}>Mostrar todos</button>
            </div>
          ) : (
            Object.entries(groupedTerms).map(([category, terms]) => (
              <div key={category} className="glossary-section">
                {selectedCategory === 'all' && (
                  <h3 className="glossary-section__title">
                    {categoryNames[category as GlossaryTerm['category']]}
                  </h3>
                )}
                <div className="glossary-terms">
                  {terms.map((term) => (
                    <div
                      key={term.term}
                      className={`glossary-term ${expandedTerm === term.term ? 'expanded' : ''}`}
                    >
                      <button
                        className="glossary-term__header"
                        onClick={() => setExpandedTerm(expandedTerm === term.term ? null : term.term)}
                      >
                        <div className="glossary-term__info">
                          <span className="glossary-term__name">{term.term}</span>
                          <span className="glossary-term__short">{term.shortExplanation}</span>
                        </div>
                        <ChevronRight
                          size={16}
                          className={`glossary-term__arrow ${expandedTerm === term.term ? 'rotated' : ''}`}
                        />
                      </button>

                      {expandedTerm === term.term && (
                        <div className="glossary-term__body">
                          <p className="glossary-term__full">{term.fullExplanation}</p>
                          {term.example && (
                            <div className="glossary-term__example">
                              <Lightbulb size={14} />
                              <span><strong>Ejemplo:</strong> {term.example}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer tip */}
        <footer className="glossary-footer">
          <Lightbulb size={16} />
          <span>
            Tocá el ícono <span className="help-icon-demo">?</span> junto a cualquier término para ver su explicación
          </span>
        </footer>
      </div>

      <style>{`
        .glossary-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(2px);
          z-index: 999;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .glossary-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 420px;
          max-width: 100vw;
          background: white;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          animation: slideIn 0.25s ease;
          box-shadow: -10px 0 50px rgba(0, 0, 0, 0.15);
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .glossary-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 20px 20px 16px;
          border-bottom: 1px solid var(--color-border, #e2e8f0);
          background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
        }

        .glossary-header__title {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .glossary-header__title svg {
          color: var(--color-primary, #10b981);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .glossary-header__title h2 {
          font-size: 1.1rem;
          font-weight: 700;
          margin: 0 0 2px 0;
          color: var(--color-text, #1e293b);
        }

        .glossary-header__title p {
          font-size: 0.8rem;
          color: var(--color-text-secondary, #64748b);
          margin: 0;
        }

        .glossary-close {
          background: white;
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: 8px;
          padding: 8px;
          cursor: pointer;
          color: var(--color-text-secondary, #64748b);
          transition: all 0.15s;
        }

        .glossary-close:hover {
          background: var(--color-bg-secondary, #f8fafc);
          color: var(--color-text, #1e293b);
        }

        .glossary-search {
          position: relative;
          padding: 16px 20px;
          border-bottom: 1px solid var(--color-border, #e2e8f0);
        }

        .glossary-search__icon {
          position: absolute;
          left: 32px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-light, #94a3b8);
          pointer-events: none;
        }

        .glossary-search input {
          width: 100%;
          padding: 12px 40px;
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: 10px;
          font-size: 0.9rem;
          outline: none;
          transition: all 0.15s;
        }

        .glossary-search input:focus {
          border-color: var(--color-primary, #10b981);
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }

        .glossary-search input::placeholder {
          color: var(--color-text-light, #94a3b8);
        }

        .glossary-search__clear {
          position: absolute;
          right: 32px;
          top: 50%;
          transform: translateY(-50%);
          background: var(--color-bg-secondary, #f8fafc);
          border: none;
          border-radius: 4px;
          padding: 4px;
          cursor: pointer;
          color: var(--color-text-secondary, #64748b);
        }

        .glossary-categories {
          display: flex;
          gap: 8px;
          padding: 12px 20px;
          border-bottom: 1px solid var(--color-border, #e2e8f0);
          overflow-x: auto;
          flex-shrink: 0;
        }

        .glossary-category {
          padding: 6px 12px;
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: 20px;
          background: white;
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--color-text-secondary, #64748b);
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }

        .glossary-category:hover {
          background: var(--color-bg-secondary, #f8fafc);
        }

        .glossary-category.active {
          background: var(--color-primary, #10b981);
          border-color: var(--color-primary, #10b981);
          color: white;
        }

        .glossary-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
        }

        .glossary-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          color: var(--color-text-secondary, #64748b);
        }

        .glossary-empty svg {
          color: var(--color-text-light, #94a3b8);
          margin-bottom: 12px;
        }

        .glossary-empty p {
          margin: 0 0 12px 0;
          font-size: 0.85rem;
        }

        .glossary-empty button {
          padding: 8px 16px;
          background: var(--color-primary, #10b981);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
        }

        .glossary-section {
          margin-bottom: 24px;
        }

        .glossary-section:last-child {
          margin-bottom: 0;
        }

        .glossary-section__title {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--color-text-light, #94a3b8);
          margin: 0 0 12px 0;
          padding-bottom: 8px;
          border-bottom: 1px dashed var(--color-border, #e2e8f0);
        }

        .glossary-terms {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .glossary-term {
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.15s;
        }

        .glossary-term:hover {
          border-color: var(--color-primary, #10b981);
        }

        .glossary-term.expanded {
          border-color: var(--color-primary, #10b981);
          background: #f0fdf4;
        }

        .glossary-term__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 12px 14px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
        }

        .glossary-term__info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .glossary-term__name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-text, #1e293b);
        }

        .glossary-term__short {
          font-size: 0.75rem;
          color: var(--color-text-secondary, #64748b);
        }

        .glossary-term__arrow {
          color: var(--color-text-light, #94a3b8);
          transition: transform 0.2s;
          flex-shrink: 0;
        }

        .glossary-term__arrow.rotated {
          transform: rotate(90deg);
        }

        .glossary-term__body {
          padding: 0 14px 14px;
          animation: expandIn 0.2s ease;
        }

        @keyframes expandIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .glossary-term__full {
          font-size: 0.8rem;
          line-height: 1.6;
          color: var(--color-text-secondary, #64748b);
          margin: 0;
        }

        .glossary-term__example {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 12px;
          padding: 10px 12px;
          background: linear-gradient(135deg, #fef3c7, #fef9c3);
          border-radius: 8px;
          font-size: 0.75rem;
          color: #92400e;
        }

        .glossary-term__example svg {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .glossary-footer {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 20px;
          background: var(--color-bg-secondary, #f8fafc);
          border-top: 1px solid var(--color-border, #e2e8f0);
          font-size: 0.75rem;
          color: var(--color-text-secondary, #64748b);
        }

        .glossary-footer svg {
          color: #f59e0b;
          flex-shrink: 0;
        }

        .help-icon-demo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          background: var(--color-primary, #10b981);
          color: white;
          border-radius: 50%;
          font-size: 0.65rem;
          font-weight: 600;
          margin: 0 2px;
        }

        @media (max-width: 480px) {
          .glossary-drawer {
            width: 100vw;
          }

          .glossary-categories {
            padding: 10px 16px;
          }

          .glossary-content {
            padding: 12px 16px;
          }
        }
      `}</style>
    </>
  );
}

export default GlossaryDrawer;

