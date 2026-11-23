import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../shared/i18n/language';
import { PageHeader } from '../../shared/ui/PageHeader';
import { MemberCoachBookingView } from './components/MemberCoachBookingView';
import { MemberCalendar } from './components/MemberCalendar';

export function MemberClassesPage() {
  const { lang } = useLanguage();
  const [params, setParams] = useSearchParams();
  const text = (vi: string, en: string) => lang === 'en' ? en : vi;
  // Giữ URL cũ cho liên kết thanh toán PT; tab lớp nhóm cũ trở về lịch PT.
  const booking = params.get('tab') === 'pt';
  return <div data-i18n-managed className="portal-container member-classes">
    <PageHeader title={text('Lịch PT 1:1', '1:1 PT schedule')} />
    <div className="portal-tabs" role="tablist" aria-label={text("Lịch PT", "PT schedule")}>
      <button type="button" role="tab" aria-selected={!booking} className={!booking ? "portal-tab active" : "portal-tab"} onClick={() => setParams({})}>{text("Lịch của tôi", "My schedule")}</button>
      <button type="button" role="tab" aria-selected={booking} className={booking ? "portal-tab active" : "portal-tab"} onClick={() => setParams({ tab: "pt" })}>{text("Đặt lịch HLV 1:1", "Book a 1:1 coach")}</button>
    </div>
    {/* Component PT hiện có giữ toàn bộ xem slot, đặt, hủy và thanh toán. */}
    {booking ? <MemberCoachBookingView /> : <MemberCalendar />}
  </div>;
}
