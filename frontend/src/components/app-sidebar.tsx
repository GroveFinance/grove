import {
  Calendar,
  ArrowLeftRight,
  Settings,
  Flag,
  LineChart,
  RefreshCcw,
  ListChecks,
  Tags,
  FolderKanban,
  ChevronRight,
  Utensils,
  PieChart,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTheme } from "./theme-provider";
import { ModeToggle } from "./mode-toggle";
import { GettingStarted } from "./GettingStarted";
import { Badge } from "@/components/ui/badge";
import { useSystemInfo } from "@/hooks/queries/useSystemInfo";
import { VersionUpdateDialog } from "./VersionUpdateDialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarGroup,
  SidebarGroupContent,
  SidebarRail,
  useSidebar,
} from "./ui/sidebar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

const navItems = [
  { name: "Overview", icon: Calendar, href: "/" },
  { name: "Transactions", icon: ArrowLeftRight, href: "/transactions" },
  { name: "Investments", icon: LineChart, href: "/investments" },
];

const trendsSubItems = [
  { name: "Restaurants", icon: Utensils, href: "/trends/restaurants" },
  { name: "Budgets", icon: FolderKanban, href: "/trends/budgets" },
  { name: "Categories", icon: PieChart, href: "/trends/categories" },
];

const settingsSubItems = [
  { name: "Accounts", icon: ListChecks, href: "/settings/accounts" },
  { name: "Categories & Budgets", icon: FolderKanban, href: "/settings/categories" },
  { name: "Payee Rules", icon: Tags, href: "/settings/rules" },
  { name: "Sync Settings", icon: RefreshCcw, href: "/settings/sync" },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const sidebar = useSidebar();
  const { theme } = useTheme();

  // Version checking
  const { data: systemInfo } = useSystemInfo();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  // Check if update should be shown (not dismissed for this version)
  const shouldShowUpdateBadge =
    systemInfo?.version.update_available &&
    systemInfo?.version.latest_version &&
    localStorage.getItem("grove_dismissed_update") !== systemInfo.version.latest_version;

  // Auto-close on route change (mobile only)
  useEffect(() => {
    if (sidebar.isMobile) sidebar.setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, sidebar.isMobile, sidebar.setOpenMobile]);

  const handleNavClick = () => {
    if (sidebar.isMobile) sidebar.setOpenMobile(false);
  };

  const buttonClasses = "w-full data-[state=collapsed]:justify-center data-[state=collapsed]:px-0";

  const subButtonClasses = "w-full data-[state=collapsed]:justify-center data-[state=collapsed]:px-0";

  const logoSrc = theme === "dark" ? "/grove_dark.png" : "/grove_light.png";
  const LogoIcon = () => <img src={logoSrc} alt="Logo" className="h-5 w-5" />;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="pb-0 pl-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className={`pl-0 ${buttonClasses} hover:bg-transparent ${shouldShowUpdateBadge ? "cursor-pointer" : ""}`}
              onClick={() => shouldShowUpdateBadge && setShowUpdateDialog(true)}
            >
              <LogoIcon />
              <span className="text-lg font-semibold tracking-tight">
                Grove
              </span>
              {shouldShowUpdateBadge && (
                <Badge
                  variant="outline"
                  className="ml-auto text-xs text-primary border-primary"
                >
                  Update
                </Badge>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="pt-0">
        {/* Getting Started Checklist */}
        <div className="px-2 p-0 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:hidden">
          <GettingStarted onNavClick={handleNavClick} />
        </div>

        <SidebarMenu>
          {navItems.map(({ name, icon: Icon, href }) => {
            const isActive = location.pathname === href;
            return (
              <SidebarMenuItem key={name}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className={buttonClasses}
                >
                  <Link to={href} onClick={handleNavClick}>
                    <Icon className="h-5 w-5 text-primary" />
                    <span >{name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}

          {/* Trends collapsible */}
          <SidebarGroup className="p-0">
            <Collapsible>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className={buttonClasses}>
                    <Flag className="h-5 w-5 text-primary" />
                    <span>Trends</span>
                    <ChevronRight className="ml-auto h-4 w-4 transition-transform [[data-state=open]_&]:rotate-90 group-data-[state=collapsed]:hidden" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenuSub>
                      {trendsSubItems.map(({ name, icon: Icon, href }) => {
                        const isActive = location.pathname === href;
                        return (
                          <SidebarMenuSubItem key={name}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActive}
                              className={subButtonClasses}
                            >
                              <Link to={href} onClick={handleNavClick}>
                                <Icon className="h-4 w-4 !text-primary" />
                                <span>{name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarGroup>

          {/* Settings collapsible */}
          <SidebarGroup className="p-0">
            <Collapsible>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className={buttonClasses}>
                    <Settings className="h-5 w-5 text-primary" />
                    <span>Settings</span>
                    <ChevronRight className="ml-auto h-4 w-4 transition-transform [[data-state=open]_&]:rotate-90 group-data-[state=collapsed]:hidden" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenuSub>
                      {settingsSubItems.map(({ name, icon: Icon, href }) => {
                        const isActive = location.pathname === href;
                        return (
                          <SidebarMenuSubItem key={name}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActive}
                              className={subButtonClasses}
                            >
                              <Link to={href} onClick={handleNavClick}>
                                <Icon className="h-4 w-4 !text-primary" />
                                <span>{name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarGroup>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <ModeToggle />
      </SidebarFooter>

      <SidebarRail />

      {systemInfo?.version && (
        <VersionUpdateDialog
          open={showUpdateDialog}
          onOpenChange={setShowUpdateDialog}
          versionInfo={systemInfo.version}
        />
      )}
    </Sidebar>
  );
}
