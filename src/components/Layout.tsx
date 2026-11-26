import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { Avatar } from "./ui";
import {
  HeartIcon,
  HomeIcon,
  LogOutIcon,
  MoonIcon,
  PackageIcon,
  PlusIcon,
  SunIcon,
  TagIcon,
  UserIcon,
} from "./icons";

const desktopLinks = [
  { to: "/", label: "Scopri", icon: HomeIcon },
  { to: "/preferiti", label: "Preferiti", icon: HeartIcon },
  { to: "/offerte", label: "Offerte", icon: TagIcon },
  { to: "/ordini", label: "Ordini", icon: PackageIcon },
];

const mobileLinks = [
  { to: "/", label: "Scopri", icon: HomeIcon },
  { to: "/preferiti", label: "Preferiti", icon: HeartIcon },
  { to: "/vendi", label: "Vendi", icon: PlusIcon, primary: true },
  { to: "/offerte", label: "Offerte", icon: TagIcon },
  { to: "/profilo", label: "Profilo", icon: UserIcon },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="Riuso, home">
            <span className="brand-mark">R</span>
            <span className="brand-name">Riuso</span>
          </Link>

          <nav className="desktop-nav" aria-label="Navigazione principale">
            {desktopLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                end={link.to === "/"}
              >
                <link.icon width={19} height={19} />
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className="icon-button theme-toggle"
              onClick={toggle}
              aria-label={theme === "dark" ? "Attiva tema chiaro" : "Attiva tema scuro"}
              title={theme === "dark" ? "Tema chiaro" : "Tema scuro"}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            <Link to="/vendi" className="button button-primary header-sell">
              <PlusIcon width={18} height={18} />
              Vendi
            </Link>

            {loading ? (
              <span className="header-skeleton" />
            ) : user ? (
              <div className="user-menu" ref={menuRef}>
                <button
                  type="button"
                  className="user-trigger"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <Avatar name={user.name || user.email || "Utente"} src={user.image} size={34} />
                  <span className="user-name">{user.name || user.email?.split("@")[0]}</span>
                </button>
                {menuOpen && (
                  <div className="user-dropdown" role="menu">
                    <div className="user-dropdown-head">
                      <strong>{user.name || "Utente"}</strong>
                      <span>{user.email}</span>
                    </div>
                    <Link to="/profilo" role="menuitem">
                      <UserIcon width={17} height={17} /> Il mio profilo
                    </Link>
                    <Link to="/ordini" role="menuitem">
                      <PackageIcon width={17} height={17} /> I miei ordini
                    </Link>
                    <button type="button" role="menuitem" onClick={handleSignOut}>
                      <LogOutIcon width={17} height={17} /> Esci
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/auth" className="button button-ghost">
                Accedi
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <div>
          <strong>Riuso</strong>
          <span>Il marketplace dell'usato, senza sprechi.</span>
        </div>
        <div className="footer-links">
          <Link to="/">Scopri</Link>
          <Link to="/vendi">Vendi</Link>
          <Link to="/profilo">Profilo</Link>
        </div>
        <span className="footer-note">Demo su Neon · pagamenti simulati</span>
      </footer>

      <nav className="bottom-nav" aria-label="Navigazione mobile">
        {mobileLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `bottom-link${isActive ? " active" : ""}${link.primary ? " primary" : ""}`
            }
            end={link.to === "/"}
          >
            <span className={link.primary ? "bottom-icon primary" : "bottom-icon"}>
              <link.icon width={link.primary ? 24 : 21} height={link.primary ? 24 : 21} />
            </span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
