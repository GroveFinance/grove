import { ExternalLink, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { VersionInfo } from "@/services/api/system";

interface VersionUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionInfo: VersionInfo;
}

export function VersionUpdateDialog({
  open,
  onOpenChange,
  versionInfo,
}: VersionUpdateDialogProps) {
  const handleViewRelease = () => {
    if (versionInfo.release_url) {
      window.open(versionInfo.release_url, "_blank", "noopener,noreferrer");
    }
  };

  const handleDismiss = () => {
    // Store dismissal in localStorage with version number
    localStorage.setItem(
      "grove_dismissed_update",
      versionInfo.latest_version || ""
    );
    onOpenChange(false);
  };

  const releaseDate = versionInfo.released_at
    ? new Date(versionInfo.released_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Update Available
          </DialogTitle>
          <DialogDescription>
            A new version of Grove is available
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Current Version</div>
              <div className="font-semibold">v{versionInfo.current_version}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Latest Version</div>
              <div className="font-semibold text-primary">
                v{versionInfo.latest_version}
              </div>
            </div>
          </div>

          {releaseDate && (
            <div className="text-sm text-muted-foreground">
              Released on {releaseDate}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleDismiss}>
              Remind Me Later
            </Button>
            <Button onClick={handleViewRelease} className="gap-2">
              View Release Notes
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
