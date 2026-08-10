import { useRef, useState } from "react";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drag-and-drop (+ tap-to-browse) GPX upload zone. Shows the picked file
 * as a chip with size + remove button once selected.
 */
export default function GpxDropzone({ file, onFileSelected, onInvalidFile }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function pick(fileList) {
    const f = fileList?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".gpx")) {
      onInvalidFile?.("Bitte eine .gpx-Datei auswählen.");
      return;
    }
    onFileSelected(f);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        pick(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition ${
        dragOver
          ? "border-trail-500 bg-trail-50"
          : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".gpx"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
      {file ? (
        <div className="flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0" aria-hidden>
              🗺️
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFileSelected(null);
            }}
            className="text-gray-400 hover:text-red-500 text-lg shrink-0 px-2 py-1"
            aria-label="Datei entfernen"
          >
            ✕
          </button>
        </div>
      ) : (
        <>
          <div className="text-3xl mb-1" aria-hidden>
            📤
          </div>
          <p className="text-sm text-gray-600">
            <span className="text-trail-700 font-semibold">GPX-Datei auswählen</span> oder hierher
            ziehen
          </p>
          <p className="text-xs text-gray-400 mt-1">Strava, Komoot, Garmin, ...</p>
        </>
      )}
    </div>
  );
}
