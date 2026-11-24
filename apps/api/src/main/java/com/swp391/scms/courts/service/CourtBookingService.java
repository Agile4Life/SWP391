package com.swp391.scms.courts.service;

import com.swp391.scms.common.exception.*;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.PackageBenefits;
import com.swp391.scms.courts.dto.CourtBookingRequests.BookRequest;
import com.swp391.scms.courts.dto.CourtBookingResponses.*;
import com.swp391.scms.courts.entity.CourtBooking;
import com.swp391.scms.courts.repository.CourtBookingRepository;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.facilities.repository.RoomRepository;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Nghiệp vụ đặt sân: danh sách sân, khung giờ trống, đặt/hủy, hạn mức theo gói, thanh toán tại quầy/VNPay và
 * nhả chỗ chưa thanh toán.
 */
@Service
@Transactional(readOnly = true)
public class CourtBookingService {
    private final com.swp391.scms.finance.service.VnpayPaymentGuard vnpayGuard;
    private static final ZoneId CENTER_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Set<String> COURT_DISCIPLINES = Set.of("Tennis", "Cầu lông", "Bơi lội");
    private static final Set<String> STAFF_ROLES = Set.of("CENTER_MANAGER", "RECEPTIONIST", "STAFF");
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.scheduling.service.MemberScheduleGuard scheduleGuard;

    private final CourtBookingRepository bookings;
    private final RoomRepository rooms;
    private final MembershipSubscriptionRepository subscriptions;
    private final MemberRepository members;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private MessageService messages;

    /** Tùy chọn để service vẫn dựng được trong unit test; thiếu nó thì không ghi dòng doanh thu. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private PaymentRepository payments;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.wallet.WalletService wallets;
    @org.springframework.beans.factory.annotation.Value("${app.vnpay.timeout-minutes:15}")
    private int vnpayTimeoutMinutes = 15;
    /** Lượt đặt quầy chưa trả được nhả trước giờ bắt đầu khoảng này, để khung giờ đặt lại được. */
    @org.springframework.beans.factory.annotation.Value("${app.courts.cash-release-lead-minutes:120}")
    private int cashReleaseLeadMinutes = 120;
    /** ...nhưng không bao giờ sớm hơn khoảng này sau khi tạo, để lượt đặt sát giờ vẫn còn thời gian thanh toán. */
    @org.springframework.beans.factory.annotation.Value("${app.courts.cash-min-hold-minutes:30}")
    private int cashMinHoldMinutes = 30;
    private static final Set<String> PAYMENT_METHODS = Set.of("cash", "vnpay");

    /** Constructor rút gọn không có VnpayPaymentGuard (dùng trong test). */
    public CourtBookingService(CourtBookingRepository bookings, RoomRepository rooms,
                               MembershipSubscriptionRepository subscriptions, MemberRepository members, Clock clock) {
        this(bookings, rooms, subscriptions, members, clock, null);
    }

    /** Constructor chính: nhận repository đặt sân, phòng, gói, hội viên, Clock và VnpayPaymentGuard. */
    @org.springframework.beans.factory.annotation.Autowired
    public CourtBookingService(CourtBookingRepository bookings, RoomRepository rooms,
                               MembershipSubscriptionRepository subscriptions, MemberRepository members, Clock clock,
                               com.swp391.scms.finance.service.VnpayPaymentGuard vnpayGuard) {
        this.vnpayGuard = vnpayGuard;
        this.bookings = bookings; this.rooms = rooms; this.subscriptions = subscriptions;
        this.members = members; this.clock = clock;
    }

    /** True nếu tên bộ môn là môn có sân (Tennis, Cầu lông, Bơi lội). */
    public static boolean isCourtDiscipline(String name) { return COURT_DISCIPLINES.contains(name); }
    /** True nếu thời điểm đúng tròn giờ (phút, giây, nano đều bằng 0). */
    private static boolean wholeHour(LocalTime time) {
        return time != null && time.getMinute() == 0 && time.getSecond() == 0 && time.getNano() == 0;
    }
    /** Giờ mở/đóng cửa hợp lệ: cả hai tròn giờ và giờ mở trước giờ đóng. */
    public static boolean validHours(LocalTime open, LocalTime close) {
        return wholeHour(open) && wholeHour(close) && open.isBefore(close);
    }
    /** Thời điểm hiện tại theo giờ Việt Nam. */
    private LocalDateTime now() { return LocalDateTime.ofInstant(clock.instant(), CENTER_ZONE); }
    /** Tạo BadRequestException với mã COURT_BOOKING_* và message key error.courts.*. */
    private static BadRequestException invalid(String suffix, Object... args) {
        return new BadRequestException("COURT_BOOKING_" + suffix.toUpperCase(Locale.ROOT), "error.courts." + suffix,
                args == null || args.length == 0 ? null : args, null);
    }
    /** Tạo ConflictException với mã COURT_BOOKING_* và message key error.courts.*. */
    private static ConflictException conflict(String suffix, Object... args) {
        return new ConflictException("COURT_BOOKING_" + suffix.toUpperCase(Locale.ROOT), "error.courts." + suffix,
                args == null || args.length == 0 ? null : args, null);
    }
    /** Tạo ForbiddenException với mã COURT_BOOKING_* và message key error.courts.*. */
    private static ForbiddenException forbidden(String suffix) {
        return new ForbiddenException("COURT_BOOKING_" + suffix.toUpperCase(Locale.ROOT), "error.courts." + suffix, null, null);
    }
    /** Tạo lỗi 404 khi không tìm thấy sân hoặc lượt đặt. */
    private static AppException notFound() {
        return new AppException(HttpStatus.NOT_FOUND, "COURT_BOOKING_NOT_FOUND", "error.courts.not_found", null, null);
    }
    /**
     * Chỉ chặn ngày trống hoặc ở quá khứ; giới hạn đặt trước bao xa tùy hạng gói (xem bookOne).
     *
     * Chỉ từ chối ngày thiếu/quá khứ; hội viên được đặt trước bao xa phụ thuộc hạng gói (xem bookOne).
     */
    private void dateWindow(LocalDate date) {
        if (date == null) throw invalid("invalid_slot");
        if (date.isBefore(now().toLocalDate())) throw invalid("past_slot");
    }
    /** Lấy sân theo id: phải tồn tại, đang available, thuộc môn có sân và có giờ mở cửa hợp lệ. */
    private Room court(Long id) {
        if (id == null) throw invalid("invalid_court");
        Room room = rooms.findById(id).orElseThrow(CourtBookingService::notFound);
        if (!"available".equals(room.getStatus())) throw conflict("court_unavailable");
        if (room.getDiscipline() == null || !isCourtDiscipline(room.getDiscipline().getName())
                || !validHours(room.getOpenTime(), room.getCloseTime())) throw invalid("invalid_court");
        return room;
    }

    /** Danh sách sân đang mở, lọc theo tên bộ môn (rỗng là tất cả). */
    public List<CourtDto> listCourts(String discipline) {
        return rooms.findAvailableCourts(discipline == null ? "" : discipline.trim()).stream()
                .map(r -> new CourtDto(r.getId(), r.getName(), r.getLocation(), r.getDiscipline().getId(),
                        r.getDiscipline().getName(), r.getOpenTime(), r.getCloseTime())).toList();
    }

    /** Các khung 1 giờ của sân trong ngày: đánh dấu đã qua, có lớp học, đã đặt hoặc trống, kèm giá. */
    public List<SlotDto> availability(Long roomId, LocalDate date) {
        dateWindow(date);
        Room room = court(roomId);
        var existing = bookings.findRoomBookings(roomId, date);
        var classes = bookings.findRoomClasses(roomId, date);
        LocalDateTime current = now();
        List<SlotDto> result = new ArrayList<>();
        for (LocalTime start = room.getOpenTime(); start.isBefore(room.getCloseTime()); start = start.plusHours(1)) {
            LocalTime end = start.plusHours(1);
            final LocalTime slotStart = start;
            String status = !date.atTime(start).isAfter(current) ? "past"
                    : classes.stream().anyMatch(s -> overlaps(slotStart, end, s.getStartTime(), s.getEndTime())) ? "class"
                    : existing.stream().anyMatch(b -> overlaps(slotStart, end, b.getStartTime(), b.getEndTime())) ? "booked" : "free";
            result.add(new SlotDto(start, end, status, CourtPricing.priceFor(start)));
        }
        return result;
    }

    /** True nếu hai khoảng giờ giao nhau. */
    private static boolean overlaps(LocalTime start, LocalTime end, LocalTime otherStart, LocalTime otherEnd) {
        return start.isBefore(otherEnd) && end.isAfter(otherStart);
    }

    /** Hội viên đặt một khung sân theo yêu cầu. */
    @Transactional
    public BookingDto book(AuthenticatedPrincipal principal, BookRequest request) {
        return bookOne(principal, request.roomId(), request.date(), request.startTime(), request.paymentMethod());
    }

    /**
     * Đặt một khung sân: chỉ MEMBER, ngày/giờ hợp lệ trong giờ mở cửa, gói còn hiệu lực, trong giới hạn đặt
     * trước và số lượt sắp tới, không trùng sân/lịch hội viên; còn hạn mức thì miễn phí, hết thì phải chọn
     * phương thức trả tiền.
     */
    private BookingDto bookOne(AuthenticatedPrincipal principal, Long roomId, LocalDate date, LocalTime start,
                               String paymentMethod) {
        if (principal == null || !"MEMBER".equals(principal.role())) throw forbidden("forbidden");
        dateWindow(date);
        if (!wholeHour(start)) throw invalid("invalid_slot");
        if (!date.atTime(start).isAfter(now())) throw invalid("past_slot");
        Room room = court(roomId);
        LocalTime end = start.plusHours(1);
        if (start.isBefore(room.getOpenTime()) || !end.isAfter(start) || end.isAfter(room.getCloseTime())) throw invalid("invalid_slot");
        Member member = members.findByUserIdForUpdate(principal.id()).orElseThrow(() -> forbidden("membership_invalid"));
        if (subscriptions.existsApprovedHoldCovering(principal.id(), date)) throw forbidden("membership_on_hold");
        if (member.getUser().getDeletedAt() != null || !"active".equals(member.getUser().getStatus())
                || !subscriptions.hasActiveMembershipCoveringSession(principal.id(), now().toLocalDate(), date)) {
            throw forbidden("membership_invalid");
        }
        // Quy tắc theo hạng gói (PackageBenefits): đặt trước được bao xa, và được mở bao nhiêu lượt cùng lúc.
        MembershipSubscription plan = activeSubscription(principal.id(), now().toLocalDate());
        com.swp391.scms.facilities.entity.MembershipPackage pkg = plan == null ? null : plan.getMembershipPackage();
        int advanceDays = com.swp391.scms.facilities.PackageBenefits.courtAdvanceDays(pkg);
        if (date.isAfter(now().toLocalDate().plusDays(advanceDays))) throw invalid("too_far", advanceDays);
        int maxUpcoming = com.swp391.scms.facilities.PackageBenefits.courtMaxUpcoming(pkg);
        if (bookings.countUpcomingBooked(principal.id(), now().toLocalDate(), now().toLocalTime()) >= maxUpcoming) {
            throw conflict("upcoming_limit", maxUpcoming);
        }
        if (bookings.existsRoomOverlap(room.getId(), date, start, end)
                || bookings.existsClassOverlap(room.getId(), date, start, end)
                || bookings.existsMemberOverlap(principal.id(), date, start, end)) throw conflict("slot_taken");
        if (scheduleGuard != null) scheduleGuard.ensureFree(principal.id(), date, start, end, null);
        String method = paymentMethod == null || paymentMethod.isBlank()
                || CourtPricing.PACKAGE_QUOTA.equalsIgnoreCase(paymentMethod.trim())
                ? null : paymentMethod.trim().toLowerCase(Locale.ROOT);
        if (method != null && !PAYMENT_METHODS.contains(method)) throw invalid("invalid_payment_method");
        BigDecimal price = CourtPricing.priceFor(start);
        // Gói bao phủ các lượt đặt đầu tiên của tháng; mọi sân hoặc giờ thêm đều trả khi đặt.
        boolean covered = quotaUsed(principal.id(), date) < monthlyQuota(principal.id(), date);
        if (!covered && method == null) throw invalid("payment_required");
        if (!covered) {
            int maxUnpaid = maxUnpaidHolds(principal.id(), date);
            if (bookings.countUnpaidHolds(principal.id(), now().toLocalDate()) >= maxUnpaid) throw conflict("unpaid_limit", maxUnpaid);
        }
        CourtBooking booking = new CourtBooking(); booking.setRoom(room); booking.setMember(member.getUser());
        booking.setBookingDate(date); booking.setStartTime(start); booking.setEndTime(end); booking.setCreatedAt(now());
        booking.setPrice(covered ? BigDecimal.ZERO : price);
        booking.setPaymentMethod(covered ? CourtPricing.PACKAGE_QUOTA : method);
        booking.setPaymentStatus(covered ? "covered" : "pending");
        CourtBooking saved = bookings.saveAndFlush(booking);
        if (!covered && payments != null) {
            Payment payment = new Payment();
            payment.setMember(member); payment.setAmount(price); payment.setMethod("vnpay".equals(method) ? "online_wallet" : "cash"); payment.setStatus("pending");
            payment.setCourtBookingId(saved.getId());
            payment.setNote("Court #" + saved.getId());
            payments.save(payment);
        }
        return dto(saved, principal);
    }

    /** Chu kỳ gói active phủ ngày cho trước; nếu nhiều thì chọn gói có hạn mức sân cao nhất. */
    private MembershipSubscription activeSubscription(Long memberId, LocalDate date) {
        return subscriptions.findByMemberUserIdAndStatus(memberId, "active").stream()
                .filter(s -> s.getStartDate() != null && s.getEndDate() != null
                        && !s.getStartDate().isAfter(date) && !s.getEndDate().isBefore(date))
                .max(Comparator.comparingInt(s -> s.getMembershipPackage() == null ? -1
                        : CourtPricing.cycleQuota(s.getMembershipPackage())))
                .orElse(null);
    }
    /** Số lượt đặt sân chưa thanh toán tối đa theo hạng gói. */
    private int maxUnpaidHolds(Long memberId, LocalDate date) {
        MembershipSubscription subscription = activeSubscription(memberId, date);
        return com.swp391.scms.facilities.PackageBenefits.courtMaxUnpaidHolds(subscription == null ? null : subscription.getMembershipPackage());
    }
    /** Số lượt đặt sân miễn phí mỗi chu kỳ của gói đang phủ ngày cho trước. */
    private int monthlyQuota(Long memberId, LocalDate date) {
        MembershipSubscription subscription = activeSubscription(memberId, date);
        return subscription == null || subscription.getMembershipPackage() == null ? 0
                : CourtPricing.cycleQuota(subscription.getMembershipPackage());
    }
    /** Số lượt đã dùng hạn mức trong chu kỳ gói chứa ngày cho trước. */
    private long quotaUsed(Long memberId, LocalDate date) {
        MembershipSubscription subscription = activeSubscription(memberId, date);
        if (subscription == null) return 0;
        return bookings.countQuotaUsage(memberId,
                PackageBenefits.cycleStart(subscription, date),
                PackageBenefits.cycleEnd(subscription, date),
                CourtPricing.PACKAGE_QUOTA);
    }

    /**
     * Hạn mức đặt sân của hội viên trong chu kỳ chứa ngày được chọn (mặc định hôm nay) cùng các giới hạn theo
     * hạng gói.
     *
     * Số lượt đặt đã bao gồm mà hội viên còn lại trong tháng của {@code date} (hôm nay khi null).
     */
    public QuotaDto quota(AuthenticatedPrincipal principal, LocalDate date) {
        if (principal == null || !"MEMBER".equals(principal.role())) throw forbidden("forbidden");
        LocalDate day = date == null ? now().toLocalDate() : date;
        MembershipSubscription subscription = activeSubscription(principal.id(), day);
        String name = subscription == null || subscription.getMembershipPackage() == null ? null
                : subscription.getMembershipPackage().getName();
        int total = subscription == null ? 0 : CourtPricing.cycleQuota(subscription.getMembershipPackage());
        int used = (int) quotaUsed(principal.id(), day);
        MembershipSubscription current = activeSubscription(principal.id(), now().toLocalDate());
        var currentPkg = current == null ? null : current.getMembershipPackage();
        LocalDate today = now().toLocalDate();
        return new QuotaDto(name, total, used, Math.max(0, total - used),
                com.swp391.scms.facilities.PackageBenefits.courtAdvanceDays(currentPkg),
                com.swp391.scms.facilities.PackageBenefits.courtMaxUpcoming(currentPkg),
                (int) bookings.countUpcomingBooked(principal.id(), today, now().toLocalTime()),
                com.swp391.scms.facilities.PackageBenefits.courtMaxUnpaidHolds(currentPkg),
                (int) bookings.countUnpaidHolds(principal.id(), today), cashReleaseLeadMinutes);
    }

    /** Lịch sử đặt sân của hội viên đang đăng nhập, mới nhất trước, phân trang. */
    public Page<BookingDto> my(AuthenticatedPrincipal principal, int page, int size) {
        return bookings.findByMemberIdOrderByBookingDateDescStartTimeDescIdDesc(principal.id(), page(page, size))
                .map(b -> dto(b, principal));
    }

    /** Nhân viên xem lượt đặt sân trong ngày (lọc theo sân nếu có), phân trang. */
    public Page<BookingDto> daily(AuthenticatedPrincipal principal, LocalDate date, Long roomId, int page, int size) {
        if (!STAFF_ROLES.contains(principal.role())) throw forbidden("forbidden");
        if (date == null) throw invalid("invalid_slot");
        Pageable pageable = page(page, size);
        Page<CourtBooking> found = roomId == null ? bookings.findDaily(date, pageable) : bookings.findDailyByRoom(date, roomId, pageable);
        return found.map(b -> dto(b, principal));
    }
    /** Tạo Pageable sau khi kiểm tra page ≥ 0 và size trong 1..100. */
    private Pageable page(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw invalid("invalid_slot");
        return PageRequest.of(page, size);
    }

    /**
     * Hủy lượt đặt sân: chủ sở hữu hoặc nhân viên, đúng hạn hủy; khoản chưa trả chuyển failed, khoản đã trả
     * hoàn vào ví.
     */
    @Transactional
    public BookingDto cancel(AuthenticatedPrincipal principal, Long id, String reason) {
        CourtBooking booking = bookings.findByIdForUpdate(id).orElseThrow(CourtBookingService::notFound);
        boolean staff = STAFF_ROLES.contains(principal.role());
        if (!staff && (!"MEMBER".equals(principal.role()) || !principal.id().equals(booking.getMember().getId()))) throw forbidden("forbidden");
        if ("cancelled".equals(booking.getStatus())) return dto(booking, principal);
        if (!canCancel(booking, principal)) throw invalid("cancel_too_late");
        if (reason != null && reason.length() > 255) throw invalid("invalid_slot");
        if (vnpayGuard != null) vnpayGuard.court(booking.getId());
        String trimmedReason = reason == null || reason.isBlank() ? null : reason.trim();
        BigDecimal refundedTotal = BigDecimal.ZERO;
        boolean hasPaymentRows = false;
        if (payments != null) {
            for (Payment payment : payments.findAllByCourtBookingId(booking.getId())) {
                hasPaymentRows = true;
                if ("pending".equals(payment.getStatus())) {
                    payment.setStatus("failed");
                } else if ("success".equals(payment.getStatus())) {
                    BigDecimal refundable = payment.netAmount();
                    if (refundable.compareTo(BigDecimal.ZERO) > 0) {
                        payment.setRefundedAmount(payment.getAmount());
                        payment.setStatus("refunded");
                        refundedTotal = refundedTotal.add(refundable);
                    }
                }
            }
        }
        if ("paid".equals(booking.getPaymentStatus())) {
            booking.setPaymentStatus("refunded");
            // Chỉ các lượt đặt cũ trả không có dòng thanh toán mới quay về dùng giá; thanh toán đã hoàn không
            // được trả hai lần.
            if (!hasPaymentRows && refundedTotal.compareTo(BigDecimal.ZERO) == 0
                    && booking.getPrice() != null && booking.getPrice().compareTo(BigDecimal.ZERO) > 0) {
                refundedTotal = booking.getPrice();
            }
        } else if (refundedTotal.compareTo(BigDecimal.ZERO) > 0) {
            booking.setPaymentStatus("refunded");
        }
        if (refundedTotal.compareTo(BigDecimal.ZERO) > 0 && wallets != null && booking.getMember() != null) {
            wallets.creditCourtRefund(booking.getMember().getId(), refundedTotal,
                    "COURT_REFUND_" + booking.getId(), trimmedReason);
        }
        booking.setStatus("cancelled"); booking.setCancelledAt(now());
        booking.setCancelReason(trimmedReason);
        return dto(bookings.saveAndFlush(booking), principal);
    }

    /**
     * Lễ tân xác nhận đã thu tiền mặt: lượt đặt chuyển paid và ghi nhận doanh thu.
     *
     * Quầy ghi nhận phí sân tại quầy (tiền mặt) đã thu: lượt đặt chuyển sang đã trả và doanh thu được ghi.
     */
    @Transactional
    public BookingDto confirmPayment(AuthenticatedPrincipal principal, Long id) {
        if (principal == null || !STAFF_ROLES.contains(principal.role())) throw forbidden("forbidden");
        CourtBooking booking = bookings.findByIdForUpdate(id).orElseThrow(CourtBookingService::notFound);
        if (!"booked".equals(booking.getStatus()) || !"pending".equals(booking.getPaymentStatus())
                || !"cash".equals(booking.getPaymentMethod())) throw conflict("payment_not_pending");
        booking.setPaymentStatus("paid");
        if (payments != null) {
            payments.findAllByCourtBookingId(id).stream().filter(payment -> "pending".equals(payment.getStatus()))
                    .forEach(payment -> { payment.setStatus("success"); payment.setPaidAt(now()); });
        }
        return dto(bookings.saveAndFlush(booking), principal);
    }

    /**
     * Nhả khung sân chưa thanh toán: VNPay quá thời gian chờ cổng, tiền mặt sắp tới giờ mà vẫn chưa trả; bỏ qua
     * khoản VNPay còn có thể xác nhận; trả về số lượt đã nhả.
     *
     * Giải phóng các khung bị giữ bởi lượt đặt chưa trả: lượt VNPay không trả trong thời gian chờ của cổng,
     * và lượt đặt quầy vẫn chưa trả {@code cashReleaseLeadMinutes} phút trước giờ bắt đầu (đã giữ ít nhất
     * {@code cashMinHoldMinutes}). Các lượt VNPay còn có thể xác nhận được để lại cho đối soát.
     */
    @Transactional
    public int expireUnpaid() {
        LocalDateTime current = now();
        List<CourtBooking> stale = new ArrayList<>(bookings.findUnpaidOnlineBefore(current.minusMinutes(vnpayTimeoutMinutes + 1L)));
        LocalDateTime releaseAt = current.plusMinutes(cashReleaseLeadMinutes);
        stale.addAll(bookings.findUnpaidCashDue(releaseAt.toLocalDate(), releaseAt.toLocalTime(), current.minusMinutes(cashMinHoldMinutes)));
        int cancelled = 0;
        for (CourtBooking booking : stale) {
            try {
                if (vnpayGuard != null) vnpayGuard.court(booking.getId());
            } catch (RuntimeException awaitingGateway) {
                continue;
            }
            if (payments != null) {
                payments.findAllByCourtBookingId(booking.getId()).stream()
                        .filter(payment -> "pending".equals(payment.getStatus()))
                        .forEach(payment -> payment.setStatus("failed"));
            }
            booking.setStatus("cancelled"); booking.setCancelledAt(current);
            booking.setCancelReason(messages != null ? messages.getMessage("courts.auto_cancel.unpaid") : "Unpaid");
            bookings.save(booking);
            cancelled++;
        }
        return cancelled;
    }

    /**
     * Có được hủy không: nhân viên được hủy trước giờ bắt đầu, hội viên chỉ được hủy lượt của mình trước giờ
     * bắt đầu ít nhất 2 tiếng.
     */
    private boolean canCancel(CourtBooking b, AuthenticatedPrincipal principal) {
        if (!"booked".equals(b.getStatus())) return false;
        LocalDateTime start = b.getBookingDate().atTime(b.getStartTime());
        if (STAFF_ROLES.contains(principal.role())) return start.isAfter(now());
        return "MEMBER".equals(principal.role()) && principal.id().equals(b.getMember().getId())
                && !start.isBefore(now().plusHours(2));
    }
    /** Chuyển lượt đặt sân sang DTO (giá null thành 0), kèm cờ được hủy theo người xem. */
    private BookingDto dto(CourtBooking b, AuthenticatedPrincipal principal) {
        return new BookingDto(b.getId(), b.getRoom().getId(), b.getRoom().getName(),
                b.getRoom().getDiscipline() == null ? null : b.getRoom().getDiscipline().getName(),
                b.getMember().getId(), b.getMember().getFullName(), b.getBookingDate(), b.getStartTime(), b.getEndTime(),
                b.getStatus(), b.getCreatedAt(), b.getCancelledAt(), b.getCancelReason(), canCancel(b, principal),
                b.getPrice() == null ? BigDecimal.ZERO : b.getPrice(), b.getPaymentMethod(), b.getPaymentStatus());
    }
}
