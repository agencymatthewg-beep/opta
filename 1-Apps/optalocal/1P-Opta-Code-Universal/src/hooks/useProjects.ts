import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { OptaProject } from "../types";

const STORAGE_KEY = "opta:projects";

const DEFAULT_PROJECT: OptaProject = {
    id: "default",
    name: "Default",
    color: "#a855f7",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aiConfig: {},
    notes: [],
    settings: {},
};

export function useProjects() {
    const [projects, setProjects] = useLocalStorage<OptaProject[]>(
        STORAGE_KEY,
        [DEFAULT_PROJECT],
    );
    const [activeProjectId, setActiveProjectId] = useLocalStorage<string>(
        "opta:activeProjectId",
        "default",
    );

    const activeProject = useMemo(
        () => projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? DEFAULT_PROJECT,
        [projects, activeProjectId],
    );

    const createProject = useCallback(
        (partial: Partial<OptaProject> & { name: string; color: string }) => {
            const now = new Date().toISOString();
            const project: OptaProject = {
                id: crypto.randomUUID(),
                createdAt: now,
                updatedAt: now,
                aiConfig: {},
                notes: [],
                settings: {},
                ...partial,
            };
            setProjects((prev) => [...prev, project]);
            return project;
        },
        [setProjects],
    );

    const updateProject = useCallback(
        (id: string, patch: Partial<OptaProject>) => {
            setProjects((prev) =>
                prev.map((p) =>
                    p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
                ),
            );
        },
        [setProjects],
    );

    const deleteProject = useCallback(
        (id: string) => {
            if (id === "default") return; // Cannot delete the default project
            setProjects((prev) => prev.filter((p) => p.id !== id));
            if (activeProjectId === id) setActiveProjectId("default");
        },
        [activeProjectId, setActiveProjectId, setProjects],
    );

    return {
        projects,
        activeProject,
        activeProjectId,
        setActiveProjectId,
        createProject,
        updateProject,
        deleteProject,
    };
}
