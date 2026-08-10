import { useEffect, useRef, useState } from "react";

/**
 * Drag-and-drop (+ tap-to-browse / camera-capture) photo upload zone with
 * an inline thumbnail preview once a file is chosen.
 */
export default function PhotoDropzone({ file, onFileSelected }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(fileList) {
    const f = fileList?.[0];
    if (f) onFileSelected(f);
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
      className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition ${
        dragOver
          ? "border-trail-500 bg-trail-50"
          : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
      {previewUrl ? (
        <div className="flex items-center gap-3 text-left">
          <img
            src={previewUrl}
            alt="Vorschau"
            className="w-14 h-14 object-cover rounded-lg shrink-0 border border-gray-200"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
            <p className="text-xs text-gray-400">Foto ausgewählt</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFileSelected(null);
            }}
            className="text-gray-400 hover:text-red-500 text-lg shrink-0 px-2 py-1"
            aria-label="Foto entfernen"
          >
            ✕
          </button>
        </div>
      ) : (
        <>
          <div className="text-2xl mb-1" aria-hidden>
            📷
          </div>
          <p className="text-sm text-gray-600">Foto hinzufügen (optional)</p>
        </>
      )}
    </div>
  );
}
