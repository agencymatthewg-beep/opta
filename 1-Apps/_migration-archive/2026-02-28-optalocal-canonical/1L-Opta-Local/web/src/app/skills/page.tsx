'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import type {
  SkillDefinition,
  SkillExecuteResponse,
  SkillsListResponse,
} from '@/types/skills';

function extractSkills(response: SkillsListResponse): SkillDefinition[] {
  if (response.data && Array.isArray(response.data)) return response.data;
  if (response.skills && Array.isArray(response.skills)) return response.skills;
  return [];
}

export default function SkillsPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [payloadText, setPayloadText] = useState('{\n  "text": "hello"\n}');
  const [result, setResult] = useState<SkillExecuteResponse | null>(null);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    if (!client) return;
    setIsLoadingSkills(true);
    setError(null);
    try {
      const list = await client.listSkills();
      const extracted = extractSkills(list);
      setSkills(extracted);
      setSelectedSkillName((current) => current ?? extracted[0]?.name ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load skills list',
      );
    } finally {
      setIsLoadingSkills(false);
    }
  }, [client]);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.name === selectedSkillName) ?? null,
    [selectedSkillName, skills],
  );

  const runSkill = useCallback(async () => {
    if (!client || !selectedSkillName) return;

    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const parsedPayload = JSON.parse(payloadText) as object;
      const execution = await client.executeSkill(selectedSkillName, {
        arguments: parsedPayload,
      });
      setResult(execution);
    } catch (runError) {
      setError(
        runError instanceof Error ? runError.message : 'Failed to execute skill',
      );
    } finally {
      setIsRunning(false);
    }
  }, [client, payloadText, selectedSkillName]);

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-text-primary">Skills</h1>
        <p className="text-sm text-text-secondary">
          Discover registered skills and execute them with explicit arguments.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="rounded-lg border border-opta-border bg-opta-surface/20">
          <div className="flex items-center justify-between border-b border-opta-border px-3 py-2">
            <span className="text-xs uppercase tracking-[0.12em] text-text-muted">
              Skills
            </span>
            <button
              type="button"
              className="text-xs text-text-secondary hover:text-text-primary"
              onClick={() => void loadSkills()}
              disabled={isLoadingSkills || !client}
            >
              {isLoadingSkills ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="max-h-[70vh] overflow-auto p-2">
            {skills.map((skill) => (
              <button
                key={skill.name}
                type="button"
                data-testid="skill-item"
                onClick={() => setSelectedSkillName(skill.name)}
                className="mb-1 w-full rounded border border-opta-border bg-opta-surface/30 px-2 py-2 text-left text-xs text-text-primary"
              >
                <div className="font-mono">{skill.name}</div>
                {skill.description ? (
                  <div className="mt-0.5 text-text-muted">{skill.description}</div>
                ) : null}
              </button>
            ))}
            {skills.length === 0 && (
              <p className="px-2 py-3 text-xs text-text-muted">No skills available.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-opta-border bg-opta-surface/20 p-4">
          <h2 className="mb-2 text-xs uppercase tracking-[0.12em] text-text-muted">
            Selected Skill
          </h2>
          {selectedSkill ? (
            <div className="mb-3 text-xs text-text-primary">
              <div className="font-mono">{selectedSkill.name}</div>
              <div className="text-text-secondary">
                {selectedSkill.description ?? 'No description'}
              </div>
            </div>
          ) : (
            <p className="mb-3 text-xs text-text-muted">Select a skill first.</p>
          )}

          <label
            htmlFor="skills-payload"
            className="mb-1 block text-xs uppercase tracking-[0.12em] text-text-muted"
          >
            Arguments (JSON)
          </label>
          <textarea
            id="skills-payload"
            data-testid="skill-payload-input"
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            className="mb-3 h-40 w-full rounded border border-opta-border bg-opta-surface/30 p-2 font-mono text-xs text-text-primary"
          />

          <div className="mb-3">
            <button
              type="button"
              data-testid="run-skill-button"
              className="rounded border border-opta-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
              onClick={() => void runSkill()}
              disabled={!selectedSkillName || isRunning || !client}
            >
              {isRunning ? 'Running...' : 'Run Skill'}
            </button>
          </div>

          {error && (
            <p className="mb-2 rounded border border-neon-red/40 bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
              {error}
            </p>
          )}

          <h3 className="mb-1 text-xs uppercase tracking-[0.12em] text-text-muted">
            Result
          </h3>
          <pre
            data-testid="skill-result-panel"
            className="max-h-64 overflow-auto rounded border border-opta-border bg-opta-surface/30 p-2 text-xs text-text-secondary"
          >
            {result ? JSON.stringify(result, null, 2) : 'No result yet.'}
          </pre>
        </section>
      </div>
    </main>
  );
}

