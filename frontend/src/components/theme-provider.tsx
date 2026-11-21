/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react"
import { useSettings, useUpdateSettings } from "@/hooks/queries/useSettings"
import type { ThemeMode as Mode, ThemeName } from "@/types"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultMode?: Mode
  defaultTheme?: ThemeName
  storageKey?: string
}

type ThemeProviderState = {
  mode: Mode
  themeName: ThemeName
  theme: Mode // Legacy compatibility - returns resolved mode
  setMode: (mode: Mode) => void
  setThemeName: (theme: ThemeName) => void
  setTheme: (mode: Mode) => void // Legacy compatibility
}

const initialState: ThemeProviderState = {
  mode: "system",
  themeName: "grove",
  theme: "system",
  setMode: () => null,
  setThemeName: () => null,
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultMode = "system",
  defaultTheme = "grove",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [mode, setMode] = useState<Mode>(
    () => (localStorage.getItem(`${storageKey}-mode`) as Mode) || defaultMode
  )

  const [themeName, setThemeName] = useState<ThemeName>(
    () => (localStorage.getItem(`${storageKey}-name`) as ThemeName) || defaultTheme
  )

  // Server settings are the source of truth; localStorage is only a cache so the
  // first paint has the right theme. Only apply keys the server has explicitly
  // stored, so a not-yet-migrated local value isn't overwritten by the default.
  const { data: settings } = useSettings()
  const { mutate: updateSettings } = useUpdateSettings()

  useEffect(() => {
    if (!settings) return
    if (settings.explicit.includes("theme.mode")) {
      const serverMode = settings.values["theme.mode"]
      localStorage.setItem(`${storageKey}-mode`, serverMode)
      setMode(serverMode)
    }
    if (settings.explicit.includes("theme.name")) {
      const serverName = settings.values["theme.name"]
      localStorage.setItem(`${storageKey}-name`, serverName)
      setThemeName(serverName)
    }
  }, [settings, storageKey])

  useEffect(() => {
    const root = window.document.documentElement

    // Remove all theme classes
    root.classList.remove("light", "dark")

    // Set theme name via data attribute
    root.setAttribute("data-theme", themeName)

    // Set mode class
    if (mode === "system") {
      const systemMode = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemMode)
      return
    }

    root.classList.add(mode)
  }, [mode, themeName])

  const changeMode = (newMode: Mode) => {
    localStorage.setItem(`${storageKey}-mode`, newMode)
    setMode(newMode)
    updateSettings({ "theme.mode": newMode })
  }

  const value = {
    mode,
    themeName,
    theme: mode, // Legacy compatibility
    setMode: changeMode,
    setThemeName: (newTheme: ThemeName) => {
      localStorage.setItem(`${storageKey}-name`, newTheme)
      setThemeName(newTheme)
      updateSettings({ "theme.name": newTheme })
    },
    setTheme: changeMode, // Legacy compatibility
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}

export type { Mode, ThemeName }
