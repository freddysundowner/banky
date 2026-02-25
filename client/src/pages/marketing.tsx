import { useState } from "react";
import { ExternalLink, Monitor, Download, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const posters = [
  {
    id: "features",
    title: "Feature Overview ⭐",
    description: "All system features listed with sub-points. Shows SACCOs, Banks, Microfinance & Chamas at the top. Best for sharing.",
    file: "/posters/features.html",
  },
  {
    id: "dark",
    title: "Dark Theme",
    description: "Bold dark background with glowing blue accents and feature chips.",
    file: "/posters/poster-dark.html",
  },
  {
    id: "gradient",
    title: "Blue Gradient",
    description: "Deep blue gradient, large bold text. Eye-catching on WhatsApp status.",
    file: "/posters/poster-gradient.html",
  },
  {
    id: "minimal",
    title: "Split Panel",
    description: "Dark navy left panel + white feature cards on the right.",
    file: "/posters/poster-minimal.html",
  },
  {
    id: "bold",
    title: "Bold & Clean",
    description: "White background, big typography, colored feature sections.",
    file: "/posters/poster-bold.html",
  },
  {
    id: "5",
    title: "Everything Your SACCO Needs",
    description: "Blue gradient, bold headline, decorative circles, feature pills.",
    file: "/posters/poster-5.html",
  },
];

export default function Marketing() {
  const [selected, setSelected] = useState<string | null>(null);

  const selectedPoster = posters.find((p) => p.id === selected);

  if (selected && selectedPoster) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
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
    <div className="min-h-screen bg-slate-100">
      <div className="bg-white border-b px-6 py-4 shadow-sm">
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

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-3 gap-6">
          {posters.map((poster) => (
            <div
              key={poster.id}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
              onClick={() => setSelected(poster.id)}
            >
              {/* Poster preview */}
              <div className="relative overflow-hidden bg-slate-50" style={{ height: 320 }}>
                <iframe
                  src={poster.file}
                  title={poster.title}
                  style={{
                    width: 1080,
                    height: 1080,
                    border: "none",
                    transform: "scale(0.296)",
                    transformOrigin: "top left",
                    display: "block",
                    pointerEvents: "none",
                  }}
                  tabIndex={-1}
                />
                <div className="absolute inset-0 group-hover:bg-blue-600/5 transition-colors" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-white/90 backdrop-blur-sm text-blue-700 font-semibold text-sm px-5 py-2.5 rounded-full shadow flex items-center gap-2">
                    <Monitor className="w-4 h-4" /> Preview
                  </div>
                </div>
              </div>

              {/* Card info */}
              <div className="p-5 flex items-start justify-between">
                <div>
                  <h2 className="font-bold text-slate-900 text-base">{poster.title}</h2>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{poster.description}</p>
                </div>
                <a
                  href={poster.file}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-4 mt-0.5 text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0"
                  title="Open full size"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-blue-800">
          <strong>How to share a poster:</strong> Click any design to preview it → click "Open Full Size" to see it at full 1080×1080px → take a screenshot or right-click to save → share directly on WhatsApp, Facebook, or any platform.
        </div>
      </div>
    </div>
  );
}
