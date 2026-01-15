import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useConflicts } from '../hooks/useConflicts';
import ConflictCard from '../components/ConflictCard';

/**
 * Check circle icon for success state.
 */
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function Settings() {
  const { conflicts, summary, loading } = useConflicts();
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  const handleDismiss = (toolId: string) => {
    setAcknowledgedIds((prev) => new Set([...prev, toolId]));
  };

  const handleLearnMore = (toolId: string) => {
    // Placeholder for future docs link
    console.log('Learn more about:', toolId);
  };
  return (
    <div className="page max-w-2xl">
      <h1 className="page-title text-glow-primary">Settings</h1>

      <div className="flex flex-col gap-8 mt-6">
        {/* Detected Conflicts Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Detected Conflicts
            </h2>
            {!loading && summary && summary.total_count > 0 && (
              <Badge
                variant={
                  summary.high_count > 0
                    ? 'destructive'
                    : summary.medium_count > 0
                    ? 'warning'
                    : 'secondary'
                }
                className="text-xs"
              >
                {summary.total_count}
              </Badge>
            )}
          </div>

          {loading ? (
            <Card>
              <CardContent className="p-5">
                <div className="h-24 flex items-center justify-center">
                  <div className="text-muted-foreground text-sm">Scanning for conflicts...</div>
                </div>
              </CardContent>
            </Card>
          ) : conflicts.length === 0 ? (
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                    <CheckCircleIcon className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">No conflicts detected</div>
                    <div className="text-sm text-muted-foreground">
                      Opta has full control over system optimizations
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                These tools may interfere with Opta's optimizations. Consider disabling them for best results.
              </p>
              {conflicts.map((conflict) => (
                <ConflictCard
                  key={conflict.tool_id}
                  conflict={conflict}
                  acknowledged={acknowledgedIds.has(conflict.tool_id)}
                  onDismiss={handleDismiss}
                  onLearnMore={handleLearnMore}
                />
              ))}
            </div>
          )}
        </section>

        {/* AI Configuration Section */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            AI Configuration
          </h2>
          <Card>
            <CardContent className="p-5">
              <div className="flex justify-between items-center gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">AI Mode</span>
                  <span className="text-xs text-muted-foreground">
                    Choose between local or cloud AI processing
                  </span>
                </div>
                <select
                  className="px-4 py-2 text-sm bg-secondary text-foreground border border-border rounded-lg cursor-not-allowed opacity-50"
                  disabled
                >
                  <option>Local (Llama 3)</option>
                  <option>Cloud (Claude)</option>
                  <option>Hybrid (Auto)</option>
                </select>
              </div>
              <Separator className="my-4" />
              <p className="text-xs text-muted-foreground italic">
                AI configuration coming in Phase 5-6...
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Appearance Section */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Appearance
          </h2>
          <Card>
            <CardContent className="p-5">
              <div className="flex justify-between items-center gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">Theme</span>
                  <span className="text-xs text-muted-foreground">
                    Customize the app appearance
                  </span>
                </div>
                <select
                  className="px-4 py-2 text-sm bg-secondary text-foreground border border-border rounded-lg cursor-not-allowed opacity-50"
                  disabled
                >
                  <option>Dark (Default)</option>
                  <option>Light</option>
                  <option>System</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* About Section */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            About
          </h2>
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Version</span>
                <span className="text-sm font-medium text-foreground">0.1.0</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Build</span>
                <span className="text-sm font-medium text-foreground">Foundation</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Platform</span>
                <span className="text-sm font-medium text-foreground">Tauri v2</span>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

export default Settings;
