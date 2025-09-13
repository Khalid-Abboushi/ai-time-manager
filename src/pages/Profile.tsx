// Profile.tsx
import { useEffect, useState } from "react"
import {
  User,
  Mail,
  Calendar,
  Award,
  Settings as SettingsIcon,
  Edit,
  Save,
  Camera,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ProfileState {
  name: string
  email: string
  username: string
  bio: string
  joinDate: string
  streak: number
  totalTasks: number
  completionRate: number
  avatarUrl?: string
}

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false)

  const [profile, setProfile] = useState<ProfileState>({
    name: "",
    email: "",
    username: "",
    bio: "",
    joinDate: "",
    streak: 0,
    totalTasks: 0,
    completionRate: 0,
    avatarUrl: "",
  })

  // simple placeholder achievements array (keeps original section working)
  const achievements: Array<{ name: string; icon: string; unlocked: boolean }> = []

  // Derived stats shown in the right card
  const stats = [
    { label: "Current Streak", value: `${profile.streak} days`, variant: "success" as const },
    { label: "Total Tasks", value: profile.totalTasks, variant: "default" as const },
    { label: "Completion Rate", value: `${profile.completionRate}%`, variant: "warning" as const },
    { label: "Rank", value: "#0", variant: "default" as const },
  ]

  // Hydrate profile + compute totals from localStorage
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("profile") || "{}")
    const tasks = JSON.parse(localStorage.getItem("tasks") || "[]") as Array<{
      completed: boolean
      isParent?: boolean
      completedOn?: string
      deadline?: string
    }>
    const dailyStreak = Number(localStorage.getItem("dailyStreak") || 0)

    const totalTasks = tasks.filter((t) => !t.isParent).length
    const completed = tasks.filter((t) => t.completed && !t.isParent).length
    const completionRate = totalTasks ? Math.round((completed / totalTasks) * 100) : 0

    setProfile((prev) => ({
      ...prev,
      ...stored,
      joinDate: stored.joinDate || new Date().toISOString().split("T")[0],
      streak: dailyStreak,
      totalTasks,
      completionRate,
    }))
  }, [])

  const handleSave = () => {
    setIsEditing(false)
    localStorage.setItem("profile", JSON.stringify(profile))
    console.log("Profile saved:", profile)
  }

  const handleInputChange = (field: keyof ProfileState, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || "")
      setProfile((p) => {
        const next = { ...p, avatarUrl: url }
        localStorage.setItem("profile", JSON.stringify(next))
        return next
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Profile</h1>
            <p className="text-xl text-muted-foreground">Manage your account and track your progress</p>
          </div>
          <Button onClick={() => (isEditing ? handleSave() : setIsEditing(true))} className="bg-gradient-primary hover-glow">
            {isEditing ? <Save className="w-4 h-4 mr-2" /> : <Edit className="w-4 h-4 mr-2" />}
            {isEditing ? "Save" : "Edit Profile"}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-gradient-card shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-primary" />
                  <span>Personal Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start space-x-6 mb-6">
                  <div className="relative">
                    <Avatar className="w-24 h-24">
                      <AvatarImage src={profile.avatarUrl || "/placeholder-avatar.jpg"} />
                      <AvatarFallback className="text-2xl bg-gradient-primary text-white">
                        {profile.name ? profile.name.split(" ").map((n) => n[0]).join("") : "AA"}
                      </AvatarFallback>
                    </Avatar>

                    {isEditing && (
                      <>
                        <input
                          id="avatar-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={onAvatarChange}
                        />
                        <Button
                          size="sm"
                          className="absolute -bottom-2 -right-2 rounded-full w-8 h-8 p-0"
                          onClick={() => document.getElementById("avatar-input")?.click()}
                        >
                          <Camera className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        {isEditing ? (
                          <Input id="name" value={profile.name} onChange={(e) => handleInputChange("name", e.target.value)} />
                        ) : (
                          <p className="text-foreground font-medium">{profile.name || "—"}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        {isEditing ? (
                          <Input
                            id="username"
                            value={profile.username}
                            onChange={(e) => handleInputChange("username", e.target.value)}
                          />
                        ) : (
                          <p className="text-foreground font-medium">@{profile.username || "—"}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      {isEditing ? (
                        <Input
                          id="email"
                          type="email"
                          value={profile.email}
                          onChange={(e) => handleInputChange("email", e.target.value)}
                        />
                      ) : (
                        <p className="text-foreground font-medium">{profile.email || "—"}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      {isEditing ? (
                        <Input id="bio" value={profile.bio} onChange={(e) => handleInputChange("bio", e.target.value)} />
                      ) : (
                        <p className="text-muted-foreground">{profile.bio || "—"}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-gradient-primary shadow-glow border-0 text-white">
              <CardHeader>
                <CardTitle>Your Stats</CardTitle>
                <CardDescription className="text-white/80">Track your productivity journey</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.map((stat) => (
                    <div key={stat.label} className="flex justify-between items-center">
                      <span className="text-sm text-white/80">{stat.label}</span>
                      <span className="font-semibold">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-card border-0">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Member since</p>
                  <p className="font-semibold text-foreground">{profile.joinDate || "—"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
