"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Task = {
    id: string;
    title: string;
    completed: boolean;
    time?: string;
    tag: string;
    createdAt: number;
};

interface TaskContextType {
    tasks: Task[];
    addTask: (title: string, tag: string) => void;
    toggleTask: (id: string) => void;
    deleteTask: (id: string) => void;
    clearCompleted: () => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: React.ReactNode }) {
    const [tasks, setTasks] = useState<Task[]>([]);

    // Load from LocalStorage
    useEffect(() => {
        const saved = localStorage.getItem("opta_tasks");
        if (saved) {
            try {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setTasks(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse tasks", e);
            }
        } else {
            // Default initial tasks
            setTasks([
                { id: "1", title: "Review Project Opta Plan", completed: true, tag: "Planning", createdAt: Date.now(), time: "10:00 AM" },
                { id: "2", title: "Implement Dark Mode Aesthetics", completed: false, tag: "Dev", createdAt: Date.now(), time: "Now" },
            ]);
        }
    }, []);

    // Save to LocalStorage
    useEffect(() => {
        if (tasks.length > 0) {
            localStorage.setItem("opta_tasks", JSON.stringify(tasks));
        }
    }, [tasks]);

    const addTask = (title: string, tag: string) => {
        const newTask: Task = {
            id: crypto.randomUUID(),
            title,
            completed: false,
            tag,
            createdAt: Date.now(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setTasks(prev => [newTask, ...prev]);
    };

    const toggleTask = (id: string) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const deleteTask = (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
    };

    const clearCompleted = () => {
        setTasks(prev => prev.filter(t => !t.completed));
    };

    return (
        <TaskContext.Provider value={{ tasks, addTask, toggleTask, deleteTask, clearCompleted }}>
            {children}
        </TaskContext.Provider>
    );
}

export function useTasks() {
    const context = useContext(TaskContext);
    if (context === undefined) {
        throw new Error("useTasks must be used within a TaskProvider");
    }
    return context;
}
