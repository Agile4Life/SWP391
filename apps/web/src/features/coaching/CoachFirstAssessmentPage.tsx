import { useState, type FormEvent } from 'react';
import { useI18n } from '../../shared/i18n';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { localizableError } from '../../shared/lib/errorMessage';
import { CoachHealthMetrics } from './CoachHealthMetrics';
import { searchFirstAssessmentCandidates, type FirstAssessmentCandidate } from './firstAssessmentApi';

/**
 * First assessment: every registered member is measured once by a coach when they first come to the center,
 * before they pick a package. Later measurements belong to the member's assigned coach.
 */
export function CoachFirstAssessmentPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FirstAssessmentCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | Error | null>(null);
  const [selected, setSelected] = useState<FirstAssessmentCandidate | null>(null);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (query.trim().length < 2) {
      setError(t('Nhập ít nhất 2 ký tự: tên, mã hội viên, email hoặc số điện thoại.', 'Enter at least 2 characters: name, member code, email or phone.'));
      return;
    }
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      setResults(await searchFirstAssessmentCandidates(query));
    } catch (cause) {
      setResults(null);
      setError(localizableError(cause, 'Không tìm được hội viên. Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-i18n-managed className="portal-container first-assessment">
      <PageHeader title={t('Đánh giá thể trạng lần đầu', 'First fitness assessment')} />
      <form className="portal-card stack" onSubmit={(event) => void onSearch(event)} aria-label={t('Tìm hội viên chưa được đánh giá', 'Find members awaiting an assessment')}>
        <p>{t(
          'Hội viên đến trung tâm lần đầu được đo thể trạng và BMI để tư vấn gói tập và lộ trình. Chỉ hiện hội viên đã có tài khoản và chưa có số đo nào.',
          'Members visiting for the first time are measured (fitness and BMI) so you can advise on a package and a roadmap. Only registered members with no measurements are listed.',
        )}</p>
        <div className="portal-form-group">
          <label className="portal-label" htmlFor="first-assessment-search">{t('Tên, mã hội viên, email hoặc số điện thoại', 'Name, member code, email or phone')}</label>
          <input id="first-assessment-search" className="portal-input" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div><button type="submit" className="btn-primary" disabled={loading}>{loading ? t('Đang tìm…', 'Searching…') : t('Tìm hội viên', 'Search')}</button></div>
      </form>
      {error && <div className="portal-card" role="alert"><strong>{t(error)}</strong></div>}
      {loading && <LoadingSkeleton label={t('Đang tìm hội viên', 'Searching members')} />}
      {!loading && results && results.length === 0 && (
        <div className="portal-card" role="status">{t('Không có hội viên nào chờ đánh giá khớp với tìm kiếm.', 'No member awaiting an assessment matches your search.')}</div>
      )}
      {!loading && results && results.length > 0 && (
        <ul className="stack" style={{ listStyle: 'none', padding: 0 }} aria-label={t('Hội viên chờ đánh giá', 'Members awaiting assessment')}>
          {results.map((item) => (
            <li key={item.memberId} className="portal-card" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span><strong>{item.fullName ?? '—'}</strong> {item.membershipCode ? `(${item.membershipCode})` : ''} {item.phone ?? ''}</span>
              <button type="button" className="btn-secondary btn-sm" aria-pressed={selected?.memberId === item.memberId} onClick={() => setSelected(item)}>
                {t('Đánh giá', 'Assess')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && <CoachHealthMetrics memberId={selected.memberId} memberName={selected.fullName ?? ''} intakeOnly />}
    </div>
  );
}
