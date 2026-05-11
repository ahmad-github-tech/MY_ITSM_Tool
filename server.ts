import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory database with initial sample data
  let projects = [
    { 
      id: 1, 
      name: "HR-Portal", 
      description: "Human Resources Management System", 
      employees: "John.D, Sarah.M, Admin, Support.Alpha",
      p1ResponseSla: 2, p1ResolutionSla: 4,
      p2ResponseSla: 4, p2ResolutionSla: 8,
      p3ResponseSla: 8, p3ResolutionSla: 24,
      p4ResponseSla: 24, p4ResolutionSla: 48,
      shiftStart: "09:00",
      shiftEnd: "18:00",
      workingDays: "Mon,Tue,Wed,Thu,Fri",
      holidays: "",
      employeeShifts: "[]"
    },
    { 
      id: 2, 
      name: "E-Commerce", 
      description: "Online Shopping Platform", 
      employees: "John.D, Sarah.M, Admin, Support.Alpha",
      p1ResponseSla: 1, p1ResolutionSla: 2,
      p2ResponseSla: 2, p2ResolutionSla: 4,
      p3ResponseSla: 4, p3ResolutionSla: 8,
      p4ResponseSla: 12, p4ResolutionSla: 24,
      shiftStart: "08:00",
      shiftEnd: "20:00",
      workingDays: "Mon,Tue,Wed,Thu,Fri,Sat",
      holidays: "",
      employeeShifts: "[]"
    },
    { 
      id: 3, 
      name: "Internal-CRM", 
      description: "Customer Relationship Management", 
      employees: "Sarah.M, Admin",
      p1ResponseSla: 4, p1ResolutionSla: 8,
      p2ResponseSla: 8, p2ResolutionSla: 16,
      p3ResponseSla: 16, p3ResolutionSla: 48,
      p4ResponseSla: 48, p4ResolutionSla: 96,
      shiftStart: "09:00",
      shiftEnd: "17:00",
      workingDays: "Mon,Tue,Wed,Thu,Fri",
      holidays: "",
      employeeShifts: "[]"
    }
  ];

  let tasks = [
    {
      id: 1,
      ticketId: "INC-1001",
      projectId: "HR-Portal",
      supportLevel: "L1",
      priority: "P3",
      generationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      responseDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString().slice(0, 16),
      closureDate: null,
      status: "In-Progress",
      userIntimated: false,
      description: "Cannot access salary slip module",
      solution: "",
      remarks: "",
      assignedTo: "Sarah.M",
      auditLog: []
    },
    {
      id: 2,
      ticketId: "INC-1002",
      projectId: "E-Commerce",
      supportLevel: "L2",
      priority: "P1",
      generationDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      responseDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString().slice(0, 16),
      closureDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
      status: "Closed",
      userIntimated: true,
      description: "Checkout gateway timeout",
      solution: "Restarted payment service and cleared cache",
      remarks: "Issue resolved permanently",
      assignedTo: "Admin",
      auditLog: []
    }
  ];

  // API Routes
  app.get("/supportflow/api/projects", (req, res) => {
    res.json(projects);
  });

  app.post("/supportflow/api/projects", (req, res) => {
    const existingIndex = projects.findIndex(p => p.name === req.body.name);
    if (existingIndex !== -1) {
      projects[existingIndex] = { ...projects[existingIndex], ...req.body };
      return res.json(projects[existingIndex]);
    }
    const newProject = { ...req.body, id: projects.length + 1 };
    projects.push(newProject);
    res.json(newProject);
  });

  app.delete("/supportflow/api/projects/:id", (req, res) => {
    const id = parseInt(req.params.id);
    projects = projects.filter(p => p.id !== id);
    res.status(204).send();
  });

  app.get("/supportflow/api/tasks", (req, res) => {
    res.json(tasks);
  });

  app.get("/supportflow/api/tasks/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const task = tasks.find(t => t.id === id);
    if (task) res.json(task);
    else res.status(404).send();
  });

  app.post("/supportflow/api/tasks", (req, res) => {
    const newTask = { 
      ...req.body, 
      id: tasks.length + 1,
      auditLog: req.body.auditLog || []
    };
    tasks.push(newTask);
    res.json(newTask);
  });

  app.put("/supportflow/api/tasks/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      tasks[index] = { ...tasks[index], ...req.body };
      res.json(tasks[index]);
    } else {
      res.status(404).send();
    }
  });

  app.delete("/supportflow/api/tasks/:id", (req, res) => {
    const id = parseInt(req.params.id);
    tasks = tasks.filter(t => t.id !== id);
    res.status(204).send();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
