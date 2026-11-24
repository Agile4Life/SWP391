package com.swp391.scms.shop.service;

import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.shop.entity.ProductOrder;
import com.swp391.scms.shop.entity.ProductOrderItem;
import com.swp391.scms.shop.entity.ProductVariant;
import com.swp391.scms.shop.entity.StockMovement;
import com.swp391.scms.shop.repository.ProductVariantRepository;
import com.swp391.scms.shop.repository.StockMovementRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Quản lý tồn kho biến thể: giữ hàng khi đặt đơn, trả hàng khi hủy và ghi lịch sử biến động. */
@Service
@Transactional
public class StockService {
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ProductVariantRepository variants;
    private final StockMovementRepository movements;
    private final UserRepository users;
    private final Clock clock;

    /** Constructor rút gọn: không có UserRepository, dùng giờ Việt Nam. */
    public StockService(ProductVariantRepository variants, StockMovementRepository movements) {
        this(variants, movements, null, Clock.system(VN_ZONE));
    }

    /** Constructor rút gọn: không có UserRepository, nhận Clock. */
    public StockService(ProductVariantRepository variants, StockMovementRepository movements, Clock clock) {
        this(variants, movements, null, clock);
    }

    /** Constructor chính: nhận repository biến thể, lịch sử tồn, người dùng (tùy chọn) và Clock. */
    @Autowired
    public StockService(ProductVariantRepository variants,
                        StockMovementRepository movements,
                        @Autowired(required = false) UserRepository users,
                        Clock clock) {
        this.variants = variants;
        this.movements = movements;
        this.users = users;
        this.clock = clock != null ? clock : Clock.system(VN_ZONE);
    }

    /**
     * Giữ hàng cho đơn: khóa các biến thể, báo hết hàng nếu không đủ tồn, trừ tồn và ghi biến động
     * order_reserve.
     */
    public void reserve(ProductOrder order, Map<Long, Integer> qtyByVariant, Long actorId) {
        Map<Long, ProductVariant> byId = new HashMap<>();
        if (order != null && order.getItems() != null) {
            for (ProductOrderItem item : order.getItems()) {
                if (item.getVariant() != null && item.getVariant().getId() != null) {
                    byId.put(item.getVariant().getId(), item.getVariant());
                }
            }
        }
        if (byId.size() < qtyByVariant.size()) {
            for (ProductVariant v : variants.findAllByIdInForUpdate(qtyByVariant.keySet())) {
                byId.put(v.getId(), v);
            }
        }
        User actor = resolveActor(actorId);
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), VN_ZONE);
        for (Map.Entry<Long, Integer> entry : qtyByVariant.entrySet()) {
            ProductVariant variant = byId.get(entry.getKey());
            int q = entry.getValue();
            if (variant == null
                    || !variant.isActive()
                    || (variant.getProduct() != null && !variant.getProduct().isActive())
                    || (variant.getProduct() != null && variant.getProduct().getCategory() != null && !variant.getProduct().getCategory().isActive())
                    || variant.getStock() < q) {
                throw new ConflictException("PRODUCT_OUT_OF_STOCK", "error.shop.product_out_of_stock", null, "Out of stock");
            }
            variant.setStock(variant.getStock() - q);
            StockMovement movement = new StockMovement();
            movement.setVariant(variant);
            movement.setDelta(-q);
            movement.setReason("order_reserve");
            movement.setOrderId(order != null ? order.getId() : null);
            movement.setActor(actor);
            movement.setCreatedAt(now);
            movements.save(movement);
        }
    }

    /**
     * Trả hàng của đơn về kho (chỉ một lần, bỏ qua nếu đã có biến động order_release): khóa biến thể theo id
     * tăng dần, cộng tồn và ghi lịch sử.
     */
    public void release(ProductOrder order, Long actorId) {
        if (order == null || order.getItems() == null || order.getItems().isEmpty()) {
            return;
        }
        if (order.getId() != null && movements.existsByOrderIdAndReason(order.getId(), "order_release")) {
            return;
        }
        List<Long> ids = order.getItems().stream()
                .filter(i -> i.getVariant() != null && i.getVariant().getId() != null)
                .map(i -> i.getVariant().getId())
                .distinct()
                .sorted()
                .toList();
        Map<Long, ProductVariant> byId = new HashMap<>();
        if (!ids.isEmpty()) {
            List<ProductVariant> locked = variants.findAllByIdInForUpdate(ids);
            if (locked != null) {
                for (ProductVariant v : locked) {
                    byId.put(v.getId(), v);
                }
            }
        }
        User actor = resolveActor(actorId);
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), VN_ZONE);
        for (ProductOrderItem item : order.getItems()) {
            ProductVariant variant = item.getVariant() != null
                    ? byId.getOrDefault(item.getVariant().getId(), item.getVariant())
                    : null;
            if (variant != null) {
                variant.setStock(variant.getStock() + item.getQuantity());
                StockMovement movement = new StockMovement();
                movement.setVariant(variant);
                movement.setDelta(item.getQuantity());
                movement.setReason("order_release");
                movement.setOrderId(order.getId());
                movement.setActor(actor);
                movement.setCreatedAt(now);
                movements.save(movement);
            }
        }
    }

    /** Lấy người thực hiện theo id (không có thì null). */
    private User resolveActor(Long actorId) {
        if (actorId == null || users == null) {
            return null;
        }
        return users.findById(actorId).orElse(null);
    }
}
