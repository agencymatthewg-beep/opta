// TODO: UI design — Gemini will implement the visual design for this page.
// Backend is fully wired: list, show, save, activate, delete.
import { useState } from "react";
import { useEnvProfiles } from "../hooks/useEnvProfiles";
import type { DaemonConnectionOptions, EnvProfile } from "../types";

interface EnvProfilesPageProps {
  connection: DaemonConnectionOptions;
}

type EditingProfile = {
  name: string;
  description: string;
  vars: { key: string; value: string }[];
};

function blankEditingProfile(): EditingProfile {
  return { name: "", description: "", vars: [{ key: "", value: "" }] };
}

function profileToEditing(p: EnvProfile): EditingProfile {
  return {
    name: p.name,
    description: p.description ?? "",
    vars: Object.entries(p.vars).map(([key, value]) => ({ key, value })),
  };
}

function editingToProfile(e: EditingProfile): Pick<EnvProfile, "name" | "vars" | "description"> {
  return {
    name: e.name.trim(),
    description: e.description.trim() || undefined,
    vars: Object.fromEntries(e.vars.filter((v) => v.key.trim()).map((v) => [v.key.trim(), v.value])),
  };
}

export function EnvProfilesPage({ connection }: EnvProfilesPageProps) {
  const { profiles, activeProfile, loading, error, saving, refresh, saveProfile, deleteProfile, activateProfile, deactivate } =
    useEnvProfiles(connection);

  const [editing, setEditing] = useState<EditingProfile | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const startNew = () => {
    setEditing(blankEditingProfile());
    setIsNew(true);
    setSaveError(null);
  };

  const startEdit = (profile: EnvProfile) => {
    setEditing(profileToEditing(profile));
    setIsNew(false);
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setIsNew(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    const profile = editingToProfile(editing);
    if (!profile.name) {
      setSaveError("Profile name is required.");
      return;
    }
    setSaveError(null);
    try {
      await saveProfile(profile);
      setEditing(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (name: string) => {
    await deleteProfile(name);
    setConfirmDeleteName(null);
    if (editing && !isNew) setEditing(null);
  };

  const updateVar = (index: number, field: "key" | "value", value: string) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const vars = [...prev.vars];
      vars[index] = { ...vars[index], [field]: value };
      return { ...prev, vars };
    });
  };

  const addVar = () => {
    setEditing((prev) => prev ? { ...prev, vars: [...prev.vars, { key: "", value: "" }] } : prev);
  };

  const removeVar = (index: number) => {
    setEditing((prev) => prev ? { ...prev, vars: prev.vars.filter((_, i) => i !== index) } : prev);
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Profile list */}
      <div className="flex flex-col gap-2 w-56 shrink-0">
        <button type="button" onClick={startNew} className="opta-studio-btn w-full">
          + New Profile
        </button>

        {loading && <div className="text-xs text-zinc-500 text-center py-4">Loading…</div>}
        {error && <div className="text-xs text-red-400">{error}</div>}

        {profiles.map((profile) => (
          <div
            key={profile.name}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              profile.isActive
                ? "border-[var(--opta-primary)] bg-[var(--opta-primary)]/10"
                : "border-[var(--opta-border)] bg-white/5 hover:bg-white/10"
            }`}
            onClick={() => startEdit(profile)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && startEdit(profile)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-50 truncate">{profile.name}</span>
              {profile.isActive && (
                <span className="text-[10px] text-[var(--opta-primary)] font-semibold ml-1 shrink-0">ACTIVE</span>
              )}
            </div>
            {profile.description && (
              <div className="text-xs text-zinc-400 mt-0.5 truncate">{profile.description}</div>
            )}
            <div className="text-xs text-zinc-600 mt-1">
              {Object.keys(profile.vars).length} variable{Object.keys(profile.vars).length !== 1 ? "s" : ""}
            </div>
          </div>
        ))}

        {profiles.length === 0 && !loading && (
          <div className="text-xs text-zinc-500 text-center py-4">No profiles yet.</div>
        )}
      </div>

      {/* Editor */}
      {editing ? (
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
          {saveError && <div className="st-status-banner st-status-banner-error">{saveError}</div>}

          <div className="flex flex-col gap-2">
            <label className="st-label">Profile name</label>
            <input
              type="text"
              value={editing.name}
              onChange={(e) => setEditing((prev) => prev ? { ...prev, name: e.target.value } : prev)}
              disabled={!isNew}
              placeholder="production, staging, local…"
              className="opta-studio-input"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="st-label">Description (optional)</label>
            <input
              type="text"
              value={editing.description}
              onChange={(e) => setEditing((prev) => prev ? { ...prev, description: e.target.value } : prev)}
              placeholder="What this profile is for…"
              className="opta-studio-input"
            />
          </div>

          {/* Env vars table */}
          <div className="flex flex-col gap-2">
            <label className="st-label">Environment variables</label>
            {editing.vars.map((v, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={v.key}
                  onChange={(e) => updateVar(i, "key", e.target.value)}
                  placeholder="KEY"
                  className="opta-studio-input font-mono text-xs flex-1"
                />
                <input
                  type="text"
                  value={v.value}
                  onChange={(e) => updateVar(i, "value", e.target.value)}
                  placeholder="value"
                  className="opta-studio-input font-mono text-xs flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeVar(i)}
                  className="opta-studio-btn-secondary px-2 text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={addVar} className="opta-studio-btn-secondary text-sm w-max">
              + Add variable
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="opta-studio-btn">
              {saving ? "Saving…" : isNew ? "Create profile" : "Save changes"}
            </button>

            {!isNew && (
              <button
                type="button"
                onClick={() => void activateProfile(editing.name)}
                disabled={saving || activeProfile === editing.name}
                className="opta-studio-btn-secondary"
              >
                {activeProfile === editing.name ? "Currently active" : "Set as active"}
              </button>
            )}

            {!isNew && activeProfile === editing.name && (
              <button
                type="button"
                onClick={() => void deactivate()}
                disabled={saving}
                className="opta-studio-btn-secondary"
              >
                Deactivate
              </button>
            )}

            <button type="button" onClick={cancelEdit} className="opta-studio-btn-secondary">
              Cancel
            </button>

            {!isNew && (
              confirmDeleteName === editing.name ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDelete(editing.name)}
                    disabled={saving}
                    className="opta-studio-btn text-red-400 border-red-500/30"
                  >
                    Confirm delete
                  </button>
                  <button type="button" onClick={() => setConfirmDeleteName(null)} className="opta-studio-btn-secondary">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteName(editing.name)}
                  className="opta-studio-btn-secondary text-red-400 border-red-500/30 ml-auto"
                >
                  Delete profile
                </button>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          Select a profile to edit, or create a new one.
        </div>
      )}
    </div>
  );
}
