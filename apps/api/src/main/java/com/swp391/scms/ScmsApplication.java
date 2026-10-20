package com.swp391.scms;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class ScmsApplication {
    public static void main(String[] args) {
        SpringApplication.run(ScmsApplication.class, args);
    }
}
