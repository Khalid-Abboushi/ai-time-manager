import { useEffect } from "react"
import { Auth as SupaAuth } from "@supabase/auth-ui-react"
import { supabase } from "@/lib/supabase"
import heroImage from "@/assets/hero-image.jpg"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface AuthProps {
  /** Fired once the user is authenticated so parent can route. */
  onLogin: () => void
}

const Auth = ({ onLogin }: AuthProps) => {
  // Notify parent when the user is signed‑in
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) onLogin()
    })
    return () => listener.subscription.unsubscribe()
  }, [onLogin])

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="relative h-screen flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-hero opacity-10" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-5"
          style={{ backgroundImage: `url(${heroImage})` }}
        />

        <div className="relative z-10 w-full max-w-md mx-auto p-6">
          {/* Brand / Hero */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
              <span className="text-white font-bold text-2xl">AI</span>
            </div>
            <h1 className="text-white text-4xl font-bold bg-gradient-hero bg-clip-text white mb-2">
              Live Like A.I.
            </h1>
            <p className="text-muted-foreground text-lg">
              Optimize your life with AI‑powered time management
            </p>
          </div>

          {/* Supabase Auth UI */}
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl">Welcome</CardTitle>
              <CardDescription>
                Sign in or create an account to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SupaAuth
                supabaseClient={supabase}
                providers={[]}
                appearance={{
                  variables: {
                    default: {
                      colors: {
                        brand: "hsl(var(--primary))",
                        brandAccent: "hsl(var(--primary-glow))",
                      },
                    },
                  },
                }}
                theme="default"
              />
            </CardContent>
            <Separator className="my-6" />
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Auth
