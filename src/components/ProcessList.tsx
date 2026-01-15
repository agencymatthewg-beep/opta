/**
 * ProcessList component for displaying running processes.
 *
 * Shows a scrollable table of processes with resource usage and categorization.
 * Supports click-to-select for future Stealth Mode integration.
 */

import { useState } from 'react';
import { useProcesses } from '../hooks/useProcesses';
import type { ProcessInfo, ProcessCategory } from '../types/processes';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface ProcessRowProps {
  process: ProcessInfo;
  isSelected: boolean;
  onSelect: (pid: number) => void;
}

/**
 * Badge component for process category.
 */
function CategoryBadge({ category }: { category: ProcessCategory }) {
  const variantMap: Record<ProcessCategory, 'secondary' | 'default' | 'warning'> = {
    system: 'secondary',
    user: 'default',
    'safe-to-kill': 'warning',
  };

  return (
    <Badge variant={variantMap[category]} className="text-[10px] uppercase tracking-wide">
      {category}
    </Badge>
  );
}

/**
 * Single process row component.
 */
function ProcessRow({ process, isSelected, onSelect }: ProcessRowProps) {
  return (
    <TableRow
      className={cn(
        "cursor-pointer transition-colors",
        isSelected && "bg-primary/10 hover:bg-primary/15"
      )}
      onClick={() => onSelect(process.pid)}
      data-state={isSelected ? 'selected' : undefined}
    >
      <TableCell
        className="font-medium text-foreground max-w-[200px] truncate"
        title={process.name}
      >
        {process.name}
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground">
        {process.cpu_percent.toFixed(1)}%
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground">
        {process.memory_percent.toFixed(1)}%
      </TableCell>
      <TableCell className="text-center">
        <CategoryBadge category={process.category} />
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground/70">
        {process.pid}
      </TableCell>
    </TableRow>
  );
}

/**
 * Loading skeleton for process list.
 */
function ProcessListSkeleton() {
  return (
    <Card className="bg-card/80 border-border/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="h-5 w-40 rounded animate-shimmer" />
      </CardHeader>
      <CardContent className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3 py-2 border-b border-border/20 last:border-0">
            <div className="flex-[2] h-4 rounded animate-shimmer" />
            <div className="w-12 h-4 rounded animate-shimmer" />
            <div className="w-12 h-4 rounded animate-shimmer" />
            <div className="w-16 h-4 rounded animate-shimmer" />
            <div className="w-12 h-4 rounded animate-shimmer" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * ProcessList component showing running processes with resource usage.
 */
function ProcessList() {
  const { processes, loading, error, refresh } = useProcesses(3000);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);

  const handleSelect = (pid: number) => {
    setSelectedPid(selectedPid === pid ? null : pid);
  };

  if (loading && !processes) {
    return <ProcessListSkeleton />;
  }

  if (error) {
    return (
      <Card className="bg-card/80 border-border/50 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-12 h-12 flex items-center justify-center text-xl font-bold text-danger bg-danger/10 border-2 border-danger rounded-full">
            !
          </div>
          <p className="text-sm text-muted-foreground text-center">{error}</p>
          <Button onClick={refresh} size="sm" className="glow-sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const processCount = processes?.length ?? 0;

  return (
    <Card className={cn(
      "bg-card/80 border-border/50 backdrop-blur-sm",
      "transition-all duration-300",
      "hover:border-primary/30 hover:glow-sm"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
          Running Processes
          <span className="text-xs font-normal text-muted-foreground">({processCount})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[400px] rounded-lg bg-background/50">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-primary/5 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="w-[40%] text-primary text-xs uppercase tracking-wide font-semibold">
                  Name
                </TableHead>
                <TableHead className="w-[12%] text-right text-primary text-xs uppercase tracking-wide font-semibold">
                  CPU%
                </TableHead>
                <TableHead className="w-[12%] text-right text-primary text-xs uppercase tracking-wide font-semibold">
                  Mem%
                </TableHead>
                <TableHead className="w-[20%] text-center text-primary text-xs uppercase tracking-wide font-semibold">
                  Category
                </TableHead>
                <TableHead className="w-[16%] text-right text-primary text-xs uppercase tracking-wide font-semibold">
                  PID
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processes?.map((process) => (
                <ProcessRow
                  key={process.pid}
                  process={process}
                  isSelected={selectedPid === process.pid}
                  onSelect={handleSelect}
                />
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default ProcessList;
