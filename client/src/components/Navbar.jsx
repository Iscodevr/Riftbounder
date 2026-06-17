import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";

const LINKS = [
  { to: "/", label: "Catalogue", icon: "🗂️" },
  { to: "/library", label: "Collection", icon: "📚" },
  { to: "/decks", label: "Decks", icon: "🃏" },
  { to: "/scan", label: "Scanner", icon: "📷" },
  { to: "/game", label: "Jouer", icon: "⚔️" },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { lang, toggleLang } = useLanguage();

  return (
    <>
      {/* Barre du haut — desktop uniquement */}
      <nav className="hidden sm:flex bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-6 w-full">
          <Link to="/" className="font-bold text-gold-400 text-lg tracking-wide shrink-0" style={{ fontFamily: "Cinzel, serif" }}>
            RIFTBOUND
          </Link>
          <div className="flex items-center gap-1 flex-1">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  pathname === l.to ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}>
                <span className="mr-1.5">{l.icon}</span>{l.label}
              </Link>
            ))}
          </div>
          {user && (
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={toggleLang}
                className="text-xs font-semibold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-md px-2 py-1 transition-colors">
                {lang === "fr" ? "🇫🇷 FR" : "🇬🇧 EN"}
              </button>
              <span className="text-sm text-gray-400 max-w-36 truncate">{user.email}</span>
              <button onClick={logout} className="text-sm text-gray-500 hover:text-white transition-colors">
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Barre du haut mobile — logo + déconnexion */}
      <nav className="sm:hidden bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-12">
          <span className="font-bold text-gold-400 text-base tracking-wide" style={{ fontFamily: "Cinzel, serif" }}>
            RIFTBOUND
          </span>
          {user && (
            <div className="flex items-center gap-2">
              <button onClick={toggleLang}
                className="text-xs font-semibold text-gray-300 active:text-white bg-gray-800 rounded-md px-2 py-1">
                {lang === "fr" ? "🇫🇷 FR" : "🇬🇧 EN"}
              </button>
              <button onClick={logout} className="text-xs text-gray-500 active:text-white py-1 px-2">
                Déco
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Bottom nav mobile */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex">
          {LINKS.map((l) => {
            const active = pathname === l.to;
            return (
              <Link key={l.to} to={l.to}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                  active ? "text-gold-400" : "text-gray-500 active:text-white"
                }`}>
                <span className="text-xl leading-none">{l.icon}</span>
                <span className="text-[10px] font-medium">{l.label}</span>
                {active && <div className="absolute bottom-0 w-8 h-0.5 bg-gold-400 rounded-full" />}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
