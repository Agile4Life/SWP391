package com.swp391.scms.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Bật chạy bất đồng bộ (@Async) và cung cấp một thread pool riêng để gửi thông báo, giúp request chính trả về
 * ngay mà không phải chờ gửi xong.
 *
 * Configuration for asynchronous task execution (SCRUM-108).
 * Provides a dedicated thread pool for non-blocking notification dispatching.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * Thread pool "notificationTaskExecutor": 4 luồng thường trực, tối đa 10 luồng, hàng đợi 100 việc; tên
     * luồng bắt đầu bằng "notification-async-" để dễ đọc log.
     */
    @Bean(name = "notificationTaskExecutor")
    public Executor notificationTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("notification-async-");
        executor.initialize();
        return executor;
    }
}

