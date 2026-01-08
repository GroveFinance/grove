import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { getDuplicateAccounts, getLatestSyncRun } from "@/services/api"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

/**
 * Global notification system that shows persistent toasts for:
 * - Duplicate accounts that need merging
 * - SimpleFIN sync errors
 *
 * Toasts remain visible until user dismisses them.
 */
export function useGlobalNotifications() {
  const navigate = useNavigate()
  const duplicateToastId = useRef<string | number | undefined>(undefined)
  const syncErrorToastId = useRef<string | number | undefined>(undefined)

  const { data: duplicates = [] } = useQuery({
    queryKey: ["account-duplicates"],
    queryFn: getDuplicateAccounts,
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
  })

  const { data: latestSyncRun } = useQuery({
    queryKey: ["latest-sync-run"],
    queryFn: () => getLatestSyncRun("simplefin"),
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
  })

  // Show duplicate account notification
  useEffect(() => {
    if (duplicates.length > 0) {
      // Dismiss old toast if exists
      if (duplicateToastId.current) {
        toast.dismiss(duplicateToastId.current)
      }

      // Show new persistent toast
      duplicateToastId.current = toast.warning(
        duplicates.length === 1
          ? `Duplicate account detected: ${duplicates[0].name}`
          : `${duplicates.length} duplicate accounts detected`,
        {
          description: "Click to view and merge duplicate accounts",
          duration: Infinity, // Never auto-dismiss
          action: {
            label: "View",
            onClick: () => navigate("/settings/accounts"),
          },
        }
      )
    } else {
      // Dismiss toast if duplicates were resolved
      if (duplicateToastId.current) {
        toast.dismiss(duplicateToastId.current)
        duplicateToastId.current = undefined
      }
    }

    // Cleanup on unmount
    return () => {
      if (duplicateToastId.current) {
        toast.dismiss(duplicateToastId.current)
      }
    }
  }, [duplicates, navigate])

  // Show sync error notification
  useEffect(() => {
    if (latestSyncRun?.status === "failed" && latestSyncRun.error_message) {
      // Dismiss old toast if exists
      if (syncErrorToastId.current) {
        toast.dismiss(syncErrorToastId.current)
      }

      // Show new persistent toast
      syncErrorToastId.current = toast.error("SimpleFIN sync failed", {
        description: latestSyncRun.error_message.slice(0, 100) + (latestSyncRun.error_message.length > 100 ? "..." : ""),
        duration: Infinity, // Never auto-dismiss
        action: {
          label: "View Details",
          onClick: () => navigate("/settings/sync"),
        },
      })
    } else if (latestSyncRun?.status === "completed") {
      // Dismiss toast if sync succeeded
      if (syncErrorToastId.current) {
        toast.dismiss(syncErrorToastId.current)
        syncErrorToastId.current = undefined
      }
    }

    // Cleanup on unmount
    return () => {
      if (syncErrorToastId.current) {
        toast.dismiss(syncErrorToastId.current)
      }
    }
  }, [latestSyncRun, navigate])
}
