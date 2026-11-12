import { lazy, Suspense, useEffect, useRef } from 'react';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { useI18n } from '../../shared/i18n';

// Hai màn hình hỗ trợ/khiếu nại chỉ tải khi người dùng mở mục này trong Tin nhắn.
const MemberSupportPage = lazy(() => import('../member/MemberSupportPage').then(module => ({ default: module.MemberSupportPage })));
const StaffSupportPage = lazy(() => import('../support/StaffSupportPage').then(module => ({ default: module.StaffSupportPage })));

/**
 * Hỗ trợ & khiếu nại nằm chung khung Tin nhắn: hội viên gửi và theo dõi phiếu gửi lên lễ tân,
 * lễ tân nhận, trả lời và chuyển cấp ngay trong hộp thư của mình.
 */
export function SupportThread({ staff, onBack, active = true }: { staff: boolean; onBack: () => void; active?: boolean }) {
  const { t } = useI18n();
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (active) title.current?.focus({ preventScroll: true }); }, [active]);
  return <section className="direct-chat__thread direct-chat__support" aria-labelledby="chat-support-title">
    <header className="direct-chat__thread-header">
      <button type="button" data-i18n-managed className="direct-chat__back direct-chat__link" onClick={onBack} aria-label={t('Quay lại danh sách', 'Back to conversations')} title={t('Quay lại danh sách', 'Back to conversations')}>
        <svg className="direct-chat__back-chevron" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span className="direct-chat__back-label">{t('Danh sách', 'Conversations')}</span>
      </button>
      <div className="direct-chat__thread-peer">
        <div className="direct-chat__thread-meta">
          <h2 id="chat-support-title" data-i18n-managed tabIndex={-1} ref={title}>{t('Hỗ trợ & Khiếu nại', 'Support & Tickets')}</h2>
          <p>{staff ? t('Phiếu từ hội viên gửi lên lễ tân', 'Tickets members send to the front desk') : t('Gửi yêu cầu tới lễ tân và theo dõi phản hồi', 'Send requests to the front desk and follow replies')}</p>
        </div>
      </div>
    </header>
    <div className="direct-chat__support-body">
      <Suspense fallback={<LoadingSkeleton label={t('Đang tải hỗ trợ…', 'Loading support…')} count={3} />}>
        {staff ? <StaffSupportPage embedded /> : <MemberSupportPage embedded />}
      </Suspense>
    </div>
  </section>;
}
