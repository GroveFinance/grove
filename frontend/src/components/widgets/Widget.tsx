import type { ReactNode } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface BaseWidgetProps<T = unknown> {
  title?: string
  children?: ReactNode | ((data: T) => ReactNode)
  className?: string
  headerActions?: ReactNode
  data?: T
}

export default function Widget<T = unknown>({
  title,
  children,
  className,
  headerActions,
  data,
}: BaseWidgetProps<T>) {
  const content =
    typeof children === "function" ? children(data as T) : children

  return (
    <Card
      className={cn(
        "h-full flex flex-col shadow-sm border-border/50 bg-card py-4 gap-3",
        className
      )}
    >
      {title && (
        <CardHeader className="flex-shrink-0 pb-0 px-4 widget-drag-handle">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-card-foreground">
              {title}
            </CardTitle>
            {headerActions && (
              <div className="flex items-center gap-2">{headerActions}</div>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className="flex-1 min-h-0 px-4 overflow-auto">
        {content}
      </CardContent>
    </Card>
  )
}
