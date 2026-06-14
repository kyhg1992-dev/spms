import { useCallback, useState } from "react"

type AsyncState<T> = {
  loading: boolean
  data: T | null
  error: string | null
}

export function useAsyncState<T>() {
  const [state, setState] = useState<AsyncState<T>>({
    loading: false,
    data: null,
    error: null,
  })

  const run = useCallback(async (task: () => Promise<T>) => {
    setState({ loading: true, data: null, error: null })
    try {
      const result = await task()
      setState({ loading: false, data: result, error: null })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      setState({ loading: false, data: null, error: message })
      throw error
    }
  }, [])

  const reset = useCallback(() => {
    setState({ loading: false, data: null, error: null })
  }, [])

  return { ...state, run, reset }
}

export type { AsyncState }
