package com.swp391.scms.shop;

import com.swp391.scms.shop.entity.Product;
import com.swp391.scms.shop.entity.ProductVariant;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/** Bộ kiểm thử cho ProductEntityMapping (product entity mapping). */
class ProductEntityMappingTest {

    /** Kiểm thử: giá mỗi khẩu phần làm tròn half-up và trả null khi thiếu số khẩu phần. */
    @Test
    void pricePerServingRoundsHalfUpAndReturnsNullWhenServingsMissing() {
        ProductVariant variant = new ProductVariant();
        variant.setPrice(new BigDecimal("1290000"));
        variant.setServingsPerContainer(68);
        assertThat(variant.pricePerServing()).isEqualByComparingTo("18971");

        variant.setServingsPerContainer(null);
        assertThat(variant.pricePerServing()).isNull();

        variant.setServingsPerContainer(0);
        assertThat(variant.pricePerServing()).isNull();
    }

    /** Kiểm thử: sản phẩm mặc định là đang hoạt động và không nổi bật. */
    @Test
    void productDefaultsToActiveAndNotFeatured() {
        Product product = new Product();
        assertThat(product.isActive()).isTrue();
        assertThat(product.isFeatured()).isFalse();
    }
}
