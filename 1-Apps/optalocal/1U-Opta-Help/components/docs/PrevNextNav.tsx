import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { NavItem } from "@/lib/content";

interface PrevNextNavProps {
  prev?: NavItem;
  next?: NavItem;
}

export function PrevNextNav({ prev, next }: PrevNextNavProps) {
  if (!prev && !next) return null;

  return (
    <div className="flex items-stretch gap-4 mt-12 pt-4">
      {prev ? (
        <Link
          href={prev.href}
          className="flex-1 group doc-embed-block rounded-lg p-4 transition-all hover:bg-primary/[0.05]"
        >
          <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
            <ArrowLeft size={12} className="transition-transform duration-150 group-hover:-translate-x-0.5" />
            Previous
          </div>
          <div className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors">
            {prev.title}
          </div>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
      {next ? (
        <Link
          href={next.href}
          className="flex-1 group doc-embed-block rounded-lg p-4 text-right transition-all hover:bg-primary/[0.05]"
        >
          <div className="flex items-center justify-end gap-2 text-xs text-text-muted mb-1">
            Next
            <ArrowRight size={12} className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </div>
          <div className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors">
            {next.title}
          </div>
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}
