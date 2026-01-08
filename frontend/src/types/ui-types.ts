
// todo: not in use right now
export interface AsyncState<T> {
  data?: T
  isLoading: boolean
  error?: Error | null
  noData?: string | null
}