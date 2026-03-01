"use client";

interface Step {
  title: string;
  description?: string;
  content?: React.ReactNode;
}

interface StepListProps {
  steps: Step[];
}

export function StepList({ steps }: StepListProps) {
  return (
    <div className="space-y-6 mb-6">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary shrink-0">
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className="w-px flex-1 bg-white/5 mt-2" />
            )}
          </div>
          <div className="flex-1 pb-2">
            <h4 className="text-sm font-semibold text-text-primary mb-1">{step.title}</h4>
            {step.description && (
              <p className="text-sm text-text-secondary mb-2">{step.description}</p>
            )}
            {step.content}
          </div>
        </div>
      ))}
    </div>
  );
}
