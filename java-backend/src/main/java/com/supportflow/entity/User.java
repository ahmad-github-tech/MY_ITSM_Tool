package com.supportflow.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {
    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    private String role;
    
    private String status;
    
    private String password;

    public User() {}

    public User(String id, String name, String role, String status, String password) {
        this.id = id;
        this.name = name;
        this.role = role;
        this.status = status;
        this.password = password;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
