import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  Search,
  Menu,
  X,
  Globe2,
  Instagram,
  ArrowRight,
  UserRound,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { api, json } from "./api";
import type { User, Taxonomies } from "./types";
import {
  Home,
  Catalogue,
  BookDetail,
  Account,
  Dashboard,
  Legal,
  Contact,
} from "./pages";
const Reader = lazy(() => import("./Reader"));
const Admin = lazy(() => import("./Admin"));
export const Auth = createContext<{
  user: User | null;
  setUser: (u: User | null) => void;
  loading: boolean;
}>({ user: null, setUser: () => {}, loading: true });
export const CatalogContext = createContext<Taxonomies>({
  authors: [],
  categories: [],
  languages: [],
  settings: {},
});
export function Guard({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { user, loading } = useContext(Auth);
  const location = useLocation();
  if (loading) return <p className="empty">Opening your library…</p>;
  return !user ? (
    <Navigate to="/login" state={{ from: location.pathname }} replace />
  ) : admin && user.role !== "admin" ? (
    <p className="empty">This area is reserved for administrators.</p>
  ) : (
    children
  );
}
function Header() {
  const tax = useContext(CatalogContext);
  const { user, setUser } = useContext(Auth);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);
  return (
    <>
      <div className="announcement">
        {tax.settings.announcement ||
          "A thousand stories. A million possibilities."}{" "}
        <Link to="/books">
          Find your next read <ArrowUpRight size={12} />
        </Link>
      </div>
      <header className="header">
        <Link className="brand" to="/" aria-label="ReadDuniya home">
          <span className="brand-icon">
            <BookOpen size={24} />
          </span>
          <span>
            Read<span className="brand-accent">Duniya</span>
            <small>HAR KITAAB, EK NAYI DUNIYA</small>
          </span>
        </Link>
        <nav className={menu ? "nav open" : "nav"}>
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/books">Explore books</NavLink>
          <NavLink to="/categories">Categories</NavLink>
          <NavLink to="/about">Our story</NavLink>
        </nav>
        <div className="header-actions">
          <form
            className="nav-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/books?q=${encodeURIComponent(q)}`);
            }}
          >
            <label className="sr-only" htmlFor="nav-search">
              Search books
            </label>
            <Search size={17} />
            <input
              id="nav-search"
              placeholder="Search a story…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>
          <button
            className="language"
            onClick={() => navigate("/books?language=hi")}
            aria-label="Explore Hindi books"
          >
            <Globe2 size={16} /> हिन्दी
          </button>
          {user ? (
            <Link className="btn small" to="/dashboard">
              <UserRound size={15} /> My library
            </Link>
          ) : (
            <Link className="btn small" to="/login">
              Sign in <ArrowUpRight size={14} />
            </Link>
          )}
          <button
            className="menu-btn icon-btn"
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            aria-label="Toggle menu"
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {user && (
        <div className="account-bar">
          Welcome, {user.name}{" "}
          {user.role === "admin" && (
            <Link to="/admin">
              <ShieldCheck size={13} /> Admin dashboard
            </Link>
          )}
          <button
            onClick={async () => {
              await api("/logout", json("POST"));
              setUser(null);
              navigate("/");
            }}
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      )}
    </>
  );
}
function Footer() {
  return (
    <footer>
      <div className="footer-top">
        <div>
          <Link className="brand" to="/">
            <BookOpen />
            <span>
              ReadDuniya<small>HAR KITAAB, EK NAYI DUNIYA</small>
            </span>
          </Link>
          <p>
            A home for curious minds and beautiful stories.
            <br />
            Made for the reader in you.
          </p>
        </div>
        <div>
          <h3>Discover</h3>
          <Link to="/books">All books</Link>
          <Link to="/books?language=hi">हिन्दी पुस्तकें</Link>
          <Link to="/categories">Browse categories</Link>
        </div>
        <div>
          <h3>ReadDuniya</h3>
          <Link to="/about">Our story</Link>
          <Link to="/contact">Get in touch</Link>
          <Link to="/copyright">Copyright & takedown</Link>
        </div>
        <div>
          <h3>Stay curious.</h3>
          <p>Your next favourite book is waiting.</p>
          <Link className="footer-cta" to="/books">
            Start exploring <ArrowRight size={18} />
          </Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} ReadDuniya. All rights reserved.
        </span>
        <div>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/refunds">Refunds</Link>
          <span aria-label="Community">
            <Instagram size={16} />
          </span>
        </div>
      </div>
    </footer>
  );
}
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tax, setTax] = useState<Taxonomies>({
    authors: [],
    categories: [],
    languages: [],
    settings: {},
  });
  const location = useLocation();
  useEffect(() => {
    api<User>("/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
    api<Taxonomies>("/taxonomies")
      .then(setTax)
      .catch(() => {});
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const isReader = location.pathname.startsWith("/read/");
  return (
    <Auth.Provider value={{ user, setUser, loading }}>
      <CatalogContext.Provider value={tax}>
        {!isReader && <Header />}
        <main id="main">
          <Suspense fallback={<p className="empty">Opening your chapter…</p>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/books" element={<Catalogue />} />
              <Route
                path="/categories"
                element={<Catalogue categoriesOnly />}
              />
              <Route path="/category/:category" element={<Catalogue />} />
              <Route path="/books/:slug" element={<BookDetail />} />
              <Route path="/login" element={<Account />} />
              <Route path="/register" element={<Account register />} />
              <Route
                path="/dashboard"
                element={
                  <Guard>
                    <Dashboard />
                  </Guard>
                }
              />
              <Route
                path="/read/:id"
                element={
                  <Guard>
                    <Reader />
                  </Guard>
                }
              />
              <Route
                path="/admin/*"
                element={
                  <Guard admin>
                    <Admin />
                  </Guard>
                }
              />
              <Route path="/contact" element={<Contact />} />
              {["about", "privacy", "terms", "refunds", "copyright"].map(
                (p) => (
                  <Route key={p} path={`/${p}`} element={<Legal kind={p} />} />
                ),
              )}
              <Route
                path="*"
                element={
                  <div className="empty">
                    <h1>That chapter is missing.</h1>
                    <Link to="/">Return home</Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </main>
        {!isReader && <Footer />}
      </CatalogContext.Provider>
    </Auth.Provider>
  );
}
