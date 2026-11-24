package com.swp391.scms.shop;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.*;
import com.swp391.scms.shop.controller.*;
import com.swp391.scms.shop.service.ProductCatalogService;
import com.swp391.scms.shop.service.ProductOrderExpiryScheduler;
import com.swp391.scms.shop.service.QuoteService;
import com.swp391.scms.users.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Bộ kiểm thử cho ShopModuleDisabled (shop module disabled). */
@WebMvcTest(PublicProductController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class})
class ShopModuleDisabledTest {

    @Autowired MockMvc mvc;
    @MockitoBean ProductCatalogService catalog;
    @MockitoBean QuoteService quotes;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    /** Hàm trợ giúp của test: tạo actor hội viên. */
    private static UsernamePasswordAuthenticationToken memberActor() {
        return new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(10L, "member", "MEMBER"),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_MEMBER"))
        );
    }

    /** Kiểm thử: mọi controller và scheduler của shop mặc định bị tắt. */
    @Test
    void allShopControllersAndSchedulersAreDisabledByDefault() throws Exception {
        List<Class<?>> guardedBeans = List.of(
                ManagerCategoryController.class,
                ManagerProductController.class,
                PublicGeoController.class,
                PublicProductController.class,
                ShopAddressController.class,
                ShopOrderController.class,
                StaffProductOrderController.class,
                ProductOrderExpiryScheduler.class,
                ProductSeeder.class
        );
        for (Class<?> beanClass : guardedBeans) {
            ConditionalOnProperty condition = beanClass.getAnnotation(ConditionalOnProperty.class);
            assertThat(condition).as("ConditionalOnProperty on %s", beanClass.getSimpleName()).isNotNull();
            assertThat(condition.name()).containsExactly("app.shop.enabled");
            assertThat(condition.havingValue()).isEqualTo("true");
            assertThat(condition.matchIfMissing()).isFalse();
        }

        mvc.perform(get("/api/v1/public/products").with(authentication(memberActor())))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/shop/orders").with(authentication(memberActor())))
                .andExpect(status().isNotFound());
    }
}
