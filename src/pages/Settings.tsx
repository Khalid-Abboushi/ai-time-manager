import { useState, useEffect } from "react";
import { Palette, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { applyTheme } from "@/utils/theme";
import { SiteFooter } from "@/utils/SiteFooter";

interface SettingsProps {
  onLogout?: () => void;
}

interface SettingsState {
  preferences: {
    darkMode: boolean;
    compactView: boolean;
    autoSchedule: boolean;
    use12HourClock: boolean;
  };
}

const DEFAULT_SETTINGS: SettingsState = {
  preferences: {
    darkMode: true,
    compactView: false,
    autoSchedule: true,
    use12HourClock: true,
  },
};

const Settings = ({ onLogout }: SettingsProps) => {
  // Draft state — nothing applies until Save
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);

  function handleSettingChange<
    C extends keyof SettingsState,
    K extends keyof SettingsState[C]
  >(category: C, key: K, value: SettingsState[C][K]) {
    setSettings((prev) => ({
      ...prev,
      [category]: { ...prev[category], [key]: value },
    }));
  }

  const handleSave = () => {
    localStorage.setItem("userSettings", JSON.stringify(settings));
    // Apply side effects (theme) only on save
    applyTheme(settings.preferences.darkMode);
  };

  // Load once and apply previously saved theme once
  useEffect(() => {
    const stored = localStorage.getItem("userSettings");
    if (!stored) {
      applyTheme(DEFAULT_SETTINGS.preferences.darkMode);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as Partial<SettingsState>;
      const merged: SettingsState = {
        ...DEFAULT_SETTINGS,
        preferences: { ...DEFAULT_SETTINGS.preferences, ...(parsed.preferences || {}) },
      };
      setSettings(merged);
      applyTheme(merged.preferences.darkMode);
    } catch {
      localStorage.removeItem("userSettings");
      applyTheme(DEFAULT_SETTINGS.preferences.darkMode);
    }
  }, []);

  const prettyKey = (k: string) =>
    k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());

  return (
     <div className="min-h-dvh flex flex-col bg-gradient-to-br from-background to-muted">
        <main className="flex-1">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-xl text-muted-foreground">Customize your AI Time Manager experience</p>
        </div>

        {/* === UNDERGLOW WRAPPER (extends past the card) === */}
        <div className="relative">
          {/* Big blurred gradient behind the card */}
          <div
            aria-hidden
            className="
              pointer-events-none absolute -inset-8 rounded-3xl blur-2xl opacity-60
              bg-[conic-gradient(at_20%_10%,#f0abfc_0deg,#a78bfa_120deg,#22d3ee_240deg,#f0abfc_360deg)]
              dark:opacity-70
            "
          />
          {/* subtle vignette so the glow fades out nicely */}
          <div
            aria-hidden
            className="
              pointer-events-none absolute -inset-16 rounded-[2.25rem]
              bg-[radial-gradient(60%_60%_at_50%_50%,rgba(255,255,255,0.12),transparent_60%)]
              dark:bg-[radial-gradient(60%_60%_at_50%_50%,rgba(255,255,255,0.08),transparent_60%)]
            "
          />

          {/* The actual card sits above the glow */}
          <Card className="relative overflow-hidden border bg-card/90 backdrop-blur shadow-xl
                           border-violet-200/60 dark:border-violet-500/30">
            {/* thin top beam */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-fuchsia-400 via-violet-500 to-indigo-500" />

            <CardHeader className="relative z-10">
              <CardTitle className="flex items-center space-x-2">
                <Palette className="w-5 h-5 text-primary" />
                <span>App Preferences</span>
              </CardTitle>
              <CardDescription>Customize how the app looks and behaves</CardDescription>
            </CardHeader>

            <CardContent className="relative z-10">
              <div className="space-y-6">
                {Object.entries(settings.preferences).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">{prettyKey(key)}</Label>
                      <p className="text-sm text-muted-foreground">
                        {key === "darkMode" && "Switch to dark theme for better nighttime use"}
                        {key === "compactView" && "Use tighter spacing in lists and schedules"}
                        {key === "autoSchedule" && "Automatically schedule tasks into your day"}
                        {key === "use12HourClock" && "Use 12‑hour clock (AM/PM) instead of 24‑hour"}
                      </p>
                    </div>
                    <Switch
                      checked={Boolean(value)}
                      onCheckedChange={(checked) =>
                        handleSettingChange(
                          "preferences",
                          key as keyof SettingsState["preferences"],
                          checked as SettingsState["preferences"][keyof SettingsState["preferences"]]
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save */}
        <div className="mt-8 flex justify-end">
          <Button onClick={handleSave} className="bg-gradient-primary hover-glow transition-bounce">
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Settings;
