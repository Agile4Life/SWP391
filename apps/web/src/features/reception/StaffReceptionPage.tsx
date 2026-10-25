import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../shared/api/client';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Select } from '../../shared/ui/Select';
import { PaymentInvoice } from './PaymentInvoice';
import { toast } from '../../shared/ui/toast';
import {
  maskCitizenId,
  receptionApi,
  type HoldRequestItem,
  type MemberLookupResult,
  type PaymentMethod,
  type PaymentResponseDto,
  type PendingSubscriptionItem,
} from './receptionApi';

const vnd = (n: number) => `${n.toLocaleString('vi-VN')} đ`;

export function StaffReceptionPage() {
  const currentUser = getCurrentUser();

  // BR-01: Chỉ RECEPTIONIST / STAFF và CENTER_MANAGER / MANAGER được truy cập
  const hasAccess = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'MANAGER' || currentUser.role === 'STAFF';
  }, [currentUser]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<MemberLookupResult[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberLookupResult | null>(null);

  // Danh sách yêu cầu gói tập đang chờ thanh toán (do Hội viên đăng ký / gia hạn / nâng cấp)
  const [pendingList, setPendingList] = useState<PendingSubscriptionItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [selectedPending, setSelectedPending] = useState<PendingSubscriptionItem | null>(null);
  const [cancellingPendingId, setCancellingPendingId] = useState<number | null>(null);

  // Danh sách yêu cầu bảo lưu gói tập đang chờ xử lý
  const [holdList, setHoldList] = useState<HoldRequestItem[]>([]);
  const [loadingHolds, setLoadingHolds] = useState(true);
  const [processingHoldId, setProcessingHoldId] = useState<number | null>(null);

  // Form thanh toán
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('pos');
  const [paymentNotes, setPaymentNotes] = useState('Thanh toán gói tập tại quầy Lễ tân');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Popup Hóa đơn điện tử sau khi thanh toán thành công (BR-04)
  const [completedPayment, setCompletedPayment] = useState<PaymentResponseDto | null>(null);
  const [completedPackageName, setCompletedPackageName] = useState<string>('');
  const [completedMemberName, setCompletedMemberName] = useState<string>('');
  const [completedMembershipCode, setCompletedMembershipCode] = useState<string | null>(null);

  const loadPendingSubscriptions = useCallback(async () => {
    if (!hasAccess) return;
    setLoadingPending(true);
    try {
      const items = await receptionApi.getPendingSubscriptions();
      setPendingList(items);
      if (items.length > 0) {
        const first = items[0];
        setSelectedPending((prev) => items.find((i) => i.id === prev?.id) ?? first);
        setSelectedMember((prev) =>
          prev ?? {
            userId: first.memberId,
            membershipCode: first.membershipCode || `MB-2026-${String(first.memberId).padStart(3, '0')}`,
            fullName: first.memberName,
            email: first.memberEmail,
            phone: first.memberPhone,
            citizenId: null,
            status: 'PENDING_PAYMENT',
            currentPackage: first.packageName,
            endDate: `${first.startDate} → ${first.endDate}`,
          },
        );
      } else {
        setSelectedPending(null);
      }
    } catch {
      setPendingList([]);
    } finally {
      setLoadingPending(false);
    }
  }, [hasAccess]);

  const loadPendingHolds = useCallback(async () => {
    if (!hasAccess) return;
    setLoadingHolds(true);
    try {
      const items = await receptionApi.getPendingHoldRequests();
      setHoldList(items);
    } catch {
      setHoldList([]);
    } finally {
      setLoadingHolds(false);
    }
  }, [hasAccess]);

  useEffect(() => {
    void loadPendingSubscriptions();
    void loadPendingHolds();
  }, [loadPendingSubscriptions, loadPendingHolds]);

  const handleSelectPendingItem = (item: PendingSubscriptionItem) => {
    setSelectedPending(item);
    setSelectedMember({
      userId: item.memberId,
      membershipCode: item.membershipCode || `MB-2026-${String(item.memberId).padStart(3, '0')}`,
      fullName: item.memberName,
      email: item.memberEmail,
      phone: item.memberPhone,
      citizenId: null,
      status: 'PENDING_PAYMENT',
      currentPackage: item.packageName,
      endDate: `${item.startDate} → ${item.endDate}`,
    });
  };

  const handleCancelPendingItem = async (item: PendingSubscriptionItem) => {
    if (cancellingPendingId !== null || isSubmittingPayment) return;
    setCancellingPendingId(item.id);
    try {
      await receptionApi.cancelPendingSubscription(item.id);
      toast(`Đã hủy yêu cầu gói tập #${item.id} (${item.packageName}) của hội viên ${item.memberName}.`, 'success');
      await loadPendingSubscriptions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Hủy yêu cầu gói tập thất bại.';
      toast(msg, 'error');
    } finally {
      setCancellingPendingId(null);
    }
  };

  const handleApproveHold = async (item: HoldRequestItem) => {
    if (processingHoldId !== null) return;
    setProcessingHoldId(item.id);
    try {
      const res = await receptionApi.approveHoldRequest(item.id);
      toast(
        `Đã xác nhận bảo lưu gói "${item.packageName}" cho ${item.memberName}. Đã tự động hủy ${res.cancelledEnrollmentsCount} lịch học trong tương lai.`,
        'success',
      );
      await loadPendingHolds();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Xác nhận bảo lưu thất bại.';
      toast(msg, 'error');
    } finally {
      setProcessingHoldId(null);
    }
  };

  const handleRejectHold = async (item: HoldRequestItem) => {
    if (processingHoldId !== null) return;
    setProcessingHoldId(item.id);
    try {
      await receptionApi.rejectHoldRequest(item.id);
      toast(`Đã từ chối yêu cầu bảo lưu của hội viên ${item.memberName}.`, 'success');
      await loadPendingHolds();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Từ chối yêu cầu bảo lưu thất bại.';
      toast(msg, 'error');
    } finally {
      setProcessingHoldId(null);
    }
  };

  // BR-01: Forbidden Guard khi vai trò không hợp lệ
  if (!hasAccess) {
    return (
      <div className="portal-container" data-testid="reception-forbidden-guard">
        <div className="portal-card">
          <div className="portal-state" style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '16px' }} role="img" aria-label="Forbidden">
              🚫
            </div>
            <h2 className="portal-state__title" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
              403 - Quyền truy cập bị từ chối
            </h2>
            <p style={{ color: 'var(--color-text-muted)', maxWidth: '480px', margin: '0 auto 20px auto' }}>
              Chỉ Lễ tân (Receptionist) và Quản lý trung tâm (Center Manager) mới có quyền truy cập quầy lễ tân &amp; thu ngân.
            </p>
            <a href="/portal" className="btn-secondary">
              Về trang chủ Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  const currentPrice = selectedPending ? selectedPending.packagePrice : 0;

  // Xử lý tra cứu hội viên
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      toast('Vui lòng nhập SĐT, Mã hội viên hoặc CCCD để tra cứu.', 'error');
      return;
    }
    if (q.length < 2) {
      toast('Từ khóa tìm kiếm phải ít nhất 2 ký tự.', 'error');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const results = await receptionApi.lookupMembers(q);
      setSearchResults(results);
      if (results.length > 0) {
        const member = results[0];
        setSelectedMember(member);
        const matchedPending = pendingList.find((p) => p.memberId === member.userId) ?? null;
        setSelectedPending(matchedPending);
        toast(`Đã tìm thấy ${results.length} kết quả phù hợp.`, 'success');
      } else {
        setSelectedMember(null);
        setSelectedPending(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tra cứu thất bại.';
      toast(msg, 'error');
      setSearchResults([]);
      setSelectedMember(null);
      setSelectedPending(null);
    } finally {
      setIsSearching(false);
    }
  };

  // BR-03 & BR-04: Xác nhận thanh toán cho yêu cầu gói tập đang chờ của hội viên
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMember || !selectedPending) {
      toast('Vui lòng chọn một yêu cầu đăng ký gói tập đang chờ thanh toán của hội viên.', 'error');
      return;
    }

    if (!paymentMethod) {
      toast('Vui lòng chọn hình thức thanh toán (Tiền mặt / POS / Chuyển khoản QR).', 'error');
      return;
    }

    // BR-03: Khóa nút khi đang xử lý để tránh thu trùng
    if (isSubmittingPayment) return;

    setIsSubmittingPayment(true);
    try {
      const result = await receptionApi.processPayment({
        memberId: selectedPending.memberId,
        subscriptionId: selectedPending.id,
        packageId: selectedPending.packageId,
        amount: selectedPending.packagePrice,
        method: paymentMethod,
        notes: paymentNotes.trim() || undefined,
      });

      // BR-04: Chỉ hiển thị hóa đơn khi Payment API trả thành công
      setCompletedPackageName(selectedPending.packageName);
      setCompletedMemberName(selectedPending.memberName);
      setCompletedMembershipCode(selectedPending.membershipCode);
      setCompletedPayment(result);
      toast(`Đã xác nhận thu tiền thành công! Hóa đơn: ${result.invoiceNumber}`, 'success');
      await loadPendingSubscriptions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Giao dịch thanh toán thất bại.';
      toast(msg, 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <div className="portal-container">
      <PageHeader
        eyebrow="Lễ tân &amp; Thu ngân"
        title="Quầy lễ tân"
      />

      {/* Thanh tra cứu hội viên (BR-01, BR-05) */}
      <div className="portal-card" style={{ marginBottom: '24px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="Nhập Số điện thoại, Mã hội viên (MB-...) hoặc CCCD để tra cứu..."
              className="portal-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary" disabled={isSearching}>
            {isSearching ? (
              <>
                <span className="spinner" />
                <span>Đang tìm...</span>
              </>
            ) : (
              'Tra cứu hội viên'
            )}
          </button>
        </form>

        {/* Danh sách kết quả nếu có nhiều hơn 1 người */}
        {searchResults.length > 1 && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
              Tìm thấy {searchResults.length} hội viên. Chọn hội viên để kiểm tra yêu cầu:
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {searchResults.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  className={`btn-secondary btn-sm ${selectedMember?.userId === m.userId ? 'btn-primary' : ''}`}
                  onClick={() => {
                    setSelectedMember(m);
                    setSelectedPending(pendingList.find((p) => p.memberId === m.userId) ?? null);
                  }}
                >
                  {m.fullName} ({m.membershipCode || m.phone})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mục Yêu Cầu Đăng Ký / Gia Hạn / Nâng Cấp Gói Tập Đang Chờ Thanh Toán (pending_payment) */}
      <div className="portal-card" style={{ marginBottom: '24px' }}>
        <div className="portal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="portal-card-title">Gói tập chờ thanh toán ({pendingList.length})</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--color-text-muted)' }}>
              Xác nhận thu tiền cho gói tập hội viên đã chọn.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => void loadPendingSubscriptions()}
            disabled={loadingPending}
          >
            {loadingPending ? 'Đang tải...' : 'Làm mới danh sách'}
          </button>
        </div>

        {loadingPending ? (
          <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }} role="status" aria-busy="true">
            <span className="sr-only">Đang tải danh sách yêu cầu chờ thanh toán...</span>
            {[1, 2].map((idx) => (
              <div
                key={idx}
                aria-hidden="true"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border-medium)',
                  backgroundColor: 'var(--color-bg-card)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div className="portal-skeleton-line" style={{ width: '42%', height: 18, marginBottom: 8 }} />
                  <div className="portal-skeleton-line" style={{ width: '64%', height: 14 }} />
                </div>
                <div style={{ width: 160 }}>
                  <div className="portal-skeleton-line" style={{ width: '100%', height: 34 }} />
                </div>
              </div>
            ))}
          </div>
        ) : pendingList.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Hiện không có yêu cầu đăng ký gói tập nào đang ở trạng thái chờ thanh toán.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
            {pendingList.map((item) => {
              const isSelected = selectedPending?.id === item.id;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectPendingItem(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectPendingItem(item);
                    }
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid var(--color-accent-gold)' : '1px solid var(--color-border-medium)',
                    backgroundColor: isSelected ? 'var(--color-bg-warm)' : 'var(--color-bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: 'var(--color-accent-gold)',
                          fontSize: '0.92rem',
                        }}
                      >
                        Yêu cầu #{item.id}
                      </span>
                      <strong>{item.memberName}</strong>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                        ({item.membershipCode || `MB-${item.memberId}`} • {item.memberPhone || item.memberEmail})
                      </span>
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--color-text-main)', marginTop: '4px' }}>
                      Gói hội viên đã chọn: <strong>{item.packageName}</strong> ({item.durationDays} ngày • {item.startDate} → {item.endDate})
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text-main)' }}>
                        {vnd(item.packagePrice)}
                      </div>
                      <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                        CHỜ THANH TOÁN
                      </span>
                    </div>
                    <button
                      type="button"
                      className={isSelected ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPendingItem(item);
                      }}
                    >
                      {isSelected ? 'Đang chọn xử lý' : 'Chọn xác nhận'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      style={{ color: '#fca5a5', borderColor: '#FCA5A5' }}
                      disabled={cancellingPendingId !== null || isSubmittingPayment}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleCancelPendingItem(item);
                      }}
                    >
                      {cancellingPendingId === item.id ? 'Đang hủy...' : 'Hủy yêu cầu'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mục Yêu cầu bảo lưu */}
      <div className="portal-card" style={{ marginBottom: '24px' }}>
        <div className="portal-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="portal-card-title">Yêu cầu bảo lưu ({holdList.length})</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--color-text-muted)' }}>
              Duyệt bảo lưu sẽ hủy các lịch học tương lai của hội viên.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => void loadPendingHolds()}
            disabled={loadingHolds}
          >
            {loadingHolds ? 'Đang tải...' : 'Làm mới bảo lưu'}
          </button>
        </div>

        {loadingHolds ? (
          <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }} role="status" aria-busy="true">
            <span className="sr-only">Đang tải danh sách yêu cầu bảo lưu...</span>
            <div
              aria-hidden="true"
              style={{
                padding: '14px 18px',
                borderRadius: '10px',
                border: '1px solid var(--color-border-medium)',
                backgroundColor: 'var(--color-bg-card)',
              }}
            >
              <div className="portal-skeleton-line" style={{ width: '45%', height: 18, marginBottom: 8 }} />
              <div className="portal-skeleton-line" style={{ width: '70%', height: 14 }} />
            </div>
          </div>
        ) : holdList.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Hiện không có yêu cầu bảo lưu gói tập nào đang chờ xử lý.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
            {holdList.map((item) => {
              const isBusy = processingHoldId === item.id;
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '14px',
                    padding: '16px 18px',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border-medium)',
                    backgroundColor: 'var(--color-bg-warm)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: 'var(--color-accent-gold)',
                          fontSize: '0.92rem',
                        }}
                      >
                        Bảo lưu #{item.id}
                      </span>
                      <strong>{item.memberName}</strong>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                        ({item.membershipCode || `MB-${item.memberId}`} • {item.memberPhone || item.memberEmail})
                      </span>
                      <span className="badge badge-warning">CHỜ DUYỆT BẢO LƯU</span>
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--color-text-main)', marginTop: '6px' }}>
                      Gói tập đang hoạt động: <strong>{item.packageName}</strong> ({item.startDate} → {item.endDate})
                    </div>
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border-subtle)',
                        fontSize: '0.88rem',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <strong>Lý do hội viên nhập:</strong> {item.holdReason}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      disabled={processingHoldId !== null}
                      onClick={() => void handleRejectHold(item)}
                    >
                      {isBusy ? 'Đang xử lý...' : 'Từ chối'}
                    </button>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={processingHoldId !== null}
                      onClick={() => void handleApproveHold(item)}
                    >
                      {isBusy ? 'Đang xử lý...' : 'Xác nhận bảo lưu & Hủy lịch tương lai'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid-2">
        {/* Thông tin hội viên tìm thấy (BR-01 Empty state & BR-05 Masked CCCD) */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2 className="portal-card-title">Thông tin hội viên</h2>
            {selectedMember && (
              <span className={`badge ${selectedMember.status?.toUpperCase() === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`}>
                {selectedPending ? 'CHỜ THANH TOÁN' : selectedMember.status?.toUpperCase()}
              </span>
            )}
          </div>

          {selectedMember ? (
            <div>
              <div className="kv-list">
                <div className="kv-row">
                  <span>Họ và tên</span>
                  <strong>{selectedMember.fullName}</strong>
                </div>

                <div className="kv-row">
                  <span>Mã hội viên</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {selectedMember.membershipCode || `MB-2026-${String(selectedMember.userId).padStart(3, '0')}`}
                  </span>
                </div>

                <div className="kv-row">
                  <span>Số điện thoại</span>
                  <strong>{selectedMember.phone || 'Chưa cập nhật'}</strong>
                </div>

                <div className="kv-row">
                  <span>Email</span>
                  <span>{selectedMember.email}</span>
                </div>

                {/* BR-05: CCCD được che một phần (masked) */}
                <div className="kv-row">
                  <span>Số CCCD (Bảo mật)</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--color-text-main)' }}>
                    {maskCitizenId(selectedMember.citizenId)}
                  </span>
                </div>

                <div className="kv-row">
                  <span>Gói tập yêu cầu</span>
                  <strong>
                    {selectedPending
                      ? `${selectedPending.packageName} (Yêu cầu #${selectedPending.id})`
                      : selectedMember.currentPackage || 'Chưa có yêu cầu gói tập chờ thanh toán'}
                  </strong>
                </div>

                <div className="kv-row">
                  <span>Thời hạn gói</span>
                  <span style={{ color: 'var(--color-accent-gold)', fontWeight: 600 }}>
                    {selectedPending
                      ? `${selectedPending.startDate} → ${selectedPending.endDate} (${selectedPending.durationDays} ngày)`
                      : selectedMember.endDate || 'Chưa kích hoạt'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* BR-01: Trạng thái trống rõ ràng */
            <div className="portal-empty" style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🔍</div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: 'var(--color-text-main)' }}>
                {hasSearched ? 'Không tìm thấy hội viên' : 'Chưa chọn hội viên'}
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: 0 }}>
                {hasSearched
                  ? `Không có kết quả nào khớp với từ khóa "${searchQuery}". Vui lòng kiểm tra lại SĐT, Mã hội viên hoặc CCCD.`
                  : 'Hãy ấn vào một Yêu cầu đang chờ ở danh sách trên hoặc tra cứu SĐT hội viên.'}
              </p>
            </div>
          )}
        </div>

        {/* Panel thu ngân & Xác nhận gói tập do Hội viên đã chọn */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2 className="portal-card-title">Xác nhận thanh toán</h2>
          </div>

          <form onSubmit={handlePayment}>
            {/* Gói tập cố định theo lựa chọn của Hội viên — Staff không được tự chọn/đổi gói */}
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="pos-package">
                Gói Tập Hội viên Đã Chọn (Cố định theo yêu cầu của Hội viên)
              </label>
              <input
                id="pos-package"
                type="text"
                className="portal-input"
                value={
                  selectedPending
                    ? `${selectedPending.packageName} (${selectedPending.durationDays} ngày — Yêu cầu #${selectedPending.id})`
                    : 'Chưa có yêu cầu gói tập chờ thanh toán'
                }
                disabled
                readOnly
                style={{
                  fontWeight: 600,
                  color: selectedPending ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                  backgroundColor: 'var(--color-bg-warm)',
                  cursor: 'not-allowed',
                }}
              />
            </div>

            <div className="grid-2">
              {/* BR-02: Số tiền hiển thị theo giá gói và KHÔNG cho sửa tay */}
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="pos-amount">
                  Số tiền Thu (Không sửa tay)
                </label>
                <input
                  id="pos-amount"
                  type="text"
                  className="portal-input"
                  value={vnd(currentPrice)}
                  disabled
                  readOnly
                  style={{
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: 'var(--color-accent-gold)',
                    backgroundColor: 'var(--color-bg-warm)',
                    cursor: 'not-allowed',
                  }}
                />
              </div>

              {/* BR-03: Bắt buộc chọn hình thức thanh toán */}
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="pos-method">
                  Hình thức Thanh Toán *
                </label>
                <Select
                  id="pos-method"
                  className="portal-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  disabled={isSubmittingPayment}
                >
                  <option value="pos">POS Quẹt thẻ ngân hàng</option>
                  <option value="cash">Tiền mặt tại quầy</option>
                  <option value="bank_transfer">Chuyển khoản VietQR tức thì</option>
                  <option value="online_wallet">Ví điện tử MoMo / ZaloPay</option>
                </Select>
              </div>
            </div>

            <div className="portal-form-group">
              <label className="portal-label" htmlFor="pos-notes">
                Ghi Chú Giao Dịch
              </label>
              <input
                id="pos-notes"
                type="text"
                className="portal-input"
                placeholder="Ghi chú thêm về giao dịch..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                disabled={isSubmittingPayment}
              />
            </div>

            {/* BR-03: Nút chỉ bật khi đã chọn yêu cầu chờ thanh toán của hội viên */}
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
              disabled={isSubmittingPayment || !selectedPending}
            >
              {isSubmittingPayment ? (
                <>
                  <span className="spinner" />
                  <span>Đang xử lý thu tiền...</span>
                </>
              ) : (
                'Xác Nhận Thu Tiền & Xuất Hóa Đơn'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* BR-04: Popup Hóa đơn điện tử chỉ hiện khi Payment thành công */}
      {completedPayment && (
        <PaymentInvoice
          payment={completedPayment}
          memberName={completedMemberName}
          membershipCode={completedMembershipCode}
          packageName={completedPackageName}
          cashierName={currentUser?.name}
          onClose={() => setCompletedPayment(null)}
        />
      )}
    </div>
  );
}
