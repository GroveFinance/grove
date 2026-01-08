import { useMemo } from "react"

interface AsyncResult<T> {
  data: T | undefined
  isLoading: boolean
  error: Error | null
  hasData: boolean
}

export function useAsyncData<T>(
  data: T | undefined,
  isLoading: boolean,
  error: Error | null
): AsyncResult<T> {
  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      hasData: !!data && !isLoading && !error,
    }),
    [data, isLoading, error]
  )
}