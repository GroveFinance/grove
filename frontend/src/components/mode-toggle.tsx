import { Moon, Sun, Check } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { useTheme, type ThemeName, type Mode } from "@/components/theme-provider"
import { SidebarMenuButton } from "@/components/ui/sidebar"

const THEMES: { name: ThemeName; label: string }[] = [
  { name: "grove", label: "Grove" },
  { name: "ocean", label: "Ocean" },
  { name: "sunset", label: "Sunset" },
  { name: "forest", label: "Forest" },
  { name: "slate", label: "Slate" },
]

const MODES: { mode: Mode; label: string }[] = [
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
  { mode: "system", label: "System" },
]

export function ModeToggle() {
  const { mode, themeName, setMode, setThemeName } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="w-full data-[state=collapsed]:justify-center data-[state=collapsed]:px-0">
          <Sun className="h-5 w-5 text-primary scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-5 w-5 text-primary scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span>Theme</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Mode</DropdownMenuLabel>
        {MODES.map(({ mode: m, label }) => (
          <DropdownMenuItem key={m} onClick={() => setMode(m)}>
            <Check className={`mr-2 h-4 w-4 ${mode === m ? 'opacity-100' : 'opacity-0'}`} />
            {label}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs text-muted-foreground">Color Scheme</DropdownMenuLabel>
        {THEMES.map(({ name, label }) => (
          <DropdownMenuItem key={name} onClick={() => setThemeName(name)}>
            <Check className={`mr-2 h-4 w-4 ${themeName === name ? 'opacity-100' : 'opacity-0'}`} />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}