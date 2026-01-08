import type { ReactNode } from "react"
import { Spinner } from "@/components/ui/shadcn-io/spinner"

type AsyncRendererProps<T> = {
  isLoading: boolean
  error: Error | null
  noData?: string | null
  data?: T
  children: (data: T) => ReactNode
}

export function AsyncRenderer<T>({
  isLoading,
  error,
  noData,
  data,
  children,
}: AsyncRendererProps<T>) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return <div className="text-red-500 p-4">{error.message}</div>
  }

  if (noData) {
    return <div className="text-gray-500 p-4">{noData}</div>
  }

  if (data !== undefined) {
    return <>{children(data)}</>
  }

  return null
}
