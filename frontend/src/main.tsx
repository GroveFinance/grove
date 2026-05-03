import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { toast } from "sonner";
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry failed requests with exponential backoff
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && 'status' in error) {
          const status = (error as Error & { status?: number }).status;
          if (status && status >= 400 && status < 500) return false;
        }
        // Retry up to 2 times for network/server errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Show stale data while refetching
      staleTime: 30000, // 30 seconds
    },
    mutations: {
      // Default mutation settings
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Global error handler using QueryCache
queryClient.getQueryCache().config.onError = (error) => {
  console.error('Query error:', error);

  // Network error (fetch failed)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    toast.error('Connection Error', {
      description: 'Unable to connect to the server. Please check if the backend is running.',
      duration: 5000,
    });
    return;
  }

  // API error with status
  if (error instanceof Error && 'status' in error) {
    const status = (error as Error & { status?: number }).status;

    if (status === 404) {
      // Don't show toast for 404s - they're often expected
      return;
    }

    if (status && status >= 500) {
      toast.error('Server Error', {
        description: 'The server encountered an error. Please try again later.',
        duration: 5000,
      });
      return;
    }
  }

  // Generic error fallback
  toast.error('Error', {
    description: error instanceof Error ? error.message : 'An unexpected error occurred',
    duration: 5000,
  });
};

// Global mutation error handler using MutationCache
queryClient.getMutationCache().config.onError = (error) => {
  console.error('Mutation error:', error);

  // Network error
  if (error instanceof TypeError && error.message.includes('fetch')) {
    toast.error('Connection Error', {
      description: 'Unable to save changes. Please check if the backend is running.',
      duration: 5000,
    });
    return;
  }

  // API error
  if (error instanceof Error && 'status' in error) {
    const status = (error as Error & { status?: number }).status;

    if (status && status >= 500) {
      toast.error('Server Error', {
        description: 'Failed to save changes. Please try again.',
        duration: 5000,
      });
      return;
    }

    if (status && status >= 400 && status < 500) {
      toast.error('Invalid Request', {
        description: 'Please check your input and try again.',
        duration: 5000,
      });
      return;
    }
  }

  // Generic error
  toast.error('Error', {
    description: error instanceof Error ? error.message : 'Failed to save changes',
    duration: 5000,
  });
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>
);