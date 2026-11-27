import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useNavigation } from 'react-router-dom';
import { apiFetch, clearAuthSession, syncSessionWithServer, TOKEN_STORAGE_KEY, type UserSession } from '../../shared/api/client';
import { sessionIdentityKey, useCurrentUser } from '../../shared/api/useCurrentUser';
import { LanguageSetting, useI18n } from '../../shared/i18n';
import { formatCenterDateTime } from '../../shared/lib/centerTime';
import { localizableError } from '../../shared/lib/errorMessage';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { Modal } from '../../shared/ui/Modal';
import { ThemeToggle } from '../../shared/ui/ThemeToggle';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { dismissToast } from '../../shared/ui/toast';
import { PortalIcon } from './PortalIcon';
import { usePortalMotion } from './usePortalMotion';
import './portal-motion.css';
import { PortalSectionTabs } from './PortalSectionTabs';
import { getMobileNavLabel, getNavLabel, getRoleLabel, getTabLabel, isPortalNavActive, MOBILE_PRIMARY_NAV, PORTAL_NAV } from './portalNavigation';
import { useReceptionAlerts } from '../reception/useReceptionAlerts';
import { getUnreadCount } from '../member/notificationsApi';
import { subscribeMembershipChanges } from '../member/membershipRealtime';
import { getProfile } from '../member/profileApi';
import { usePortalNotices } from '../../shared/lib/portalNotices';
import { ChatWidget } from '../chat/ChatWidget';
import { PwaStatus } from '../pwa/PwaStatus';
import { NotificationsPopover } from '../member/NotificationsPopover';
import { formatPrice } from '../../shared/lib/membershipPresentation';
import { navigateToVnpay } from '../payments/vnpayApi';
import { releaseAbandonedVnpay, rememberActiveVnpay } from '../payments/vnpaySession';

// Chỉ hội viên mới thấy trợ lý AI; các WebGL shader của nó không được tải ở lần tải đầu của mọi vai trò khác.

/** Một giao dịch trong dữ liệu ví trả về từ API (mọi trường đều tùy chọn). */
interface WalletTransactionItem {
  id?: number;
  type?: string;
  amount?: number;
  balanceAfter?: number;
  description?: string | null;
  referenceId?: string | null;
  createdAt?: string | null;
}

/** Dữ liệu tóm tắt ví từ API: số dư, lần cập nhật và danh sách giao dịch. */
interface WalletSummaryResponse {
  balance?: number;
  updatedAt?: string | null;
  transactions?: WalletTransactionItem[];
}

/** Nhãn hiển thị của loại giao dịch ví theo ngôn ngữ (nạp VNPay, nạp tại quầy, hoàn tiền, thanh toán dịch vụ). */
function walletTypeLabel(type?: string, lang: 'vi' | 'en' = 'vi') {
  if (type === 'TOPUP_VNPAY') return lang === 'en' ? 'VNPay top-up' : 'Nạp từ VNPay';
  if (type === 'TOPUP_COUNTER') return lang === 'en' ? 'Counter top-up' : 'Nạp tại quầy Lễ tân';
  if (type === 'REFUND_CREDIT') return lang === 'en' ? 'Refund to wallet' : 'Hoàn tiền vào ví';
  if (type === 'PAYMENT_DEBIT') return lang === 'en' ? 'Service payment' : 'Thanh toán dịch vụ';
  return type || (lang === 'en' ? 'Wallet transaction' : 'Giao dịch ví');
}

/** True nếu là giao dịch cộng tiền: loại nạp/hoàn là cộng, loại thanh toán là trừ, còn lại xét theo dấu số tiền. */
function isCreditTransaction(type?: string, amount?: number) {
  if (type === 'PAYMENT_DEBIT') return false;
  if (type === 'TOPUP_VNPAY' || type === 'TOPUP_COUNTER' || type === 'REFUND_CREDIT') return true;
  return (amount ?? 0) >= 0;
}

/** Chuẩn hóa chuỗi để tìm kiếm: bỏ dấu tiếng Việt, đổi đ thành d và chuyển chữ thường. */
function searchable(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

/**
 * Vỏ portal gắn với một danh tính: khi đổi tài khoản/role (kể cả từ tab khác) toàn bộ cây con bị remount,
 * nên chat, thông báo và state trang của phiên cũ không còn hiển thị cho người dùng mới.
 */
export function PortalShell() {
  const user = useCurrentUser();
  useReceptionAlerts(user?.role ?? '', user?.id ?? '');
  if (!user) return <Navigate to="/login" replace />;
  return <PortalShellContent key={sessionIdentityKey(user)} user={user} />;
}

/** Nội dung vỏ portal: thanh bên, thanh trên, tìm kiếm, thông báo, ví và menu tài khoản cho một người dùng. */
function PortalShellContent({ user }: { user: UserSession }) {
  const { lang, t } = useI18n();
  const location = useLocation();
  useEffect(() => () => dismissToast(), [location.pathname]);
  const navigate = useNavigate();
  const navigation = useNavigation();
  const navigating = navigation.state !== 'idle';
  const [confirm, confirmDialog] = useConfirm();
  const [dialog, setDialog] = useState<'search' | 'menu' | 'notifications' | 'wallet' | null>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);
  // Thanh công cụ nổi ở góc phải trên cùng; tiêu đề trang chừa đúng bề rộng của nó để nội dung bắt đầu từ đầu trang.
  const appMainRef = useRef<HTMLDivElement | null>(null);
  const topbarActionsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const actions = topbarActionsRef.current;
    const main = appMainRef.current;
    if (!actions || !main || typeof ResizeObserver === 'undefined') return;
    // Khoảng từ mép phải vùng nội dung tới mép trái cụm thao tác.
    const sync = () => main.style.setProperty('--portal-topbar-width', `${Math.ceil(main.getBoundingClientRect().right - actions.getBoundingClientRect().left)}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(actions);
    observer.observe(main);
    return () => observer.disconnect();
  }, []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const isMember = user.role === 'MEMBER';
  const avatarMenuId = useId();
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionItem[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | Error | { vi: string; en: string } | null>(null);
  const [topupAmount, setTopupAmount] = useState('200000');
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupError, setTopupError] = useState<string | Error | { vi: string; en: string } | null>(null);

  // Nạp ví qua VNPay: kiểm tra số tiền 10.000–100.000.000 đ, tạo giao dịch rồi chuyển sang cổng VNPay; lỗi thì hiện thông báo.
  const handleWalletTopup = async () => {
    if (topupBusy) return;
    const numeric = Number(topupAmount);
    if (!Number.isFinite(numeric) || numeric < 10000 || numeric > 100000000) {
      setTopupError({ vi: 'Số tiền nạp vào Ví phải từ 10.000 đ đến 100.000.000 đ.', en: 'Wallet top-up amount must be between 10,000 VND and 100,000,000 VND.' });
      return;
    }
    setTopupBusy(true);
    setTopupError(null);
    try {
      await releaseAbandonedVnpay();
      const checkout = await apiFetch<{ reference?: string; paymentUrl?: string }>('/wallet/topup/vnpay', {
        method: 'POST',
        body: JSON.stringify({ amount: numeric }),
      });
      if (checkout?.paymentUrl) {
        if (checkout.reference) rememberActiveVnpay(checkout.reference);
        navigateToVnpay(checkout.paymentUrl);
      } else {
        setTopupError({
          vi: 'Không nhận được đường dẫn thanh toán VNPay. Vui lòng thử lại.',
          en: 'VNPay payment URL was not returned. Please try again.',
        });
        setTopupBusy(false);
      }
    } catch (err) {
      setTopupError(localizableError(err, 'Không thể tạo giao dịch nạp tiền VNPay.'));
      setTopupBusy(false);
    }
  };

  const notificationTrigger = useRef<HTMLElement | null>(null);
  const suppressNotificationFocusRef = useRef(false);
  // Đóng hộp thoại thông báo; chỉ trả focus về nút chuông khi đóng chủ động (Esc / nút đóng), không cướp focus khi click ra ngoài.
  const closeNotifications = useCallback((restoreFocus: boolean | unknown = true) => {
    setDialog(null);
    if (restoreFocus !== false && !suppressNotificationFocusRef.current) {
      (notificationTrigger.current ?? document.querySelector<HTMLElement>('.member-notification-bell'))?.focus();
    }
    suppressNotificationFocusRef.current = false;
  }, []);
  // Mở hoặc đóng hộp thoại thông báo (bấm lần nữa thì đóng).
  const openNotifications = (event: MouseEvent<HTMLButtonElement>) => {
    notificationTrigger.current = event.currentTarget;
    setDialog(current => current === 'notifications' ? null : 'notifications');
  };
  useEffect(() => {
    if (dialog !== 'notifications') {
      suppressNotificationFocusRef.current = false;
      return;
    }
    // Ghi nhận thao tác nhấn ra ngoài hộp thông báo ở pha capture trước khi popover gọi onClose().
    const onOutsidePointerDown = (event: Event) => {
      const panel = document.getElementById('portal-notifications');
      const trigger = notificationTrigger.current ?? document.querySelector<HTMLElement>('.member-notification-bell');
      if (
        event.target instanceof Node &&
        !panel?.contains(event.target) &&
        !trigger?.contains(event.target)
      ) {
        suppressNotificationFocusRef.current = true;
      }
    };
    document.addEventListener('pointerdown', onOutsidePointerDown, true);
    return () => document.removeEventListener('pointerdown', onOutsidePointerDown, true);
  }, [dialog]);
  const [query, setQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [notificationError, setNotificationError] = useState(false);
  const clientUnread = usePortalNotices().filter((item) => !item.read).length;
  const totalUnread = (unreadCount ?? 0) + clientUnread;
  const previousPath = useRef(location.pathname);
  const mainRef = useRef<HTMLElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const navTriggerRef = useRef<HTMLElement | null>(null);
  usePortalMotion(mainRef);
  // Mọi vai trò đều mở được hộp thư server và thông báo thao tác tại client.
  const hasServerNotifications = true;
  const canReceiveNotifications = true;
  const profileLabel = isMember
    ? t('Hồ sơ hội viên', 'Member profile')
    : t('Hồ sơ cá nhân', 'My profile');
  const navItems = PORTAL_NAV.filter((item) => item.roles.includes(user.role)).map((item) => {
    if (item.to === '/member/profile') return { ...item, label: profileLabel };
    return { ...item, label: getNavLabel(item.to, item.label, lang) };
  });
  const normalizedPathname = location.pathname === '/profile' ? '/member/profile' : location.pathname;
  const activeNavItem = navItems.find((item) => isPortalNavActive(item, normalizedPathname));
  const activeTab = activeNavItem?.tabs?.find((tab) => normalizedPathname === tab.to || normalizedPathname.startsWith(`${tab.to}/`));
  const pageTitle = activeTab ? `${activeNavItem!.label} · ${getTabLabel(activeTab, lang)}` : activeNavItem?.label ?? t('SÖL Fitness', 'SÖL Fitness');
  // Tìm theo tên mục gộp lẫn tên từng tab con (hỗ trợ khớp từng từ rời, vd. "lich pt" vẫn tìm ra "Lịch học & đặt PT").
  const results = navItems.filter((item) => {
    const tokens = searchable(query.trim()).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return true;
    const matchText = (candidate: string) => {
      const hay = searchable(candidate);
      return tokens.every((token) => hay.includes(token));
    };
    return matchText(item.label) || (item.tabs ?? []).some(tab => matchText(getTabLabel(tab, lang)));
  });
  // Mục mobile có thể là một tab con của mục gộp: vẫn phải đúng quyền và giữ đích đến riêng.
  const mobileItems = MOBILE_PRIMARY_NAV[user.role].flatMap(item => {
    const authorizedItem = navItems.find(candidate => candidate.to === item.to || candidate.tabs?.some(tab => tab.to === item.to));
    return authorizedItem ? [{ ...authorizedItem, to: item.to, label: getMobileNavLabel(item.to, item.label, lang) }] : [];
  });
  const secondaryScreen = !mobileItems.some(item => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

  // Tải ảnh đại diện và email từ hồ sơ; lỗi (vd. môi trường test/offline) thì bỏ qua.
  const refreshProfileSummary = useCallback(() => {
    void getProfile()
      .then((profile) => {
        if (profile && typeof profile === 'object') {
          setAvatarUrl(typeof profile.avatarUrl === 'string' && profile.avatarUrl.trim() ? profile.avatarUrl.trim() : null);
          setProfileEmail(typeof profile.email === 'string' && profile.email.trim() ? profile.email.trim() : null);
        }
      })
      .catch(() => {
        // Bỏ qua trong ngữ cảnh ngoại tuyến/kiểm thử khi /profile chưa được giả lập
      });
  }, []);

  // Tải số dư và lịch sử giao dịch ví (chỉ áp dụng cho Hội viên).
  const refreshWallet = useCallback(() => {
    if (!isMember) return;
    setWalletLoading(true);
    setWalletError(null);
    void apiFetch<WalletSummaryResponse>('/wallet/my')
      .then((data) => {
        if (data && typeof data === 'object') {
          const numeric = Number(data.balance);
          setWalletBalance(Number.isFinite(numeric) ? numeric : 0);
          setWalletTransactions(Array.isArray(data.transactions) ? data.transactions : []);
          setWalletError(null);
        } else {
          setWalletError({
            vi: 'Không thể tải thông tin ví. Vui lòng thử lại.',
            en: 'Unable to load wallet information. Please try again.',
          });
        }
      })
      .catch((err) => {
        setWalletError(localizableError(err, 'Không thể tải thông tin ví. Vui lòng thử lại.'));
      })
      .finally(() => {
        setWalletLoading(false);
      });
  }, [isMember]);

  useEffect(() => {
    if (!isMember || location.pathname.startsWith('/member/payments/vnpay/return')) return;
    if (localStorage.getItem(TOKEN_STORAGE_KEY)) {
      void releaseAbandonedVnpay();
    }
    // Quay lại trang từ bộ nhớ đệm (nút Back) thì mở lại nút nạp và hủy phiên VNPay bỏ dở.
    const handleRestore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setTopupBusy(false);
      if (localStorage.getItem(TOKEN_STORAGE_KEY)) {
        void releaseAbandonedVnpay();
      }
    };
    window.addEventListener('pageshow', handleRestore);
    return () => window.removeEventListener('pageshow', handleRestore);
  }, [isMember, location.pathname]);

  useEffect(() => {
    if (localStorage.getItem(TOKEN_STORAGE_KEY)) {
      refreshProfileSummary();
    }
    window.addEventListener('profile-updated', refreshProfileSummary);
    return () => {
      window.removeEventListener('profile-updated', refreshProfileSummary);
    };
  }, [refreshProfileSummary]);

  useEffect(() => {
    if (!isMember) return;
    if (localStorage.getItem(TOKEN_STORAGE_KEY)) {
      refreshWallet();
    }
    // Mở hộp thoại ví từ menu tài khoản.
    const handleOpenWalletModal = () => {
      setAvatarMenuOpen(false);
      refreshWallet();
      setDialog('wallet');
    };
    window.addEventListener('wallet-updated', refreshWallet);
    window.addEventListener('open-wallet-modal', handleOpenWalletModal);
    return () => {
      window.removeEventListener('wallet-updated', refreshWallet);
      window.removeEventListener('open-wallet-modal', handleOpenWalletModal);
    };
  }, [isMember, refreshWallet]);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    refreshProfileSummary();
    if (isMember) refreshWallet();
    // Bấm ra ngoài menu tài khoản thì đóng.
    const onPointerDown = (event: Event) => {
      if (avatarMenuRef.current && event.target instanceof Node && !avatarMenuRef.current.contains(event.target)) {
        setAvatarMenuOpen(false);
      }
    };
    // Nhấn Esc thì đóng menu tài khoản và trả focus về nút tài khoản.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAvatarMenuOpen(false);
        avatarMenuRef.current?.querySelector<HTMLButtonElement>('.portal-account')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [avatarMenuOpen, isMember, refreshProfileSummary, refreshWallet]);

  useEffect(() => {
    if (!hasServerNotifications) return;
    let active = true;
    // Làm mới số thông báo chưa đọc (bỏ qua khi tab đang ẩn).
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void getUnreadCount().then((count) => {
        if (active) { setUnreadCount(count); setNotificationError(false); }
      }).catch(() => {
        if (active) { setUnreadCount(null); setNotificationError(true); }
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener('member-notifications-changed', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const disconnectRealtime = user.role === 'MEMBER' && localStorage.getItem(TOKEN_STORAGE_KEY)
      ? subscribeMembershipChanges(() => {
          if (!active) return;
          window.dispatchEvent(new Event('member-notifications-changed'));
        })
      : null;
    return () => {
      active = false;
      window.clearInterval(timer);
      disconnectRealtime?.();
      window.removeEventListener('member-notifications-changed', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [hasServerNotifications, user.role]);

  useEffect(() => {
    // Role có thể bị Admin đổi sau khi đăng nhập: đối chiếu với server khi vào portal và khi quay lại tab.
    let lastSync = 0;
    // Đồng bộ phiên với server, tối đa một lần mỗi 5 giây.
    const sync = () => {
      const now = Date.now();
      if (now - lastSync < 5000) return;
      lastSync = now;
      void syncSessionWithServer();
    };
    // Tab hiện lại thì đồng bộ phiên.
    const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
    sync();
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${pageTitle} · SÖL Portal`;
    return () => { document.title = previousTitle; };
  }, [pageTitle]);

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      setAvatarMenuOpen(false);
      setDialog(null);
      navTriggerRef.current = null;
      mainRef.current?.focus();
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (canReceiveNotifications && location.state?.openNotifications) {
      notificationTrigger.current = notificationTrigger.current ?? document.querySelector<HTMLElement>('.member-notification-bell');
      setDialog('notifications');
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [canReceiveNotifications, location.state, location.pathname, navigate]);

  // Mở hộp thoại tìm kiếm hoặc menu điều hướng, nhớ nút đã bấm để trả focus chính xác khi đóng.
  const openNavigation = (mode: 'search' | 'menu', trigger?: HTMLElement | null) => {
    navTriggerRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setQuery('');
    setDialog(mode);
  };

  // Vẽ ảnh đại diện, ảnh mặc định khi chưa có hoặc ảnh lỗi.
  const renderAvatarContent = () => (
    <img
      src={avatarUrl || '/images/default-avatar.png'}
      alt={user.name || 'Avatar'}
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
      onError={(e) => {
        const target = e.currentTarget;
        if (!target.src.endsWith('/images/default-avatar.png')) {
          target.src = '/images/default-avatar.png';
        }
      }}
    />
  );

  const roleLabel = getRoleLabel(user.role, lang);

  return <div className="portal-backdrop">
    <div className="app-shell portal-v2">
      <a href="#portal-main" className="skip-link">{t('Bỏ qua tới nội dung chính', 'Skip to main content')}</a>
      <aside className="app-sidebar" aria-label={t('Thanh công cụ SÖL', 'SÖL Sidebar')}>
        <div className="portal-rail-head">
          <Link to="/" className="portal-logo portal-logo--mark" aria-label={t('SÖL · Về trang chủ', 'SÖL · Back to home')}><img src="/favicon.svg" alt="" width={44} height={44} draggable={false} /></Link>
          <span className="portal-rail-brand" aria-hidden="true">SÖL<small>Fitness</small></span>
        </div>
        <nav className="portal-rail-nav" aria-label={t('Điều hướng portal', 'Portal navigation')}>
          {navItems.filter((item) => item.to !== '/member/profile' && item.to !== '/member/notifications').map((item) => {
            // Mục gộp sáng khi đang ở bất kỳ tab con nào, không chỉ tab đầu.
            const active = isPortalNavActive(item, location.pathname);
            return <Link key={item.to} to={item.to} className={`portal-rail-link${active ? ' active' : ''}`} aria-label={item.label} title={item.to === '/staff/reception-history' ? item.label : undefined} aria-current={active ? 'page' : undefined}>
              <PortalIcon name={item.icon} /><span className="portal-rail-label" aria-hidden="true">{item.label}</span>
            </Link>;
          })}
        </nav>
        <div className="portal-rail-footer">
          <Link to="/" className="portal-rail-link" aria-label={t('Về trang chủ', 'Back to home')}><PortalIcon name="home" /><span className="portal-rail-label" aria-hidden="true">{t('Về trang chủ', 'Back to home')}</span></Link>
        </div>
      </aside>

      <div className="app-main" ref={appMainRef}>
        <header className="app-topbar">
          <div className="portal-workspace">
            <button type="button" className="portal-icon-button portal-mobile-menu" aria-label={t('Mở điều hướng', 'Open navigation')} onClick={(event) => openNavigation('menu', event.currentTarget)}><PortalIcon name="menu" /></button>
          </div>
          <div className="portal-topbar-actions" ref={topbarActionsRef}>
            <ThemeToggle />
            {canReceiveNotifications && <button type="button" onClick={openNotifications} aria-haspopup="dialog" aria-expanded={dialog === 'notifications'} aria-controls="portal-notifications" className="member-notification-bell" aria-label={notificationError ? t('Thông báo · Không thể cập nhật số chưa đọc', 'Notifications · Unable to update unread count') : t(`Thông báo · ${totalUnread} chưa đọc`, `Notifications · ${totalUnread} unread`)} title={notificationError ? t('Không thể cập nhật số thông báo', 'Unable to update notifications') : t('Thông báo', 'Notifications')}>
              <PortalIcon name="bell" size={19} />
              {totalUnread > 0 && <span className="member-notification-badge" aria-hidden="true">{totalUnread > 99 ? '99+' : totalUnread}</span>}
            </button>}
            <button type="button" className="portal-search-trigger" aria-label={t('Tìm màn hình', 'Find screen')} onClick={(event) => openNavigation('search', event.currentTarget)}>
              <span className="portal-search-icon"><PortalIcon name="search" size={17} /></span><span>{t('Tìm màn hình…', 'Find screen…')}</span>
            </button>
            <div className="portal-avatar-menu" ref={avatarMenuRef}>
              <button
                type="button"
                className="portal-account"
                aria-label={t(`Hồ sơ của ${user.name}`, `Profile of ${user.name}`)}
                aria-expanded={avatarMenuOpen}
                aria-controls={avatarMenuOpen ? avatarMenuId : undefined}
                data-testid="portal-avatar-trigger"
                onClick={() => setAvatarMenuOpen((current) => !current)}
              >
                <span className="portal-avatar" style={{ overflow: 'hidden' }}>{renderAvatarContent()}</span>
                <span className="portal-account-name">{user.name}</span>
              </button>
              {avatarMenuOpen && (
                <div
                  id={avatarMenuId}
                  className="portal-avatar-dropdown"
                >
                  <div className="portal-avatar-dropdown__brand">
                    <Link to="/portal" className="portal-wordmark" aria-label={t('SÖL Fitness · Trang đầu portal', 'SÖL Fitness · Portal home')} onClick={() => setAvatarMenuOpen(false)}>SÖL<span>Fitness</span></Link>
                    <span className="portal-workspace-role">{roleLabel}</span>
                  </div>
                  <div className="portal-avatar-dropdown__summary">
                    <span className="portal-avatar" style={{ overflow: 'hidden', flexShrink: 0 }}>
                      {renderAvatarContent()}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--portal-muted, #bcb8b5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {profileEmail || user.identifier}
                      </div>
                    </div>
                  </div>

                  <LanguageSetting variant="menu" />

                  <div role="menu" aria-label={t('Menu tài khoản', 'Account menu')} className="portal-avatar-dropdown__menu">
                    {isMember && <button
                      type="button"
                      role="menuitem"
                      data-testid="avatar-menu-wallet"
                      className="portal-avatar-dropdown__wallet"
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        refreshWallet();
                        setDialog('wallet');
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span>{t('Ví của tôi', 'My Wallet')}</span>
                      </span>
                      <strong
                        className="portal-avatar-dropdown__wallet-amount"
                        style={{ color: walletError ? 'var(--portal-danger)' : 'var(--portal-salmon, var(--sol-accent))' }}
                      >
                        {walletError ? t('Lỗi tải số dư', 'Error loading') : formatPrice(walletBalance)}
                      </strong>
                    </button>}

                    <Link
                      to="/member/profile"
                      role="menuitem"
                      data-testid="avatar-menu-profile"
                      className="portal-avatar-dropdown__link"
                      onClick={() => setAvatarMenuOpen(false)}
                    >
                      <span>{t('Thông tin cá nhân', 'Personal Profile')}</span>
                    </Link>

                    <button
                      type="button"
                      role="menuitem"
                      data-testid="avatar-menu-logout"
                      className="portal-avatar-dropdown__logout"
                      onClick={async () => {
                        setAvatarMenuOpen(false);
                        avatarMenuRef.current?.querySelector<HTMLButtonElement>('.portal-account')?.focus();
                        const ok = await confirm({
                          title: { vi: 'Đăng xuất khỏi SÖL?', en: 'Sign out of SÖL?' },
                          message: {
                            vi: 'Bạn cần đăng nhập lại để vào portal.',
                            en: 'You will need to sign in again to open the portal.',
                          },
                          cancelLabel: { vi: 'Ở lại', en: 'Stay' },
                          confirmLabel: { vi: 'Đăng xuất', en: 'Sign out' },
                        });
                        if (ok) {
                          clearAuthSession();
                          navigate('/login', { replace: true });
                        }
                      }}
                    >
                      <span>{t('Đăng xuất', 'Sign out')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <PwaStatus mode="status" />
        <main ref={mainRef} id="portal-main" tabIndex={-1} aria-busy={navigating || undefined}>
          {navigating && <LoadingSkeleton label={t('Đang tải trang…', 'Loading page…')} variant="cards" count={3} className="portal-route-loading" />}
          {activeNavItem?.tabs && <PortalSectionTabs label={activeNavItem.label} tabs={activeNavItem.tabs} pathname={location.pathname} lang={lang} />}
          <div key={location.pathname} className="route-fade" hidden={navigating}><Outlet /></div>
        </main>
        <footer className="portal-workspace-footer">
          <span>SÖL Fitness</span>
        </footer>
      </div>

      <nav className="portal-mobile-nav" aria-label={t('Điều hướng nhanh', 'Quick navigation')}>
        {mobileItems.map(item => <NavLink key={item.to} to={item.to} className="portal-mobile-nav__item">
          <span>{item.label}</span>
        </NavLink>)}
        <button ref={moreRef} type="button" className={`portal-mobile-nav__item${secondaryScreen ? ' active' : ''}`} aria-label={t('Thêm màn hình', 'More screens')} aria-haspopup="dialog" aria-expanded={dialog === 'menu'} aria-current={secondaryScreen ? 'true' : undefined} onClick={(event) => openNavigation('menu', event.currentTarget)}>
          <span>{t('Thêm', 'More')}</span>
        </button>
      </nav>

      {location.pathname !== '/member/check-in' && location.pathname !== '/staff/check-in' && location.pathname !== '/staff/check-out' && location.pathname !== '/messages' && <ChatWidget />}
      {canReceiveNotifications && dialog === 'notifications' && <NotificationsPopover onClose={closeNotifications} triggerRef={notificationTrigger} />}
      {dialog === 'wallet' && (
        <Modal title={t('Ví điện tử SÖL', 'SÖL Digital Wallet')} busy={topupBusy} onClose={() => setDialog(null)}>
          {walletError && (
            <div className="portal-alert" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <span>{t(walletError)}</span>
              <button type="button" className="btn-secondary btn-sm" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={refreshWallet} disabled={walletLoading}>
                {t('Thử lại', 'Retry')}
              </button>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: 18,
              borderRadius: 16,
              background: 'var(--portal-raised, #303030)',
              border: '1px solid var(--portal-border-strong, #ffffff30)',
              marginBottom: 16,
            }}
          >
            <div>
              <div className="portal-label">{t('Số dư khả dụng', 'Available balance')}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--portal-salmon, var(--sol-accent))', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
                {walletError ? '—' : formatPrice(walletBalance)}
              </div>
            </div>
            <button type="button" className="btn-secondary btn-sm" onClick={refreshWallet} disabled={walletLoading}>
              {walletLoading ? t('Đang tải…', 'Loading…') : t('Làm mới', 'Refresh')}
            </button>
          </div>
          {isMember && (
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                border: '1px solid var(--portal-border, #ffffff1a)',
                background: 'var(--portal-surface, #292929)',
                display: 'grid',
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div className="portal-label" style={{ marginBottom: 0 }}>{t('Nạp tiền vào Ví qua VNPay', 'Top up wallet via VNPay')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[100000, 200000, 500000, 1000000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={`filter-chip${Number(topupAmount) === amt ? ' is-active' : ''}`}
                    onClick={() => {
                      setTopupError(null);
                      setTopupAmount(String(amt));
                    }}
                  >
                    +{formatPrice(amt)}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="number"
                  className="portal-input"
                  aria-label={t('Số tiền nạp vào Ví (VNĐ)', 'Wallet top-up amount (VND)')}
                  min={10000}
                  max={100000000}
                  step={10000}
                  value={topupAmount}
                  onChange={(e) => {
                    setTopupError(null);
                    setTopupAmount(e.target.value);
                  }}
                  style={{ flex: '1 1 160px' }}
                />
                <button
                  type="button"
                  className="btn-primary"
                  data-testid="wallet-topup-btn"
                  disabled={topupBusy}
                  onClick={() => void handleWalletTopup()}
                >
                  {topupBusy ? t('Đang chuyển tới VNPay…', 'Redirecting to VNPay…') : t('Nạp vào Ví qua VNPay', 'Top up via VNPay')}
                </button>
              </div>
              {topupError && (
                <p className="form-error" role="alert" style={{ margin: 0 }}>
                  {t(topupError)}
                </p>
              )}
            </div>
          )}
          <h3 className="portal-card-title" style={{ fontSize: 14, marginBottom: 10 }}>{t('Lịch sử giao dịch Ví', 'Wallet transaction history')}</h3>
          {walletTransactions.length === 0 ? (
            walletError ? (
              <p className="portal-subtitle" role="status">{t('Không thể tải lịch sử giao dịch lúc này.', 'Unable to load transaction history right now.')}</p>
            ) : (
              <p className="portal-subtitle" role="status">{t('Chưa có biến động số dư nào trong ví.', 'No wallet transactions yet.')}</p>
            )
          ) : (
            <div style={{ display: 'grid', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {walletTransactions.map((tx, idx) => {
                const credit = isCreditTransaction(tx.type, tx.amount);
                const absAmount = Math.abs(Number(tx.amount ?? 0));
                return (
                  <div
                    key={tx.id ?? idx}
                    className="row-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 14px',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{walletTypeLabel(tx.type, lang)}</div>
                      {tx.description && (
                        <div className="row-card__meta" style={{ fontSize: 12 }}>{tx.description}</div>
                      )}
                      {tx.createdAt && (
                        <div className="row-card__meta" style={{ fontSize: 12 }}>{formatCenterDateTime(tx.createdAt, tx.createdAt)}</div>
                      )}
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        fontVariantNumeric: 'tabular-nums',
                        color: credit ? 'var(--portal-success, #86efac)' : 'var(--portal-paper, #faf9f6)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {credit ? '+' : '-'}{formatPrice(absAmount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}
      {(dialog === 'menu' || dialog === 'search') && <Modal title={dialog === 'menu' ? t('Điều hướng', 'Navigation') : t('Tìm màn hình', 'Find Screen')} onClose={() => setDialog(null)} returnFocusRef={navTriggerRef}>
        <label className="portal-label" htmlFor="portal-screen-search">{t('Tên màn hình', 'Screen name')}</label>
        <input id="portal-screen-search" className="portal-input" type="search" placeholder={t('Ví dụ: lớp học, gói tập, điểm danh…', 'e.g. classes, memberships, attendance…')} value={query} onChange={(event) => setQuery(event.target.value)} />
        <nav className="portal-screen-results" aria-label={t('Các màn hình của bạn', 'Your screens')}>
          {results.map((item) => item.to === '/member/notifications' ? <button key={item.to} type="button" onClick={() => {
            notificationTrigger.current = document.querySelector<HTMLButtonElement>('.member-notification-bell');
            setDialog('notifications');
          }}><span>{item.label}</span><PortalIcon name="arrow" size={16} /></button> : <NavLink key={item.to} to={item.to} onClick={() => setDialog(null)}>
            <span>{item.label}</span><PortalIcon name="arrow" size={16} />
          </NavLink>)}
          {results.length === 0 && <p className="portal-search-empty" role="status">{t('Không tìm thấy màn hình. Hãy thử từ khóa khác.', 'No matching screens found. Try another keyword.')}</p>}
        </nav>
        {dialog === 'menu' && <div className="portal-menu-settings">
          <PwaStatus mode="install" />
          <Link className="portal-menu-home" to="/" onClick={() => setDialog(null)}>{t('Về trang chủ SÖL', 'Back to SÖL Home')}</Link>
        </div>}
      </Modal>}
      {confirmDialog}
    </div>
  </div>;
}
