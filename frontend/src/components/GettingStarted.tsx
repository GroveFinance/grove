import { Link } from "react-router-dom";
import { CheckCircle2, Circle, X, ChevronRight } from "lucide-react";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface GettingStartedProps {
  onNavClick?: () => void;
}

export function GettingStarted({ onNavClick }: GettingStartedProps) {
  const { steps, completedCount, totalCount, isComplete, isDismissed, dismiss } =
    useOnboardingProgress();

  if (isDismissed) {
    return null;
  }

  const progressPercent = (completedCount / totalCount) * 100;

  return (
    <Collapsible defaultOpen={!isComplete} className="group/collapsible">
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex items-center justify-between p-3 pb-2">
          <div className="flex items-center gap-2 flex-1">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent">
                <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                <span className="font-semibold text-sm">Getting Started</span>
              </Button>
            </CollapsibleTrigger>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-sm opacity-70 hover:opacity-100"
            onClick={dismiss}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>

        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {completedCount} of {totalCount} complete
            </span>
          </div>
          <Progress value={progressPercent} className="h-1.5 mt-1.5" />
        </div>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-1">
            {steps.map((step) => (
              <Link
                key={step.id}
                to={step.href}
                onClick={onNavClick}
                className={cn(
                  "flex items-start gap-2 p-2 rounded-md hover:bg-accent transition-colors group",
                  step.completed && "opacity-60"
                )}
              >
                <div className="mt-0.5">
                  {step.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-none mb-1">
                    {step.title}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {step.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {isComplete && (
            <div className="px-3 pb-3 pt-1 border-t">
              <div className="text-xs text-center text-muted-foreground py-2">
                🎉 You're all set! You can dismiss this checklist.
              </div>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
