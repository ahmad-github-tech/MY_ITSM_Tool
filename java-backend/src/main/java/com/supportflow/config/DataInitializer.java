package com.supportflow.config;

import com.supportflow.entity.SupportTask;
import com.supportflow.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;
import java.util.Arrays;

@Configuration
public class DataInitializer {

    @Autowired
    private TaskRepository taskRepository;

    @Bean
    public CommandLineRunner initData() {
        return args -> {
            if (taskRepository.count() == 0) {
                System.out.println("Initializing sample data...");
                
                SupportTask task1 = new SupportTask();
                task1.setTicketId("INC-1001");
                task1.setProjectId("HR-Portal");
                task1.setSupportLevel("L1");
                task1.setPriority("P3");
                task1.setGenerationDate(LocalDateTime.now().minusDays(2));
                task1.setResponseDate(LocalDateTime.now().minusDays(2).plusHours(1));
                task1.setStatus("In-Progress");
                task1.setDescription("Cannot access salary slip module");
                task1.setAssignedTo("Sarah.M");
                
                SupportTask task2 = new SupportTask();
                task2.setTicketId("INC-1002");
                task2.setProjectId("E-Commerce");
                task2.setSupportLevel("L2");
                task2.setPriority("P1");
                task2.setGenerationDate(LocalDateTime.now().minusDays(1));
                task2.setResponseDate(LocalDateTime.now().minusDays(1).plusMinutes(15));
                task2.setClosureDate(LocalDateTime.now().minusHours(2));
                task2.setStatus("Closed");
                task2.setUserIntimated(true);
                task2.setDescription("Checkout gateway timeout");
                task2.setSolution("Restarted payment service and cleared cache");
                task2.setRemarks("Issue resolved permanently");
                task2.setAssignedTo("Admin");

                taskRepository.saveAll(Arrays.asList(task1, task2));
                System.out.println("Sample data initialized.");
            }
        };
    }
}
