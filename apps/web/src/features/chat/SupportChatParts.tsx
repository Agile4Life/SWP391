import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { formatCenterDateTime } from '../../shared/lib/centerTime';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { useI18n } from '../../shared/i18n';
import type { SupportBubble } from './supportChat';

/** Biểu tượng tai nghe dùng cho avatar của mục Hỗ trợ & Khiếu nại (danh sách và tiêu đề hội thoại). */
export function SupportIcon({ size = 26 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 0 1 18 0" /><path d="M3 12v3a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" /><path d="M21 12v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z" /><path d="M18 17v1a3 3 0 0 1-3 3h-2" />
  </svg>;
}

/** Tiêu đề hội thoại giống ChatThread: nút quay lại, avatar, tên + dòng phụ, hành động bên phải. */
export function SupportHeader({ onBack, title, subtitle, active, children }: {
  onBack: () => void; title: string; subtitle: ReactNode; active: boolean; children?: ReactNode;
}) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (active) heading.current?.focus({ preventScroll: true }); }, [active]);
  return <header className="direct-chat__thread-header">
    <button type="button" data-i18n-managed className="direct-chat__back direct-chat__link" onClick={onBack} aria-label={t('Quay lại danh sách', 'Back to conversations')} title={t('Quay lại danh sách', 'Back to conversations')}>
      <svg className="direct-chat__back-chevron" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span className="direct-chat__back-label">{t('Danh sách', 'Conversations')}</span>
    </button>
    <div className="direct-chat__thread-peer">
      <span className="direct-chat__avatar direct-chat__avatar--support direct-chat__thread-avatar" aria-hidden="true"><SupportIcon size={18} /></span>
      <div className="direct-chat__thread-meta">
        <h2 id="chat-support-title" data-i18n-managed tabIndex={-1} ref={heading}>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
    {children}
  </header>;
}

export function HeaderAction({ label, onClick, disabled, pressed, children }: {
  label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; children: ReactNode;
}) {
  return <button type="button" data-i18n-managed className={`direct-chat__thread-action${pressed ? ' is-active' : ''}`} aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
  </button>;
}

/** Vùng tin nhắn dạng bong bóng, tự cuộn xuống tin mới nhất. */
export function SupportTranscript({ label, bubbles, pending, loading, empty, fallbackName }: {
  label: string; bubbles: SupportBubble[]; pending?: string | null; loading: boolean; empty: ReactNode; fallbackName: string;
}) {
  const { t } = useI18n();
  const scroll = useRef<HTMLDivElement>(null);
  const last = bubbles.at(-1)?.id;
  useLayoutEffect(() => {
    const node = scroll.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [last, bubbles.length, pending, loading]);
  const showEmpty = !loading && bubbles.length === 0 && !pending;
  return <div className="direct-chat__transcript" ref={scroll} role="region" aria-label={label} tabIndex={0} aria-busy={loading}>
    {loading ? <LoadingSkeleton label={t('Đang tải tin nhắn…', 'Loading messages…')} count={3} /> : showEmpty ? empty : null}
    {!loading && <ol className="direct-chat__messages">
      {bubbles.map(bubble => <li key={bubble.id} className={bubble.mine ? 'is-mine' : undefined}>
        <div className="direct-chat__bubble">
          {bubble.mine
            ? <span className="direct-chat__sender">{t('Bạn', 'You')}</span>
            : <strong data-i18n-managed className="support-chat__name">{bubble.sender || fallbackName}</strong>}
          <p data-i18n-managed>{bubble.text}</p>
          <time dateTime={bubble.at}>{formatCenterDateTime(bubble.at)}</time>
        </div>
      </li>)}
      {pending && <li className="is-mine"><div className="direct-chat__bubble is-pending"><span className="direct-chat__sender">{t('Bạn', 'You')}</span><p data-i18n-managed>{pending}</p></div></li>}
    </ol>}
  </div>;
}
