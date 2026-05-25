import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Sidebar, MobileNav, MobileBottomNav } from "@/components/layout/Sidebar";
import { InstallPrompt } from "@/components/layout/InstallPrompt";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { SessionTimer } from "@/components/shared/SessionTimer";

const ConnectionStatus = dynamic(
  () => import("@/components/layout/ConnectionStatus").then((m) => m.ConnectionStatus),
  { ssr: false }
);

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Header glass sticky */}
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 glass shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <MobileNav />
            <div className="lg:hidden flex items-center gap-2">
              <Image src="/TFC0.png" alt="TFC" width={26} height={26} className="object-contain rounded-lg" />
              <span className="text-sm font-bold gradient-text">The Fairy Crocheter</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SessionTimer />
            <ThemeToggle />
            <ConnectionStatus />
          </div>
        </header>

        {/* Contenu animé à l'entrée */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-safe lg:pb-6">
          <div className="page-enter">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav />
      <InstallPrompt />
    </div>
  );
}
