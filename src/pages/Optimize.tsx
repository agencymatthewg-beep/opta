import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

function Optimize() {
  return (
    <div className="page max-w-3xl">
      <h1 className="page-title text-glow-primary">Optimize</h1>

      {/* Hero Section */}
      <div className="text-center py-12 mb-8">
        <Button
          size="lg"
          className="h-auto px-12 py-5 text-lg font-semibold glow-lg-success disabled:glow-none disabled:bg-card disabled:text-muted-foreground"
          disabled
        >
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          One-Click Optimize
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">
          Automatically optimize your system for maximum gaming performance
        </p>
      </div>

      {/* Games Section */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Detected Games</h2>
        <Card>
          <CardContent className="p-8">
            <div className="text-center py-6">
              <svg className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5z" />
              </svg>
              <p className="text-base text-foreground mb-2">No games detected yet.</p>
              <p className="text-sm text-muted-foreground">Game detection coming in Phase 7...</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default Optimize;
