import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { formatPrice } from '../../shared/lib/membershipPresentation';
import { useStaffI18n, type StaffMessage, staffError as errorMessage } from '../operations/staffI18n';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { Select } from '../../shared/ui/Select';
import { DatePicker } from '../../shared/ui/DatePicker';
import { Modal } from '../../shared/ui/Modal';
import { centerNowParts, formatCenterDateTime } from '../../shared/lib/centerTime';
import type { PageResult } from './auditApi';
import {
  reconciliationApi,
  type IpnEventRow,
  type LateRefundRow,
  type MemberRef,
  type PaymentTimeline,
  type ReconciliationSummary,
  type VnpayAttemptRow,
} from './reconciliationApi';
import './admin-audit-logs.css';
import './admin-reconciliation.css';

type Tab = 'attempts' | 'refunds' | 'ipn';
type Translate = ReturnType<typeof useStaffI18n>['t'];

const PAGE_SIZE = 20;
const DEFAULT_DAYS = 7;

function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Loads one page of a list while `enabled`; `key` changes whenever the request parameters change. */
function usePaged<T>(load: () => Promise<PageResult<T>>, key: string, enabled: boolean, fallback: string) {
  const loader = useRef(load);
  // Declared before the loading effect, so the request below always uses the latest filters.
  useEffect(() => { loader.current = load; });
  const [data, setData] = useState<PageResult<T> | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<StaffMessage>('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let mounted = true;
    setLoading(true);
    setError('');
    loader.current()
      .then((res) => { if (mounted) setData(res); })
      .catch((err) => {
        if (mounted) {
          setData(null);
          setError(errorMessage(err, fallback));
        }
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [key, enabled, reload, fallback]);

  return { data, loading, error, retry: () => setReload((n) => n + 1) };
}

export function AdminPaymentReconciliationPage() {
  const { t } = useStaffI18n();
  const today = centerNowParts().date;
  const [from, setFrom] = useState(() => shiftIsoDate(today, -(DEFAULT_DAYS - 1)));
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState<Tab>('attempts');

  const formatOptionalPrice = (n: number | null | undefined) => (n == null ? '—' : formatPrice(Math.round(Number(n))));

  // Summary
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<StaffMessage>('');
  const [summaryReload, setSummaryReload] = useState(0);

  useEffect(() => {
    let mounted = true;
    setSummaryLoading(true);
    setSummaryError('');
    reconciliationApi.getSummary({ from, to })
      .then((res) => { if (mounted) setSummary(res); })
      .catch((err) => {
        if (mounted) {
          setSummary(null);
          setSummaryError(errorMessage(err, 'Không thể tải tổng quan đối soát.'));
        }
      })
      .finally(() => { if (mounted) setSummaryLoading(false); });
    return () => { mounted = false; };
  }, [from, to, summaryReload]);

  // Attempts tab
  const [attemptStatus, setAttemptStatus] = useState('ALL');
  const [staleOnly, setStaleOnly] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [attemptPage, setAttemptPage] = useState(0);
  const attempts = usePaged<VnpayAttemptRow>(
    () => reconciliationApi.getAttempts({ status: attemptStatus, stale: staleOnly, q: search, from, to, page: attemptPage, size: PAGE_SIZE }),
    JSON.stringify([attemptStatus, staleOnly, search, from, to, attemptPage]),
    tab === 'attempts',
    'Không thể tải danh sách lượt VNPay.',
  );

  // Late refunds tab
  const [refundPage, setRefundPage] = useState(0);
  const refunds = usePaged<LateRefundRow>(
    () => reconciliationApi.getLateRefunds({ from, to, page: refundPage, size: PAGE_SIZE }),
    JSON.stringify([from, to, refundPage]),
    tab === 'refunds',
    'Không thể tải danh sách hoàn tiền tự động.',
  );

  // IPN events tab
  const [rspCode, setRspCode] = useState('ALL');
  const [source, setSource] = useState('ALL');
  const [referenceDraft, setReferenceDraft] = useState('');
  const [reference, setReference] = useState('');
  const [ipnPage, setIpnPage] = useState(0);
  const ipn = usePaged<IpnEventRow>(
    () => reconciliationApi.getIpnEvents({ rspCode, source, reference, from, to, page: ipnPage, size: PAGE_SIZE }),
    JSON.stringify([rspCode, source, reference, from, to, ipnPage]),
    tab === 'ipn',
    'Không thể tải sự kiện IPN.',
  );

  // Timeline modal
  const [timelineId, setTimelineId] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<PaymentTimeline | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<StaffMessage>('');
  const [timelineReload, setTimelineReload] = useState(0);

  useEffect(() => {
    if (timelineId == null) return undefined;
    let mounted = true;
    setTimelineLoading(true);
    setTimelineError('');
    setTimeline(null);
    reconciliationApi.getTimeline(timelineId)
      .then((res) => { if (mounted) setTimeline(res); })
      .catch((err) => { if (mounted) setTimelineError(errorMessage(err, 'Không thể tải dòng thời gian thanh toán.')); })
      .finally(() => { if (mounted) setTimelineLoading(false); });
    return () => { mounted = false; };
  }, [timelineId, timelineReload]);

  const resetPages = () => { setAttemptPage(0); setRefundPage(0); setIpnPage(0); };

  const memberCell = (member: MemberRef | null) => (
    <div className="actor-meta">
      <span className="actor-name">{member?.fullName || '—'}</span>
      <span className="actor-email">{member?.email || member?.phone || ''}</span>
    </div>
  );

  const openTimeline = (paymentId: number | null) => { if (paymentId != null) setTimelineId(paymentId); };
  const timelineButton = (paymentId: number | null) => paymentId == null ? <span className="recon-muted">—</span> : (
    <button
      type="button"
      className="btn-secondary btn-sm"
      onClick={(e) => { e.stopPropagation(); openTimeline(paymentId); }}
      aria-label={t(`Xem dòng thời gian thanh toán #${paymentId}`, `View payment timeline #${paymentId}`)}
    >
      #{paymentId}
    </button>
  );

  return (
    <div data-i18n-managed className="audit-page recon-page portal-container">
      <PageHeader title={t('Đối soát thanh toán', 'Payment reconciliation')} />

      <div className="portal-card audit-filter-bar">
        <div className="audit-filter-group recon-date">
          <span className="portal-label filter-label">{t('Từ ngày', 'From')}</span>
          <DatePicker value={from} max={to} onChange={(e) => { if (e.target.value) { setFrom(e.target.value); resetPages(); } }} />
        </div>
        <div className="audit-filter-group recon-date">
          <span className="portal-label filter-label">{t('Đến ngày', 'To')}</span>
          <DatePicker value={to} min={from} onChange={(e) => { if (e.target.value) { setTo(e.target.value); resetPages(); } }} />
        </div>
        <span className="recon-muted recon-range-hint">{t('Tối đa 92 ngày mỗi lần tra cứu.', 'Up to 92 days per search.')}</span>
      </div>

      <section aria-label={t('Tổng quan đối soát', 'Reconciliation overview')}>
        {summaryLoading ? (
          <LoadingSkeleton label={t('Đang tải tổng quan…', 'Loading overview…')} variant="cards" count={6} />
        ) : summaryError ? (
          <div className="portal-alert" role="alert">
            <span>{t(summaryError)}</span>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setSummaryReload((n) => n + 1)}>{t('Thử lại', 'Retry')}</button>
          </div>
        ) : summary ? (
          <>
            {summary.staleAttempts > 0 && (
              <div className="recon-warning" role="status">
                <span>
                  {t(`Có ${summary.staleAttempts} lượt VNPay treo quá hạn: job đóng giao dịch treo có thể không chạy.`,
                    `${summary.staleAttempts} VNPay attempt(s) stuck past expiry: the stale-attempt job may not be running.`)}
                </span>
                <button type="button" className="btn-secondary btn-sm" onClick={() => { setTab('attempts'); setStaleOnly(true); setAttemptStatus('ALL'); setAttemptPage(0); }}>
                  {t('Xem lượt treo', 'Show stuck attempts')}
                </button>
              </div>
            )}
            {summary.anomalies.total > 0 && (
              <div className="recon-warning" role="status">
                <span>
                  {t(`Có ${summary.anomalies.total} bất thường cần kiểm tra (${summary.anomalies.successAttemptUnpaid} lượt VNPay thành công nhưng khoản thanh toán chưa ghi nhận, ${summary.anomalies.walletPaymentWithoutSource} khoản trực tuyến đã thu nhưng không có nguồn tiền).`,
                    `${summary.anomalies.total} anomaly(ies) need checking (${summary.anomalies.successAttemptUnpaid} successful VNPay attempt(s) on unpaid payments, ${summary.anomalies.walletPaymentWithoutSource} online payment(s) marked paid without a money source).`)}
                </span>
              </div>
            )}
            <div className="metrics-grid recon-metrics">
              <div className="metric-card">
                <span className="metric-label">{t('Lượt VNPay treo', 'Stuck VNPay attempts')}</span>
                <span className={`metric-value${summary.staleAttempts > 0 ? ' metric-value--danger' : ''}`}>{summary.staleAttempts}</span>
                <span className="metric-unit">{t(`${summary.pendingAttempts} lượt đang chờ`, `${summary.pendingAttempts} pending`)}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">{t('Hoàn tiền tự động', 'Automatic refunds')}</span>
                <span className="metric-value">{summary.lateRefundCount}</span>
                <span className="metric-unit">{formatOptionalPrice(summary.lateRefundAmount)}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">{t('IPN cần gửi lại (99)', 'IPN to retry (99)')}</span>
                <span className={`metric-value${summary.ipnRetryable > 0 ? ' metric-value--warning' : ''}`}>{summary.ipnRetryable}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">{t('IPN bị từ chối', 'Rejected IPN')}</span>
                <span className="metric-value">{summary.ipnRejected}</span>
                <span className="metric-unit">97 · 04 · 01</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">{t('Khoản có nhiều lượt VNPay', 'Payments with several attempts')}</span>
                <span className="metric-value">{summary.multiAttemptPayments}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">{t('Bất thường', 'Anomalies')}</span>
                <span className={`metric-value${summary.anomalies.total > 0 ? ' metric-value--danger' : ' metric-value--success'}`}>{summary.anomalies.total}</span>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <div className="portal-tabs audit-view-tabs" role="tablist">
        {([
          ['attempts', t('Lượt VNPay', 'VNPay attempts')],
          ['refunds', t('Hoàn tiền tự động', 'Automatic refunds')],
          ['ipn', t('Sự kiện IPN', 'IPN events')],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`portal-tab audit-tab-btn ${tab === key ? 'active is-active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'attempts' && (
        <section aria-label={t('Lượt VNPay', 'VNPay attempts')}>
          <form
            className="portal-card audit-filter-bar"
            onSubmit={(e: FormEvent) => { e.preventDefault(); setSearch(searchDraft.trim()); setAttemptPage(0); }}
          >
            <div className="audit-filter-group recon-grow">
              <span className="portal-label filter-label">{t('Tìm kiếm', 'Search')}</span>
              <input
                type="search"
                className="portal-input"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder={t('Mã giao dịch, email hoặc SĐT', 'Reference, email or phone')}
                aria-label={t('Tìm theo mã giao dịch, email hoặc SĐT', 'Search by reference, email or phone')}
              />
            </div>
            <div className="audit-filter-group">
              <span className="portal-label filter-label">{t('Trạng thái lượt', 'Attempt status')}</span>
              <Select
                className="portal-select"
                value={attemptStatus}
                disabled={staleOnly}
                onChange={(e) => { setAttemptStatus(e.target.value); setAttemptPage(0); }}
                aria-label={t('Lọc theo trạng thái lượt', 'Filter by attempt status')}
              >
                <option value="ALL">{t('Tất cả', 'All')}</option>
                <option value="pending">{t('Đang chờ', 'Pending')}</option>
                <option value="success">{t('Thành công', 'Successful')}</option>
                <option value="failed">{t('Thất bại / đã đóng', 'Failed / closed')}</option>
              </Select>
            </div>
            <label className="recon-check">
              <input type="checkbox" checked={staleOnly} onChange={(e) => { setStaleOnly(e.target.checked); setAttemptPage(0); }} />
              <span>{t('Chỉ lượt treo', 'Stuck only')}</span>
            </label>
            <button type="submit" className="btn-primary">{t('Tìm', 'Search')}</button>
          </form>
          <ListCard
            t={t}
            state={attempts}
            loadingLabel={t('Đang tải lượt VNPay…', 'Loading VNPay attempts…')}
            emptyLabel={t('Không có lượt VNPay nào phù hợp.', 'No matching VNPay attempts.')}
            page={attemptPage}
            setPage={setAttemptPage}
            tableLabel={t('Bảng lượt VNPay', 'VNPay attempts table')}
            head={[t('Thời gian', 'Created'), t('Mã giao dịch', 'Reference'), t('Hội viên', 'Member'), t('Đối tượng', 'For'),
              t('Số tiền', 'Amount'), t('Trạng thái', 'Status'), t('Khoản thanh toán', 'Payment')]}
            rows={(attempts.data?.content ?? []).map((row) => (
              <tr key={row.reference} className={row.paymentId != null ? 'recon-row-click' : undefined} onClick={() => openTimeline(row.paymentId)}>
                <td className="recon-num">{formatCenterDateTime(row.createdAt)}</td>
                <td>
                  <code className="recon-code">{row.reference}</code>
                  {row.gatewayTransactionNo && <div className="recon-muted">VNPay {row.gatewayTransactionNo}</div>}
                </td>
                <td>{memberCell(row.member)}</td>
                <td>{targetLabel(t, row.targetType, row.targetId)}</td>
                <td className="recon-num">{formatOptionalPrice(row.amount)}</td>
                <td>
                  <span className={`badge ${attemptBadge(row)}`}>{row.stale ? t('Treo', 'Stuck') : attemptStatusLabel(t, row.status)}</span>
                  <div className="recon-muted">{t('Thanh toán:', 'Payment:')} {paymentStatusLabel(t, row.paymentStatus)}</div>
                  {row.attemptCount > 1 && <div className="recon-muted">{t(`${row.attemptCount} lượt`, `${row.attemptCount} attempts`)}</div>}
                </td>
                <td>{timelineButton(row.paymentId)}</td>
              </tr>
            ))}
          />
        </section>
      )}

      {tab === 'refunds' && (
        <section aria-label={t('Hoàn tiền tự động', 'Automatic refunds')}>
          <ListCard
            t={t}
            state={refunds}
            loadingLabel={t('Đang tải hoàn tiền tự động…', 'Loading automatic refunds…')}
            emptyLabel={t('Không có khoản hoàn tiền tự động nào trong khoảng thời gian này.', 'No automatic refunds in this period.')}
            page={refundPage}
            setPage={setRefundPage}
            tableLabel={t('Bảng hoàn tiền tự động', 'Automatic refunds table')}
            head={[t('Thời gian', 'Time'), t('Hội viên', 'Member'), t('Số tiền', 'Amount'), t('Lý do', 'Reason'),
              t('Mã giao dịch VNPay', 'VNPay reference'), t('Khoản thanh toán', 'Payment')]}
            rows={(refunds.data?.content ?? []).map((row) => (
              <tr key={row.walletTransactionId} className={row.paymentId != null ? 'recon-row-click' : undefined} onClick={() => openTimeline(row.paymentId)}>
                <td className="recon-num">{formatCenterDateTime(row.createdAt)}</td>
                <td>{memberCell(row.member)}</td>
                <td className="recon-num">{formatOptionalPrice(row.amount)}</td>
                <td>
                  {row.kind === 'ORDER_LATE_REFUND'
                    ? t('Đơn hàng đã hủy, VNPay báo thành công muộn', 'Order cancelled, VNPay confirmed late')
                    : t('VNPay xác nhận muộn cho khoản đã thanh toán/đã đóng', 'VNPay confirmed late for a payment already settled or closed')}
                </td>
                <td><code className="recon-code">{row.reference ?? '—'}</code></td>
                <td>
                  {timelineButton(row.paymentId)}
                  {row.paymentStatus && <div className="recon-muted">{paymentStatusLabel(t, row.paymentStatus)}</div>}
                </td>
              </tr>
            ))}
          />
        </section>
      )}

      {tab === 'ipn' && (
        <section aria-label={t('Sự kiện IPN', 'IPN events')}>
          <form
            className="portal-card audit-filter-bar"
            onSubmit={(e: FormEvent) => { e.preventDefault(); setReference(referenceDraft.trim()); setIpnPage(0); }}
          >
            <div className="audit-filter-group recon-grow">
              <span className="portal-label filter-label">{t('Mã giao dịch', 'Reference')}</span>
              <input
                type="search"
                className="portal-input"
                value={referenceDraft}
                onChange={(e) => setReferenceDraft(e.target.value)}
                placeholder={t('Nhập mã tham chiếu giao dịch…', 'Enter transaction reference…')}
                aria-label={t('Lọc theo mã giao dịch', 'Filter by reference')}
              />
            </div>
            <div className="audit-filter-group">
              <span className="portal-label filter-label">{t('Mã trả lời', 'Answer code')}</span>
              <Select
                className="portal-select"
                value={rspCode}
                onChange={(e) => { setRspCode(e.target.value); setIpnPage(0); }}
                aria-label={t('Lọc theo mã trả lời', 'Filter by answer code')}
              >
                <option value="ALL">{t('Tất cả', 'All')}</option>
                {['00', '01', '02', '04', '97', '99'].map((code) => (
                  <option key={code} value={code}>{`${code} · ${rspLabel(t, code)}`}</option>
                ))}
              </Select>
            </div>
            <div className="audit-filter-group">
              <span className="portal-label filter-label">{t('Nguồn', 'Source')}</span>
              <Select
                className="portal-select"
                value={source}
                onChange={(e) => { setSource(e.target.value); setIpnPage(0); }}
                aria-label={t('Lọc theo nguồn', 'Filter by source')}
              >
                <option value="ALL">{t('Tất cả', 'All')}</option>
                <option value="IPN">{t('IPN từ VNPay', 'IPN from VNPay')}</option>
                <option value="RETURN">{t('Trang trả về', 'Return page')}</option>
              </Select>
            </div>
            <button type="submit" className="btn-primary">{t('Tìm', 'Search')}</button>
          </form>
          <ListCard
            t={t}
            state={ipn}
            loadingLabel={t('Đang tải sự kiện IPN…', 'Loading IPN events…')}
            emptyLabel={t('Không có sự kiện IPN nào phù hợp.', 'No matching IPN events.')}
            page={ipnPage}
            setPage={setIpnPage}
            tableLabel={t('Bảng sự kiện IPN', 'IPN events table')}
            head={[t('Thời gian', 'Received'), t('Mã giao dịch', 'Reference'), t('Nguồn', 'Source'),
              t('Kết quả VNPay', 'VNPay result'), t('Số tiền', 'Amount'), t('Hệ thống trả lời', 'System answer')]}
            rows={(ipn.data?.content ?? []).map((row) => (
              <tr key={row.id}>
                <td className="recon-num">{formatCenterDateTime(row.receivedAt)}</td>
                <td><code className="recon-code">{row.reference ?? '—'}</code></td>
                <td>{row.source === 'RETURN' ? t('Trang trả về', 'Return page') : 'IPN'}</td>
                <td className="recon-num">
                  {row.gatewayResponseCode ?? '—'} / {row.gatewayTransactionStatus ?? '—'}
                  {row.gatewayTransactionNo && <div className="recon-muted">VNPay {row.gatewayTransactionNo}</div>}
                </td>
                <td className="recon-num">{formatOptionalPrice(row.amount)}</td>
                <td><span className={`badge ${rspBadge(row.rspCode)}`}>{row.rspCode} · {rspLabel(t, row.rspCode)}</span></td>
              </tr>
            ))}
          />
        </section>
      )}

      {timelineId != null && (
        <Modal title={t(`Dòng thời gian thanh toán #${timelineId}`, `Payment timeline #${timelineId}`)} onClose={() => setTimelineId(null)}>
          {timelineLoading ? (
            <LoadingSkeleton label={t('Đang tải dòng thời gian…', 'Loading timeline…')} count={4} />
          ) : timelineError ? (
            <div className="portal-alert" role="alert">
              <span>{t(timelineError)}</span>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setTimelineReload((n) => n + 1)}>{t('Thử lại', 'Retry')}</button>
            </div>
          ) : timeline ? (
            <div className="recon-timeline">
              {timeline.payment && (
                <dl className="recon-facts">
                  <div><dt>{t('Hội viên', 'Member')}</dt><dd>{timeline.payment.member?.fullName ?? '—'} {timeline.payment.member?.email ? `· ${timeline.payment.member.email}` : ''}</dd></div>
                  <div><dt>{t('Đối tượng', 'For')}</dt><dd>{targetLabel(t, timeline.payment.targetType, timeline.payment.targetId)}</dd></div>
                  <div><dt>{t('Số tiền', 'Amount')}</dt><dd>{formatOptionalPrice(timeline.payment.amount)}{timeline.payment.refundedAmount ? ` · ${t('đã hoàn', 'refunded')} ${formatOptionalPrice(timeline.payment.refundedAmount)}` : ''}</dd></div>
                  <div><dt>{t('Trạng thái', 'Status')}</dt><dd>{paymentStatusLabel(t, timeline.payment.status)} · {methodLabel(t, timeline.payment.method)}</dd></div>
                  {timeline.payment.invoiceNumber && <div><dt>{t('Hóa đơn', 'Invoice')}</dt><dd>{timeline.payment.invoiceNumber}</dd></div>}
                </dl>
              )}
              {timeline.entries.length === 0 ? (
                <p className="recon-muted">{t('Chưa có sự kiện nào cho khoản thanh toán này.', 'No events for this payment yet.')}</p>
              ) : (
                <ol className="recon-steps" aria-label={t('Các bước theo thời gian', 'Steps in time order')}>
                  {timeline.entries.map((entry, index) => (
                    <li key={`${entry.type}-${entry.at}-${index}`}>
                      <span className="recon-num recon-muted">{formatCenterDateTime(entry.at)}</span>
                      <strong>{entryLabel(t, entry.type)}</strong>
                      <span>{entryDetail(t, entry, formatOptionalPrice)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}

interface ListState<T> {
  data: PageResult<T> | null;
  loading: boolean;
  error: StaffMessage;
  retry: () => void;
}

function ListCard<T>({ t, state, loadingLabel, emptyLabel, page, setPage, tableLabel, head, rows }: {
  t: Translate;
  state: ListState<T>;
  loadingLabel: string;
  emptyLabel: string;
  page: number;
  setPage: (updater: (p: number) => number) => void;
  tableLabel: string;
  head: string[];
  rows: ReactElement[];
}) {
  const totalPages = Math.max(1, state.data?.totalPages ?? 1);
  const total = state.data?.totalElements ?? 0;
  return (
    <div className="portal-card portal-card--flush audit-table-card">
      {state.loading ? (
        <LoadingSkeleton label={loadingLabel} variant="table" count={6} />
      ) : state.error ? (
        <div className="portal-alert" role="alert">
          <span>{t(state.error)}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={state.retry}>{t('Thử lại', 'Retry')}</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="portal-empty recon-empty"><p>{emptyLabel}</p></div>
      ) : (
        <div className="recon-table-scroll">
          <table className="portal-table audit-table" aria-label={tableLabel}>
            <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      )}
      {!state.loading && !state.error && total > 0 && (
        <div className="audit-pagination-bar">
          <span>{t(`Trang ${page + 1} / ${totalPages} (${total} bản ghi)`, `Page ${page + 1} / ${totalPages} (${total} records)`)}</span>
          <div className="pagination-controls">
            <button type="button" className="btn-secondary btn-sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              {t('Trang trước', 'Previous')}
            </button>
            <button type="button" className="btn-secondary btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              {t('Trang sau', 'Next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function attemptBadge(row: VnpayAttemptRow): string {
  if (row.stale) return 'badge-danger';
  if (row.status === 'success') return 'badge-success';
  if (row.status === 'pending') return 'badge-warning';
  return 'badge-neutral';
}

function rspBadge(code: string): string {
  if (code === '00') return 'badge-success';
  if (code === '99') return 'badge-warning';
  if (code === '02') return 'badge-info';
  return 'badge-danger';
}

function attemptStatusLabel(t: Translate, status: string | null): string {
  switch (status) {
    case 'pending': return t('Đang chờ', 'Pending');
    case 'success': return t('Thành công', 'Successful');
    case 'failed': return t('Thất bại / đã đóng', 'Failed / closed');
    default: return status ?? '—';
  }
}

function paymentStatusLabel(t: Translate, status: string | null): string {
  switch (status) {
    case 'pending': return t('Chờ thanh toán', 'Awaiting payment');
    case 'success': return t('Đã thanh toán', 'Paid');
    case 'failed': return t('Đã đóng', 'Closed');
    case 'refunded': return t('Đã hoàn tiền', 'Refunded');
    default: return status ?? '—';
  }
}

function methodLabel(t: Translate, method: string | null): string {
  switch (method) {
    case 'online_wallet': return t('Trực tuyến', 'Online');
    case 'cash': return t('Tiền mặt', 'Cash');
    case 'pos': return t('Quẹt thẻ', 'Card terminal');
    case 'bank_transfer': return t('Chuyển khoản', 'Bank transfer');
    default: return method ?? '—';
  }
}

function targetLabel(t: Translate, type: string | null, id: number | null): string {
  const suffix = id != null ? ` #${id}` : '';
  switch (type) {
    case 'MEMBERSHIP': return t('Gói tập', 'Membership') + suffix;
    case 'COACH_BOOKING': return t('Buổi PT 1:1', '1:1 coach session') + suffix;
    case 'COURT_BOOKING': return t('Đặt sân', 'Court booking') + suffix;
    case 'PRODUCT_ORDER': return t('Đơn hàng', 'Shop order') + suffix;
    case 'COURSE': return t('Khóa học', 'Course') + suffix;
    case 'WALLET_TOPUP': return t('Nạp Ví', 'Wallet top-up');
    default: return '—';
  }
}

function rspLabel(t: Translate, code: string): string {
  switch (code) {
    case '00': return t('Đã ghi nhận', 'Accepted');
    case '01': return t('Không tìm thấy giao dịch', 'Transaction not found');
    case '02': return t('Đã xử lý trước đó', 'Already processed');
    case '04': return t('Sai số tiền', 'Amount mismatch');
    case '97': return t('Sai chữ ký / dữ liệu', 'Invalid signature or data');
    case '99': return t('Lỗi tạm thời, chờ gửi lại', 'Temporary error, awaiting retry');
    default: return t('Khác', 'Other');
  }
}

function entryLabel(t: Translate, type: string): string {
  switch (type) {
    case 'PAYMENT_CREATED': return t('Tạo khoản thanh toán', 'Payment created');
    case 'ATTEMPT_CREATED': return t('Mở lượt VNPay', 'VNPay attempt opened');
    case 'CALLBACK_RECEIVED': return t('Nhận phản hồi VNPay', 'VNPay callback received');
    case 'WALLET_TRANSACTION': return t('Giao dịch Ví', 'Wallet transaction');
    case 'PAYMENT_PAID': return t('Ghi nhận đã thanh toán', 'Marked as paid');
    case 'INVOICE_ISSUED': return t('Xuất hóa đơn', 'Invoice issued');
    default: return type;
  }
}

function entryDetail(
  t: Translate,
  entry: PaymentTimeline['entries'][number],
  formatAmount: (n: number | null | undefined) => string,
): string {
  const parts: string[] = [];
  if (entry.reference) parts.push(entry.reference);
  switch (entry.type) {
    case 'ATTEMPT_CREATED':
      parts.push(attemptStatusLabel(t, entry.status));
      break;
    case 'CALLBACK_RECEIVED':
      parts.push(entry.source === 'RETURN' ? t('Trang trả về', 'Return page') : 'IPN');
      if (entry.code) parts.push(`${entry.code} · ${rspLabel(t, entry.code)}`);
      break;
    case 'PAYMENT_CREATED':
    case 'PAYMENT_PAID':
      parts.push(methodLabel(t, entry.detail));
      break;
    case 'INVOICE_ISSUED':
      if (entry.detail) parts.push(entry.detail);
      break;
    default:
      break;
  }
  if (entry.amount != null) parts.push(formatAmount(entry.amount));
  return parts.join(' · ');
}
