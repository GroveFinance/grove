import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface AdvancedSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (daysBack: number, captureRaw: boolean) => Promise<void>;
  isSyncing: boolean;
}

export function AdvancedSyncDialog({
  open,
  onOpenChange,
  onConfirm,
  isSyncing,
}: AdvancedSyncDialogProps) {
  const [daysBack, setDaysBack] = useState("30");
  const [captureRaw, setCaptureRaw] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    const days = parseInt(daysBack);
    if (isNaN(days) || days < 1) {
      setError("Please enter a valid number of days (minimum 1)");
      return;
    }
    if (days > 365) {
      setError("Maximum 365 days allowed");
      return;
    }
    setError("");
    await onConfirm(days, captureRaw);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Advanced Sync</DialogTitle>
          <DialogDescription>
            Re-sync transactions from the last N days. This will fetch all
            transactions from the specified period and update your local data.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="days" className="text-right">
              Days Back
            </Label>
            <Input
              id="days"
              type="number"
              min="1"
              max="365"
              value={daysBack}
              onChange={(e) => setDaysBack(e.target.value)}
              className="col-span-3"
              disabled={isSyncing}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <div className="col-start-2 col-span-3 flex items-center space-x-2">
              <Checkbox
                id="capture-raw"
                checked={captureRaw}
                onCheckedChange={(checked) => setCaptureRaw(checked === true)}
                disabled={isSyncing}
              />
              <Label
                htmlFor="capture-raw"
                className="text-sm font-normal cursor-pointer"
              >
                Download raw SimpleFin API response (for debugging)
              </Label>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSyncing}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSyncing}>
            {isSyncing ? "Syncing..." : "Start Sync"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
