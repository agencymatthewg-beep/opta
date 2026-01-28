import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu, BarChart3, Newspaper, TrendingUp } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Top Models - Glass Card */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-neon-cyan" />
            <CardTitle>Top Models</CardTitle>
          </div>
          <CardDescription>Highest performing AI models this week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">GPT-4o</span>
              <div className="flex gap-2">
                <Badge variant="info" size="sm">OpenAI</Badge>
                <Badge variant="success" size="sm">#1</Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">Claude 3.5 Sonnet</span>
              <div className="flex gap-2">
                <Badge variant="purple" size="sm">Anthropic</Badge>
                <Badge size="sm">#2</Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">Gemini 1.5 Pro</span>
              <div className="flex gap-2">
                <Badge variant="warning" size="sm">Google</Badge>
                <Badge size="sm">#3</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Benchmarks - Glass Card */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-neon-purple" />
            <CardTitle>Recent Benchmarks</CardTitle>
          </div>
          <CardDescription>Latest benchmark results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center border border-opta-border rounded-lg bg-opta-surface/50">
            <span className="text-white/40 text-sm">Chart placeholder</span>
          </div>
          <p className="mt-3 text-sm text-white/60">
            Interactive benchmark comparison coming soon...
          </p>
        </CardContent>
      </Card>

      {/* Latest News - Default Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Newspaper className="h-5 w-5 text-neon-orange" />
            <CardTitle>Latest News</CardTitle>
          </div>
          <CardDescription>AI industry updates</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="text-sm text-white/80 pb-2 border-b border-opta-border">
              OpenAI announces GPT-5 research preview
            </li>
            <li className="text-sm text-white/80 pb-2 border-b border-opta-border">
              Anthropic releases Claude 4 with improved reasoning
            </li>
            <li className="text-sm text-white/80">
              Google DeepMind unveils Gemini 2.0
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Quick Stats - Default Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-neon-green" />
            <CardTitle>Quick Stats</CardTitle>
          </div>
          <CardDescription>Platform overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-lg bg-opta-surface border border-opta-border">
              <div className="text-2xl font-bold text-neon-cyan">128</div>
              <div className="text-xs text-white/60 mt-1">Models Tracked</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-opta-surface border border-opta-border">
              <div className="text-2xl font-bold text-neon-purple">47</div>
              <div className="text-xs text-white/60 mt-1">Benchmarks</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-opta-surface border border-opta-border">
              <div className="text-2xl font-bold text-neon-green">12</div>
              <div className="text-xs text-white/60 mt-1">Providers</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-opta-surface border border-opta-border">
              <div className="text-2xl font-bold text-neon-orange">24h</div>
              <div className="text-xs text-white/60 mt-1">Last Update</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
