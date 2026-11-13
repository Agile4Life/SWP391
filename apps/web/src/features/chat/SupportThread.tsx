import { lazy, Suspense } from 'react';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { useI18n } from '../../shared/i18n';

// Hai hội thoại hỗ trợ/khiếu nại chỉ tải khi người dùng mở mục này trong Tin nhắn.
const MemberSupportChat = lazy(() => import('./MemberSupportChat').then(module => ({ default: module.MemberSupportChat })));
const StaffSupportChat = lazy(() => import('./StaffSupportChat').then(module => ({ default: module.StaffSupportChat })));

/**
 * Hỗ trợ & khiếu nại nằm chung khung Tin nhắn và dùng cùng giao diện hội thoại: hội viên nhắn tin để gửi và theo dõi phiếu,
 * lễ tân nhận, trả lời bằng tin nhắn và chuyển cấp ngay trong hộp thư của mình.
 */
export function SupportThread({ staff, onBack, active = true }: { staff: boolean; onBack: () => void; active?: boolean }) {
  const { t } = useI18n();
  return <Suspense fallback={<section className="direct-chat__thread direct-chat__support"><div className="direct-chat__transcript"><LoadingSkeleton label={t('Đang tải hỗ trợ…', 'Loading support…')} count={3} /></div></section>}>
    {staff ? <StaffSupportChat onBack={onBack} active={active} /> : <MemberSupportChat onBack={onBack} active={active} />}
  </Suspense>;
}
