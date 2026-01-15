import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

function Settings() {
  return (
    <div className="page max-w-2xl">
      <h1 className="page-title text-glow-primary">Settings</h1>

      <div className="flex flex-col gap-8 mt-6">
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
