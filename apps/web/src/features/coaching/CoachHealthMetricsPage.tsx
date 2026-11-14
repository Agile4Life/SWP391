import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../shared/api/client';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Select } from '../../shared/ui/Select';
import { useStaffI18n, type StaffMessage } from '../operations/staffI18n';
import { aiApi, type MemberOption } from './aiApi';
import { CoachHealthMetrics } from './CoachHealthMetrics';
import './coach-training-plan.css';

/** Health metrics tab: pick one of the coach's members, then record and review their measurements. */
export function CoachHealthMetricsPage() {
  const { t } = useStaffI18n();
  const role = getCurrentUser()?.role;
  const hasAccess = role === 'COACH' || role === 'MANAGER';
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [memberId, setMemberId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<StaffMessage>('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!hasAccess) return;
    let active = true;
    setLoading(true);
    setError('');
    aiApi.getCoachMembers()
      .then((loaded) => {
        if (!active) return;
        setMembers(loaded);
        setMemberId((prev) => (loaded.some((m) => m.id === prev) ? prev : loaded[0]?.id ?? null));
      })
      .catch(() => { if (active) setError('Không thể tải danh sách học viên. Vui lòng thử lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [hasAccess, attempt]);

  const member = members.find((m) => m.id === memberId);

  return (
    <div data-i18n-managed className="portal-container plan-editor-page">
      <PageHeader title={t("Chỉ số sức khỏe")} />
      {!hasAccess ? (
        <div className="portal-card" role="alert"><p>{t("Truy cập bị từ chối (403 Forbidden)")}</p></div>
      ) : loading ? (
        <LoadingSkeleton label={t("Đang tải hồ sơ sức khỏe hội viên…", "Loading member health profile…")} variant="profile" />
      ) : error ? (
        <div className="portal-alert" role="alert">
          <p>{t(error)}</p>
          <button type="button" className="btn-secondary" onClick={() => setAttempt((value) => value + 1)}>{t("Thử lại")}</button>
        </div>
      ) : !member ? (
        <div className="portal-card" role="status">
          <p><strong>{t("Chưa có học viên để ghi nhận chỉ số sức khỏe.", "No students available for health metrics.")}</strong></p>
          <p>{t("Học viên lấy từ các lớp đã có hội viên ghi danh.")}</p>
        </div>
      ) : (
        <>
          <div className="portal-card" style={{ marginBottom: 20, maxWidth: 520 }}>
            <label className="portal-label" htmlFor="health-member-select">{t("Học viên thụ hưởng")}</label>
            <Select id="health-member-select" className="portal-select" value={String(member.id)} onChange={(e) => setMemberId(Number(e.target.value))}>
              {members.map((m) => (
                <option data-i18n-managed key={m.id} value={String(m.id)}>{m.fullName} ({m.memberCode})</option>
              ))}
            </Select>
          </div>
          <CoachHealthMetrics memberId={member.id} memberName={member.fullName} />
        </>
      )}
    </div>
  );
}
