import { useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { Home, Calendar, BarChart3, Settings, User, LogOut, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface NavigationProps {
  onLogout?: () => void
}

const Navigation = ({ onLogout }: NavigationProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  const navItems = [
    { name: "Home", icon: Home, path: "/" },
    { name: "Schedule", icon: Calendar, path: "/schedule" },
    { name: "Stats", icon: BarChart3, path: "/stats" },
    { name: "Settings", icon: Settings, path: "/settings" },
  ]

  const handleLogout = () => {
    toast({
      title: "Logged out successfully",
      description: "See you later! Keep optimizing your life.",
    })
    onLogout?.()
  }

  const handleProfileClick = () => {
    navigate("/profile")
    setIsMobileMenuOpen(false)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <nav className="bg-gradient-card border-b border-border shadow-card sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <NavLink to="/" className="flex items-center space-x-2 hover:opacity-80 transition duration-200">
            <span className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
              LiveLike<span className="text-primary font-bold">AI</span>
            </span>
          </NavLink>


          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-2 px-4 py-2 rounded-lg transition-smooth hover-glow",
                    isActive
                      ? "bg-gradient-primary text-white shadow-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </NavLink>
            ))}
          </div>

          {/* Desktop User Actions */}
          <div className="hidden md:flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleProfileClick}
              className="flex items-center space-x-2 hover-glow"
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center space-x-2 hover-glow"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-gradient-card">
          <div className="px-4 py-2 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg transition-smooth",
                    isActive
                      ? "bg-gradient-primary text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </NavLink>
            ))}
            <div className="border-t border-border my-2"></div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleProfileClick}
              className="w-full justify-start px-3 py-2"
            >
              <User className="w-5 h-5 mr-3" />
              <span>Profile</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start px-3 py-2 text-destructive hover:text-destructive"
            >
              <LogOut className="w-5 h-5 mr-3" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navigation