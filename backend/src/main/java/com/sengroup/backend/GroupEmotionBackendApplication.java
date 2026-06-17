package com.sengroup.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@EnableAsync
@SpringBootApplication
public class GroupEmotionBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(GroupEmotionBackendApplication.class, args);
    }
}
