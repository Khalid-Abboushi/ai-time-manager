// utils/theme.ts

export const applyTheme = (isDark: boolean) => {
  const root = document.documentElement
  root.classList.toggle("dark", isDark)
  root.style.colorScheme = isDark ? "dark" : "light"
}

// Initialize once (call as early as possible in your app)
export const initTheme = () => {
  try {
    const storedRaw = localStorage.getItem("userSettings")
    const stored = storedRaw ? JSON.parse(storedRaw) : {}
    const saved = stored?.preferences?.darkMode
    const prefers = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false
    const isDark = typeof saved === "boolean" ? saved : prefers

    applyTheme(isDark)

    // Keep in sync if another tab changes settings
    window.addEventListener("storage", (e) => {
      if (e.key === "userSettings") {
        try {
          const newSettings = e.newValue ? JSON.parse(e.newValue) : {}
          const newDark = !!newSettings.preferences?.darkMode
          applyTheme(newDark)
        } catch {
          // ignore malformed
        }
      }
    })
  } catch {
    // best effort, swallow errors
  }
}
