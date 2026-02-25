import { useState } from "react";
import { ExternalLink, Monitor, Download, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const TITLES = [
  "Feature Overview ⭐",
  "The End of Manual Banking",
  "One System. Every Institution.",
  "Run Your SACCO, Bank or Chama Like a Pro",
  "Your Members' Money. Perfectly Managed.",
  "Less Chaos. More Control.",
];

const SLUGS = ["features", "poster-dark", "poster-gradient", "poster-7", "poster-8", "poster-9"];

const posters = SLUGS.map((slug, i) => ({
  id: slug,
  title: TITLES[i],
  file: `/posters/${slug}.html`,
}));

const fbPosters = SLUGS.map((slug, i) => ({
  id: `${slug}-fb`,
  title: TITLES[i],
  file: `/posters/${slug}-fb.html`,
}));

const waPosters = SLUGS.map((slug, i) => ({
  id: `${slug}-wa`,
  title: TITLES[i],
  file: `/posters/${slug}-wa.html`,
}));

const allPosters = [...posters, ...fbPosters, ...waPosters];

function PosterCard({ poster, iw, ih, ch, scale, onSelect }: {
  poster: { id: string; title: string; file: string };
  iw: number; ih: number; ch: number; scale: number;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
      onClick={() => onSelect(poster.id)}
    >
      <div className="relative overflow-hidden bg-slate-50" style={{ height: ch }}>
        <iframe
          src={poster.file}
          title={poster.title}
          style={{
            width: iw,
            height: ih,
            border: "none",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            display: "block",
            pointerEvents: "none",
          }}
          tabIndex={-1}
        />
        <div className="absolute inset-0 group-hover:bg-blue-600/5 transition-colors" />
      </div>
      <div className="p-3 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900 text-sm truncate pr-2">{poster.title}</h2>
        <a
          href={poster.file}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0"
          title="Open full size"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

export default function Marketing() {
  const [selected, setSelected] = useState<string | null>(null);

  const selectedPoster = allPosters.find((p) => p.id === selected);

  if (selected && selectedPoster) {
    return (
      <div className="h-screen overflow-y-auto bg-slate-100 flex flex-col">
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Gallery
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <span className="font-semibold text-slate-800">{selectedPoster.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Take a screenshot to share on WhatsApp / Facebook
            </span>
            <a
              href={selectedPoster.file}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              <ExternalLink className="w-4 h-4" /> Open Full Size
            </a>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center p-8 overflow-auto">
          <div className="shadow-2xl rounded overflow-hidden" style={{ width: 680, height: 680 }}>
            <iframe
              src={selectedPoster.file}
              title={selectedPoster.title}
              style={{
                width: 1080,
                height: 1080,
                border: "none",
                transform: "scale(0.63)",
                transformOrigin: "top left",
                display: "block",
              }}
            />
          </div>
        </div>

        <div className="bg-white border-t px-6 py-4 text-center text-sm text-slate-500">
          <strong>How to share:</strong> Click "Open Full Size" → right-click the page → Save as image, or take a screenshot (Cmd+Shift+4 / Windows Snipping Tool).
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-slate-100">
      <div className="bg-white border-b px-6 py-4 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Marketing Posters</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Pick a design to preview and share on Facebook, WhatsApp, or LinkedIn.
            </p>
          </div>
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5 space-y-10 pb-12">

        {/* ── Square 1080×1080 ── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-base font-bold text-slate-800">Square  <span className="text-slate-400 font-normal text-sm">1080 × 1080px — WhatsApp posts, Facebook feed, Instagram</span></h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {posters.map((poster) => (
              <PosterCard key={poster.id} poster={poster} iw={1080} ih={1080} ch={160} scale={0.148} onSelect={setSelected} />
            ))}
          </div>
        </section>

        {/* ── Facebook Ad 1200×628 ── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-base font-bold text-slate-800">Facebook Ad  <span className="text-slate-400 font-normal text-sm">1200 × 628px — Facebook & LinkedIn ads, link previews</span></h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {fbPosters.map((poster) => (
              <PosterCard key={poster.id} poster={poster} iw={1200} ih={628} ch={160} scale={0.254} onSelect={setSelected} />
            ))}
          </div>
        </section>

        {/* ── WhatsApp Status 1080×1920 ── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-base font-bold text-slate-800">WhatsApp Status  <span className="text-slate-400 font-normal text-sm">1080 × 1920px — WhatsApp status, Instagram & Facebook stories</span></h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {waPosters.map((poster) => (
              <PosterCard key={poster.id} poster={poster} iw={1080} ih={1920} ch={260} scale={0.148} onSelect={setSelected} />
            ))}
          </div>
        </section>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
          <strong>How to share:</strong> Click any poster → "Open Full Size" → screenshot at the exact pixel size → share directly on WhatsApp, Facebook or Instagram.
        </div>
      </div>
    </div>
  );
}
