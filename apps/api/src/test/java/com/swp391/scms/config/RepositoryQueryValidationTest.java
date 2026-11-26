package com.swp391.scms.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.persistence.EntityManager;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.AnnotatedBeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AssignableTypeFilter;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.data.repository.Repository;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;

/**
 * Bộ kiểm thử kiểm tra tính hợp lệ truy vấn cho tất cả Spring Data repository.
 * Khởi tạo mọi Spring Data repository trên mô hình entity thật mà không cần cơ sở dữ liệu: tên phương thức truy vấn dẫn xuất
 * và mọi {@code @Query} (JPQL) đều được phân tích cú pháp và phân giải giống hệt lúc ứng dụng khởi động, giúp lỗi gõ nhầm phát hiện ngay tại đây
 * thay vì làm API không khởi động được.
 */
class RepositoryQueryValidationTest {

    private static LocalContainerEntityManagerFactoryBean factoryBean;
    private static EntityManager entityManager;

    /** Khởi động Hibernate (không cần database) để biên dịch các truy vấn của repository. */
    @BeforeAll
    static void bootHibernateWithoutDatabase() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource("jdbc:postgresql://localhost:1/never_connected");
        factoryBean = new LocalContainerEntityManagerFactoryBean();
        factoryBean.setDataSource(dataSource);
        factoryBean.setPackagesToScan("com.swp391.scms");
        factoryBean.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factoryBean.setJpaPropertyMap(Map.of(
                "jakarta.persistence.database-product-name", "PostgreSQL",
                "jakarta.persistence.database-major-version", "16",
                "hibernate.boot.allow_jdbc_metadata_access", "false",
                "hibernate.hbm2ddl.auto", "none"));
        factoryBean.afterPropertiesSet();
        entityManager = SharedEntityManagerCreator.createSharedEntityManager(factoryBean.getObject());
    }

    /** Đóng tài nguyên Hibernate sau khi kiểm tra xong. */
    @AfterAll
    static void close() {
        if (factoryBean != null && factoryBean.getObject() != null) {
            factoryBean.getObject().close();
        }
    }

    /** Kiểm thử: mọi repository đều phân giải được các truy vấn của nó. */
    @Test
    void everyRepositoryResolvesItsQueries() throws Exception {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false) {
            /** Lọc ứng viên quét component: cho phép cả interface repository (isCandidateComponent). */
            @Override
            protected boolean isCandidateComponent(AnnotatedBeanDefinition definition) {
                return definition.getMetadata().isInterface() && definition.getMetadata().isIndependent();
            }
        };
        scanner.addIncludeFilter(new AssignableTypeFilter(Repository.class));
        JpaRepositoryFactory factory = new JpaRepositoryFactory(entityManager);

        List<String> failures = new ArrayList<>();
        int checked = 0;
        for (var candidate : scanner.findCandidateComponents("com.swp391.scms")) {
            Class<?> repository = Class.forName(candidate.getBeanClassName());
            try {
                factory.getRepository(repository);
                checked++;
            } catch (RuntimeException e) {
                Throwable root = e;
                while (root.getCause() != null) {
                    root = root.getCause();
                }
                failures.add(repository.getSimpleName() + ": " + root.getMessage());
            }
        }
        assertTrue(checked > 20, "expected to find the project repositories, found " + checked);
        assertEquals(List.of(), failures);
    }
}
