import React, { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../shared/api/client';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Select } from '../../shared/ui/Select';
import { Modal } from '../../shared/ui/Modal';
import { toast } from '../../shared/ui/toast';
import type { MembershipPackage } from '../manager/catalogApi';
import {
  maskCitizenId,
  receptionApi,
  type MemberLookupResult,
  type MembershipPackage,
  type PaymentMethod,
  type PaymentResponseDto,
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

  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);

  // Danh sách gói tập đang hoạt động bán tại quầy POS
  const [activePackages, setActivePackages] = useState<MembershipPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | ''>('');

  // Form thanh toán
  const [selectedPackageId, setSelectedPackageId] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('pos');
  const [paymentNotes, setPaymentNotes] = useState('Thanh toán gói tập tại quầy Lễ tân');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Popup Hóa đơn điện tử sau khi thanh toán thành công (BR-04)
  const [completedPayment, setCompletedPayment] = useState<PaymentResponseDto | null>(null);
<<<<<<< Updated upstream
=======
  const [completedPackageName, setCompletedPackageName] = useState<string>('');
  const [completedMemberName, setCompletedMemberName] = useState<string>('');

  const loadPendingSubscriptions = useCallback(async () => {
    if (!hasAccess) return;
    setLoadingPending(true);
    try {
      const items = await receptionApi.getPendingSubscriptions();
      setPendingList(items ?? []);
      if (items && items.length > 0) {
        const first = items[0];
        setSelectedPending((prev) => items.find((i) => i.id === prev?.id) ?? first);
        setSelectedPackageId((prev) => (prev ? prev : first.packageId));
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
>>>>>>> Stashed changes

  // BR-02: Tải danh sách gói tập chỉ đang ACTIVE
  useEffect(() => {
<<<<<<< Updated upstream
    if (!hasAccess) return;
    let active = true;
    (async () => {
      setLoadingPackages(true);
      try {
        const pkgs = await receptionApi.getActivePackages();
        if (active) {
          setPackages(pkgs);
          if (pkgs.length > 0) {
            setSelectedPackageId(pkgs[0].id);
          }
        }
      } catch {
        if (active) setPackages([]);
      } finally {
        if (active) setLoadingPackages(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [hasAccess]);
=======
    void loadPendingSubscriptions();
    if (hasAccess) {
      receptionApi.getActivePackages().then(setActivePackages).catch(() => {});
    }
  }, [hasAccess, loadPendingSubscriptions]);

  const handleSelectPendingItem = (item: PendingSubscriptionItem) => {
    setSelectedPending(item);
    setSelectedPackageId(item.packageId);
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
>>>>>>> Stashed changes

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
            <p style={{ color: '#7E7771', maxWidth: '480px', margin: '0 auto 20px auto' }}>
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

<<<<<<< Updated upstream
  // Gói tập đang chọn
  const selectedPackage = packages.find((p) => p.id === Number(selectedPackageId));
  const currentPrice = selectedPackage ? selectedPackage.price : 0;
=======
  const selectedDirectPackage = activePackages.find((p) => p.id === Number(selectedPackageId)) ?? null;
  const currentPrice = selectedPending
    ? selectedPending.packagePrice
    : selectedDirectPackage
      ? selectedDirectPackage.price
      : 0;
>>>>>>> Stashed changes

  // Xử lý tra cứu hội viên
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      toast('Vui lòng nhập SĐT, Mã hội viên hoặc CCCD để tra cứu.', 'error');
      return;
    }
    if (q.length < 2) {
      toast('Từ khóa tìm kiếm phải có ít nhất 2 ký tự.', 'error');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const results = await receptionApi.lookupMembers(q);
      setSearchResults(results);
      if (results.length > 0) {
<<<<<<< Updated upstream
        setSelectedMember(results[0]);
        toast(`Đã tìm thấy ${results.length} kết quả phù hợp.`, 'success');
      } else {
        setSelectedMember(null);
=======
        const member = results[0];
        setSelectedMember(member);
        const matchedPending = pendingList.find((p) => p.memberId === member.userId) ?? null;
        setSelectedPending(matchedPending);
        setSelectedPackageId(matchedPending ? matchedPending.packageId : '');
        toast(`Đã tìm thấy ${results.length} kết quả phù hợp.`, 'success');
      } else {
        setSelectedMember(null);
        setSelectedPending(null);
        setSelectedPackageId('');
>>>>>>> Stashed changes
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tra cứu thất bại.';
      toast(msg, 'error');
      setSearchResults([]);
      setSelectedMember(null);
<<<<<<< Updated upstream
=======
      setSelectedPending(null);
      setSelectedPackageId('');
>>>>>>> Stashed changes
    } finally {
      setIsSearching(false);
    }
  };

<<<<<<< Updated upstream
  // BR-03 & BR-04: Xử lý thanh toán
=======
  // BR-03 & BR-04: Xác nhận thanh toán cho yêu cầu chờ hoặc bán gói trực tiếp tại quầy
>>>>>>> Stashed changes
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMember) {
<<<<<<< Updated upstream
      toast('Vui lòng tra cứu và chọn hội viên trước khi thu tiền.', 'error');
      return;
    }

    if (!selectedPackageId || !selectedPackage) {
      toast('Vui lòng chọn gói dịch vụ cần mua hoặc gia hạn.', 'error');
=======
      toast('Vui lòng tra cứu hoặc chọn một hội viên.', 'error');
      return;
    }

    if (!selectedPending && !selectedPackageId) {
      toast('Vui lòng chọn một gói tập để thanh toán.', 'error');
>>>>>>> Stashed changes
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
      const packageIdToPay = selectedPending ? selectedPending.packageId : Number(selectedPackageId);
      const pkg = activePackages.find((p) => p.id === packageIdToPay);
      const amountToPay = selectedPending ? selectedPending.packagePrice : (pkg?.price ?? currentPrice);
      const packageName = selectedPending ? selectedPending.packageName : (pkg?.name ?? 'Gói tập');

      const result = await receptionApi.processPayment({
        memberId: selectedMember.userId,
<<<<<<< Updated upstream
        packageId: selectedPackage.id,
        amount: selectedPackage.price,
=======
        subscriptionId: selectedPending?.id,
        packageId: packageIdToPay,
        amount: amountToPay,
>>>>>>> Stashed changes
        method: paymentMethod,
        notes: paymentNotes.trim() || undefined,
      });

      // BR-04: Chỉ hiển thị hóa đơn khi Payment API trả thành công
<<<<<<< Updated upstream
=======
      setCompletedPackageName(packageName);
      setCompletedMemberName(selectedMember.fullName);
>>>>>>> Stashed changes
      setCompletedPayment(result);
      toast(`Đã xác nhận thu tiền thành công! Hóa đơn: ${result.invoiceNumber}`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Giao dịch thanh toán thất bại.';
      toast(msg, 'error');
      // Thất bại: không tạo hóa đơn
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  return (
    <div className="portal-container">
      <PageHeader
        eyebrow="Lễ tân &amp; Thu ngân"
        title="Quầy lễ tân &amp; Thu ngân trực tiếp"
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
              'Tra Cứu Hội Viên'
            )}
          </button>
        </form>

        {/* Danh sách kết quả nếu có nhiều hơn 1 người */}
        {searchResults.length > 1 && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #ECE7E1' }}>
            <div style={{ fontSize: '0.86rem', color: '#7E7771', marginBottom: '8px' }}>
              Tìm thấy {searchResults.length} hội viên. Chọn hội viên để thực hiện thanh toán:
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {searchResults.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  className={`btn-secondary btn-sm ${selectedMember?.userId === m.userId ? 'btn-primary' : ''}`}
<<<<<<< Updated upstream
                  onClick={() => setSelectedMember(m)}
=======
                  onClick={() => {
                    setSelectedMember(m);
                    const matched = pendingList.find((p) => p.memberId === m.userId) ?? null;
                    setSelectedPending(matched);
                    setSelectedPackageId(matched ? matched.packageId : '');
                  }}
>>>>>>> Stashed changes
                >
                  {m.fullName} ({m.membershipCode || m.phone})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid-2">
        {/* Thông tin hội viên tìm thấy (BR-01 Empty state & BR-05 Masked CCCD) */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2 className="portal-card-title">Thông Tin Hội Viên</h2>
            {selectedMember && (
              <span className={`badge ${selectedMember.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`}>
                {selectedMember.status}
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
                  <span style={{ fontFamily: 'monospace', color: '#4A4541' }}>
                    {maskCitizenId(selectedMember.citizenId || (selectedMember.phone ? `079${selectedMember.phone.slice(-6)}123` : null))}
                  </span>
                </div>

                <div className="kv-row">
                  <span>Gói tập hiện tại</span>
                  <span>{selectedMember.currentPackage || 'Chưa đăng ký gói nào'}</span>
                </div>

                <div className="kv-row">
                  <span>Hạn sử dụng</span>
                  <span style={{ color: selectedMember.status === 'ACTIVE' ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
                    {selectedMember.endDate || 'Hết hạn hoặc chưa kích hoạt'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => toast(`Đã gửi thẻ QR điện tử về số ${selectedMember.phone || selectedMember.email}`, 'success')}
                >
                  Cấp Lại Thẻ QR
                </button>
              </div>
            </div>
          ) : (
            /* BR-01: Trạng thái trống rõ ràng */
            <div className="portal-empty" style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🔍</div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#1A1614' }}>
                {hasSearched ? 'Không tìm thấy hội viên' : 'Chưa chọn hội viên'}
              </h3>
              <p style={{ color: '#7E7771', fontSize: '0.88rem', margin: 0 }}>
                {hasSearched
                  ? `Không có kết quả nào khớp với từ khóa "${searchQuery}". Vui lòng kiểm tra lại SĐT, Mã hội viên hoặc CCCD.`
                  : 'Hãy nhập thông tin vào thanh tra cứu phía trên để tìm kiếm khách hàng.'}
              </p>
            </div>
          )}
        </div>

        {/* Panel thu ngân & Bán gói tập (BR-02, BR-03) */}
        <div className="portal-card">
          <div className="portal-card-header">
            <h2 className="portal-card-title">Xử Lý Thu Phí &amp; Bán Gói Tập (POS)</h2>
          </div>

          <form onSubmit={handlePayment}>
<<<<<<< Updated upstream
            {/* BR-02: Dropdown chỉ liệt kê gói tập đang active */}
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="pos-package">
                Chọn Gói Dịch Vụ Mua / Gia Hạn * (Chỉ gói Active)
              </label>
              {loadingPackages ? (
                <div style={{ color: '#7E7771', fontSize: '0.88rem' }}>Đang nạp danh mục gói tập...</div>
              ) : packages.length === 0 ? (
                <div style={{ color: '#DC2626', fontSize: '0.88rem' }}>Hiện chưa có gói tập nào đang hoạt động (active).</div>
=======
            {/* Gói tập: Hiển thị gói đã chọn nếu có pending, hoặc cho phép chọn trực tiếp từ danh sách activePackages */}
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="pos-package">
                {selectedPending ? 'Gói Tập Hội Viên Đã Chọn (Yêu cầu chờ)' : 'Chọn Gói Tập Bán Tại Quầy *'}
              </label>
              {selectedPending ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    id="pos-package"
                    type="text"
                    className="portal-input"
                    value={`${selectedPending.packageName} (${selectedPending.durationDays} ngày — Yêu cầu #${selectedPending.id})`}
                    disabled
                    readOnly
                    style={{
                      fontWeight: 600,
                      color: '#1A1614',
                      backgroundColor: '#FAF8F5',
                      flex: 1,
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setSelectedPending(null);
                      setSelectedPackageId('');
                    }}
                    title="Bỏ chọn yêu cầu này để chọn gói khác"
                  >
                    Đổi gói khác
                  </button>
                </div>
>>>>>>> Stashed changes
              ) : (
                <Select
                  id="pos-package"
                  className="portal-select"
<<<<<<< Updated upstream
                  value={String(selectedPackageId)}
                  onChange={(e) => setSelectedPackageId(Number(e.target.value))}
                  disabled={isSubmittingPayment}
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.durationDays} ngày — {vnd(pkg.price)})
=======
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value ? Number(e.target.value) : '')}
                  disabled={isSubmittingPayment}
                >
                  <option value="">-- Chọn gói tập bán trực tiếp cho hội viên --</option>
                  {activePackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.durationDays} ngày) — {vnd(pkg.price)}
>>>>>>> Stashed changes
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="grid-2">
              {/* BR-02: Số tiền hiển thị theo giá gói và KHÔNG cho sửa tay */}
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="pos-amount">
                  Số Tiền Thu (Không sửa tay)
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
                    color: '#996515',
                    backgroundColor: '#FAF8F5',
                    cursor: 'not-allowed',
                  }}
                />
              </div>

              {/* BR-03: Bắt buộc chọn hình thức thanh toán */}
              <div className="portal-form-group">
                <label className="portal-label" htmlFor="pos-method">
                  Hình Thức Thanh Toán *
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

<<<<<<< Updated upstream
            {/* BR-03: Nút bị khóa khi đang xử lý để tránh thu trùng */}
=======
            {/* BR-03: Nút bật khi đã chọn hội viên VÀ có gói tập (từ yêu cầu chờ hoặc chọn trực tiếp) */}
>>>>>>> Stashed changes
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
<<<<<<< Updated upstream
              disabled={isSubmittingPayment || !selectedMember || packages.length === 0}
=======
              disabled={isSubmittingPayment || !selectedMember || (!selectedPending && !selectedPackageId)}
>>>>>>> Stashed changes
            >
              {isSubmittingPayment ? (
                <>
                  <span className="spinner" />
                  <span>Đang xử lý thu tiền...</span>
                </>
              ) : (
                'Xác Nhận Thu Tiền &amp; Xuất Hóa Đơn'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* BR-04: Popup Hóa đơn điện tử chỉ hiện khi Payment thành công */}
      {completedPayment && (
        <Modal
          title={`Hóa Đơn Điện Tử: ${completedPayment.invoiceNumber}`}
          onClose={() => setCompletedPayment(null)}
        >
          <div style={{ display: 'grid', gap: '16px' }}>
            <div
              style={{
                backgroundColor: '#F0FDF4',
                border: '1px solid #86EFAC',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>🧾</div>
              <h3 style={{ margin: '0 0 4px 0', color: '#166534', fontSize: '1.25rem' }}>
                Thanh Toán Thành Công!
              </h3>
              <p style={{ margin: 0, color: '#15803D', fontSize: '0.9rem' }}>
                Giao dịch đã được ghi nhận và cấp mã hóa đơn điện tử hợp lệ.
              </p>
            </div>

            {/* Thông tin chi tiết hóa đơn */}
            <div className="kv-list" style={{ backgroundColor: '#FAF8F5', padding: '16px', borderRadius: '8px' }}>
              <div className="kv-row">
                <span>Số hóa đơn</span>
                <strong style={{ fontFamily: 'monospace', color: '#996515', fontSize: '1rem' }}>
                  {completedPayment.invoiceNumber}
                </strong>
              </div>
              <div className="kv-row">
                <span>Khách hàng</span>
                <strong>{selectedMember?.fullName}</strong>
              </div>
              <div className="kv-row">
                <span>Gói dịch vụ</span>
                <strong>{selectedPackage?.name}</strong>
              </div>
              <div className="kv-row">
                <span>Phương thức</span>
                <span className="badge badge-info">{completedPayment.method.toUpperCase()}</span>
              </div>
              <div className="kv-row">
                <span>Thời gian thanh toán</span>
                <span>{new Date(completedPayment.paidAt).toLocaleString('vi-VN')}</span>
              </div>
              <div className="kv-row" style={{ borderTop: '1px dashed #D6CEC5', paddingTop: '10px' }}>
                <span style={{ fontSize: '1rem', fontWeight: 600 }}>TỔNG TIỀN ĐÃ THU</span>
                <strong style={{ fontSize: '1.2rem', color: '#15803d' }}>
                  {vnd(completedPayment.amount)}
                </strong>
              </div>
            </div>

            {/* Nút hành động trong Modal Hóa đơn */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCompletedPayment(null)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handlePrintInvoice}
              >
                🖨️ In Hóa Đơn
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
