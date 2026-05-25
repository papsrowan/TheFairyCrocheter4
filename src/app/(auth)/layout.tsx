import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Panneau gauche — décoratif couleurs logo */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, hsl(25 65% 28%) 0%, hsl(33 72% 42%) 50%, hsl(40 82% 55%) 100%)" }}
      >
        {/* Cercles décoratifs */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, hsl(40 90% 75%), transparent)" }} />
        <div className="absolute bottom-10 -right-16 w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, white, transparent)" }} />

        {/* Contenu décoratif */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12 text-white">
          {/* Logo réel */}
          <div className="w-32 h-32 rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center mb-8 shadow-2xl border border-white/20">
            <Image
              src="/TFC0.png"
              alt="The Fairy Crocheter"
              width={96}
              height={96}
              className="object-contain drop-shadow-lg"
              priority
            />
          </div>

          <h1 className="text-3xl font-bold text-center mb-3 drop-shadow">The Fairy Crocheter</h1>
          <p className="text-white/80 text-center text-sm leading-relaxed max-w-xs">
            Gestion commerciale complète — ventes, stock, clients et finances en un seul endroit.
          </p>

          {/* Features */}
          <div className="mt-10 space-y-3 w-full max-w-xs">
            {[
              { icon: "⚡", text: "Caisse POS rapide" },
              { icon: "📦", text: "Gestion du stock en temps réel" },
              { icon: "📊", text: "Dashboard analytique" },
              { icon: "📄", text: "Factures PDF automatiques" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2.5 backdrop-blur-sm border border-white/10">
                <span className="text-lg">{f.icon}</span>
                <span className="text-sm text-white/90 font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <Image
              src="/TFC0.png"
              alt="The Fairy Crocheter"
              width={48}
              height={48}
              className="object-contain rounded-xl"
            />
            <h1 className="text-xl font-bold gradient-text">The Fairy Crocheter</h1>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
