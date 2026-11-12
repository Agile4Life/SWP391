import { useStaffI18n, type StaffMessage, staffError as errorMessage, staffNotify as notify } from '../operations/staffI18n';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { listHealthMetrics, addHealthMetrics, type HealthMetric } from '../member/profileApi';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { formatCenterDateTime } from '../../shared/lib/centerTime';
import { calculateAutoBmi, summarizeHealthMetrics, type HealthMetricsSummary } from './coachHealthUtils';

export type { HealthMetricsSummary };

type MetricKey = 'height' | 'weight' | 'body_fat' | 'muscle_mass';
type Draft = Record<MetricKey, string>;

interface FieldSpec { key: MetricKey; label: string; en: string; unit: string; optional: boolean }

/** Height and weight drive BMI; body fat and muscle mass are optional extras. */
const FIELDS: FieldSpec[] = [
  { key: 'height', label: 'Chiều cao', en: 'Height', unit: 'cm', optional: false },
  { key: 'weight', label: 'Cân nặng', en: 'Weight', unit: 'kg', optional: false },
  { key: 'body_fat', label: 'Tỷ lệ mỡ', en: 'Body fat', unit: '%', optional: true },
  { key: 'muscle_mass', label: 'Khối lượng cơ', en: 'Muscle mass', unit: 'kg', optional: true },
];
const EMPTY_DRAFT: Draft = { height: '', weight: '', body_fat: '', muscle_mass: '' };
const COLUMNS: { key: string; label: string; en: string; unit: string }[] = [
  { key: 'weight', label: 'Cân nặng', en: 'Weight', unit: 'kg' },
  { key: 'height', label: 'Chiều cao', en: 'Height', unit: 'cm' },
  { key: 'bmi', label: 'BMI', en: 'BMI', unit: '' },
  { key: 'body_fat', label: 'Tỷ lệ mỡ', en: 'Body fat', unit: '%' },
  { key: 'muscle_mass', label: 'Khối lượng cơ', en: 'Muscle mass', unit: 'kg' },
];

/** One assessment: every measurement taken together (saved within the same minute). */
interface Assessment { at: string; values: Record<string, number> }

function groupAssessments(rows: readonly HealthMetric[]): Assessment[] {
  const groups = new Map<string, Assessment>();
  for (const row of rows) {
    const key = row.recordedAt.slice(0, 16);
    const group = groups.get(key) ?? { at: row.recordedAt, values: {} };
    const name = row.metricName.toLowerCase();
    if (group.values[name] === undefined) group.values[name] = row.metricValue;
    if (row.recordedAt > group.at) group.at = row.recordedAt;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (a.at < b.at ? 1 : -1));
}

function latestOf(rows: readonly HealthMetric[], name: string): HealthMetric | undefined {
  return rows.reduce<HealthMetric | undefined>((best, row) => {
    if (row.metricName.toLowerCase() !== name) return best;
    return !best || row.recordedAt > best.recordedAt ? row : best;
  }, undefined);
}

function parseValue(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : Number.NaN;
}

/** Remount for each selected member to isolate drafts and in-flight requests. */
export function CoachHealthMetrics({ memberId, memberName, intakeOnly = false, onMetricsChange }: { memberId: number; memberName: string; intakeOnly?: boolean; onMetricsChange?: (summary: HealthMetricsSummary) => void }) {
  return <HealthMetricsForm key={String(memberId) + String(intakeOnly)} memberId={memberId} memberName={memberName} intakeOnly={intakeOnly} onMetricsChange={onMetricsChange} />;
}

function HealthMetricsForm({ memberId, memberName, intakeOnly, onMetricsChange }: { memberId: number; memberName: string; intakeOnly: boolean; onMetricsChange?: (summary: HealthMetricsSummary) => void }) {
  const { t } = useStaffI18n();
  const [rows, setRows] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<StaffMessage>('');
  const [saveError, setSaveError] = useState<StaffMessage>('');
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const alive = useRef(false);
  const latestRowsRef = useRef<HealthMetric[]>([]);
  const onMetricsChangeRef = useRef(onMetricsChange);
  useEffect(() => {
    onMetricsChangeRef.current = onMetricsChange;
  }, [onMetricsChange]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    if (intakeOnly) { setLoading(false); return () => { active = false; }; }
    listHealthMetrics(memberId)
      .then((data) => {
        if (!active) return;
        const nextRows = data.length > 0 ? data : latestRowsRef.current;
        latestRowsRef.current = nextRows;
        setRows(nextRows);
        if (nextRows.length > 0) onMetricsChangeRef.current?.(summarizeHealthMetrics(memberId, nextRows));
      })
      .catch((err) => { if (active) setLoadError(errorMessage(err, 'Không thể tải lịch sử số đo.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [memberId, attempt, intakeOnly]);

  const summary = useMemo(() => summarizeHealthMetrics(memberId, rows), [memberId, rows]);
  const assessments = useMemo(() => groupAssessments(rows), [rows]);
  const previous = useMemo(() => {
    const result: Partial<Record<MetricKey, HealthMetric>> = {};
    for (const field of FIELDS) result[field.key] = latestOf(rows, field.key);
    return result;
  }, [rows]);

  // BMI follows the entered height/weight; a blank field falls back to the latest recorded value.
  const heightNow = parseValue(draft.height) ?? summary.heightCm;
  const weightNow = parseValue(draft.weight) ?? summary.weightKg;
  const liveBmi = calculateAutoBmi(
    typeof heightNow === 'number' && Number.isFinite(heightNow) ? heightNow : undefined,
    typeof weightNow === 'number' && Number.isFinite(weightNow) ? weightNow : undefined,
  );

  function setField(key: MetricKey, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || loading || loadError) return;
    const items: { metricName: MetricKey; metricValue: number; unit: string }[] = [];
    for (const field of FIELDS) {
      const number = parseValue(draft[field.key]);
      if (number === null) continue;
      if (Number.isNaN(number) || number < 0.01 || Math.round(number * 100) / 100 !== number || (field.key === 'body_fat' && number > 100)) {
        setSaveError('Nhập giá trị hợp lệ lớn hơn 0 (tối đa 2 chữ số thập phân); tỷ lệ mỡ không vượt 100%.');
        return;
      }
      items.push({ metricName: field.key, metricValue: number, unit: field.unit });
    }
    if (items.length === 0) {
      setSaveError('Nhập ít nhất một số đo để lưu.');
      return;
    }
    busy.current = true;
    setSaving(true);
    setSaveError('');
    try {
      await addHealthMetrics(memberId, { metrics: items });
      if (alive.current) {
        const recordedAt = new Date().toISOString();
        const optimistic: HealthMetric[] = items.map((item, index) => ({ id: Date.now() + index, metricName: item.metricName, metricValue: item.metricValue, unit: item.unit, recordedAt }));
        const touched = items.some((item) => item.metricName === 'height' || item.metricName === 'weight');
        const bmi = touched ? calculateAutoBmi(
          items.find((item) => item.metricName === 'height')?.metricValue ?? summarizeHealthMetrics(memberId, latestRowsRef.current).heightCm,
          items.find((item) => item.metricName === 'weight')?.metricValue ?? summarizeHealthMetrics(memberId, latestRowsRef.current).weightKg,
        ) : undefined;
        if (bmi !== undefined) optimistic.push({ id: Date.now() + items.length, metricName: 'bmi', metricValue: bmi, unit: null, recordedAt });
        const nextRows = [...optimistic, ...latestRowsRef.current];
        latestRowsRef.current = nextRows;
        onMetricsChangeRef.current?.(summarizeHealthMetrics(memberId, nextRows));
        setDraft(EMPTY_DRAFT);
        setAttempt((n) => n + 1);
        notify('Đã ghi nhận số đo sức khỏe.', 'success');
      }
    } catch (err) {
      if (alive.current) setSaveError(errorMessage(err, 'Không thể lưu số đo.'));
    } finally {
      busy.current = false;
      if (alive.current) setSaving(false);
    }
  }

  return <section data-i18n-managed className="portal-card" aria-label={t("Chỉ số sức khỏe học viên")}>
    <h2 className="portal-card-title">{t("Chỉ số sức khỏe · ")}{memberName}</h2>
    {intakeOnly && <p className="muted">{t("Chỉ thêm số đo cho hội viên đang check-in hôm nay.")}</p>}
    {loading ? <LoadingSkeleton label={t("Đang tải số đo")} count={2} /> : loadError ? <div role="alert">{t(loadError)} <button type="button" className="btn-secondary" onClick={() => setAttempt((n) => n + 1)}>{t("Thử lại")}</button></div> : <>
      <form data-i18n-managed onSubmit={(event) => void submit(event)}>
        <p className="muted">{t("Mỗi lần đánh giá nhập được nhiều số đo cùng lúc. Ô để trống sẽ giữ nguyên số đo gần nhất.", "Enter several measurements in one assessment. Blank fields keep the latest recorded value.")}</p>
        <div className="grid-3">
          {FIELDS.filter((field) => !field.optional).map((field) => <MetricInput key={field.key} field={field} value={draft[field.key]} previous={previous[field.key]} disabled={saving} onChange={setField} />)}
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="coach-metric-bmi">{t("BMI")}</label>
            <input id="coach-metric-bmi" className="portal-input" type="text" readOnly tabIndex={-1} value={liveBmi !== undefined ? String(liveBmi) : '—'} aria-describedby="coach-metric-bmi-hint" />
            <small id="coach-metric-bmi-hint" className="muted">{t("BMI được tính tự động từ chiều cao và cân nặng.")}</small>
          </div>
        </div>
        <div className="grid-2">
          {FIELDS.filter((field) => field.optional).map((field) => <MetricInput key={field.key} field={field} value={draft[field.key]} previous={previous[field.key]} disabled={saving} onChange={setField} />)}
        </div>
        {saveError && <p role="alert" className="form-error">{t(saveError)}</p>}
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? t('Đang lưu…') : t('Lưu đánh giá', 'Save assessment')}</button>
      </form>
      {intakeOnly ? null : assessments.length === 0 ? <p>{t("Chưa có số đo được ghi nhận.")}</p> : <div className="portal-table-wrapper"><table className="portal-table"><thead><tr><th scope="col">{t("Ngày ghi nhận")}</th>{COLUMNS.map((column) => <th key={column.key} scope="col">{t(column.label, column.en)}{column.unit ? ` (${column.unit})` : ''}</th>)}</tr></thead><tbody>{assessments.map((assessment) => <tr key={assessment.at}><td>{formatCenterDateTime(assessment.at)}</td>{COLUMNS.map((column) => <td key={column.key}>{assessment.values[column.key] ?? '—'}</td>)}</tr>)}</tbody></table></div>}
    </>}
  </section>;
}

function MetricInput({ field, value, previous, disabled, onChange }: { field: FieldSpec; value: string; previous?: HealthMetric; disabled: boolean; onChange: (key: MetricKey, value: string) => void }) {
  const { t } = useStaffI18n();
  const id = `coach-metric-${field.key.replace('_', '-')}`;
  return <div className="portal-form-group">
    <label className="portal-label" htmlFor={id}>
      {t(field.label, field.en)} ({field.unit}){field.optional ? <span className="muted"> · {t('Tùy chọn', 'Optional')}</span> : null}
    </label>
    <input
      id={id}
      className="portal-input"
      type="number"
      inputMode="decimal"
      min="0.01"
      max={field.key === 'body_fat' ? 100 : undefined}
      step="0.01"
      value={value}
      disabled={disabled}
      placeholder={previous ? `${t('Gần nhất', 'Latest')}: ${previous.metricValue}` : ''}
      onChange={(event) => onChange(field.key, event.target.value)}
    />
  </div>;
}
