"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { hasPermission } from "@/lib/security/rbac";
import type { Role } from "@prisma/client";
import type { Permission } from "@/lib/security/rbac";
import {
  LayoutDashboard, ShoppingCart, Package, Users, TrendingUp,
  FileText, Settings, StickyNote, UserCog, LogOut, X, User, ScanLine,
  ChevronLeft, ChevronRight,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  color: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",        label: "Dashboard",        icon: LayoutDashboard, permission: "dashboard:read",    color: "text-violet-500" },
  { href: "/ventes/nouvelle",  label: "Caisse / Vente",   icon: ScanLine,        permission: "ventes:create",     color: "text-rose-500"   },
  { href: "/ventes",           label: "Historique ventes", icon: ShoppingCart,   permission: "ventes:read",       color: "text-orange-500" },
  { href: "/produits",     label: "Produits & Stock", icon: Package,         permission: "produits:read",     color: "text-amber-500"  },
  { href: "/clients",      label: "Clients",          icon: Users,           permission: "clients:read",      color: "text-sky-500"    },
  { href: "/finances",     label: "Finances",         icon: TrendingUp,      permission: "finances:read",     color: "text-emerald-500"},
  { href: "/documents",    label: "Documents",        icon: FileText,        permission: "documents:read",    color: "text-indigo-500" },
  { href: "/notes",        label: "Notes",            icon: StickyNote,      permission: "notes:read",        color: "text-yellow-500" },
  { href: "/utilisateurs", label: "Utilisateurs",     icon: UserCog,         permission: "utilisateurs:read", color: "text-pink-500"   },
  { href: "/parametres",   label: "Paramètres",       icon: Settings,        permission: "parametres:read",   color: "text-slate-500"  },
  { href: "/profil",       label: "Mon profil",       icon: User,            permission: "profil:update",     color: "text-gray-500"   },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Gérante",
  CAISSIER: "Caissier",
  DISTRIBUTEUR: "Distributeur",
};

function UserAvatar({ name, role }: { name: string; role: string }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex items-center gap-3 px-2 py-1 rounded-xl">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ background: "linear-gradient(135deg, hsl(33 72% 42%), hsl(40 85% 56%))" }}
      >
        {initials || "?"}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{ROLE_LABELS[role] ?? role}</p>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role as Role | undefined;

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.permission || !userRole) return true;
    return hasPermission(userRole, item.permission);
  });

  const userName = [session?.user?.prenom, session?.user?.nom].filter(Boolean).join(" ") || "Utilisateur";

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-sm">
            <Image src="/TFC0.png" alt="TFC" width={36} height={36} className="object-contain" priority />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight gradient-text">The Fairy Crocheter</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">ERP / POS</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 group relative",
                isActive
                  ? "bg-primary text-primary-foreground shadow-[0_2px_8px_hsl(var(--primary)/0.35)]"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary-foreground/40" />
              )}
              <item.icon className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-150",
                !isActive && item.color,
                "group-hover:scale-110"
              )} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Profil + déconnexion */}
      <div className="border-t px-2.5 py-3 space-y-0.5">
        {session?.user && (
          <Link href="/profil" onClick={onNavigate}
            className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/80 transition-colors group">
            <UserAvatar name={userName} role={session.user.role ?? ""} />
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
                     text-muted-foreground hover:bg-rose-50 hover:text-rose-600
                     dark:hover:bg-rose-950/30 dark:hover:text-rose-400
                     transition-all duration-150 group"
        >
          <LogOut className="h-4 w-4 group-hover:rotate-12 transition-transform duration-150" />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
}

/* ── Desktop Sidebar (rétractable) ── */
export function Sidebar() {
  const pathname = usePathname();
  // Rétracté par défaut sur la caisse, sinon mémorisé
  const isCaisse = pathname === "/ventes/nouvelle";
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return isCaisse;
    const saved = localStorage.getItem("sidebar-collapsed");
    return isCaisse ? true : (saved !== null ? saved === "true" : false);
  });

  // Force la rétraction sur la caisse, même si localStorage dit autre chose
  useEffect(() => {
    if (isCaisse) setCollapsed(true);
  }, [isCaisse]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  return (
    <aside className={cn(
      "hidden lg:flex flex-col h-full bg-card border-r shrink-0 transition-all duration-200 relative",
      collapsed ? "w-14" : "w-[var(--sidebar-width)]"
    )}>
      {/* Bouton toggle */}
      <button
        onClick={toggle}
        className="absolute -right-3 top-6 z-30 w-6 h-6 rounded-full bg-card border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
        title={collapsed ? "Développer" : "Réduire"}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      {collapsed ? (
        /* Mode icônes seulement */
        <div className="flex flex-col h-full py-3 px-1.5 space-y-0.5 overflow-y-auto">
          {/* Logo compact */}
          <div className="flex justify-center pb-3 mb-1 border-b">
            <Image src="/TFC0.png" alt="TFC" width={28} height={28} className="rounded-lg" />
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} title={item.label}
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-xl transition-all mx-auto",
                  isActive ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted"
                )}>
                <item.icon className={cn("h-5 w-5", !isActive && item.color)} />
              </Link>
            );
          })}
        </div>
      ) : (
        <SidebarContent />
      )}
    </aside>
  );
}

/* ── Mobile Bottom Nav ── */
const BOTTOM_NAV_MAIN = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Accueil"  },
  { href: "/ventes",    icon: ShoppingCart,    label: "Ventes"   },
  { href: "/produits",  icon: Package,         label: "Produits" },
  { href: "/clients",   icon: Users,           label: "Clients"  },
];


export function MobileBottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const { data: session } = useSession();
  const userRole = session?.user?.role as Role | undefined;
  const userName = [session?.user?.prenom, session?.user?.nom].filter(Boolean).join(" ") || "Mon compte";

  // Tous les items accessibles sauf ceux déjà dans la barre du bas
  const mainHrefs = new Set(BOTTOM_NAV_MAIN.map(i => i.href));
  const moreItems = NAV_ITEMS.filter(item => {
    if (mainHrefs.has(item.href)) return false;
    if (!item.permission || !userRole) return true;
    return hasPermission(userRole, item.permission);
  }).map(item => ({ ...item, color: item.color ?? "text-muted-foreground" }));

  const BG_COLORS: Record<string, string> = {
    "text-emerald-500": "bg-emerald-100 dark:bg-emerald-900/30",
    "text-indigo-500":  "bg-indigo-100 dark:bg-indigo-900/30",
    "text-yellow-500":  "bg-yellow-100 dark:bg-yellow-900/30",
    "text-pink-500":    "bg-pink-100 dark:bg-pink-900/30",
    "text-slate-500":   "bg-slate-100 dark:bg-slate-900/30",
    "text-gray-500":    "bg-gray-100 dark:bg-gray-900/30",
  };

  return (
    <>
      {/* ── Sheet "Plus" ─────────────────────────────────────────────────── */}
      {showMore && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            style={{ animation: "fadeIn 0.2s ease-out both" }}
            onClick={() => setShowMore(false)}
          />

          {/* Sheet */}
          <div
            className="fixed bottom-0 inset-x-0 z-50 bg-card rounded-t-3xl shadow-2xl lg:hidden overflow-hidden safe-bottom"
            style={{ animation: "slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1) both" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Avatar + nom */}
            <div className="px-5 py-3 border-b flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ background: "linear-gradient(135deg, hsl(33 72% 42%), hsl(40 85% 56%))" }}
              >
                {userName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{userName}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[userRole ?? ""] ?? userRole}</p>
              </div>
              <button onClick={() => setShowMore(false)}
                className="ml-auto p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Bouton Nouvelle vente */}
            <div className="px-4 pt-4 pb-2">
              <Link href="/ventes/nouvelle" onClick={() => setShowMore(false)}
                className="flex items-center gap-3 w-full rounded-2xl bg-primary text-primary-foreground px-4 py-3.5 font-semibold text-sm
                           shadow-[0_4px_16px_hsl(var(--primary)/0.4)] active:scale-[0.98] transition-all">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="font-bold">Nouvelle vente</p>
                  <p className="text-xs text-primary-foreground/70">Ouvrir la caisse</p>
                </div>
                <span className="ml-auto text-primary-foreground/50">→</span>
              </Link>
            </div>

            {/* Items supplémentaires */}
            <div className="px-4 py-3 space-y-1">
              {moreItems.map((item, i) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setShowMore(false)}
                    style={{ animationDelay: `${i * 35}ms`, animation: "slideUp 0.22s ease-out both" }}
                    className={cn(
                      "flex items-center gap-4 w-full rounded-2xl px-3.5 py-3.5 transition-all duration-150",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/50 hover:bg-muted text-foreground"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      isActive ? "bg-white/20" : BG_COLORS[item.color] ?? "bg-background"
                    )}>
                      <item.icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : item.color)} />
                    </div>
                    <span className="font-semibold text-sm flex-1">{item.label}</span>
                    <span className={cn("text-lg leading-none", isActive ? "text-primary-foreground/60" : "text-muted-foreground")}>›</span>
                  </Link>
                );
              })}
            </div>

            {/* Profil + Déconnexion */}
            <div className="px-4 pb-4 pt-1 flex gap-2">
              <Link href="/profil" onClick={() => setShowMore(false)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 bg-muted/60 hover:bg-muted transition-colors text-sm font-semibold text-foreground">
                <User className="h-4 w-4" />
                Mon profil
              </Link>
              <button
                onClick={() => { setShowMore(false); signOut({ callbackUrl: "/login" }); }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors text-sm font-semibold">
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Barre du bas ─────────────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass border-t safe-bottom">
        <div className="flex h-[3.75rem]">
          {BOTTOM_NAV_MAIN.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all duration-200 relative",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full bg-primary" />
                )}
                <item.icon className={cn("h-5 w-5 transition-transform duration-200", isActive && "scale-110")} />
                <span className={cn("transition-all duration-200", isActive && "font-semibold")}>{item.label}</span>
              </Link>
            );
          })}
          {/* Bouton Plus */}
          <button onClick={() => setShowMore(v => !v)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all duration-200 relative",
              showMore ? "text-primary" : "text-muted-foreground"
            )}>
            {showMore && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full bg-primary" />
            )}
            <div className={cn(
              "w-7 h-5 flex flex-col items-center justify-center gap-[3px] transition-all duration-300",
              showMore && "gap-0"
            )}>
              <span className={cn("w-4 h-px bg-current rounded-full transition-all duration-300",
                showMore && "rotate-45 translate-y-px")} />
              <span className={cn("w-3 h-px bg-current rounded-full transition-all duration-300",
                showMore && "opacity-0 w-0")} />
              <span className={cn("w-4 h-px bg-current rounded-full transition-all duration-300",
                showMore && "-rotate-45 -translate-y-px")} />
            </div>
            <span className={cn("transition-all duration-200", showMore && "font-semibold")}>
              {showMore ? "Fermer" : "Plus"}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

/* ── Mobile Nav (hamburger + drawer) ── */
export function MobileNav() {
  const [open, setOpen]   = useState(false);
  const pathname          = usePathname();
  const { data: session } = useSession();
  const userRole          = session?.user?.role as Role | undefined;
  const userName          = [session?.user?.prenom, session?.user?.nom].filter(Boolean).join(" ") || "Utilisateur";
  const initials          = userName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  const visibleItems = NAV_ITEMS.filter(item => {
    if (!item.permission || !userRole) return true;
    return hasPermission(userRole, item.permission);
  });

  return (
    <>
      {/* Bouton hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden p-2 rounded-xl text-muted-foreground hover:bg-muted transition-all active:scale-95"
        aria-label="Menu"
      >
        <div className="w-5 h-4 flex flex-col justify-between">
          <span className="w-full h-0.5 bg-current rounded-full" />
          <span className="w-3/4 h-0.5 bg-current rounded-full" />
          <span className="w-full h-0.5 bg-current rounded-full" />
        </div>
      </button>

      {open && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <aside
            className="fixed inset-y-0 left-0 z-50 w-72 bg-card flex flex-col shadow-2xl lg:hidden"
            style={{ animation: "slideInLeft 0.22s cubic-bezier(0.34,1.2,0.64,1) both" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b">
              <div className="flex items-center gap-3">
                <Image src="/TFC0.png" alt="TFC" width={32} height={32} className="rounded-xl" />
                <div>
                  <p className="text-sm font-bold gradient-text">The Fairy Crocheter</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">ERP / POS</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Utilisateur */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: "linear-gradient(135deg, hsl(33 72% 42%), hsl(40 85% 56%))" }}>
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{userName}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[userRole ?? ""] ?? userRole}</p>
              </div>
            </div>

            {/* Navigation — tous les items */}
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
              {visibleItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== "/dashboard" && item.href !== "/ventes" && pathname.startsWith(item.href)) ||
                  (item.href === "/ventes" && pathname === "/ventes");
                return (
                  <Link key={item.href} href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5 shrink-0", !isActive && item.color)} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Déconnexion */}
            <div className="border-t px-3 py-3">
              <button
                onClick={() => { setOpen(false); signOut({ callbackUrl: "/login" }); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition-all"
              >
                <LogOut className="h-5 w-5" />
                Déconnexion
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
