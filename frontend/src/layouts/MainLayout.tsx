import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "../components/ui/breadcrumb"
import { Separator } from "../components/ui/separator"
import { SidebarTrigger } from "../components/ui/sidebar"
import { useLocation } from "react-router-dom";
import { useSyncSettings } from "@/hooks/useSyncSettings";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string; // optional override
}

export function MainLayout({ children, title }: MainLayoutProps) {
  const location = useLocation();
  const pathParts = location.pathname.split("/").filter(Boolean);
  const pageName = pathParts[pathParts.length - 1] || "Home";

  const finalPageName = title || pageName;
  const formattedPageName =
    finalPageName.charAt(0).toUpperCase() + finalPageName.slice(1);

  const { data: syncData } = useSyncSettings("simplefin");
  const [syncAge, setSyncAge] = useState<string>("");

  // Update sync age every minute
  useEffect(() => {
    const updateAge = () => {
      if (syncData?.last_sync) {
        setSyncAge(formatDistanceToNow(new Date(syncData.last_sync), { addSuffix: true }));
      }
    };

    updateAge();
    const interval = setInterval(updateAge, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [syncData?.last_sync]);

  return (
    <div className="flex h-screen">
      {/* Main Area */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4 flex-1">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{formattedPageName}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            {syncAge && (
              <div className="ml-auto text-xs text-muted-foreground">
                Synced {syncAge}
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
}