import { useContext, useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Feather,
  Globe2,
  Heart,
  Library,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { Auth, CatalogContext } from "./App";
import { api, json } from "./api";
import type { Book, Page, User, Order } from "./types";
import { money } from "./types";
import { purchase, downloadBook } from "./payments";
export function ErrorNote({ error }: { error: string }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
}
export function Cover({
  book,
  large = false,
}: {
  book: Book;
  large?: boolean;
}) {
  const [image, setImage] = useState(!!book.has_cover);
  return (
    <div
      className={`book-cover cover-${book.id % 8} ${large ? "large-cover" : ""}`}
    >
      {image && (
        <img
          loading="lazy"
          src={`/api/books/${book.id}/cover`}
          onError={() => setImage(false)}
          alt=""
        />
      )}
      <div className="cover-content">
        <span className="cover-kicker">READDUNIYA EDITIONS</span>
        <h3 lang={book.language?.code}>{book.title}</h3>
        <div className="cover-art">
          <span />
          <i />
          <b />
        </div>
        <span className="cover-author">{book.author?.name}</span>
      </div>
      <span className="spine" />
    </div>
  );
}
export function BookCard({ book }: { book: Book }) {
  return (
    <article className="book-card">
      <Link to={`/books/${book.slug}`} tabIndex={-1} aria-hidden="true">
        <Cover book={book} />
        <span className="book-badge">{book.language?.name}</span>
      </Link>
      <div className="book-meta">
        <span>{book.categories?.[0]?.name || "Discover"}</span>
        <span>
          <Star size={11} /> {book.read_available ? "Free to read" : "Discover"}
        </span>
      </div>
      <h3 lang={book.language?.code}>
        <Link to={`/books/${book.slug}`}>{book.title}</Link>
      </h3>
      <p>{book.author?.name}</p>
      <div className="book-bottom">
        <span>
          {book.read_available ? "Read for free" : "Catalogue preview"}
        </span>
        <Link to={`/books/${book.slug}`} aria-label={`Explore ${book.title}`}>
          <ArrowUpRight size={18} />
        </Link>
      </div>
    </article>
  );
}
export function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState("");
  const [genre, setGenre] = useState("");
  const tax = useContext(CatalogContext);
  useEffect(() => {
    api<Page<Book>>(`/books?${new URLSearchParams({ category: genre })}`)
      .then((p) => setBooks(p.data))
      .catch((e) => setError(e.message));
  }, [genre]);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> YOUR NEXT CHAPTER STARTS HERE
          </div>
          <h1>
            Small escapes.
            <br />
            <em>Endless worlds.</em>
          </h1>
          <p>
            For the stories that stay with you.
            <br />
            Discover books in Hindi & English, read at your pace,
            <br className="desktop" /> and find a little more of yourself on
            every page.
          </p>
          <div className="hero-actions">
            <Link className="btn" to="/books">
              Explore the library <ArrowUpRight size={18} />
            </Link>
            <Link className="text-link" to="/books?language=hi">
              हिन्दी में पढ़ें <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-note">
            <span className="reader-avatars">
              अ <i>R</i>
              <b>क</b>
            </span>
            <span>
              A space for every kind of reader.
              <small>Many languages. One love for stories.</small>
            </span>
          </div>
        </div>
        <div
          className="hero-art"
          aria-label="Illustrated collection of ReadDuniya books"
        >
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="star star-one">✧</span>
          <span className="star star-two">✧</span>
          <div className="hero-book hero-book-back">
            <span>READDUNIYA ORIGINALS</span>
            <h2>
              बारिश
              <br />
              के बाद
            </h2>
            <div className="rain-art">☂︎</div>
            <small>कहानियों की एक नई दुनिया</small>
          </div>
          <div className="hero-book hero-book-front">
            <span>THE EVERYDAY COLLECTION</span>
            <h2>
              The Art of
              <br />
              <em>Beginning</em>
            </h2>
            <div className="sun-art">
              <i />
              <b />
              <span />
            </div>
            <small>READDUNIYA STUDIO</small>
          </div>
          <div className="floating-label">
            <BookOpen size={24} />
            <span>
              One more page.<small>One more possibility.</small>
            </span>
          </div>
          <div className="vertical-type">A WORLD BETWEEN THE PAGES</div>
        </div>
        <span className="hero-bottom">
          SCROLL TO DISCOVER <span>↓</span>
        </span>
      </section>
      <div className="benefits">
        <span>
          <BookOpen /> Read online, at your pace
        </span>
        <span>
          <Globe2 /> Hindi & English stories
        </span>
        <span>
          <ShieldCheck /> Respecting authors & their work
        </span>
        <span>
          <Heart /> A library made with love
        </span>
      </div>
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE GOOD KIND OF GETTING LOST</span>
            <h2>A story for every mood.</h2>
          </div>
          <Link className="text-link" to="/books">
            View all books <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="genre-tabs">
          <button
            className={!genre ? "selected" : ""}
            onClick={() => setGenre("")}
          >
            All books <Sparkles size={14} />
          </button>
          {tax.categories.slice(0, 6).map((c) => (
            <button
              className={genre === c.slug ? "selected" : ""}
              key={c.id}
              onClick={() => setGenre(c.slug || "")}
            >
              {c.name}
            </button>
          ))}
        </div>
        <ErrorNote error={error} />
        <div className="book-grid">
          {books.slice(0, 4).map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
        {!books.length && !error && (
          <p className="empty">Gathering your next reads…</p>
        )}
      </section>
      <section className="hindi-banner">
        <div className="banner-decoration">क</div>
        <div>
          <span className="eyebrow">STORIES THAT FEEL LIKE HOME</span>
          <h2>अपनी भाषा। अपनी कहानियाँ।</h2>
          <p>
            कुछ कहानियाँ दिल के और करीब होती हैं। हिन्दी की दुनिया में खो जाइए।
          </p>
        </div>
        <Link className="btn light" to="/books?language=hi">
          हिन्दी पुस्तकें खोजें <ArrowUpRight size={18} />
        </Link>
      </section>
      <section className="section category-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FOLLOW YOUR CURIOSITY</span>
            <h2>Where will you wander?</h2>
          </div>
          <Link className="text-link" to="/categories">
            All categories <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="category-grid">
          {tax.categories.slice(0, 4).map((c, i) => (
            <Link
              to={`/category/${c.slug}`}
              className={`category-tile category-${i}`}
              key={c.id}
            >
              {[<Feather />, <BookOpen />, <Sparkles />, <Library />][i]}
              <div>
                <h3>{c.name}</h3>
                <span>Find your next perspective</span>
              </div>
              <ArrowUpRight size={19} />
            </Link>
          ))}
        </div>
      </section>
      <section className="quote-section">
        <span>“</span>
        <blockquote>
          A reader lives a thousand lives
          <br />
          before they find their next favourite.
        </blockquote>
        <p>A LITTLE CURIOSITY GOES A LONG WAY.</p>
        <Link to="/books" className="text-link">
          Make time for a story <ArrowRight size={16} />
        </Link>
      </section>
    </>
  );
}
export function Catalogue({
  categoriesOnly = false,
}: {
  categoriesOnly?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const route = useParams();
  const tax = useContext(CatalogContext);
  const [data, setData] = useState<Page<Book>>();
  const [error, setError] = useState("");
  const [search, setSearch] = useState(params.get("q") || "");
  const query = new URLSearchParams(params);
  if (route.category) query.set("category", route.category);
  const key = query.toString();
  useEffect(() => {
    setError("");
    api<Page<Book>>(`/books?${key}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [key]);
  function filter(k: string, v: string) {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next);
  }
  return (
    <section className="section catalogue">
      <div className="page-intro">
        <span className="eyebrow">THE READDUNIYA LIBRARY</span>
        <h1>
          {categoriesOnly
            ? "Follow your curiosity."
            : route.category
              ? tax.categories.find((c) => c.slug === route.category)?.name ||
                "Explore a genre."
              : "Find your next world."}
        </h1>
        <p>
          Stories, ideas, and a little everyday wonder. In a language that feels
          like you.
        </p>
      </div>
      {categoriesOnly ? (
        <div className="category-grid">
          {tax.categories.map((c, i) => (
            <Link
              className={`category-tile category-${i % 4}`}
              key={c.id}
              to={`/category/${c.slug}`}
            >
              <BookOpen />
              <h3>{c.name}</h3>
              <ArrowUpRight />
            </Link>
          ))}
        </div>
      ) : (
        <>
          <div className="filters">
            <form
              className="search-field"
              onSubmit={(e) => {
                e.preventDefault();
                filter("q", search);
              }}
            >
              <Search size={18} />
              <input
                aria-label="Search title or author"
                placeholder="Search by title or author"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button>Search</button>
            </form>
            <select
              aria-label="Language"
              value={params.get("language") || ""}
              onChange={(e) => filter("language", e.target.value)}
            >
              <option value="">All languages</option>
              {tax.languages.map((l) => (
                <option value={l.code} key={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort books"
              value={params.get("sort") || "newest"}
              onChange={(e) => filter("sort", e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="title">Title A–Z</option>
              <option value="price">Download price</option>
            </select>
          </div>
          <ErrorNote error={error} />
          <p className="results-count">
            {data?.total ?? "…"} books to discover
          </p>
          <div className="book-grid">
            {data?.data.map((b) => (
              <BookCard book={b} key={b.id} />
            ))}
          </div>
          {data?.total === 0 && (
            <p className="empty">
              No books found. Try another title or language.
            </p>
          )}
          <Pagination
            page={data?.current_page || 1}
            last={data?.last_page || 1}
            onChange={(n) => {
              const p = new URLSearchParams(params);
              p.set("page", String(n));
              setParams(p);
            }}
          />
        </>
      )}
    </section>
  );
}
export function Pagination({
  page,
  last,
  onChange,
}: {
  page: number;
  last: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="pagination">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>
      <span>
        Page {page} of {last}
      </span>
      <button
        disabled={page >= last}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
export function BookDetail() {
  const { slug } = useParams();
  const [book, setBook] = useState<Book>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useContext(Auth);
  const navigate = useNavigate();
  useEffect(() => {
    setBook(undefined);
    api<Book>(`/catalog/${slug}`)
      .then(setBook)
      .catch((e) => setError(e.message));
  }, [slug]);
  useEffect(() => {
    if (!book) return;
    document.title = `${book.title} by ${book.author.name} | ReadDuniya`;
    const meta = document.querySelector('meta[name="description"]');
    meta?.setAttribute("content", book.description.slice(0, 160));
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = `https://readduniya.in/books/${book.slug}`;
    document.head.appendChild(canonical);
    return () => {
      canonical.remove();
      document.title = "ReadDuniya — Har Kitaab, Ek Nayi Duniya";
    };
  }, [book]);
  async function buy() {
    if (!user) {
      navigate("/login");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await purchase(book!);
      await downloadBook(book!.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!book)
    return (
      <div className="empty">
        <ErrorNote error={error} />
        {!error && "Opening this chapter…"}
      </div>
    );
  return (
    <section className="section book-detail">
      <Link to="/books" className="text-link">
        <ChevronLeft size={16} /> Back to the library
      </Link>
      <div className="detail-grid">
        <div className="detail-cover">
          <Cover book={book} large />
        </div>
        <div className="detail-copy">
          <span className="eyebrow">
            {book.categories.map((c) => c.name).join(" · ")} /{" "}
            {book.language.name}
          </span>
          <h1 lang={book.language.code}>{book.title}</h1>
          <p className="byline">by {book.author.name}</p>
          <p className="description">{book.description}</p>
          <div className="detail-specs">
            <span>
              Language<strong>{book.language.name}</strong>
            </span>
            <span>
              Published<strong>{book.publication_year}</strong>
            </span>
            <span>
              Publisher<strong>{book.publisher}</strong>
            </span>
            <span>
              Pages<strong>{book.page_count || "Preview"}</strong>
            </span>
          </div>
          <div className="detail-buttons">
            {book.read_available && book.render_status === "ready" ? (
              <Link className="btn" to={`/read/${book.id}`}>
                <BookOpen size={18} /> Read for free
              </Link>
            ) : (
              <span className="pill">Online reading coming soon</span>
            )}
            {book.download_available && (
              <button className="btn outline" disabled={busy} onClick={buy}>
                <Download size={17} />
                {busy
                  ? "Checking payment…"
                  : `Buy PDF · ${money(book.download_price_paise)}`}
              </button>
            )}
          </div>
          <ErrorNote error={error} />
          <p className="rights-note">
            <ShieldCheck size={16} /> Rights-cleared catalogue. Your purchase
            supports authorized distribution.
          </p>
          <div className="tags">
            {book.tags?.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
          <p className="muted">
            Already purchased? Re-download from{" "}
            <Link to="/dashboard">your library</Link> without paying again.
          </p>
        </div>
      </div>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Book",
          name: book.title,
          author: { "@type": "Person", name: book.author.name },
          inLanguage: book.language.code,
          url: `https://readduniya.in/books/${book.slug}`,
          description: book.description,
          isbn: book.isbn || undefined,
        }).replace(/</g, "\\u003c")}
      </script>
    </section>
  );
}
export function Account({ register = false }: { register?: boolean }) {
  const { setUser, user } = useContext(Auth);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  if (user)
    return (
      <div className="empty">
        You’re signed in. <Link to="/dashboard">Open your library</Link>
      </div>
    );
  return (
    <section className="auth-layout">
      <div className="auth-art">
        <BookOpen size={40} />
        <h1>
          There’s a whole
          <br />
          world waiting
          <br />
          <em>for you.</em>
        </h1>
        <p>Har Kitaab, Ek Nayi Duniya.</p>
      </div>
      <div className="auth-form">
        <span className="eyebrow">WELCOME TO READDUNIYA</span>
        <h1>{register ? "Begin your story." : "Welcome back."}</h1>
        <p>
          {register
            ? "Make room for a little more wonder."
            : "Your next chapter is right where you left it."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            const form = Object.fromEntries(new FormData(e.currentTarget));
            try {
              const u = await api<User>(
                register ? "/register" : "/login",
                json("POST", form),
              );
              setUser(u);
              navigate(location.state?.from || "/dashboard");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {register && (
            <label>
              Your name
              <input required name="name" autoComplete="name" maxLength={100} />
            </label>
          )}
          <label>
            Email address
            <input required name="email" type="email" autoComplete="email" />
          </label>
          <label>
            Password
            <input
              required
              name="password"
              type="password"
              minLength={register ? 12 : undefined}
              autoComplete={register ? "new-password" : "current-password"}
            />
          </label>
          {register && (
            <>
              <small>At least 12 characters, with letters and numbers.</small>
              <label>
                Confirm password
                <input
                  required
                  name="password_confirmation"
                  type="password"
                  autoComplete="new-password"
                />
              </label>
              <p className="muted">
                By registering, you agree to our <Link to="/terms">terms</Link>{" "}
                and <Link to="/privacy">privacy policy</Link>.
              </p>
            </>
          )}
          <ErrorNote error={error} />
          <button className="btn" disabled={busy}>
            {busy
              ? "Please wait…"
              : register
                ? "Create your account"
                : "Sign in"}
            <ArrowUpRight size={17} />
          </button>
        </form>
        <p>
          {register ? "Already a reader?" : "New here?"}{" "}
          <Link className="underlined" to={register ? "/login" : "/register"}>
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </section>
  );
}
type DashboardData = {
  history: { id: number; book: Book; page: number }[];
  bookmarks: { id: number; book: Book; page: number }[];
  orders: Page<Order>;
  entitlements: { id: number; book: Book }[];
};
export function Dashboard() {
  const [data, setData] = useState<DashboardData>();
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const { user } = useContext(Auth);
  useEffect(() => {
    api<DashboardData>(`/dashboard?page=${page}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [page]);
  return (
    <section className="section">
      <span className="eyebrow">YOUR OWN LITTLE CORNER</span>
      <h1>Hello, {user?.name.split(" ")[0]}.</h1>
      <p className="muted">A good day for one more chapter.</p>
      <ErrorNote error={error} />
      <h2>Continue reading</h2>
      <div className="library-list">
        {data?.history.map((h) => (
          <Link to={`/read/${h.book.id}?page=${h.page}`} key={h.id}>
            <BookOpen />
            <div>
              <strong>{h.book.title}</strong>
              <p>
                Page {h.page} of {h.book.page_count}
              </p>
              <progress value={h.page} max={h.book.page_count} />
            </div>
            <ArrowUpRight />
          </Link>
        ))}
        {data && !data.history.length && (
          <p>
            Your reading journey starts with <Link to="/books">a new book</Link>
            .
          </p>
        )}
      </div>
      <h2>Your downloads</h2>
      <div className="library-list">
        {data?.entitlements.map((e) => (
          <div key={e.id}>
            <BookOpen />
            <strong>{e.book.title}</strong>
            <button
              className="btn small"
              onClick={() =>
                downloadBook(e.book.id).catch((e) => setError(e.message))
              }
            >
              <Download size={15} /> Download again
            </button>
          </div>
        ))}
        {data && !data.entitlements.length && (
          <p>Purchased books will be available here.</p>
        )}
      </div>
      <h2>Saved pages</h2>
      <div className="tags">
        {data?.bookmarks.map((b) => (
          <Link
            className="pill"
            key={b.id}
            to={`/read/${b.book.id}?page=${b.page}`}
          >
            {b.book.title} · {b.page}
          </Link>
        ))}
      </div>
      <h2>Purchase history</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Book / reference</th>
              <th>Price</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {data?.orders.data.map((o) => (
              <tr key={o.id}>
                <td>
                  {o.book.title}
                  <small>{o.reference}</small>
                </td>
                <td>{money(o.amount_paise)}</td>
                <td>
                  <span className={`status ${o.status}`}>{o.status}</span>
                </td>
                <td>{new Date(o.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        last={data?.orders.last_page || 1}
        onChange={setPage}
      />
    </section>
  );
}
const legal: Record<string, { title: string; text: string[] }> = {
  about: {
    title: "A world between the pages.",
    text: [
      "ReadDuniya is a home for Hindi and English stories. Har Kitaab, Ek Nayi Duniya — every book opens a new world.",
      "We believe good reading should be welcoming, thoughtful, and respectful of the people who create it. Our catalogue includes only titles with recorded distribution rights.",
      "This initial catalogue contains synthetic demonstration titles. Reading and downloads become available when rights-cleared files are added.",
    ],
  },
  privacy: {
    title: "Privacy policy",
    text: [
      "DRAFT — requires legal review before launch. Identify the legal operator, address, privacy contact and applicable Indian data protection obligations.",
      "We process account details, reading progress, bookmarks, purchase records and limited security logs to operate the service. Payment card details are handled by Razorpay, not stored by ReadDuniya.",
      "Define lawful purposes, retention periods, deletion/export requests, grievance handling, processors, cross-border transfers and breach procedures before publishing this policy. Essential session cookies support authentication and CSRF protection.",
    ],
  },
  terms: {
    title: "Terms of use",
    text: [
      "DRAFT — requires legal review before launch. Identify the service operator and jurisdiction.",
      "Books may be read or downloaded only as permitted by the title’s license and your purchase. Do not redistribute, automate scraping, share accounts or bypass access controls.",
      "Reading safeguards discourage casual copying. Browser screenshots, screen recording and device photography cannot reliably be prevented; ReadDuniya does not offer DRM-level protection.",
      "Specify eligibility, license scope, account suspension, dispute resolution, consumer rights, service availability and limitation terms with legal counsel.",
    ],
  },
  refunds: {
    title: "Refund policy",
    text: [
      "DRAFT — requires legal review before accepting payments. Confirm eligibility, timelines, contact details and applicable consumer rights.",
      "If a payment is captured but access is delayed, contact support with the order reference. Do not make duplicate payments. Captured payments are reconciled through signed Razorpay webhooks.",
      "Approved refunds must be issued in the Razorpay dashboard. Any refund conservatively revokes future downloads after its signed webhook. Previously downloaded files cannot be recalled. Publish approved response times and escalation procedures before launch.",
    ],
  },
  copyright: {
    title: "Copyright & takedown",
    text: [
      "DRAFT — requires legal review. Publish the designated rights/grievance contact and response process before launch.",
      "We require a record of publication and distribution rights before titles are published. Catalogue samples are synthetic; no copyrighted full books are seeded.",
      "To report a suspected infringement, provide the title URL, identification of the protected work, evidence of ownership/authority, contact details, and a good-faith statement. Contact us through the contact page.",
      "Admins should promptly retire disputed titles pending review, preserve audit records and document the decision. Define counter-notice and repeat-infringer procedures with counsel.",
    ],
  },
};
export function Legal({ kind }: { kind: string }) {
  const p = legal[kind];
  return (
    <section className="section prose">
      <span className="eyebrow">READDUNIYA</span>
      <h1>{p.title}</h1>
      {p.text.map((t) => (
        <p key={t}>{t}</p>
      ))}
      <Link className="text-link" to="/contact">
        Get in touch <ArrowUpRight size={16} />
      </Link>
    </section>
  );
}
export function Contact() {
  const tax = useContext(CatalogContext);
  return (
    <section className="section prose">
      <span className="eyebrow">LET’S TURN A PAGE TOGETHER</span>
      <h1>We’re listening.</h1>
      <p>
        Questions about your library, a payment, or publication rights? Email
        our team with your order reference or book URL. Never include payment
        secrets or card information.
      </p>
      <a
        className="btn"
        href={`mailto:${tax.settings.contact_email || "hello@readduniya.in"}`}
      >
        {tax.settings.contact_email || "hello@readduniya.in"}{" "}
        <ArrowUpRight size={17} />
      </a>
      <p className="muted">
        The contact mailbox must be configured by the operator before launch.
      </p>
    </section>
  );
}
