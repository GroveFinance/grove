/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react"

type Mode = "dark" | "light" | "system"
type ThemeName = "grove" | "ocean" | "sunset" | "forest" | "slate"

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

  const value = {
    mode,
    themeName,
    theme: mode, // Legacy compatibility
    setMode: (newMode: Mode) => {
      localStorage.setItem(`${storageKey}-mode`, newMode)
      setMode(newMode)
    },
    setThemeName: (newTheme: ThemeName) => {
      localStorage.setItem(`${storageKey}-name`, newTheme)
      setThemeName(newTheme)
    },
    setTheme: (newMode: Mode) => { // Legacy compatibility
      localStorage.setItem(`${storageKey}-mode`, newMode)
      setMode(newMode)
    },
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