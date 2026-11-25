package com.swp391.scms.shop.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.service.VnpayPaymentGuard;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.shop.ShopProperties;
import com.swp391.scms.shop.dto.OrderDtos.CreateOrderRequest;
import com.swp391.scms.shop.dto.OrderDtos.OrderDto;
import com.swp391.scms.shop.dto.OrderDtos.OrderSummaryDto;
import com.swp391.scms.shop.entity.OrderStatus;
import com.swp391.scms.shop.entity.ProductOrder;
import com.swp391.scms.shop.entity.ProductOrderItem;
import com.swp391.scms.shop.entity.ProductVariant;
import com.swp391.scms.shop.mapper.OrderMapper;
import com.swp391.scms.shop.repository.ProductOrderRepository;
import com.swp391.scms.shop.repository.ProductVariantRepository;
import com.swp391.scms.shop.service.AddressService.ShippingSnapshot;
import com.swp391.scms.shop.service.QuoteService.Priced;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Nghiệp vụ đơn hàng shop của hội viên: đặt đơn chống gửi trùng, xem/hủy đơn và hủy tự động đơn quá hạn thanh
 * toán.
 */
@ConditionalOnProperty(name = "app.shop.enabled", havingValue = "true")
@Service
public class ProductOrderService {
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Kết quả đặt đơn: đơn đã tạo (hoặc đơn cũ cùng clientRequestId) và có phải vừa tạo mới không. */
    public record CreateResult(OrderDto order, boolean created) {}

    private final ProductOrderRepository orders;
    private final ProductVariantRepository variants;
    private final MemberRepository members;
    private final QuoteService quotes;
    private final AddressService addresses;
    private final StockService stock;
    private final OrderCodeGenerator codes;
    private final OrderMapper mapper;
    private final ShopProperties props;
    private final Clock clock;

    @Autowired(required = false)
    private com.swp391.scms.membership.service.MemberDiscountService memberDiscounts;

    private VnpayPaymentGuard guard;
    private PaymentRepository payments;
    private ProductOrderRefunds refunds;
    private NotificationService notifications;
    private MessageService messages;
    private TransactionTemplate requiresNewTx;

    /** Constructor rút gọn không có các phụ thuộc tùy chọn (dùng trong test). */
    public ProductOrderService(ProductOrderRepository orders,
                               ProductVariantRepository variants,
                               MemberRepository members,
                               QuoteService quotes,
                               AddressService addresses,
                               StockService stock,
                               OrderCodeGenerator codes,
                               OrderMapper mapper,
                               ShopProperties props,
                               Clock clock) {
        this(orders, variants, members, quotes, addresses, stock, codes, mapper, props, clock,
                null, null, null, null, null, null);
    }

    /**
     * Constructor chính: nhận các repository và service bắt buộc cùng VnpayPaymentGuard, thanh toán, hoàn tiền,
     * thông báo, MessageService và transaction manager (tùy chọn).
     */
    @Autowired
    public ProductOrderService(ProductOrderRepository orders,
                               ProductVariantRepository variants,
                               MemberRepository members,
                               QuoteService quotes,
                               AddressService addresses,
                               StockService stock,
                               OrderCodeGenerator codes,
                               OrderMapper mapper,
                               ShopProperties props,
                               Clock clock,
                               @Autowired(required = false) VnpayPaymentGuard guard,
                               @Autowired(required = false) PaymentRepository payments,
                               @Autowired(required = false) ProductOrderRefunds refunds,
                               @Autowired(required = false) NotificationService notifications,
                               @Autowired(required = false) MessageService messages,
                               @Autowired(required = false) PlatformTransactionManager txManager) {
        this.orders = orders;
        this.variants = variants;
        this.members = members;
        this.quotes = quotes;
        this.addresses = addresses;
        this.stock = stock;
        this.codes = codes;
        this.mapper = mapper;
        this.props = props;
        this.clock = clock != null ? clock : Clock.system(VN_ZONE);
        this.guard = guard;
        this.payments = payments;
        this.refunds = refunds;
        this.notifications = notifications;
        this.messages = messages;
        if (txManager != null) {
            TransactionTemplate tpl = new TransactionTemplate(txManager);
            tpl.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            this.requiresNewTx = tpl;
        }
    }

    /** Gán giá trị mới cho trường guard. */
    public void setGuard(VnpayPaymentGuard guard) {
        this.guard = guard;
    }

    /** Gán giá trị mới cho trường payments. */
    public void setPayments(PaymentRepository payments) {
        this.payments = payments;
    }

    /** Gán giá trị mới cho trường refunds. */
    public void setRefunds(ProductOrderRefunds refunds) {
        this.refunds = refunds;
    }

    /** Gán giá trị mới cho trường notifications. */
    public void setNotifications(NotificationService notifications) {
        this.notifications = notifications;
    }

    /** Gán giá trị mới cho trường messages. */
    public void setMessages(MessageService messages) {
        this.messages = messages;
    }

    /**
     * Đặt đơn trong transaction riêng; nếu trùng clientRequestId do gửi đồng thời thì trả về đơn đã có thay vì
     * lỗi.
     */
    public CreateResult createIdempotent(AuthenticatedPrincipal principal, CreateOrderRequest request) {
        try {
            if (requiresNewTx != null) {
                return requiresNewTx.execute(status -> create(principal, request));
            }
            return create(principal, request);
        } catch (DataIntegrityViolationException ex) {
            if (principal != null && request != null && request.clientRequestId() != null) {
                Optional<ProductOrder> existing = orders.findByMember_UserIdAndClientRequestId(
                        principal.id(), request.clientRequestId());
                if (existing.isPresent()) {
                    return new CreateResult(mapper.toDto(existing.get(), false), false);
                }
            }
            throw ex;
        }
    }

    /**
     * Đặt đơn: chỉ hội viên đang hoạt động; trả lại đơn cũ nếu trùng clientRequestId; kiểm tra hình thức
     * nhận/thanh toán, khóa biến thể, tính giá, so với tổng dự kiến, chụp địa chỉ (có thể lưu), sinh mã, đặt
     * hạn thanh toán và giữ hàng.
     */
    @Transactional
    public CreateResult create(AuthenticatedPrincipal principal, CreateOrderRequest request) {
        requireMember(principal);
        Member member = members.findByUserIdForUpdate(principal.id())
                .filter(m -> m.getUser() != null
                        && m.getUser().getDeletedAt() == null
                        && (m.getUser().getStatus() == null || "active".equalsIgnoreCase(m.getUser().getStatus())))
                .orElseThrow(ProductOrderService::memberRequired);

        if (request == null || request.clientRequestId() == null || request.clientRequestId().isBlank()) {
            throw new BadRequestException("FULFILLMENT_INVALID", "error.shop.fulfillment_invalid", null, "Invalid clientRequestId");
        }

        Optional<ProductOrder> existing = orders.findByMember_UserIdAndClientRequestId(
                principal.id(), request.clientRequestId());
        if (existing.isPresent()) {
            return new CreateResult(mapper.toDto(existing.get(), false), false);
        }

        validateFulfillment(request);
        Map<Long, Integer> qty = QuoteService.merge(request.items());
        List<ProductVariant> locked = variants.findAllByIdInForUpdate(qty.keySet());
        int discountPercent = memberDiscounts != null ? memberDiscounts.percentFor(principal.id()) : 0;
        Priced priced = quotes.price(request.items(), locked, request.fulfillment(), discountPercent);
        if (priced.lines().stream().anyMatch(l -> l.problem() != null)) {
            throw new ConflictException("PRODUCT_OUT_OF_STOCK", "error.shop.product_out_of_stock", null, "Out of stock");
        }
        if (request.expectedTotal() == null
                || priced.total().compareTo(request.expectedTotal().setScale(0, RoundingMode.HALF_UP)) != 0) {
            throw new ConflictException("ORDER_PRICE_CHANGED", "error.shop.order_price_changed", null, "Price changed");
        }

        ShippingSnapshot ship = "delivery".equals(request.fulfillment())
                ? (request.addressId() != null
                        ? addresses.snapshot(principal.id(), request.addressId())
                        : addresses.snapshot(request.shippingAddress()))
                : null;
        if (ship != null && request.addressId() == null && request.saveAddress()) {
            addresses.createIfRoom(principal.id(), request.shippingAddress());
        }

        LocalDateTime now = now();
        ProductOrder order = new ProductOrder();
        order.setMember(member);
        order.setClientRequestId(request.clientRequestId());
        order.setCode(codes.next(now.toLocalDate()));
        order.setStatus(OrderStatus.pending_payment.name());
        order.setFulfillment(request.fulfillment());
        order.setPaymentMethod(request.paymentMethod());
        // subtotal là số hội viên trả cho sản phẩm, nên total = subtotal + phí ship vẫn đúng.
        order.setSubtotal(priced.subtotal().subtract(priced.discountAmount()));
        order.setMemberDiscountPercent(priced.discountPercent() > 0 ? priced.discountPercent() : null);
        order.setMemberDiscountAmount(priced.discountPercent() > 0 ? priced.discountAmount() : null);
        order.setShippingFee(priced.shippingFee());
        order.setTotal(priced.total());
        order.applyShipping(ship);
        order.setPaymentDueAt("counter".equals(request.paymentMethod())
                ? now.plusHours(props.counterHoldHours())
                : now.plusMinutes(props.paymentWindowMinutes()));
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        priced.lines().forEach(l -> order.addItem(ProductOrderItem.snapshot(l.variant(), l.quantity())));

        ProductOrder saved = orders.saveAndFlush(order);
        if (saved == null) {
            saved = order;
        }
        stock.reserve(saved, qty, principal.id());
        return new CreateResult(mapper.toDto(saved, false), true);
    }

    /**
     * Danh sách đơn của hội viên theo nhóm (all, pending, active, done/completed, cancelled), tối đa 20 mỗi
     * trang.
     */
    @Transactional(readOnly = true)
    public Page<OrderSummaryDto> myOrders(Long userId, String group, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.clamp(size, 1, 20);
        Pageable pageable = PageRequest.of(safePage, safeSize);
        if (group == null || group.isBlank() || "all".equalsIgnoreCase(group)) {
            return orders.findByMember_UserIdOrderByCreatedAtDescIdDesc(userId, pageable)
                    .map(mapper::toSummaryDto);
        }
        List<String> statuses = switch (group.trim().toLowerCase()) {
            case "pending" -> List.of(OrderStatus.pending_payment.name());
            case "active" -> List.of(
                    OrderStatus.paid.name(),
                    OrderStatus.processing.name(),
                    OrderStatus.shipping.name(),
                    OrderStatus.ready_for_pickup.name()
            );
            case "done", "completed" -> List.of(OrderStatus.completed.name());
            case "cancelled" -> List.of(OrderStatus.cancelled.name());
            default -> List.of(group.trim().toLowerCase());
        };
        return orders.findByMember_UserIdAndStatusInOrderByCreatedAtDescIdDesc(userId, statuses, pageable)
                .map(mapper::toSummaryDto);
    }

    /** Chi tiết một đơn của hội viên; đơn của người khác thì báo không tìm thấy. */
    @Transactional(readOnly = true)
    public OrderDto myOrder(Long userId, Long id) {
        ProductOrder order = orders.findByIdAndMember_UserId(id, userId)
                .or(() -> orders.findById(id).filter(o -> o.getMember() != null && userId.equals(o.getMember().getUserId())))
                .orElseThrow(ProductOrderService::notFound);
        return mapper.toDto(order, false);
    }

    /**
     * Hội viên hủy đơn: chỉ đơn chờ thanh toán (không đang chờ VNPay xác nhận) hoặc đã thanh toán; hoàn kho và
     * hoàn tiền nếu đã trả.
     */
    @Transactional
    public OrderDto cancelByMember(Long userId, Long id, String reason) {
        members.findByUserIdForUpdate(userId);
        ProductOrder order = orders.findByIdForUpdate(id).orElseThrow(ProductOrderService::notFound);
        if (order.getMember() == null || !userId.equals(order.getMember().getUserId())) {
            throw notFound();
        }
        if (OrderStatus.pending_payment.name().equals(order.getStatus())) {
            if (guard != null) {
                try {
                    guard.productOrder(order.getId());
                } catch (ConflictException ex) {
                    throw new ConflictException("ORDER_AWAITING_PAYMENT", "error.shop.order_awaiting_payment", null, "Order awaiting VNPay confirmation");
                }
            }
        } else if (!OrderStatus.paid.name().equals(order.getStatus())) {
            throw new ConflictException("ORDER_INVALID_TRANSITION", "error.shop.order_invalid_transition", null, "Order cannot be cancelled in its current status");
        }
        String finalReason = (reason == null || reason.isBlank()) ? "Hội viên hủy đơn" : reason.trim();
        cancelInternal(order, finalReason, true, order.getMember().getUser());
        return mapper.toDto(order, false);
    }

    /**
     * Hủy đơn nội bộ: ghi trạng thái/lý do/người hủy, hoàn kho nếu cần, đóng giao dịch chờ (failed), hoàn tiền
     * nếu đã thanh toán và thông báo hội viên.
     */
    @Transactional
    public void cancelInternal(ProductOrder order, String reason, boolean restock, User actor) {
        if (order == null || OrderStatus.cancelled.name().equals(order.getStatus())) {
            return;
        }
        LocalDateTime now = now();
        String previousStatus = order.getStatus();
        order.setStatus(OrderStatus.cancelled.name());
        order.setCancelledAt(now);
        order.setUpdatedAt(now);
        String trimmedReason = (reason != null && reason.length() > 255) ? reason.substring(0, 255) : reason;
        order.setCancelReason(trimmedReason);
        order.setCancelledBy(actor);

        if (restock) {
            stock.release(order, actor != null ? actor.getId() : null);
        }

        if (OrderStatus.pending_payment.name().equals(previousStatus)) {
            if (payments != null && order.getId() != null) {
                payments.findAllByProductOrderId(order.getId()).stream()
                        .filter(p -> "pending".equalsIgnoreCase(p.getStatus()))
                        .forEach(p -> {
                            p.setStatus("failed");
                            payments.save(p);
                        });
            }
        }

        BigDecimal refunded = BigDecimal.ZERO;
        if (!OrderStatus.pending_payment.name().equals(previousStatus) && refunds != null) {
            refunded = refunds.refundIfPaid(order, trimmedReason);
        }

        orders.save(order);

        if (notifications != null && order.getMember() != null) {
            String body = (refunded != null && refunded.signum() > 0)
                    ? msg("notifications.shop.refunded.body", order.getCode(), refunded.toPlainString())
                    : msg("notifications.shop.cancelled.body", order.getCode(), trimmedReason != null ? trimmedReason : "");
            notifications.send(
                    order.getMember().getUserId(),
                    msg("notifications.shop.cancelled.title", order.getCode()),
                    body,
                    "order",
                    "product_order",
                    order.getId(),
                    "/member/orders/" + order.getId()
            );
        }
    }

    /** Hủy các đơn quá hạn thanh toán, mỗi đơn trong transaction riêng; trả về số đơn đã hủy. */
    @Transactional
    public int expireUnpaid() {
        LocalDateTime now = now();
        List<ProductOrder> stale = orders.findExpiredUnpaid(now);
        if (stale == null || stale.isEmpty()) {
            return 0;
        }
        int cancelled = 0;
        for (ProductOrder candidate : stale) {
            Boolean didCancel = requiresNewTx != null
                    ? requiresNewTx.execute(status -> expireSingle(candidate))
                    : expireSingle(candidate);
            if (Boolean.TRUE.equals(didCancel)) {
                cancelled++;
            }
        }
        return cancelled;
    }

    /**
     * Hủy một đơn quá hạn: khóa hội viên và đơn, bỏ qua nếu không còn chờ thanh toán hoặc VNPay còn có thể xác
     * nhận.
     */
    private boolean expireSingle(ProductOrder candidate) {
        if (candidate.getMember() != null && candidate.getMember().getUserId() != null) {
            members.findByUserIdForUpdate(candidate.getMember().getUserId());
        }
        ProductOrder order = candidate.getId() != null
                ? orders.findByIdForUpdate(candidate.getId()).orElse(candidate)
                : candidate;
        if (!OrderStatus.pending_payment.name().equals(order.getStatus())) {
            return false;
        }
        if (guard != null && order.getId() != null) {
            try {
                guard.productOrder(order.getId());
            } catch (RuntimeException awaitingGateway) {
                return false;
            }
        }
        cancelInternal(order, msg("shop.auto_cancel.unpaid"), true, null);
        return true;
    }

    /**
     * Kiểm tra hình thức nhận (delivery/pickup), phương thức thanh toán (online/counter) — trả tại quầy chỉ khi
     * nhận tại quầy ; giao hàng cần đúng một trong addressId hoặc địa chỉ mới, nhận tại quầy thì không được kèm
     * địa chỉ.
     */
    private static void validateFulfillment(CreateOrderRequest request) {
        String fulfillment = request.fulfillment();
        String paymentMethod = request.paymentMethod();
        if (!"delivery".equals(fulfillment) && !"pickup".equals(fulfillment)) {
            throw new BadRequestException("FULFILLMENT_INVALID", "error.shop.fulfillment_invalid", null, "Invalid fulfillment");
        }
        if (!"online".equals(paymentMethod) && !"counter".equals(paymentMethod)) {
            throw new BadRequestException("PAYMENT_METHOD_NOT_ALLOWED", "error.shop.payment_method_not_allowed", null, "Invalid payment method");
        }
        if ("counter".equals(paymentMethod) && !"pickup".equals(fulfillment)) {
            throw new BadRequestException("PAYMENT_METHOD_NOT_ALLOWED", "error.shop.payment_method_not_allowed", null, "Pay at counter is only for pickup");
        }
        if ("delivery".equals(fulfillment)) {
            boolean hasId = request.addressId() != null;
            boolean hasInline = request.shippingAddress() != null;
            if (hasId == hasInline) {
                throw new BadRequestException("FULFILLMENT_INVALID", "error.shop.fulfillment_invalid", null, "Delivery requires exactly one of addressId or shippingAddress");
            }
        } else {
            if (request.addressId() != null || request.shippingAddress() != null) {
                throw new BadRequestException("FULFILLMENT_INVALID", "error.shop.fulfillment_invalid", null, "Pickup cannot include shipping address");
            }
        }
    }

    /** Chỉ role MEMBER được đặt/xem đơn. */
    private static void requireMember(AuthenticatedPrincipal principal) {
        if (principal == null || !"MEMBER".equals(principal.role())) {
            throw memberRequired();
        }
    }

    /** Tạo lỗi chỉ hội viên được dùng shop. */
    private static ForbiddenException memberRequired() {
        return new ForbiddenException("SHOP_MEMBER_REQUIRED", "error.shop.member_required", null, "Members only");
    }

    /** Tạo lỗi không tìm thấy đơn hàng. */
    private static ResourceNotFoundException notFound() {
        return new ResourceNotFoundException("ORDER_NOT_FOUND", "error.shop.order_not_found", null, "Order not found");
    }

    /** Thời điểm hiện tại theo giờ Việt Nam. */
    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), VN_ZONE);
    }

    /** Dịch message key kèm tham số; không có MessageService thì trả lại key. */
    private String msg(String key, Object... args) {
        if (messages != null) {
            String resolved = messages.getMessage(key, args);
            if (resolved != null && !resolved.isBlank()) {
                return resolved;
            }
        }
        return key;
    }
}
