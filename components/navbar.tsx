"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FaBars, FaTimes, FaChevronDown, FaUser } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/provider";

export default function Navbar() {
  const pathname = usePathname();
  // Hide global navbar inside dashboard to avoid double headers
  if (pathname?.startsWith("/dashboard")) return null;

  return <TopNav />;
}

function TopNav() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const handleNavClick = (sectionId: string) => {
    setMobileOpen(false);
    if (pathname !== '/') {
      window.location.href = `/#${sectionId}`;
    }
  };

  const initial = (user?.email || "U").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="w-full border-b border-white/10 bg-black/30 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 md:px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-white/20 to-white/5 border border-white/20 group-hover:border-white/40 transition-all">
              <span className="text-white font-bold text-sm">U</span>
            </div>
            <span className="text-white text-lg font-bold tracking-tight group-hover:text-white/90 transition-colors">
              Un<span className="text-white/70">Host</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link 
              href="/#features" 
              onClick={() => handleNavClick('features')}
              className="text-white/70 hover:text-white transition-colors text-sm font-medium cursor-pointer"
            >
              Features
            </Link>
            <Link 
              href="/#regions" 
              onClick={() => handleNavClick('regions')}
              className="text-white/70 hover:text-white transition-colors text-sm font-medium cursor-pointer"
            >
              Regions
            </Link>
            <Link 
              href="/#pricing" 
              onClick={() => handleNavClick('pricing')}
              className="text-white/70 hover:text-white transition-colors text-sm font-medium cursor-pointer"
            >
              Pricing
            </Link>
          </nav>

          {/* Right controls */}
          <div className="hidden md:flex items-center gap-3" ref={menuRef}>
            {!user ? (
              <Link href="/auth">
                <Button className="bg-white/10 hover:bg-white/20 text-white border border-white/20 h-9 px-4">
                  Sign In
                </Button>
              </Link>
            ) : (
              <div className="relative">
                <button 
                  onClick={() => setMenuOpen((v) => !v)} 
                  className="inline-flex items-center gap-2.5 text-white/90 hover:text-white transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/20 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">{initial}</span>
                  </div>
                  <FaChevronDown className="h-3 w-3 opacity-70" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border border-white/10 bg-black/90 backdrop-blur-md shadow-xl py-1.5">
                    <Link 
                      href="/dashboard/servers" 
                      className="block px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                    >
                      Dashboard
                    </Link>
                    <div className="h-px bg-white/10 my-1" />
                    <button 
                      onClick={signOut} 
                      className="block w-full text-left px-4 py-2.5 text-sm text-white/90 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button 
            className="md:hidden text-white/80 hover:text-white transition-colors" 
            onClick={() => setMobileOpen((v) => !v)} 
            aria-label="Toggle Menu"
          >
            {mobileOpen ? <FaTimes className="h-5 w-5" /> : <FaBars className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="md:hidden bg-black/90 backdrop-blur-md border-b border-white/10">
          <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 space-y-1">
            <Link 
              href="/#features" 
              onClick={() => handleNavClick('features')}
              className="block px-3 py-2.5 text-sm text-white/90 hover:bg-white/10 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              Features
            </Link>
            <Link 
              href="/#regions" 
              onClick={() => handleNavClick('regions')}
              className="block px-3 py-2.5 text-sm text-white/90 hover:bg-white/10 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              Regions
            </Link>
            <Link 
              href="/#pricing" 
              onClick={() => handleNavClick('pricing')}
              className="block px-3 py-2.5 text-sm text-white/90 hover:bg-white/10 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              Pricing
            </Link>
            <div className="h-px bg-white/10 my-2" />
            {!user ? (
              <Link 
                href="/auth"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 text-sm text-white/90 hover:bg-white/10 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                Sign In
              </Link>
            ) : (
              <div className="space-y-1">
                <Link 
                  href="/dashboard/servers" 
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm text-white/90 hover:bg-white/10 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  Dashboard
                </Link>
                <button 
                  onClick={() => {
                    signOut();
                    setMobileOpen(false);
                  }} 
                  className="w-full text-left px-3 py-2.5 text-sm text-white/90 hover:bg-white/10 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
