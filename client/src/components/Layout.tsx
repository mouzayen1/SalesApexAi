import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Car, Calculator, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navLinks = [
    { href: "/", label: "Inventory", icon: Home },
    { href: "/rehash-optimizer", label: "Deal Optimizer", icon: Calculator },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 font-bold text-xl">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Car className="h-5 w-5" />
              </div>
              <span className="font-display">SalesApex AI</span>
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{link.label}</span>
                  </Link>
                );
              })}
              <div className="ml-2 border-l pl-2">
                <ThemeToggle />
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t py-6 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold">SalesApex AI</span> - Advanced deal optimization technology
          </p>
        </div>
      </footer>
    </div>
  );
}
