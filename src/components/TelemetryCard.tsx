import { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TelemetryCardProps {
  title: string;
  icon: string;
  children: ReactNode;
  className?: string;
}

function TelemetryCard({ title, icon, children, className }: TelemetryCardProps) {
  return (
    <Card className={cn(
      "bg-card/80 border-border/50 backdrop-blur-sm",
      "transition-all duration-300",
      "hover:border-primary/30 hover:glow-sm",
      className
    )}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="text-base">{icon}</span>
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {children}
      </CardContent>
    </Card>
  );
}

export default TelemetryCard;
