import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useConflicts } from '../hooks/useConflicts';
import { useClaude } from '../hooks/useClaude';
import ConflictCard from '../components/ConflictCard';
import PrivacyIndicator from '../components/PrivacyIndicator';

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

/**
 * Warning triangle icon for warning state.
 */
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

/**
 * External link icon for links.
 */
function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

/**
 * Shield icon for privacy section.
 */
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function Settings() {
  const { conflicts, summary, loading } = useConflicts();
  const { status: claudeStatus, loading: claudeLoading, sessionUsage } = useClaude();
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [showPrivacyIndicators, setShowPrivacyIndicators] = useState(true);

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

        {/* Cloud AI Section */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Cloud AI
          </h2>

          {claudeLoading ? (
            <Card>
              <CardContent className="p-5">
                <div className="h-24 flex items-center justify-center">
                  <div className="text-muted-foreground text-sm">Checking Claude API status...</div>
                </div>
              </CardContent>
            </Card>
          ) : claudeStatus?.available ? (
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                    <CheckCircleIcon className="w-5 h-5 text-success" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-foreground">Claude API Configured</div>
                    <div className="text-sm text-muted-foreground">
                      Using {claudeStatus.model || 'Claude Sonnet'}
                    </div>
                  </div>
                </div>
                {sessionUsage.requestCount > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase">
                        Session Usage
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Requests</span>
                        <span className="text-foreground">{sessionUsage.requestCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Input Tokens</span>
                        <span className="text-foreground">{sessionUsage.totalInputTokens.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Output Tokens</span>
                        <span className="text-foreground">{sessionUsage.totalOutputTokens.toLocaleString()}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                    <WarningIcon className="w-5 h-5 text-warning" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-foreground">Claude API Not Configured</div>
                    <div className="text-sm text-muted-foreground">
                      {claudeStatus?.error || 'API key not set'}
                    </div>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    To enable cloud AI features, set your API key:
                  </div>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                    <li>
                      Get an API key from{' '}
                      <a
                        href="https://console.anthropic.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        console.anthropic.com
                        <ExternalLinkIcon className="w-3 h-3" />
                      </a>
                    </li>
                    <li>Set ANTHROPIC_API_KEY environment variable</li>
                    <li>Restart Opta</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Privacy Section */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Privacy
          </h2>

          <Card className="border-success/30 bg-success/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                  <ShieldIcon className="w-5 h-5 text-success" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground">Your Data is Protected</div>
                  <div className="text-sm text-muted-foreground">
                    Sensitive information is anonymized before cloud transmission
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              {/* Privacy model explanation */}
              <div>
                <div className="text-sm font-medium text-foreground mb-2">How Opta Protects Your Privacy</div>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <PrivacyIndicator backend="local" className="flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">Local queries</strong> stay completely on your device. No data is transmitted.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <PrivacyIndicator backend="cloud" anonymizedFields={[]} className="flex-shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">Cloud queries</strong> have sensitive data automatically removed before transmission.
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Sample anonymization */}
              <div>
                <div className="text-sm font-medium text-foreground mb-2">What Gets Anonymized</div>
                <div className="text-sm text-muted-foreground space-y-1.5">
                  <div className="flex items-center gap-2">
                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs">/Users/john/</code>
                    <span className="text-muted-foreground/60">-&gt;</span>
                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs">/Users/[USER]/</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs">192.168.1.100</code>
                    <span className="text-muted-foreground/60">-&gt;</span>
                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs">[IP_ADDR]</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs">AA:BB:CC:DD:EE:FF</code>
                    <span className="text-muted-foreground/60">-&gt;</span>
                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs">[MAC_ADDR]</code>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Privacy indicator toggle */}
              <div className="flex justify-between items-center gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">Show Privacy Indicators</span>
                  <span className="text-xs text-muted-foreground">
                    Display privacy badges on chat messages
                  </span>
                </div>
                <Switch
                  checked={showPrivacyIndicators}
                  onCheckedChange={setShowPrivacyIndicators}
                />
              </div>
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
