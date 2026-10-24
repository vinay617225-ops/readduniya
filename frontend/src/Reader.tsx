import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  ZoomIn,
  ZoomOut,
  BookOpen,
} from "lucide-react";
import { api, json } from "./api";
import { ErrorNote } from "./pages";
type Manifest = {
  page_count: number;
  page: number;
  url: string;
  text_url: string;
  watermark: string;
  progress?: { page: number };
  bookmarks: { page: number; note: string }[];
};
export default function Reader() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") || 1);
  const [textMode, setTextMode] = useState(false);
  const [text, setText] = useState("");
  const [data, setData] = useState<Manifest>();
  const [error, setError] = useState("");
  const [dark, setDark] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [imageError, setImageError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [saved, setSaved] = useState("");
  const [jump, setJump] = useState(String(page));
  useEffect(() => {
    let cancelled = false;
    setError("");
    setData(undefined);
    setImageError(false);
    setJump(String(page));
    api<Manifest>(`/reader/${id}?page=${page}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    const timer = window.setTimeout(() => setRefresh((n) => n + 1), 100000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [id, page, refresh]);
  useEffect(() => {
    if (!data || !textMode) return;
    let active = true;
    fetch(data.text_url, {
      credentials: "include",
      headers: { Accept: "text/plain" },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Text could not be loaded.");
        return r.text();
      })
      .then((t) => {
        if (active)
          setText(
            t ||
              "No extractable text on this page. Contact support for an accessible edition.",
          );
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      setText("");
    };
  }, [data, textMode]);
  const go = (n: number) => {
    if (n >= 1 && n <= (data?.page_count || 1)) setParams({ page: String(n) });
  };
  return (
    <div
      className={`reader ${dark ? "reader-dark" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="reader-header">
        <Link to="/dashboard">
          <ArrowLeft size={19} />
          <span>My library</span>
        </Link>
        <Link className="brand" to="/">
          <BookOpen /> ReadDuniya
        </Link>
        <button
          className="icon-btn"
          aria-label={dark ? "Light shell" : "Dark shell"}
          onClick={() => setDark(!dark)}
        >
          {dark ? <Sun /> : <Moon />}
        </button>
      </header>
      <div className="reader-toolbar">
        <button
          className="icon-btn"
          aria-label="Zoom out"
          onClick={() => setZoom(Math.max(60, zoom - 10))}
        >
          <ZoomOut />
        </button>
        <span>{zoom}%</span>
        <button
          className="icon-btn"
          aria-label="Zoom in"
          onClick={() => setZoom(Math.min(200, zoom + 10))}
        >
          <ZoomIn />
        </button>
        <button
          className="text-link"
          onClick={async () => {
            try {
              await api(`/reader/${id}/bookmarks`, json("POST", { page }));
              setSaved("Page bookmarked.");
              setRefresh((n) => n + 1);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <BookmarkPlus size={18} /> Save page
        </button>
        <button
          className="text-link"
          aria-pressed={textMode}
          onClick={() => setTextMode(!textMode)}
        >
          {textMode ? "Page image" : "Accessible text"}
        </button>
        <span role="status">{saved}</span>
      </div>
      <ErrorNote error={error} />
      <div className="reader-viewport">
        <div
          className="reader-paper"
          style={{ width: `${zoom}%`, maxWidth: `${zoom * 7}px` }}
        >
          {data && textMode ? (
            <article
              className="reader-text"
              aria-label={`Text for page ${page}`}
            >
              <p>{text || "Loading text…"}</p>
              <small>{data.watermark}</small>
            </article>
          ) : data && !imageError ? (
            <>
              <img
                src={data.url}
                alt={`Book page ${page}. Choose Accessible text for screen-reader content.`}
                draggable={false}
                onLoad={() => {
                  api(`/reader/${id}/progress`, json("PUT", { page })).catch(
                    (e) => setError(e.message),
                  );
                }}
                onError={() => setImageError(true)}
              />
              <div className="watermarks" aria-hidden="true">
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i}>{data.watermark}</span>
                ))}
              </div>
            </>
          ) : (
            <p className="empty">
              {imageError
                ? "Page image unavailable. Refresh the page link or try again shortly."
                : error
                  ? "This page cannot be opened."
                  : "Opening your chapter…"}
              {imageError && (
                <button
                  className="btn small"
                  onClick={() => setRefresh((n) => n + 1)}
                >
                  Refresh page
                </button>
              )}
            </p>
          )}
        </div>
      </div>
      <nav className="reader-controls" aria-label="Reader navigation">
        <button
          className="btn outline small"
          disabled={page <= 1 || !data}
          onClick={() => go(page - 1)}
        >
          <ChevronLeft size={17} /> Previous
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(Number(jump));
          }}
        >
          <label>
            Page{" "}
            <input
              aria-label="Page number"
              type="number"
              min={1}
              max={data?.page_count || 1}
              value={jump}
              onChange={(e) => setJump(e.target.value)}
            />
          </label>
          <span>of {data?.page_count || "…"}</span>
          <button className="text-link">Go</button>
        </form>
        <button
          className="btn small"
          disabled={!data || page >= data.page_count}
          onClick={() => go(page + 1)}
        >
          Next <ChevronRight size={17} />
        </button>
      </nav>
      <progress
        className="reader-progress"
        value={page}
        max={data?.page_count || 1}
      />
      {data && data.bookmarks.length > 0 && (
        <div className="reader-bookmarks">
          Saved pages:{" "}
          {data.bookmarks.map((b) => (
            <span key={b.page}>
              <button onClick={() => go(b.page)}>{b.page}</button>
              <button
                aria-label={`Remove bookmark ${b.page}`}
                onClick={async () => {
                  try {
                    await api(
                      `/reader/${id}/bookmarks/${b.page}`,
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
      )}
      <p className="reader-disclaimer">
        Personal reading copy. Please respect the author’s rights. Screenshots,
        screen recording and device photography cannot reliably be prevented. No
        DRM protection is promised.
      </p>
      <p className="reader-disclaimer">
        Choose Accessible text for screen-reader content extracted from the PDF.
        Scanned pages may require a separately prepared accessible edition;
        contact support.
      </p>
    </div>
  );
}
