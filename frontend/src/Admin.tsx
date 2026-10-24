import { useContext, useEffect, useState, type FormEvent } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  BookOpen,
  Users,
  ShoppingBag,
  IndianRupee,
  Plus,
  Pencil,
  Trash2,
  LayoutDashboard,
  Settings,
  Tags,
  RefreshCw,
} from "lucide-react";
import { CatalogContext } from "./App";
import { api, json } from "./api";
import {
  money,
  type Book,
  type Order,
  type Page,
  type User,
  type Taxonomies,
} from "./types";
import { ErrorNote, Pagination } from "./pages";
type Summary = {
  books: number;
  readers: number;
  revenue_paise: number;
  paid_orders: number;
  sales: { date: string; total: number }[];
};
const tabs = [
  ["overview", "Overview", LayoutDashboard],
  ["books", "Books", BookOpen],
  ["orders", "Orders", ShoppingBag],
  ["users", "Readers", Users],
  ["taxonomy", "Genres & languages", Tags],
  ["settings", "Settings", Settings],
] as const;
export default function Admin() {
  const [tab, setTab] = useState("overview");
  const [summary, setSummary] = useState<Summary>();
  const [books, setBooks] = useState<Page<Book>>();
  const [orders, setOrders] = useState<Page<Order>>();
  const [users, setUsers] = useState<Page<User>>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Book | null | undefined>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("created_at");
  const [refresh, setRefresh] = useState(0);
  const context = useContext(CatalogContext);
  const [tax, setTax] = useState<Taxonomies>(context);
  useEffect(() => {
    setError("");
    const query = new URLSearchParams({
      page: String(page),
      q: search,
      sort,
      ...(status ? { status } : {}),
    });
    if (tab === "overview")
      api<Summary>("/admin/summary")
        .then(setSummary)
        .catch((e) => setError(e.message));
    if (tab === "books")
      api<Page<Book>>(`/admin/books?${query}`)
        .then(setBooks)
        .catch((e) => setError(e.message));
    if (tab === "orders")
      api<Page<Order>>(`/admin/orders?${query}`)
        .then(setOrders)
        .catch((e) => setError(e.message));
    if (tab === "users")
      api<Page<User>>(`/admin/users?${query}`)
        .then(setUsers)
        .catch((e) => setError(e.message));
    if (tab === "taxonomy")
      api<Taxonomies>("/taxonomies")
        .then(setTax)
        .catch((e) => setError(e.message));
  }, [tab, page, search, status, sort, refresh]);
  const switchTab = (value: string) => {
    setTab(value);
    setPage(1);
    setStatus("");
    setSearch("");
    setEditing(undefined);
    setNotice("");
  };
  async function remove(b: Book) {
    if (
      !window.confirm(
        `Delete “${b.title}”? Purchased titles will be retired instead.`,
      )
    )
      return;
    try {
      await api(`/admin/books/${b.id}`, json("DELETE"));
      setRefresh((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <span className="eyebrow">THE CONTROL ROOM</span>
        <h2>
          Studio<span>.</span>
        </h2>
        {tabs.map(([id, label, Icon]) => (
          <button
            className={tab === id ? "active" : ""}
            onClick={() => switchTab(id)}
            key={id}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
        <p>
          Publish thoughtfully.
          <br />
          Every story deserves care.
        </p>
      </aside>
      <section className="admin-main">
        <div className="section-heading">
          <div>
            <span className="eyebrow">READDUNIYA / ADMIN</span>
            <h1>{tabs.find((t) => t[0] === tab)?.[1]}</h1>
          </div>
          {tab === "books" && (
            <button className="btn small" onClick={() => setEditing(null)}>
              <Plus size={17} /> Add a book
            </button>
          )}
        </div>
        <ErrorNote error={error} />
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {editing !== undefined && (
          <BookEditor
            tax={tax.languages.length ? tax : context}
            book={editing}
            onClose={() => setEditing(undefined)}
            onSaved={() => {
              setEditing(undefined);
              setRefresh((n) => n + 1);
              setNotice("Book saved. New PDF pages render in the queue.");
            }}
          />
        )}
        {tab === "overview" && summary && (
          <>
            <div className="stats-grid">
              {[
                [BookOpen, "Catalogue", summary.books],
                [Users, "Readers", summary.readers],
                [IndianRupee, "Captured sales", money(summary.revenue_paise)],
                [ShoppingBag, "Paid orders", summary.paid_orders],
              ].map(([Icon, label, value]) => {
                const I = Icon as typeof BookOpen;
                return (
                  <div className="stat" key={String(label)}>
                    <I size={20} />
                    <span>{String(label)}</span>
                    <strong>{String(value)}</strong>
                  </div>
                );
              })}
            </div>
            <div className="chart-card">
              <h2>Sales over time</h2>
              <p className="muted">Captured orders in INR. Refunds excluded.</p>
              {summary.sales.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={summary.sales.map((s) => ({
                      ...s,
                      total: Number(s.total) / 100,
                    }))}
                  >
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(v) => `₹${v}`} />
                    <Bar dataKey="total" fill="#315e4f" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty">
                  Your first chapter of sales is still ahead.
                </div>
              )}
            </div>
            <div className="notice">
              Before publishing: confirm rights, review private files, and check
              rendering status. Test checkout in Razorpay test mode before live
              activation.
            </div>
          </>
        )}
        {["books", "orders", "users"].includes(tab) && (
          <div className="filters">
            {tab !== "orders" && (
              <input
                aria-label="Filter records"
                placeholder={
                  tab === "books" ? "Filter titles…" : "Filter email…"
                }
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            )}
            {tab !== "users" && (
              <select
                aria-label="Status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {(tab === "books"
                  ? ["draft", "published"]
                  : [
                      "creating",
                      "pending",
                      "paid",
                      "failed",
                      "expired",
                      "refunded",
                    ]
                ).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            )}
            {tab === "books" && (
              <select
                aria-label="Sort books"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="created_at">Newest</option>
                <option value="title">Title</option>
                <option value="download_price_paise">Price</option>
              </select>
            )}
          </div>
        )}
        {tab === "books" && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Language / genre</th>
                    <th>Price</th>
                    <th>Status / rendering</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {books?.data.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.title}</strong>
                        <small>{b.author.name}</small>
                      </td>
                      <td>
                        {b.language.name}
                        <small>
                          {b.categories.map((c) => c.name).join(", ")}
                        </small>
                      </td>
                      <td>{money(b.download_price_paise)}</td>
                      <td>
                        <span className={`status ${b.status}`}>{b.status}</span>
                        <small>
                          {b.render_status} · {b.page_count} pages
                        </small>
                      </td>
                      <td className="actions">
                        <button
                          className="icon-btn"
                          aria-label={`Edit ${b.title}`}
                          onClick={() => setEditing(b)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={`Retry rendering ${b.title}`}
                          onClick={() =>
                            api(`/admin/books/${b.id}/render`, json("POST"))
                              .then(() => setNotice("Render queued."))
                              .catch((e) => setError(e.message))
                          }
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button
                          className="icon-btn danger"
                          aria-label={`Delete ${b.title}`}
                          onClick={() => remove(b)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              last={books?.last_page || 1}
              onChange={setPage}
            />
          </>
        )}
        {tab === "orders" && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reference / user</th>
                    <th>Book</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {orders?.data.map((o) => (
                    <tr key={o.id}>
                      <td>
                        {o.reference}
                        <small>{o.created_at}</small>
                      </td>
                      <td>{o.book.title}</td>
                      <td>{money(o.amount_paise)}</td>
                      <td>
                        <span className={`status ${o.status}`}>{o.status}</span>
                      </td>
                      <td>
                        {o.payments.map((p) => (
                          <small key={p.gateway_payment_id}>
                            {p.gateway_payment_id} · {p.status}
                          </small>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              last={orders?.last_page || 1}
              onChange={setPage}
            />
          </>
        )}
        {tab === "users" && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Change role</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.data.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>
                        <button
                          className="text-link"
                          onClick={async () => {
                            if (
                              !confirm(
                                `Change ${u.name} to ${u.role === "admin" ? "reader" : "admin"}?`,
                              )
                            )
                              return;
                            try {
                              await api(
                                `/admin/users/${u.id}/role`,
                                json("PATCH", {
                                  role: u.role === "admin" ? "reader" : "admin",
                                }),
                              );
                              setRefresh((n) => n + 1);
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          Make {u.role === "admin" ? "reader" : "admin"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              last={users?.last_page || 1}
              onChange={setPage}
            />
          </>
        )}
        {tab === "taxonomy" && (
          <div className="taxonomy-grid">
            {(["categories", "languages", "authors"] as const).map((kind) => (
              <div className="panel" key={kind}>
                <h2>{kind}</h2>
                <div className="tags">
                  {tax[kind].map((t) => (
                    <span className="pill" key={t.id}>
                      {t.name}{" "}
                      <button
                        aria-label={`Rename ${t.name}`}
                        onClick={async () => {
                          const name = prompt("New name", t.name);
                          if (!name) return;
                          try {
                            await api(
                              `/admin/taxonomies/${kind}/${t.id}`,
                              json("PATCH", {
                                name,
                                slug: t.slug,
                                code: t.code,
                              }),
                            );
                            setRefresh((n) => n + 1);
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        ✎
                      </button>{" "}
                      <button
                        aria-label={`Delete ${t.name}`}
                        onClick={async () => {
                          if (
                            !confirm(
                              `Delete ${t.name}? Associated books must be reassigned first.`,
                            )
                          )
                            return;
                          try {
                            await api(
                              `/admin/taxonomies/${kind}/${t.id}`,
                              json("DELETE"),
                            );
                            setRefresh((n) => n + 1);
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    try {
                      await api(
                        `/admin/taxonomies/${kind}`,
                        json("POST", Object.fromEntries(new FormData(form))),
                      );
                      form.reset();
                      setRefresh((n) => n + 1);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <label>
                    Name
                    <input required name="name" maxLength={100} />
                  </label>
                  {kind === "categories" && (
                    <label>
                      URL slug
                      <input
                        required
                        name="slug"
                        placeholder="fiction"
                        pattern="[a-zA-Z0-9_-]+"
                      />
                    </label>
                  )}
                  {kind === "languages" && (
                    <label>
                      Code (hi, en…)
                      <input required name="code" maxLength={8} />
                    </label>
                  )}
                  <button className="btn small">Add {kind.slice(0, -1)}</button>
                </form>
              </div>
            ))}
          </div>
        )}
        {tab === "settings" && (
          <form
            className="panel form-narrow"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api(
                  "/admin/settings",
                  json(
                    "PUT",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  ),
                );
                setNotice("Settings saved.");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <label>
              Announcement
              <input
                name="announcement"
                maxLength={250}
                defaultValue={context.settings.announcement}
              />
            </label>
            <label>
              Contact email
              <input
                type="email"
                name="contact_email"
                required
                defaultValue={context.settings.contact_email}
              />
            </label>
            <button className="btn">Save settings</button>
          </form>
        )}
      </section>
    </div>
  );
}
function BookEditor({
  book,
  onClose,
  onSaved,
  tax,
}: {
  book: Book | null;
  onClose: () => void;
  onSaved: () => void;
  tax: Taxonomies;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const rupees = Number(d.get("price_inr"));
    d.delete("price_inr");
    d.set("download_price_paise", String(Math.round(rupees * 100)));
    for (const k of ["read_available", "download_available", "confirm_rights"])
      d.set(k, d.get(k) ? "1" : "0");
    const tags = String(d.get("tags_text") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    d.delete("tags_text");
    if (tags.length) tags.forEach((t) => d.append("tags[]", t));
    else d.append("tags[]", "");
    for (const k of ["pdf", "cover"]) {
      const f = d.get(k);
      if (f instanceof File && !f.size) d.delete(k);
    }
    setBusy(true);
    setError("");
    try {
      await api(`/admin/books${book ? `/${book.id}` : ""}`, {
        method: "POST",
        body: d,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="editor panel">
      <div className="section-heading">
        <h2>{book ? "Edit title" : "A new story"}</h2>
        <button type="button" className="text-link" onClick={onClose}>
          Close ×
        </button>
      </div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            Title
            <input
              required
              name="title"
              defaultValue={book?.title}
              maxLength={250}
            />
          </label>
          <label>
            URL slug
            <input
              required
              name="slug"
              pattern="[a-zA-Z0-9_-]+"
              defaultValue={book?.slug}
              placeholder="a-new-story"
            />
          </label>
          <label>
            Author
            <select name="author_id" defaultValue={book?.author_id} required>
              <option value="">Choose author</option>
              {tax.authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Language
            <select
              name="language_id"
              defaultValue={book?.language_id}
              required
            >
              <option value="">Choose language</option>
              {tax.languages.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Publication year
            <input
              name="publication_year"
              type="number"
              min={1000}
              max={2100}
              defaultValue={book?.publication_year}
            />
          </label>
          <label>
            Publisher
            <input name="publisher" defaultValue={book?.publisher} />
          </label>
          <label>
            ISBN (optional)
            <input name="isbn" maxLength={32} defaultValue={book?.isbn} />
          </label>
          <label>
            Tags, comma separated
            <input name="tags_text" defaultValue={book?.tags?.join(", ")} />
          </label>
        </div>
        <label>
          Description
          <textarea
            required
            name="description"
            rows={4}
            defaultValue={book?.description}
          />
        </label>
        <fieldset>
          <legend>Genres</legend>
          <div className="checkboxes">
            {tax.categories.map((c) => (
              <label key={c.id}>
                <input
                  name="category_ids[]"
                  type="checkbox"
                  value={c.id}
                  defaultChecked={book?.categories.some((x) => x.id === c.id)}
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-grid">
          <label>
            Private PDF (max 50 MB)
            <input name="pdf" type="file" accept="application/pdf" />
          </label>
          <label>
            Cover (JPEG, PNG, WebP, max 5 MB)
            <input
              name="cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
          </label>
          <label>
            Download price in INR
            <input
              name="price_inr"
              type="number"
              min={1}
              max={100000}
              step="0.01"
              defaultValue={(book?.download_price_paise || 1000) / 100}
              required
            />
          </label>
          <label>
            Publication status
            <select name="status" defaultValue={book?.status || "draft"}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
          <label>
            Rights status
            <select
              name="rights_status"
              defaultValue={book?.rights_status || "unverified"}
            >
              <option value="unverified">Unverified</option>
              <option value="owned">Owned</option>
              <option value="licensed">Licensed</option>
              <option value="public_domain">Public domain</option>
            </select>
          </label>
        </div>
        <label>
          Publication and distribution rights evidence
          <textarea
            name="rights_evidence"
            rows={3}
            placeholder="License reference, territory, duration, permission to display online and distribute downloads. Re-enter evidence when publishing updates."
          />
        </label>
        <div className="checkboxes">
          <label>
            <input
              name="read_available"
              type="checkbox"
              defaultChecked={book?.read_available}
            />{" "}
            Enable online reading
          </label>
          <label>
            <input
              name="download_available"
              type="checkbox"
              defaultChecked={book?.download_available}
            />{" "}
            Enable paid downloads
          </label>
        </div>
        <label className="rights-confirm">
          <input name="confirm_rights" type="checkbox" /> I confirm that
          ReadDuniya holds the necessary publication AND distribution rights.
          This confirmation and my user ID will be recorded.
        </label>
        <ErrorNote error={error} />
        <button className="btn" disabled={busy}>
          {busy ? "Uploading…" : "Save book"}
        </button>
      </form>
    </div>
  );
}
