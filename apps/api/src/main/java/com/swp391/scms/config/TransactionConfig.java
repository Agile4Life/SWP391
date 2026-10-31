package com.swp391.scms.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@Configuration(proxyBeanMethods = false)
@EnableTransactionManagement(order = Ordered.LOWEST_PRECEDENCE - 1)
public class TransactionConfig {
}
