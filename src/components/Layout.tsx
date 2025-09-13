import { ReactNode } from "react"
import Navigation from "@/components/Navigation"

interface LayoutProps {
  children: ReactNode
  onLogout?: () => void
}

const Layout = ({ children, onLogout }: LayoutProps) => {
  return (
    <div className="min-h-screen">
      <Navigation onLogout={onLogout} />
      {children}
    </div>
  )
}

export default Layout