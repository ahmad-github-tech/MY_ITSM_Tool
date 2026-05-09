package com.supportflow.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "support_tasks")
@Data
public class SupportTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String ticketId;
    private String projectId;
    private String supportLevel;
    private String priority;
    private LocalDateTime generationDate;
    private LocalDateTime responseDate;
    private LocalDateTime closureDate;
    private String status;
    private boolean userIntimated;
    private String description;
    private String solution;
    private String remarks;
    private String assignedTo;
}
