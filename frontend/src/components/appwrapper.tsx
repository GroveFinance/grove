import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { getSync } from "@/services/api" // your API call
import { useGlobalNotifications } from "@/hooks/useGlobalNotifications"


export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [syncChecked, setSyncChecked] = useState(false);
  const [hasSync, setHasSync] = useState(false);

  // Show global notifications (duplicate accounts, sync errors)
  useGlobalNotifications();

  useEffect(() => {
    // Don't check if we're already on the sync settings page
    if (location.pathname === "/settings/sync") {
      setSyncChecked(true);
      setHasSync(true);
      return;
    }

    (async () => {
      try {
        const sync = await getSync("simplefin");
        if (!sync) {
          navigate("/settings/sync"); // redirect to create sync
          return;
        }
        setHasSync(true);
      } catch {
        // If there's an error checking sync, redirect to setup
        navigate("/settings/sync");
        return;
      } finally {
        setSyncChecked(true);
      }
    })();
  }, [navigate, location.pathname]);

  // Show loading state until sync check completes
  if (!syncChecked) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Only render children if sync is configured or we're on the sync settings page
  if (!hasSync && location.pathname !== "/settings/sync") {
    return null;
  }

  return <>{children}</>;
}