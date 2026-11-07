import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useI18n } from '../../../shared/i18n';
import { search, type SearchHit } from '../scene/selectors';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { useExploreStore } from '../state/exploreStore';

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function ExploreSearchModal() {
  const { lang, t } = useI18n();
  const searchOpen = useExploreStore(state => state.searchOpen);
  const setSearchOpen = useExploreStore(state => state.setSearchOpen);
  const selectNode = useExploreStore(state => state.selectNode);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hits = useMemo(() => search(SOL_CENTER_SCENE, query), [query]);

  // Global `/` shortcut to open search modal
  useEffect(() => {
    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === '/' && !searchOpen && !isTypingElement(event.target)) {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.key === 'Escape' && searchOpen) {
        event.preventDefault();
        setSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [searchOpen, setSearchOpen]);

  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setActiveIndex(0);
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [searchOpen]);

  if (!searchOpen) {
    return null;
  }

  const handleSelectHit = (hit: SearchHit) => {
    selectNode(hit.id, { syncLevel: true });
    setSearchOpen(false);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (hits.length > 0) {
        setActiveIndex(prev => (prev + 1) % hits.length);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (hits.length > 0) {
        setActiveIndex(prev => (prev - 1 + hits.length) % hits.length);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const targetHit = hits[activeIndex] ?? hits[0];
      if (targetHit) {
        handleSelectHit(targetHit);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setSearchOpen(false);
    }
  };

  const getNodeTypeBadge = (nodeType: SearchHit['nodeType']) => {
    switch (nodeType) {
      case 'zone':
        return t('Khu vực', 'Zone');
      case 'item':
        return t('Thiết bị / Sân', 'Equipment / Court');
      case 'hotspot':
        return t('Tính năng', 'Feature');
      case 'level':
        return t('Tầng', 'Level');
    }
  };

  return (
    <div
      className="explore3d-search-backdrop"
      data-testid="explore3d-search-backdrop"
      onClick={e => {
        if (e.target === e.currentTarget) {
          setSearchOpen(false);
        }
      }}
    >
      <div
        className="explore3d-search-modal"
        data-testid="explore3d-search-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t(
          'Tìm kiếm khu vực, thiết bị và tiện ích',
          'Search zones, equipment and features',
        )}
      >
        <div className="explore3d-search-modal__header">
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls="explore3d-search-results"
            aria-autocomplete="list"
            data-testid="explore3d-search-input"
            className="explore3d-search-input"
            placeholder={t(
              'Tìm phòng tập, mã máy (EQ-RUN-01, InBody 770), sân cầu lông, sân tennis...',
              'Search zones, equipment codes (EQ-RUN-01, InBody 770), badminton, tennis...',
            )}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
          />
          <button
            type="button"
            className="explore3d-search-close"
            data-testid="explore3d-search-close"
            aria-label={t('Đóng tìm kiếm', 'Close search')}
            onClick={() => setSearchOpen(false)}
          >
            ✕
          </button>
        </div>

        <ul
          id="explore3d-search-results"
          role="listbox"
          className="explore3d-search-results"
          aria-label={t('Kết quả tìm kiếm', 'Search results')}
        >
          {hits.length === 0 ? (
            <li className="explore3d-search-empty">
              {t('Không tìm thấy khu vực hoặc thiết bị phù hợp.', 'No matching zones or equipment found.')}
            </li>
          ) : (
            hits.map((hit, idx) => {
              const active = idx === activeIndex;
              const title = lang === 'en' ? hit.titleEn : hit.titleVi;
              const subtitle = lang === 'en' ? hit.subtitleEn : hit.subtitleVi;
              return (
                <li
                  key={hit.id}
                  role="option"
                  aria-selected={active}
                  className="explore3d-search-result-item"
                >
                  <button
                    type="button"
                    className={`explore3d-search-hit-btn${active ? ' is-active' : ''}`}
                    data-testid={`explore3d-search-hit-${hit.id}`}
                    onClick={() => handleSelectHit(hit)}
                  >
                    <div className="explore3d-search-hit-btn__top">
                      <span className="explore3d-search-hit-btn__title">{title}</span>
                      <span className="explore3d-chip">
                        {hit.levelCode ? `${hit.levelCode} · ` : ''}
                        {getNodeTypeBadge(hit.nodeType)}
                      </span>
                    </div>
                    <div className="explore3d-search-hit-btn__sub">{subtitle}</div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

export default ExploreSearchModal;
