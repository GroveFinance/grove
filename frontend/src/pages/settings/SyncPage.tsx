import { MainLayout } from "@/layouts/MainLayout";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { useSyncSettings } from "@/hooks/useSyncSettings";
import { useGlobalSyncStatus } from "@/hooks/useGlobalSyncStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { triggerSyncFromDate } from "@/services/api";
import { downloadRawResponse } from "@/services/api/sync";
import { Loader2, ChevronDown } from "lucide-react";
import { AdvancedSyncDialog } from "@/components/ui/AdvancedSyncDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SimplefinSettingsPage() {
  const { data, loading, error, saveToken, refetch } = useSyncSettings();
  const { latestRun, isSyncing, triggerSyncNow, refetch: refetchSyncStatus } = useGlobalSyncStatus();
  const [token, setToken] = useState("");
  const [showAdvancedDialog, setShowAdvancedDialog] = useState(false);
  const [shouldCaptureRaw, setShouldCaptureRaw] = useState(false);

  // Refresh sync settings when sync completes successfully
  useEffect(() => {
    if (latestRun && latestRun.status === "completed" && !isSyncing) {
      // Refresh sync settings to update last_sync timestamp
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestRun?.status, isSyncing, refetch]);

  // Auto-download raw response when sync completes
  useEffect(() => {
    if (
      shouldCaptureRaw &&
      latestRun &&
      latestRun.status === "completed"
    ) {
      handleDownloadRaw(latestRun.id);
      setShouldCaptureRaw(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestRun?.status, shouldCaptureRaw]);

  const handleSave = async () => {
    if (!token.trim()) return;
    try {
      await saveToken(token.trim());
      setToken("");
      // The hook triggers a sync after saving, so start polling for the new run
      setTimeout(() => refetchSyncStatus(), 1000);
    } catch {
      // error handled in hook
    }
  };

  const handleSyncNow = async () => {
    triggerSyncNow();
  };

  const handleAdvancedSync = async (daysBack: number, captureRaw: boolean) => {
    setShouldCaptureRaw(captureRaw);
    try {
      await triggerSyncFromDate("simplefin", daysBack, captureRaw);
      // Start polling for the new run
      setTimeout(() => refetchSyncStatus(), 1000);
    } catch (err) {
      console.error("Failed to trigger advanced sync:", err);
      setShouldCaptureRaw(false);
    }
  };

  const handleDownloadRaw = async (runId: number) => {
    // Retry logic to handle timing issues - raw data may not be in cache immediately
    const maxRetries = 5;
    const retryDelay = 500; // ms

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Add a small delay before first attempt to let the cache populate
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        const blob = await downloadRawResponse(runId);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `simplefin_raw_${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        console.log("Raw response downloaded successfully");
        return; // Success, exit the function
      } catch (err) {
        if (attempt === maxRetries - 1) {
          // Last attempt failed
          console.error("Failed to download raw response after retries:", err);
          // Could show a toast notification here
        } else {
          console.log(`Download attempt ${attempt + 1} failed, retrying...`);
        }
      }
    }
  };

  if (loading) return <p>Loading...</p>;

  const noConfig = !data;

  return (
    <MainLayout title="Sync Settings">
      <div className="max-w-2xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">SimpleFIN Settings</h1>
          <p className="text-muted-foreground">
            Configure your SimpleFIN integration.
          </p>

          {data && (
            <div className="flex items-center gap-2 mt-2">
              {data.last_sync && (
                <Badge variant="secondary">
                  Last Sync:{" "}
                  {formatDistanceToNow(new Date(data.last_sync), { addSuffix: true })}
                </Badge>
              )}
              <DropdownMenu>
                <div className="flex">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSyncing}
                    onClick={handleSyncNow}
                    className="rounded-r-none border-r-0"
                  >
                    {isSyncing ? "Syncing…" : "Sync Now"}
                  </Button>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSyncing}
                      className="rounded-l-none px-2"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </div>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSyncNow} disabled={isSyncing}>
                    Sync Now
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowAdvancedDialog(true)} disabled={isSyncing}>
                    Advanced Sync
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {data.errors && data.errors.trim() !== "" && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a
                    href="https://beta-bridge.simplefin.org/my-account"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Fix Accounts
                  </a>
                </Button>
              )}
            </div>
          )}
        </header>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {data?.errors && (() => {
          try {
            const errorArray = JSON.parse(data.errors) as string[];
            return (
              <div className="space-y-2">
                {errorArray.map((err, idx) => (
                  <Alert key={idx} variant="destructive">
                    <AlertDescription>{err}</AlertDescription>
                  </Alert>
                ))}
              </div>
            );
          } catch {
            // Fallback for non-JSON errors (backward compatibility)
            return (
              <Alert variant="destructive">
                <AlertDescription>{data.errors}</AlertDescription>
              </Alert>
            );
          }
        })()}

        <section className="space-y-4">
          {noConfig && (
            <div className="mb-4">
              <p className="text-muted-foreground">No sync configuration found. Create a token and provide it below</p>
              <Button
                asChild
                variant="secondary"
              >
                <a
                  href="https://bridge.simplefin.org/simplefin/create"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Create Token
                </a>
              </Button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Setup Token</label>
            <Input
              placeholder="Enter setup token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!token.trim()}>
              Save
            </Button>
            <Button
              asChild
              variant="outline"
            >
              <a
                href="https://beta-bridge.simplefin.org/my-account/tokens/create"
                target="_blank"
                rel="noopener noreferrer"
              >
                Create
              </a>
            </Button>
          </div>
        </section>

        {/* Sync Status Section */}
        {latestRun && (
          <section className="space-y-4 pt-8 border-t">
            <h2 className="text-xl font-semibold">Last Sync Details</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {latestRun.status === "running" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <Badge variant="secondary">Running</Badge>
                    </>
                  )}
                  {latestRun.status === "completed" && (
                    <Badge variant="default" className="bg-green-600">Completed</Badge>
                  )}
                  {latestRun.status === "failed" && (
                    <Badge variant="destructive">Failed</Badge>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Started</p>
                <p className="mt-1">
                  {formatDistanceToNow(new Date(latestRun.started_at), { addSuffix: true })}
                </p>
              </div>

              {latestRun.completed_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="mt-1">
                    {formatDistanceToNow(new Date(latestRun.completed_at), { addSuffix: true })}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground">Accounts Processed</p>
                <p className="mt-1 font-semibold">{latestRun.accounts_processed}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Transactions Found</p>
                <p className="mt-1 font-semibold">{latestRun.transactions_found}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Holdings Found</p>
                <p className="mt-1 font-semibold">{latestRun.holdings_found}</p>
              </div>
            </div>

            {latestRun.error_message && (
              <Alert variant="destructive">
                <AlertDescription>{latestRun.error_message}</AlertDescription>
              </Alert>
            )}

            {/* Account-level breakdown */}
            {latestRun.details && Object.keys(latestRun.details).length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-3">Account Breakdown</h3>
                <div className="space-y-2">
                  {Object.entries(latestRun.details).map(([accountId, details]) => (
                    <div
                      key={accountId}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <span className="font-medium">{details.name}</span>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{details.transactions} transactions</span>
                        {details.holdings > 0 && <span>{details.holdings} holdings</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Advanced Sync Dialog */}
        <AdvancedSyncDialog
          open={showAdvancedDialog}
          onOpenChange={setShowAdvancedDialog}
          onConfirm={handleAdvancedSync}
          isSyncing={isSyncing}
        />
      </div>
    </MainLayout>
  );
}
