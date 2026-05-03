import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WifiOff } from "lucide-react";

/**
 * Connection status indicator that shows when the backend is unreachable.
 * Polls the system info endpoint every 10 seconds.
 */
export function ConnectionStatus() {
  const { isError, error } = useQuery({
    queryKey: ["connection-check"],
    queryFn: async () => {
      const res = await fetch("/api/system/info");
      if (!res.ok) throw new Error("Connection failed");
      return res.json();
    },
    refetchInterval: 10000, // Check every 10 seconds
    retry: false, // Don't retry - we just want to know current status
    retryOnMount: false,
  });

  // Network error (fetch failed) indicates backend is down
  const isNetworkError =
    isError &&
    error instanceof TypeError &&
    error.message.includes("fetch");

  if (!isNetworkError) {
    return null; // Connection is fine
  }

  return (
    <Alert variant="destructive" className="fixed bottom-4 right-4 w-96 z-50 shadow-lg">
      <WifiOff className="h-4 w-4" />
      <AlertDescription>
        <strong>Connection Lost</strong>
        <br />
        Unable to reach the backend server. Please check if the server is running.
      </AlertDescription>
    </Alert>
  );
}
