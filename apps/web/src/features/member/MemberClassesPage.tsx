import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../shared/i18n/language';
import { PageHeader } from '../../shared/ui/PageHeader';
import { MemberCoachBookingView } from './components/MemberCoachBookingView';
import { MemberCalendar } from './components/MemberCalendar';
import { MemberGroupClassesView } from './components/MemberGroupClassesView';

type MemberClassesTab = 'timetable' | 'classes' | 'pt';

/**
 * Trang Lịch học & đặt PT của hội viên (`/member/classes`):
 * 3 tab rõ ràng: Lịch của tôi (gộp lớp nhóm + PT 1:1), Đăng ký lớp học, và Đặt lịch HLV 1:1.
 * Hỗ trợ tương thích cả `?tab=pt` lẫn `?tab=coach_booking` cũ và `?discipline=...`.
 */
export function MemberClassesPage() {
  const { lang } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [refreshTick, setRefreshTick] = useState(0);

  const text = (vi: string, en: string) => (lang === 'en' ? en : vi);
  const rawTab = params.get('tab');
  const disciplineParam = params.get('discipline') ?? undefined;

  const activeTab: MemberClassesTab =
    rawTab === 'pt' || rawTab === 'coach_booking'
      ? 'pt'
      : rawTab === 'classes' || rawTab === 'schedule' || Boolean(disciplineParam)
        ? 'classes'
        : 'timetable';

  const selectTab = (next: MemberClassesTab) => {
    if (next === 'timetable') setParams({});
    else if (next === 'classes') setParams({ tab: 'classes' });
    else setParams({ tab: 'pt' });
  };

  const handleBookingChange = () => setRefreshTick((n) => n + 1);

  return (
    <div data-i18n-managed className="portal-container member-classes">
      <PageHeader title={text('Lịch học & đặt PT', 'Classes & 1:1 PT')} />
      <div className="portal-tabs" role="tablist" aria-label={text('Lịch học và đặt lịch', 'Schedule and booking')}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'timetable'}
          className={activeTab === 'timetable' ? 'portal-tab active' : 'portal-tab'}
          onClick={() => selectTab('timetable')}
        >
          {text('Lịch của tôi', 'My schedule')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'classes'}
          className={activeTab === 'classes' ? 'portal-tab active' : 'portal-tab'}
          onClick={() => selectTab('classes')}
        >
          {text('Đăng ký lớp học', 'Group classes')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pt'}
          className={activeTab === 'pt' ? 'portal-tab active' : 'portal-tab'}
          onClick={() => selectTab('pt')}
        >
          {text('Đặt lịch HLV 1:1', 'Book a 1:1 coach')}
        </button>
      </div>

      {activeTab === 'timetable' ? (
        <MemberCalendar key={refreshTick} />
      ) : activeTab === 'classes' ? (
        <MemberGroupClassesView initialDiscipline={disciplineParam} onBookingChange={handleBookingChange} />
      ) : (
        <MemberCoachBookingView onBookingSuccess={handleBookingChange} />
      )}
    </div>
  );
}
