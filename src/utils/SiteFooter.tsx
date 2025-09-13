import { Github, Linkedin, Mail, Globe, Twitter } from "lucide-react";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer role="contentinfo" className="relative z-10 mt-10">
      {/* top accent line */}
      <div className="pointer-events-none absolute inset-x-0 -top-px h-[2px] bg-gradient-to-r from-fuchsia-400 via-violet-500 to-indigo-500" />

      <div className="relative overflow-hidden rounded-t-xl border-t border-border/60 bg-card/70">
        {/* soft underglow behind the footer */}
        <div className="pointer-events-none absolute inset-0
          bg-[radial-gradient(120%_80%_at_0%_0%,rgba(236,72,153,0.10),transparent_55%),radial-gradient(120%_80%_at_100%_100%,rgba(124,58,237,0.10),transparent_55%)]
          dark:bg-[radial-gradient(120%_80%_at_0%_0%,rgba(236,72,153,0.12),transparent_55%),radial-gradient(120%_80%_at_100%_100%,rgba(124,58,237,0.16),transparent_55%)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground">
              &copy; {year} <span className="font-medium text-foreground">LiveLikeAI</span>. All rights reserved.
            </p>

            <div className="sm:ml-auto flex items-center gap-2">
              {/* Replace href values with your real profiles */}
              <a
                aria-label="GitHub"
                href="https://github.com/yourname"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-foreground/80 transition hover:bg-accent hover:text-accent-foreground"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                aria-label="LinkedIn"
                href="https://www.linkedin.com/in/yourname/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-foreground/80 transition hover:bg-accent hover:text-accent-foreground"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                aria-label="Twitter / X"
                href="https://twitter.com/yourhandle"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-foreground/80 transition hover:bg-accent hover:text-accent-foreground"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                aria-label="Website"
                href="https://your.site"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-foreground/80 transition hover:bg-accent hover:text-accent-foreground"
              >
                <Globe className="h-4 w-4" />
              </a>
              <a
                aria-label="Email"
                href="mailto:you@example.com"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-foreground/80 transition hover:bg-accent hover:text-accent-foreground"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
