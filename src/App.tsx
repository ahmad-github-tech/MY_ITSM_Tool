/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  Activity, Clock, CheckCircle2, AlertCircle, Plus, 
  Search, Download, Trash2, LayoutDashboard, ListTodo, Filter, ChevronRight, Settings,
  Pencil, RotateCcw, AlertTriangle, Info, ShieldAlert
} from 'lucide-react';
import { format, subDays, differenceInMinutes, parseISO, startOfDay } from 'date-fns';
import { SupportTask, SupportLevel, Priority, TaskStatus, PRIORITY_COLORS, STATUS_COLORS, ProjectConfig } from './types';
import { cn, formatDuration, downloadCSV, exportToExcel } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// --- Constants ---
const ISSUE_TEMPLATES = [
  'Network Connectivity Loss',
  'VPN Authentication Failed',
  'Slow Database Query response',
  'Software Install Request',
  'Password Reset Required',
  'Application Crash on Startup',
  'Email Sync Error',
  'Printer Offline Issue',
  'CPU Spike on Server',
  'Storage Limit Warning'
];

// --- API Utils ---
const API_BASE = 'http://localhost:8080/supportflow/api/tasks';
const API_PROJECTS = 'http://localhost:8080/supportflow/api/projects';

export default function App() {
  const [tasks, setTasks] = useState<SupportTask[]>([]);
  const [projectsDB, setProjectsDB] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch tasks and projects on mount
  useEffect(() => {
    const initFetch = async () => {
      setLoading(true);
      await Promise.all([fetchTasks(), fetchProjects()]);
      setLoading(false);
    };
    initFetch();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch(API_BASE);
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Error connecting to backend (tasks):', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch(API_PROJECTS);
      if (response.ok) {
        const data = await response.json();
        setProjectsDB(data);
      }
    } catch (error) {
      console.error('Error connecting to backend (projects):', error);
    }
  };

  const [activeTab, setActiveTab] = useState<'analytics' | 'workbook' | 'settings' | 'mapping-details'>('analytics');
  const [trendPeriod, setTrendPeriod] = useState<'weekly' | 'monthly' | 'quarterly'>('weekly');
  const handleAddProject = async () => {
    if (!newProjectInput.trim() || projectsDB.find(p => p.name === newProjectInput)) return;
    
    askConfirmation(
      'Initialize New Project',
      `This will create project "${newProjectInput}" with default SLA and assignment policies. Continue?`,
      async () => {
        const newProj = {
          name: newProjectInput,
          description: `Project ${newProjectInput}`,
          employees: 'John.D, Sarah.M, Admin, Support.Alpha', // Default initial employees
          p1ResponseSla: 2, p1ResolutionSla: 4,
          p2ResponseSla: 4, p2ResolutionSla: 8,
          p3ResponseSla: 8, p3ResolutionSla: 24,
          p4ResponseSla: 24, p4ResolutionSla: 48,
        };

        try {
          const response = await fetch(API_PROJECTS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProj),
          });

          if (response.ok) {
            await fetchProjects();
            setNewProjectInput('');
            setConfigSelectedProject(newProjectInput);
          }
        } catch (error) {
          console.error('Error adding project:', error);
        }
      },
      'info',
      'Initialize'
    );
  };

  const handleDeleteProject = async (name: string) => {
    const project = projectsDB.find(p => p.name === name);
    if (!project) return;

    askConfirmation(
      'Terminate Project',
      `Deleting "${name}" will remove all associated configurations and mappings. Continue?`,
      async () => {
        try {
          const response = await fetch(`${API_PROJECTS}/${project.id}`, { method: 'DELETE' });
          if (response.ok) {
            await fetchProjects();
            setProjectsDB(prev => {
              const remaining = prev.filter(p => p.name !== name);
              if (remaining.length > 0) setConfigSelectedProject(remaining[0].name);
              else setConfigSelectedProject('');
              return remaining;
            });
          } else {
            console.error('Project deletion failed:', response.status);
          }
        } catch (error) {
          console.error('Error deleting project:', error);
        }
      },
      'danger',
      'Terminate'
    );
  };

  const handleUpdateSla = async () => {
    const project = projectsDB.find(p => p.name === configSelectedProject);
    if (!project) return;

    askConfirmation(
      'Apply SLA Policy Changes',
      `Updated service level benchmarks will be applied to project "${configSelectedProject}". System calculations will adapt immediately. Confirm?`,
      async () => {
        const payload = {
          ...project,
          p1ResponseSla: tempProjectSlas.P1.response,
          p1ResolutionSla: tempProjectSlas.P1.resolution,
          p2ResponseSla: tempProjectSlas.P2.response,
          p2ResolutionSla: tempProjectSlas.P2.resolution,
          p3ResponseSla: tempProjectSlas.P3.response,
          p3ResolutionSla: tempProjectSlas.P3.resolution,
          p4ResponseSla: tempProjectSlas.P4.response,
          p4ResolutionSla: tempProjectSlas.P4.resolution,
        };

        try {
          const response = await fetch(API_PROJECTS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (response.ok) {
            await fetchProjects();
          }
        } catch (error) {
          console.error('Error updating SLA:', error);
        }
      },
      'warning',
      'Apply'
    );
  };
  const handlePersonnelMapping = async () => {
    if (!personnelInput.trim() || selectedProjectsForMapping.length === 0) return;
    
    const name = personnelInput.trim();

    askConfirmation(
      editingEmployee ? 'Update Specialist Mapping' : 'Commit Personnel Mapping',
      editingEmployee 
        ? `Confirm update for specialist "${editingEmployee.originalName}"?`
        : `This will map specialist "${personnelInput}" across ${selectedProjectsForMapping.length} project(s). Continue?`,
      async () => {
        // Iterate through projectsDB and update those in selectedProjectsForMapping
        const updates = projectsDB.map(async (p) => {
          if (selectedProjectsForMapping.includes(p.name)) {
            let currentEmployees = p.employees ? p.employees.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
            
            // If editing, handle rename/move
            if (editingEmployee) {
              currentEmployees = currentEmployees.filter(e => e !== editingEmployee.originalName);
            }

            if (!currentEmployees.includes(name)) {
              currentEmployees.push(name);
            }

            const payload = { ...p, employees: currentEmployees.join(', ') };
            return fetch(API_PROJECTS, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          }
          return Promise.resolve();
        });

        try {
          await Promise.all(updates);
          await fetchProjects();
          setPersonnelInput('');
          setSelectedProjectsForMapping([]);
          setEditingEmployee(null);
        } catch (error) {
          console.error('Error updating personnel mapping:', error);
        }
      },
      'info',
      editingEmployee ? 'Update' : 'Map'
    );
  };

   const handleUnmapResource = async (emp: string) => {
    askConfirmation(
      'Unmap Resource',
      `Are you sure you want to remove "${emp}" from the selected project mappings?`,
      async () => {
        const updates = projectsDB.map(async (p) => {
          if (selectedProjectsForMapping.includes(p.name)) {
            let currentEmployees = p.employees ? p.employees.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
            currentEmployees = currentEmployees.filter(e => e !== emp);
            
            const payload = { ...p, employees: currentEmployees.join(', ') };
            return fetch(API_PROJECTS, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          }
          return Promise.resolve();
        });
        try {
          await Promise.all(updates);
          await fetchProjects();
        } catch (error) {
          console.error('Error unmapping resource:', error);
        }
      },
      'warning',
      'Unmap'
    );
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>('All');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('All');
  const [editingTask, setEditingTask] = useState<SupportTask | null>(null);
  
  // Dynamic Projects List
  const PROJECTS_LIST = useMemo(() => projectsDB.map(p => p.name), [projectsDB]);
  const [currentUser] = useState('Admin'); // Fallback to Admin from USERS if still hardcoded
  
  const [configSelectedProject, setConfigSelectedProject] = useState<string>('');

  // Sync configSelectedProject when projects load
  useEffect(() => {
    if (PROJECTS_LIST.length > 0 && !configSelectedProject) {
      setConfigSelectedProject(PROJECTS_LIST[0]);
    }
  }, [PROJECTS_LIST]);

  const [projectConfigs, setProjectConfigs] = useState<ProjectConfig[]>([]);

  // Synchronize projectConfigs with projectsDB
  useEffect(() => {
    if (projectsDB.length > 0) {
      setProjectConfigs(projectsDB.map(p => ({
        projectId: p.name,
        employees: p.employees ? p.employees.split(',').map((e: string) => e.trim()) : [],
        slas: {
          P1: { response: p.p1ResponseSla || 2, resolution: p.p1ResolutionSla || 4 },
          P2: { response: p.p2ResponseSla || 4, resolution: p.p2ResolutionSla || 8 },
          P3: { response: p.p3ResponseSla || 8, resolution: p.p3ResolutionSla || 24 },
          P4: { response: p.p4ResponseSla || 24, resolution: p.p4ResolutionSla || 48 },
        }
      })));
    }
  }, [projectsDB]);

  const [tempProjectSlas, setTempProjectSlas] = useState<ProjectConfig['slas']>({
    P1: { response: 2, resolution: 4 },
    P2: { response: 4, resolution: 8 },
    P3: { response: 8, resolution: 24 },
    P4: { response: 24, resolution: 48 },
  });

  // Update temp SLA when config selected project changes
  useEffect(() => {
    const current = projectConfigs.find(c => c.projectId === configSelectedProject);
    if (current) {
      setTempProjectSlas(current.slas);
    }
  }, [configSelectedProject, projectConfigs]);

  const [configChanges, setConfigChanges] = useState<{
    id: string;
    projectId: string;
    type: 'SLA' | 'Employee';
    detail: string;
    timestamp: string;
    user: string;
  }[]>([]);

  const [newProjectInput, setNewProjectInput] = useState('');
  const [selectedProjectsForMapping, setSelectedProjectsForMapping] = useState<string[]>([]);
  const [personnelInput, setPersonnelInput] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<{ projectId: string; originalName: string; currentName: string } | null>(null);

  // Derived mapping summary for the currently selected projects in the mapping tool
  const mappedInSelection = Array.from(new Set<string>(
    projectConfigs
      .filter(p => selectedProjectsForMapping.includes(p.projectId))
      .flatMap(p => p.employees || [])
  ));

  // --- Form State ---
  const [formData, setFormData] = useState<Partial<SupportTask>>({
    ticketId: '',
    projectId: '',
    supportLevel: 'L1',
    priority: 'P3',
    status: 'Open',
    generationDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    responseDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    closureDate: '',
    userIntimated: false,
    description: '',
    solution: '',
    remarks: '',
    assignedTo: 'Admin',
  });

  // Reset projectId in formData when projects load
  useEffect(() => {
    if (PROJECTS_LIST.length > 0 && !formData.projectId) {
      const firstProj = PROJECTS_LIST[0];
      setFormData(prev => ({ 
        ...prev, 
        projectId: firstProj,
        ticketId: getNextTicketId(firstProj, tasks)
      }));
    }
  }, [PROJECTS_LIST, tasks, formData.projectId]);

  // --- Filtered Tasks ---
  const projectFilteredTasks = useMemo(() => {
    return tasks.filter(t => 
      (selectedProject === 'All' || t.projectId === selectedProject) &&
      (selectedEmployee === 'All' || t.assignedTo === selectedEmployee)
    );
  }, [tasks, selectedProject, selectedEmployee]);

  // --- KPI Calculations ---
  const kpis = useMemo(() => {
    const currentTasks = projectFilteredTasks;
    const closedTasks = currentTasks.filter(t => t.closureDate && (t.status === 'Closed' || t.status === 'Resolved'));
    
    const mttrResp = currentTasks.reduce((acc, t) => acc + differenceInMinutes(parseISO(t.responseDate), parseISO(t.generationDate)), 0) / (currentTasks.length || 1);
    
    const mttrReso = closedTasks.reduce((acc, t) => acc + differenceInMinutes(parseISO(t.closureDate!), parseISO(t.generationDate)), 0) / (closedTasks.length || 1);
    
    const closedCount = currentTasks.filter(t => t.status === 'Closed').length;
    const intimatedCount = currentTasks.filter(t => t.status === 'Closed' && t.userIntimated).length;
    const compliance = closedCount > 0 ? (intimatedCount / closedCount) * 100 : 0;

    return {
      mttrResp: Math.round(mttrResp),
      mttrReso: Math.round(mttrReso),
      compliance: Math.round(compliance),
      total: currentTasks.length,
      active: currentTasks.filter(t => t.status !== 'Closed').length
    };
  }, [projectFilteredTasks]);

  const currentConfig = projectConfigs.find(c => c.projectId === configSelectedProject);
  const configPIndex = projectConfigs.findIndex(c => c.projectId === configSelectedProject);

  useEffect(() => {
    if (currentConfig) {
      setTempProjectSlas(currentConfig.slas);
    }
  }, [configSelectedProject, projectConfigs]);

  // --- Chart Data ---
  const charts = useMemo(() => {
    const currentTasks = projectFilteredTasks;

    // Filter tasks based on trendPeriod for Distribution charts
    const now = new Date();
    const periodStart = trendPeriod === 'weekly' 
      ? subDays(now, 7) 
      : trendPeriod === 'monthly' 
        ? subDays(now, 30) 
        : subDays(now, 91); // approx 3 months

    const distributionTasks = currentTasks.filter(t => {
      const genDate = parseISO(t.generationDate);
      return genDate >= periodStart;
    });

    // Priority Pie
    const priorityData = Object.keys(PRIORITY_COLORS).map(p => ({
      name: p,
      value: distributionTasks.filter(t => t.priority === p).length,
      color: PRIORITY_COLORS[p as Priority]
    }));

    // Support Level Bar
    const levelData = ['L1', 'L2', 'L3', 'L4'].map(l => ({
      name: l,
      count: distributionTasks.filter(t => t.supportLevel === l).length,
      total: distributionTasks.length
    }));

    // Hours Consumed per Support Level
    const consumptionData = ['L1', 'L2', 'L3', 'L4'].map(l => {
      const levelTasks = distributionTasks.filter(t => t.supportLevel === l && t.closureDate);
      const totalMinutes = levelTasks.reduce((sum, t) => {
        return sum + differenceInMinutes(parseISO(t.closureDate!), parseISO(t.generationDate));
      }, 0);
      return {
        name: l,
        hours: Math.round(totalMinutes / 60),
        count: levelTasks.length
      };
    });

    // Top 5 Issues
    const issueCounts = distributionTasks.reduce((acc, t) => {
      acc[t.description] = (acc[t.description] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topIssues = Object.entries(issueCounts)
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => (b.count as number) - (a.count as number))
      .slice(0, 5);

    // Aging of Open Tickets
    const openAgingTasks = distributionTasks.filter(t => t.status !== 'Closed' && t.status !== 'Resolved');
    const agingBuckets = [
      { name: '2-4 Days', min: 2, max: 4, color: '#3b82f6' },
      { name: '4-6 Days', min: 4, max: 6, color: '#f59e0b' },
      { name: '6-8 Days', min: 6, max: 8, color: '#f97316' },
      { name: '8-10 Days', min: 8, max: 10, color: '#ef4444' },
      { name: '10+ Days', min: 10, max: 1000, color: '#7f1d1d' }
    ];

    const agingData = agingBuckets.map(bucket => {
      const count = openAgingTasks.filter(t => {
        const ageDays = differenceInMinutes(now, parseISO(t.generationDate)) / (24 * 60);
        return ageDays >= bucket.min && ageDays < bucket.max;
      }).length;
      return { ...bucket, count };
    });

    // Trend Line calculation based on trendPeriod
    let trendData: { name: string; closures: number; date: number }[] = [];

    if (trendPeriod === 'weekly') {
      trendData = Array.from({ length: 7 }).map((_, i) => {
        const date = subDays(now, i);
        const formatted = format(date, 'MMM dd');
        const dayStart = startOfDay(date).getTime();
        const dayEnd = dayStart + 86400000;
        
        const closures = currentTasks.filter(t => {
          if (!t.closureDate) return false;
          const cTime = parseISO(t.closureDate).getTime();
          return cTime >= dayStart && cTime < dayEnd;
        }).length;

        return { name: formatted, closures, date: dayStart };
      }).reverse();
    } else if (trendPeriod === 'monthly') {
      trendData = Array.from({ length: 30 }).map((_, i) => {
        const date = subDays(now, i);
        const formatted = format(date, 'MMM dd');
        const dayStart = startOfDay(date).getTime();
        const dayEnd = dayStart + 86400000;
        
        const closures = currentTasks.filter(t => {
          if (!t.closureDate) return false;
          const cTime = parseISO(t.closureDate).getTime();
          return cTime >= dayStart && cTime < dayEnd;
        }).length;

        return { name: formatted, closures, date: dayStart };
      }).reverse();
    } else if (trendPeriod === 'quarterly') {
      // Group by week for quarterly trend
      trendData = Array.from({ length: 13 }).map((_, i) => {
        const date = subDays(now, i * 7);
        const formatted = `Wk ${13 - i}`;
        const weekStart = startOfDay(date).getTime() - (6 * 86400000); // approx start of week
        const weekEnd = startOfDay(date).getTime() + 86400000;
        
        const closures = currentTasks.filter(t => {
          if (!t.closureDate) return false;
          const cTime = parseISO(t.closureDate).getTime();
          return cTime >= weekStart && cTime < weekEnd;
        }).length;

        return { name: formatted, closures, date: weekStart };
      }).reverse();
    }

    return { priorityData, levelData, topIssues, agingData, consumptionData, trendData };
  }, [projectFilteredTasks, trendPeriod]);

  // --- Handlers ---
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();

    const actionLabel = editingTask ? 'Update' : 'Commit New';
    askConfirmation(
      `${actionLabel} Ticket Record`,
      `Are you sure you want to ${editingTask ? 'update' : 'add'} this ticket record to the database?`,
      async () => {
        // Prepare payload (convert strings to ISO dates if necessary for backend)
        const payload = {
          ticketId: formData.ticketId || `INC-${1000 + tasks.length}`,
          projectId: formData.projectId!,
          supportLevel: formData.supportLevel as SupportLevel,
          priority: formData.priority as Priority,
          generationDate: formData.generationDate,
          responseDate: formData.responseDate,
          closureDate: formData.closureDate || null,
          status: formData.status as TaskStatus,
          userIntimated: formData.userIntimated || false,
          description: formData.description || '',
          solution: formData.solution || '',
          remarks: formData.remarks || '',
          assignedTo: editingTask ? formData.assignedTo : currentUser,
        };

        try {
          const url = editingTask ? `${API_BASE}/${editingTask.id}` : API_BASE;
          const method = editingTask ? 'PUT' : 'POST';
          
          const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            const savedTask = await response.json();
            const updatedTasks = editingTask 
              ? tasks.map(t => t.id === editingTask.id ? savedTask : t)
              : [savedTask, ...tasks];
            
            setTasks(updatedTasks);
            setEditingTask(null);
            
            // Reset form
            const firstProj = PROJECTS_LIST[0] || '';
            setFormData({
              ticketId: getNextTicketId(firstProj, updatedTasks),
              projectId: firstProj,
              supportLevel: 'L1',
              priority: 'P3',
              status: 'Open',
              generationDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
              responseDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
              closureDate: '',
              userIntimated: false,
              description: '',
              solution: '',
              remarks: '',
              assignedTo: currentUser,
            });
          }
        } catch (error) {
          console.error('Error saving task:', error);
          alert('Could not connect to the Java backend. Please ensure the Spring Boot app is running on port 8080.');
        }
      },
      'info',
      editingTask ? 'Update' : 'Save'
    );
  };

  const handleDeleteTask = async (id: number) => {
    askConfirmation('Delete Task', 'Are you sure you want to permanently delete this task record?', async () => {
      try {
        const response = await fetch(`${API_BASE}/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setTasks(prev => prev.filter(t => t.id !== id));
        } else {
          console.error('Delete failed:', response.status);
        }
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }, 'danger', 'Delete');
  };

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'info' | 'warning';
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    confirmLabel: 'Confirm',
    onConfirm: () => {},
  });

  const getNextTicketId = (projectId: string, currentTasks: SupportTask[]) => {
    if (!projectId) return 'PENDING';
    
    // Generate prefix: First letters of words, or first 3 letters of name
    const words = projectId.split(/[\s-_]+/);
    let prefix = '';
    if (words.length >= 2) {
      prefix = words.map(w => w[0]).join('').toUpperCase().substring(0, 3);
    } else {
      prefix = projectId.substring(0, 3).toUpperCase();
    }
    
    // Sanitize prefix
    prefix = prefix.replace(/[^A-Z]/g, '');
    if (prefix.length < 2) prefix = (prefix + 'INC').substring(0, 3);

    // Filter tasks for this project
    const projectTasks = currentTasks.filter(t => t.projectId === projectId);
    
    let maxNum = 1000;
    projectTasks.forEach(t => {
      const match = t.ticketId.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    return `${prefix}-${maxNum + 1}`;
  };

  const askConfirmation = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    type: 'danger' | 'info' | 'warning' = 'info',
    confirmLabel: string = 'Confirm'
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      type,
      confirmLabel,
      onConfirm: async () => {
        await onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleCancel = () => {
    setEditingTask(null);
    const firstProj = PROJECTS_LIST[0] || '';
    setFormData({
      ticketId: getNextTicketId(firstProj, tasks),
      projectId: firstProj,
      supportLevel: 'L1',
      priority: 'P3',
      status: 'Open',
      generationDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      responseDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      closureDate: '',
      userIntimated: false,
      description: '',
      solution: '',
      remarks: '',
      assignedTo: currentUser,
    });
  };

  const startEditing = (task: SupportTask) => {
    setEditingTask(task);
    setFormData({
      ticketId: task.ticketId,
      projectId: task.projectId,
      supportLevel: task.supportLevel,
      priority: task.priority,
      status: task.status,
      generationDate: format(parseISO(task.generationDate), "yyyy-MM-dd'T'HH:mm"),
      responseDate: format(parseISO(task.responseDate), "yyyy-MM-dd'T'HH:mm"),
      closureDate: task.closureDate ? format(parseISO(task.closureDate), "yyyy-MM-dd'T'HH:mm") : '',
      userIntimated: task.userIntimated,
      description: task.description,
      solution: task.solution,
      remarks: task.remarks,
      assignedTo: task.assignedTo,
    });
    setIsSidebarOpen(true);
  };

  const handleExport = () => {
    const currentTasks = projectFilteredTasks;
    
    // 1. Data Sheet (Tickets)
    const ticketData = currentTasks.map(t => {
      const config = projectConfigs.find(c => c.projectId === t.projectId);
      const slaThresholds = config?.slas?.[t.priority] || { response: 8, resolution: 24 };
      
      const resolutionTime = t.closureDate ? differenceInMinutes(parseISO(t.closureDate), parseISO(t.generationDate)) : null;
      const slaLimit = slaThresholds.resolution * 60;
      const resolutionSlaStatus = resolutionTime !== null ? (resolutionTime <= slaLimit ? 'MET' : 'BREACHED') : 'PENDING';

      const responseTime = differenceInMinutes(parseISO(t.responseDate), parseISO(t.generationDate));
      const responseSlaLimit = slaThresholds.response * 60;
      const responseSlaStatus = responseTime <= responseSlaLimit ? 'MET' : 'BREACHED';
      
      return {
        'Ticket ID': t.ticketId,
        'Project': t.projectId,
        'Support Level': t.supportLevel,
        'Priority': t.priority,
        'Status': t.status,
        'Assignee': t.assignedTo,
        'Gen Date': format(parseISO(t.generationDate), 'yyyy-MM-dd HH:mm'),
        'Resp Date': format(parseISO(t.responseDate), 'yyyy-MM-dd HH:mm'),
        'Close Date': t.closureDate ? format(parseISO(t.closureDate), 'yyyy-MM-dd HH:mm') : '-',
        'Response SLA Limit (Hrs)': slaThresholds.response,
        'Response SLA Status': responseSlaStatus,
        'Resolution SLA Limit (Hrs)': slaThresholds.resolution,
        'Resolution Time (Min)': resolutionTime ?? '-',
        'Resolution SLA Status': resolutionSlaStatus,
        'Aging (H:M)': `${Math.floor(differenceInMinutes(t.closureDate ? parseISO(t.closureDate) : new Date(), parseISO(t.generationDate)) / 60)}:${(differenceInMinutes(t.closureDate ? parseISO(t.closureDate) : new Date(), parseISO(t.generationDate)) % 60).toString().padStart(2, '0')}`,
        'Delay (Min)': (resolutionTime !== null && resolutionTime > slaLimit) ? resolutionTime - slaLimit : 0,
        'Description': t.description,
        'Resolution': t.solution,
        'Remarks': t.remarks
      };
    });

    // 2. Analytics Sheet (KPIs)
    const closedTasks = currentTasks.filter(t => t.closureDate);
    const metCount = ticketData.filter(t => t['Resolution SLA Status'] === 'MET').length;
    const slaRate = closedTasks.length > 0 ? (metCount / closedTasks.length) * 100 : 0;

    const analyticsData = [
      { Metric: 'Total Tickets Managed', Value: currentTasks.length },
      { Metric: 'Active / Open Backlog', Value: kpis.active },
      { Metric: 'Global SLA Compliance Rate', Value: `${slaRate.toFixed(2)}%` },
      { Metric: 'Notification Compliance', Value: `${kpis.compliance}%` },
      { Metric: 'Mean Time to Respond (MTTR)', Value: formatDuration(kpis.mttrResp * 60000) },
      { Metric: 'Mean Time to Resolve (MTTR-R)', Value: formatDuration(kpis.mttrReso * 60000) },
      { Metric: '', Value: '' },
      { Metric: 'Volume by Priority', Value: '' },
      ...Object.keys(PRIORITY_COLORS).map(p => ({
        Metric: `  Priority ${p}`,
        Value: currentTasks.filter(t => t.priority === p).length
      })),
      { Metric: 'Volume by Support Tier', Value: '' },
      ...['L1', 'L2', 'L3', 'L4'].map(l => ({
        Metric: `  Tier ${l}`,
        Value: currentTasks.filter(t => t.supportLevel === l).length
      }))
    ];

    exportToExcel([
      { name: 'SLA_Analytics', data: analyticsData },
      { name: 'Ticket_Inventory', data: ticketData }
    ], `IT_Support_Service_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const filteredTasks = projectFilteredTasks.filter(t => 
    t.ticketId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.solution.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen overflow-hidden text-slate-200">
      {/* Sidebar Form */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="glass-panel h-full flex flex-col border-r border-slate-800 shrink-0"
      >
        <div className="p-6 flex flex-col h-full overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2 mb-8 p-1 border-b border-slate-800 pb-6">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <h1 className="font-bold text-xl tracking-tight">Ticket Entry</h1>
          </div>

          <form onSubmit={handleSaveTask} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/90 border-l-2 border-blue-500 pl-3">
                {editingTask ? 'Edit Task' : 'New Task Record'}
              </h2>
              {editingTask && (
                <button 
                  type="button" 
                  onClick={() => setEditingTask(null)}
                  className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-300"
                >
                  Cancel
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="label-sm">Project Assignment</label>
                <select 
                  className="input-field"
                  value={formData.projectId}
                  onChange={e => {
                    const newProjectId = e.target.value;
                    const config = projectConfigs.find(c => c.projectId === newProjectId);
                    const available = config?.employees || [];
                    
                    // Generate next ticket ID for this project
                    const nextId = getNextTicketId(newProjectId, tasks);
                    
                    setFormData({ 
                      ...formData, 
                      projectId: newProjectId,
                      ticketId: nextId,
                      assignedTo: available.includes(formData.assignedTo || '') ? formData.assignedTo : (available[0] || 'Admin')
                    });
                  }}
                >
                  {projectConfigs.map(p => <option key={p.projectId} value={p.projectId}>{p.projectId}</option>)}
                </select>
              </div>

              <div>
                <label className="label-sm flex items-center justify-between">
                  <span>Ticket ID</span>
                  <span className="text-[9px] text-blue-500 font-black uppercase tracking-widest bg-blue-500/5 px-1 rounded">Auto Sequence</span>
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. INC-4052"
                  value={formData.ticketId}
                  onChange={e => setFormData({ ...formData, ticketId: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label-sm">Issue Description</label>
                <textarea 
                  className="input-field min-h-[80px] resize-none" 
                  placeholder="Briefly describe the problem..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="label-sm">Assign To Employee</label>
                <select 
                  className="input-field"
                  value={formData.assignedTo}
                  onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
                >
                  {(projectConfigs.find(c => c.projectId === formData.projectId)?.employees || []).map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-sm">Support Level</label>
                <select 
                  className="input-field"
                  value={formData.supportLevel}
                  onChange={e => setFormData({ ...formData, supportLevel: e.target.value as SupportLevel })}
                >
                  <option value="L1">L1</option>
                  <option value="L2">L2</option>
                  <option value="L3">L3</option>
                  <option value="L4">L4</option>
                </select>
              </div>
              <div>
                <label className="label-sm">Priority</label>
                <select 
                  className="input-field"
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value as Priority })}
                >
                  <option value="P1">P1 - Critical</option>
                  <option value="P2">P2 - High</option>
                  <option value="P3">P3 - Medium</option>
                  <option value="P4">P4 - Low</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label-sm">Generation Date/Time</label>
                <input 
                  type="datetime-local" 
                  className="input-field"
                  value={formData.generationDate}
                  onChange={e => setFormData({ ...formData, generationDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label-sm">Response Date/Time</label>
                <input 
                  type="datetime-local" 
                  className="input-field"
                  value={formData.responseDate}
                  onChange={e => setFormData({ ...formData, responseDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label-sm">Resolution Time</label>
                <input 
                  type="datetime-local" 
                  className="input-field"
                  value={formData.closureDate || ''}
                  onChange={e => setFormData({ ...formData, closureDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="label-sm">Current Status</label>
              <select 
                className="input-field"
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as TaskStatus })}
              >
                <option value="Open">Open</option>
                <option value="In-Progress">In-Progress</option>
                <option value="Hold">Hold</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            {editingTask && (
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/20"
                  checked={formData.userIntimated}
                  onChange={e => setFormData({ ...formData, userIntimated: e.target.checked })}
                />
                <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors font-bold uppercase tracking-wider">End User Intimated</span>
              </label>
            )}

            {editingTask && (
              <div>
                <label className="label-sm">Resolution Details</label>
                <textarea 
                  className="input-field min-h-[100px] resize-none" 
                  placeholder="Describe the solution provided..."
                  value={formData.solution}
                  onChange={e => setFormData({ ...formData, solution: e.target.value })}
                />
              </div>
            )}

            {editingTask && (
              <div>
                <label className="label-sm">Remarks</label>
                <textarea 
                  className="input-field min-h-[60px] resize-none" 
                  placeholder="Any additional remarks..."
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2 group">
                {editingTask ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                )}
                {editingTask ? 'Update Record' : 'Add Record'}
              </button>
              <button 
                type="button" 
                onClick={handleCancel}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md text-xs font-black uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Syncing with Java Backend...</p>
            </div>
          </div>
        )}
        {/* Top Header / Command Bar */}
        <header className="h-16 glass-panel border-b border-slate-800 px-6 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-800 rounded-md transition-colors text-slate-400"
            >
              <ChevronRight className={cn("w-5 h-5 transition-transform", isSidebarOpen ? "rotate-180" : "rotate-0")} />
            </button>
            
            <div className="h-8 w-[1px] bg-slate-800 mx-2" />

            <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg p-1 border border-slate-800">
               <select 
                  className="bg-transparent text-xs font-bold text-slate-300 outline-none px-3 rounded hover:bg-slate-800 border-none transition-colors h-7 cursor-pointer"
                  value={selectedProject}
                  onChange={e => {
                    const nextProject = e.target.value;
                    setSelectedProject(nextProject);
                    if (nextProject !== 'All' && selectedEmployee !== 'All') {
                      const employees = projectConfigs.find(c => c.projectId === nextProject)?.employees || [];
                      if (!employees.includes(selectedEmployee)) {
                        setSelectedEmployee('All');
                      }
                    }
                  }}
                >
                  <option value="All">All Projects</option>
                  {projectConfigs.map(p => <option key={p.projectId} value={p.projectId}>{p.projectId}</option>)}
                </select>
              <div className="w-[1px] h-4 bg-slate-800 mx-1" />
               <select 
                  className="bg-transparent text-xs font-bold text-slate-300 outline-none px-3 rounded hover:bg-slate-800 border-none transition-colors h-7 cursor-pointer"
                  value={selectedEmployee}
                  onChange={e => setSelectedEmployee(e.target.value)}
                >
                  <option value="All">All Employees</option>
                  {(selectedProject === 'All' 
                    ? Array.from(new Set(projectConfigs.flatMap(c => c.employees)))
                    : (projectConfigs.find(c => c.projectId === selectedProject)?.employees || [])
                  ).map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg p-1 border border-slate-800">
              <button 
                onClick={() => setActiveTab('analytics')}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                  activeTab === 'analytics' ? "bg-slate-800 text-white shadow-lg shadow-black/20" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Analytics
              </button>
              <button 
                onClick={() => setActiveTab('workbook')}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                  activeTab === 'workbook' ? "bg-slate-800 text-white shadow-lg shadow-black/20" : "text-slate-500 hover:text-slate-300"
                )}
              >
                My Workbook
              </button>
              <button 
                onClick={() => setActiveTab('settings')}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                  activeTab === 'settings' ? "bg-slate-800 text-white shadow-lg shadow-black/20" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Configuration
              </button>
              <button 
                onClick={() => setActiveTab('mapping-details')}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                  activeTab === 'mapping-details' ? "bg-slate-800 text-white shadow-lg shadow-black/20" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Mapping Details
              </button>
            </div>
            
            <button 
              onClick={handleExport}
              className="btn-secondary flex items-center gap-2 group whitespace-nowrap"
            >
              <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
          </div>
        </header>

        {/* Tab Content Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Removed KPI Row */}


          <AnimatePresence mode="wait">
            {activeTab === 'analytics' ? (
              <motion.div 
                key="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              >
                <div className="chart-container p-6 h-[400px]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="label-sm mb-0">Ticket Trends</h3>
                    <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
                      {(['weekly', 'monthly', 'quarterly'] as const).map((period) => (
                        <button
                          key={period}
                          onClick={() => setTrendPeriod(period)}
                          className={cn(
                            "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all",
                            trendPeriod === period 
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                              : "text-slate-500 hover:text-slate-300"
                          )}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height="85%">
                    <LineChart data={charts.trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Line type="monotone" dataKey="closures" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', stroke: '#0f172a', strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="chart-container p-5 h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="label-sm mb-0">Priority Distribution</h3>
                      <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
                        {(['weekly', 'monthly', 'quarterly'] as const).map((period) => (
                          <button
                            key={period}
                            onClick={() => setTrendPeriod(period)}
                            className={cn(
                              "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all",
                              trendPeriod === period 
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                                : "text-slate-500 hover:text-slate-300"
                            )}
                          >
                            {period.slice(0, 1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-grow items-center justify-around">
                      <div className="w-32 h-32 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={charts.priorityData}
                              innerRadius={45}
                              outerRadius={65}
                              paddingAngle={4}
                              dataKey="value"
                              stroke="none"
                            >
                              {charts.priorityData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-[10px] font-bold text-slate-500 uppercase">Status</div>
                        </div>
                      </div>
                      <div className="space-y-1.5 min-w-[100px]">
                        {charts.priorityData.map(p => (
                          <div key={p.name} className="flex items-center gap-3 text-xs font-mono">
                            <div className="w-2 h-2 rounded bg-slate-400" style={{ backgroundColor: p.color }}></div> 
                            <span className="text-slate-400">{p.name}:</span>
                            <span className="text-slate-200">{p.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="chart-container p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="label-sm mb-0">Workload Distribution (L1-L4)</h3>
                    <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
                      {(['weekly', 'monthly', 'quarterly'] as const).map((period) => (
                        <button
                          key={period}
                          onClick={() => setTrendPeriod(period)}
                          className={cn(
                            "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all",
                            trendPeriod === period 
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                              : "text-slate-500 hover:text-slate-300"
                          )}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {charts.levelData.map(level => {
                      const percentage = (level.count / (level.total || 1)) * 100;
                      return (
                        <div key={level.name} className="flex items-center gap-4">
                          <span className="text-xs w-4 font-bold text-slate-400">{level.name}</span>
                          <div className="flex-grow h-6 bg-slate-800/50 rounded overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(percentage, 2)}%` }}
                              className="h-full bg-slate-400 px-2 flex items-center text-[10px] font-bold text-slate-900 whitespace-nowrap"
                            >
                              {level.count} Tickets
                            </motion.div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="chart-container p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="label-sm mb-0">Consumed Hours by Tier</h3>
                    <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
                      {(['weekly', 'monthly', 'quarterly'] as const).map((period) => (
                        <button
                          key={period}
                          onClick={() => setTrendPeriod(period)}
                          className={cn(
                            "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all",
                            trendPeriod === period 
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                              : "text-slate-500 hover:text-slate-300"
                          )}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.consumptionData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                        <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          cursor={{ fill: '#ffffff10' }}
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="hours" radius={[0, 4, 4, 0]} fill="#818cf8" label={{ position: 'right', fill: '#94a3b8', fontSize: 10 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    {charts.consumptionData.map((tier, idx) => (
                      <div key={idx} className="flex justify-between items-center px-2 py-1 bg-slate-900/40 rounded border border-slate-800/50">
                        <span className="text-[10px] font-bold text-slate-400">{tier.name} Tier</span>
                        <div className="flex gap-4">
                          <span className="text-[10px] text-slate-500">Tickets: <span className="text-white font-bold">{tier.count}</span></span>
                          <span className="text-[10px] text-slate-500">Total Hours: <span className="text-blue-400 font-bold">{tier.hours}h</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="chart-container p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="label-sm mb-0">Top 5 Issues</h3>
                    <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
                      {(['weekly', 'monthly', 'quarterly'] as const).map((period) => (
                        <button
                          key={period}
                          onClick={() => setTrendPeriod(period)}
                          className={cn(
                            "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all",
                            trendPeriod === period 
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                              : "text-slate-500 hover:text-slate-300"
                          )}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {charts.topIssues.map((issue, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-300 truncate max-w-[80%]">{issue.name}</span>
                          <span className="text-slate-500 font-bold">{issue.count}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(issue.count / (charts.topIssues[0]?.count || 1)) * 100}%` }}
                            className="h-full bg-indigo-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="chart-container p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="label-sm mb-0">Aging of Open Tickets</h3>
                    <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
                      {(['weekly', 'monthly', 'quarterly'] as const).map((period) => (
                        <button
                          key={period}
                          onClick={() => setTrendPeriod(period)}
                          className={cn(
                            "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all",
                            trendPeriod === period 
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                              : "text-slate-500 hover:text-slate-300"
                          )}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.agingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => Math.round(val).toString()} />
                        <Tooltip 
                          cursor={{ fill: '#ffffff10' }}
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {charts.agingData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-4">
                    {charts.agingData.map((bucket, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: bucket.color }} />
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{bucket.name}</span>
                        <span className="text-[10px] text-white font-black">{bucket.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'workbook' ? (
              <motion.div 
                key="workbook"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-2">
                   <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">My Workbook</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Real-time incident ledger and resolution tracking</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Search tickets or solutions..." 
                      className="input-field pl-10"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button className="p-2 glass-panel hover:bg-zinc-800 rounded-md text-zinc-400 transition-colors">
                    <Filter className="w-4 h-4" />
                  </button>
                </div>

                  <div className="glass-panel rounded-xl overflow-hidden border border-slate-800/50">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900/80 border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">ID</th>
                          <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Level</th>
                          <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Priority</th>
                          <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Status</th>
                          <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Owner</th>
                          <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Created</th>
                           <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Response Date</th>
                           <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Resolution Date</th>
                           <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Resolution Description</th>
                           <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500">Remarks</th>
                           <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Response SLA Status</th>
                          <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Resolution SLA Status</th>
                          <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Aging</th>
                          <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {filteredTasks.map(task => {
                          const config = projectConfigs.find(c => c.projectId === task.projectId);
                          
                          // Resolution SLA
                          const slaLimitHrs = config?.slas?.[task.priority]?.resolution || 24;
                          const resTimeMin = task.closureDate ? differenceInMinutes(parseISO(task.closureDate), parseISO(task.generationDate)) : null;
                          const isBreached = resTimeMin !== null && resTimeMin > (slaLimitHrs * 60);
                          const delayMin = isBreached ? resTimeMin - (slaLimitHrs * 60) : 0;

                          // Response SLA
                          const responseSlaLimitHrs = config?.slas?.[task.priority]?.response || 2;
                          const responseTimeMin = differenceInMinutes(parseISO(task.responseDate), parseISO(task.generationDate));
                          const isResponseBreached = responseTimeMin > (responseSlaLimitHrs * 60);
                          const responseDelayMin = isResponseBreached ? responseTimeMin - (responseSlaLimitHrs * 60) : 0;
                          const wasResponded = task.status !== 'Open' || task.responseDate !== task.generationDate;

                          return (
                            <tr key={task.id} className="hover:bg-slate-800/20 transition-colors group">
                              <td className="px-4 py-4 font-mono font-medium text-slate-300">
                                <div className="text-slate-500 text-[10px] uppercase font-bold mb-0.5">{task.projectId}</div>
                                {task.ticketId}
                              </td>
                              <td className="px-4 py-4 text-xs font-semibold text-slate-500">{task.supportLevel}</td>
                              <td className="px-4 py-4">
                                <span 
                                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                                  style={{ backgroundColor: `${PRIORITY_COLORS[task.priority]}15`, color: PRIORITY_COLORS[task.priority] }}
                                >
                                  {task.priority}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="flex items-center gap-1.5 text-xs text-slate-300">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[task.status] }} />
                                  {task.status}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-700">
                                    {task.assignedTo.charAt(0)}
                                  </div>
                                  <span className="text-xs text-slate-400">{task.assignedTo}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-slate-500 text-xs">
                                {format(parseISO(task.generationDate), 'MMM d, p')}
                              </td>
                              <td className="px-4 py-4 text-slate-500 text-xs">
                                {format(parseISO(task.responseDate), 'MMM d, p')}
                              </td>
                              <td className="px-4 py-4 text-slate-500 text-xs">
                                {task.closureDate ? format(parseISO(task.closureDate), 'MMM d, p') : '-'}
                              </td>
                              <td className="px-4 py-4">
                                <div className="text-xs text-slate-400 max-w-[200px] truncate" title={task.solution}>
                                  {task.solution || '-'}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="text-xs text-slate-400 max-w-[200px] truncate" title={task.remarks}>
                                  {task.remarks || '-'}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                {wasResponded ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                                      isResponseBreached ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                    )}>
                                      {isResponseBreached ? 'Breached' : 'Met'}
                                    </span>
                                    {isResponseBreached && (
                                      <span className="text-[10px] text-red-400 font-mono">
                                        +{formatDuration(responseDelayMin * 60000)}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest opacity-50">Pending</span>
                                )}
                              </td>
                              <td className="px-4 py-4 text-center">
                                {task.closureDate ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                                      isBreached ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                    )}>
                                      {isBreached ? 'Breached' : 'Met'}
                                    </span>
                                    {isBreached && (
                                      <span className="text-[10px] text-red-400 font-mono">
                                        +{formatDuration(delayMin * 60000)}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest opacity-50">Active</span>
                                )}
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className="text-xs font-mono text-slate-300">
                                  {(() => {
                                    const totalMin = differenceInMinutes(task.closureDate ? parseISO(task.closureDate) : new Date(), parseISO(task.generationDate));
                                    const h = Math.floor(Math.max(0, totalMin) / 60);
                                    const m = Math.max(0, totalMin) % 60;
                                    return `${h}:${m.toString().padStart(2, '0')}`;
                                  })()}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => startEditing(task)}
                                    className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold transition-all"
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded transition-all inline-block"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Project Selector Segment */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-xl shadow-inner">
                    <span className="text-[10px] uppercase font-black text-slate-500 pl-3 tracking-widest">Active Governance Domain</span>
                    <select 
                      className="bg-slate-800 text-xs font-black text-blue-400 px-4 py-2 rounded-lg outline-none cursor-pointer border border-slate-700 hover:border-blue-500/50 transition-all"
                      value={configSelectedProject}
                      onChange={(e) => setConfigSelectedProject(e.target.value)}
                    >
                      {projectConfigs.map(p => <option key={p.projectId} value={p.projectId}>{p.projectId}</option>)}
                    </select>
                  </div>
                  
                  <div className="flex-1 flex items-center gap-3 p-2 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl">
                    <div className="px-4">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-0.5">Provision ID</span>
                      <input 
                        type="text"
                        placeholder="E.G. PROJECT-DELTA"
                        value={newProjectInput}
                        onChange={(e) => setNewProjectInput(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                        className="bg-transparent border-none focus:ring-0 text-xs font-bold text-white w-32 placeholder:text-slate-800 p-0"
                      />
                    </div>
                    <button 
                      onClick={handleAddProject}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Project
                    </button>
                    {projectsDB.length > 1 && (
                      <button 
                         onClick={() => handleDeleteProject(configSelectedProject)}
                         className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                         title="Delete Selected Project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Segment 1: SLA Configuration */}
                <div className="chart-container p-8 border-l-4 border-l-amber-500/50">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white leading-tight uppercase tracking-tight">SLA Configuration</h3>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Definition of service level benchmarks for {currentConfig?.projectId || 'Selected Project'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => {
                          if (!currentConfig) return;
                          askConfirmation(
                            'Reset SLA Configuration',
                            `This will reset all service level benchmarks for ${currentConfig?.projectId} to zero. Continue?`,
                            () => {
                              const resetSlas = {
                                P1: { response: 0, resolution: 0 },
                                P2: { response: 0, resolution: 0 },
                                P3: { response: 0, resolution: 0 },
                                P4: { response: 0, resolution: 0 },
                              };
                              setTempProjectSlas(resetSlas);
                              setProjectConfigs(prev => prev.map(c => 
                                c.projectId === currentConfig?.projectId 
                                  ? { ...c, slas: resetSlas }
                                  : c
                              ));
                              setConfigChanges(prev => [{
                                id: Math.random().toString(36).substr(2, 9),
                                projectId: currentConfig?.projectId || configSelectedProject,
                                type: 'SLA',
                                detail: `SLA Configuration Deleted: Targets reset to zero for ${currentConfig?.projectId || configSelectedProject}`,
                                timestamp: new Date().toISOString(),
                                user: currentUser
                              }, ...prev]);
                            },
                            'danger',
                            'Reset'
                          );
                        }}
                        disabled={!currentConfig}
                        className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete/Reset Configuration"
                      >
                        <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      </button>
                      <button 
                        onClick={handleUpdateSla}
                        disabled={!currentConfig}
                        className="btn-primary flex items-center gap-2 px-8 py-3 shadow-xl shadow-blue-500/10 uppercase font-black tracking-widest text-[11px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4" />
                        TAG SLA
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {(['P1', 'P2', 'P3', 'P4'] as Priority[]).map((p) => (
                      <div key={p} className="p-5 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-6 group hover:border-amber-500/30 transition-all duration-300 shadow-xl">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full shadow-[0_0_12px_rgba(0,0,0,0.5)]" style={{ backgroundColor: PRIORITY_COLORS[p] }} />
                            <span className="text-xs font-black text-white tracking-widest uppercase">{p} Criticality</span>
                          </div>
                        </div>
                        
                        <div className="space-y-5">
                          <div className="space-y-2">
                            <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] block pl-1">Response (Hrs)</label>
                            <input 
                              type="number" 
                              className="input-field h-11 px-4 text-sm font-mono focus:ring-amber-500/20 bg-slate-950/50" 
                              value={tempProjectSlas[p].response}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setTempProjectSlas(prev => ({
                                  ...prev,
                                  [p]: { ...prev[p], response: val }
                                }));
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] block pl-1">Resolution (Hrs)</label>
                            <input 
                              type="number" 
                              className="input-field h-11 px-4 text-sm font-mono focus:ring-amber-500/20 bg-slate-950/50" 
                              value={tempProjectSlas[p].resolution}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setTempProjectSlas(prev => ({
                                  ...prev,
                                  [p]: { ...prev[p], resolution: val }
                                }));
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Segment 2: Personnel Mapping */}
                <div id="personnel-mapping-anchor" className="chart-container p-8 border-l-4 border-l-emerald-500/50">
                  <div className="space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                        <ListTodo className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-white uppercase tracking-tight">Personnel Mapping</h4>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Tag personnel to specific project resource pools</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Left: Input & Role */}
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Employee Identity</label>
                          <input 
                            type="text"
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none transition-all shadow-inner"
                            placeholder="Enter Name..."
                            value={personnelInput}
                            onChange={(e) => setPersonnelInput(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Middle: Project Selection */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Project Allocation</label>
                          <div className="flex gap-4">
                            <button 
                              onClick={() => setSelectedProjectsForMapping([])}
                              className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                            >
                              Clear
                            </button>
                            <button 
                              onClick={() => setSelectedProjectsForMapping(projectConfigs.map(p => p.projectId))}
                              className="text-[9px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors"
                            >
                              Select All
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 h-[134px] overflow-y-auto pr-2 custom-scrollbar">
                          {projectConfigs.map(p => (
                            <button
                              key={p.projectId}
                              onClick={() => {
                                setSelectedProjectsForMapping(prev => 
                                  prev.includes(p.projectId) 
                                    ? prev.filter(id => id !== p.projectId) 
                                    : [...prev, p.projectId]
                                );
                              }}
                              className={cn(
                                "flex items-center gap-3 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all text-left",
                                selectedProjectsForMapping.includes(p.projectId)
                                  ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]"
                                  : "bg-slate-900/40 border-slate-800 text-slate-500 hover:border-slate-700"
                              )}
                            >
                              <div className={cn(
                                "w-2 h-2 rounded-full transition-all flex-shrink-0",
                                selectedProjectsForMapping.includes(p.projectId) ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-slate-800"
                              )} />
                              <span className="truncate">{p.projectId}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Right: Active Mapping Reference */}
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Tagged Resources</label>
                        <div className="bg-slate-950/30 border border-slate-800/50 rounded-2xl h-[134px] overflow-y-auto custom-scrollbar p-1">
                          {selectedProjectsForMapping.length === 0 ? (
                            <div className="h-full flex items-center justify-center">
                              <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest text-center px-4">Select projects to view mapped personnel</p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {mappedInSelection.map(emp => (
                                <div key={emp} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/50 rounded-lg group border border-transparent hover:border-slate-800 transition-all">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-300 truncate max-w-[120px]">{emp}</span>
                                  </div>
                                  <button 
                                    onClick={() => handleUnmapResource(emp)}
                                    className="p-1 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              {mappedInSelection.length === 0 && (
                                <div className="h-full py-10 flex items-center justify-center">
                                  <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest">No resources mapped</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-6 border-t border-slate-800/50 gap-4">
                      {editingEmployee && (
                        <button 
                          onClick={() => {
                            setPersonnelInput('');
                            setSelectedProjectsForMapping([]);
                            setEditingEmployee(null);
                          }}
                          className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          Cancel Modification
                        </button>
                      )}
                      <button 
                        onClick={handlePersonnelMapping}
                        disabled={!personnelInput.trim() || selectedProjectsForMapping.length === 0}
                        className={cn(
                          "btn-primary flex items-center gap-2 px-12 py-4 shadow-xl uppercase font-black tracking-[0.2em] text-[11px] transition-all",
                          personnelInput.trim() && selectedProjectsForMapping.length > 0
                            ? (editingEmployee ? "bg-amber-600 hover:bg-amber-500 shadow-amber-500/20" : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20")
                            : "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700"
                        )}
                      >
                        {editingEmployee ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {editingEmployee ? 'Apply Management Changes' : 'Execute Personnel Mapping'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {activeTab === 'mapping-details' && (
              <motion.div
                key="mapping-details"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* 1st segment: SLA Mapping Details */}
                <div className="chart-container overflow-hidden">
                  <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">SLA Mapping Details</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Audit trail for service level benchmark modifications</p>
                    </div>
                    <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] font-black text-amber-500 uppercase tracking-widest">
                      SLA Ledger
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900/50 border-b border-slate-800">
                        <tr>
                          <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-slate-500">Project</th>
                          <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-slate-500">SLA Configuration Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30">
                        {projectConfigs.map(config => {
                          const latestLog = configChanges.find(l => l.projectId === config.projectId && l.type === 'SLA');
                          return (
                            <tr key={config.projectId} className="hover:bg-slate-800/20 transition-colors">
                              <td className="px-6 py-4">
                                <span className="text-[11px] font-black text-blue-400 uppercase tracking-wider bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10">
                                  {config.projectId}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-row gap-2 max-w-none overflow-x-auto whitespace-nowrap pb-1 custom-scrollbar">
                                  {(['P1', 'P2', 'P3', 'P4'] as Priority[]).map((p, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700/50 shadow-sm flex-shrink-0">
                                      <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter w-4">{p}</span>
                                      <div className="flex flex-row gap-3 border-l border-slate-700 pl-2">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Request</span>
                                          <span className="text-[10px] font-bold text-slate-200 leading-none">{config.slas?.[p]?.response || 0}h</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Resolution</span>
                                          <span className="text-[10px] font-bold text-slate-200 leading-none">{config.slas?.[p]?.resolution || 0}h</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2nd segment: Resource Mapping Details (Project wise) */}
                <div className="chart-container overflow-hidden">
                  <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Resource Mapping Details</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Consolidated view of all active personnel project wise</p>
                    </div>
                    <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-black text-blue-500 uppercase tracking-widest">
                      Project Allocation
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900/50 border-b border-slate-800">
                        <tr>
                          <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-slate-500">Project</th>
                          <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-slate-500">User Name</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30">
                        {projectConfigs.map((config) => (
                          <tr key={config.projectId} className="hover:bg-slate-800/20 transition-colors">
                            <td className="px-6 py-4">
                              <span className="text-[11px] font-black text-blue-400 uppercase tracking-wider bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10">
                                {config.projectId}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-2">
                                {(config.employees || []).map(emp => (
                                  <div key={emp} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700/50 shadow-sm">
                                    <div className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[10px] font-black text-blue-400">
                                      {emp.charAt(0)}
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-200">
                                      {emp}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {confirmModal.isOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className={cn(
                      "p-3 rounded-xl",
                      confirmModal.type === 'danger' ? "bg-red-500/10 text-red-500" :
                      confirmModal.type === 'warning' ? "bg-amber-500/10 text-amber-500" :
                      "bg-blue-500/10 text-blue-500"
                    )}>
                      {confirmModal.type === 'danger' ? <Trash2 className="w-6 h-6" /> :
                       confirmModal.type === 'warning' ? <AlertTriangle className="w-6 h-6" /> :
                       <Info className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">{confirmModal.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">{confirmModal.message}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                      className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={confirmModal.onConfirm}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
                        confirmModal.type === 'danger' ? "bg-red-600 hover:bg-red-500 text-white shadow-red-500/20" :
                        confirmModal.type === 'warning' ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20" :
                        "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"
                      )}
                    >
                      {confirmModal.confirmLabel}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function KPICard({ label, value, color, progress, progressColor, className }: any) {
  return (
    <div className={cn("bg-slate-900/40 border border-slate-800 p-4 rounded-xl backdrop-blur-sm", className)}>
      <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-wider">{label}</p>
      <p className={cn("text-2xl font-mono", color)}>{value}</p>
      {progress !== undefined && (
        <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className={cn("h-full", progressColor)} 
          />
        </div>
      )}
    </div>
  );
}

