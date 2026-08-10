import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../i18n/LanguageContext.jsx";

/**
 * Drag-and-drop (+ tap-to-browse / camera-capture) photo upload zone with
 * an inline thumbnail preview once a file is chosen.
 */
export default function PhotoDropzone({ file, onFileSelected }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  // Derived synchronously from `file` (not via useEffect + state) so it can
  // never go stale for a render: mirroring a prop into state via an effect
  // means there's a render in between - after the parent clears `file` but
  // before the effect has run - where the old previewUrl is still truthy
  // while `file` is already null, crashing `file.name` below.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
      {file ? (
        <div className="flex items-center gap-3 text-left">
          <img
            src={previewUrl}
            alt={t("common.preview")}
            className="w-14 h-14 object-cover rounded-lg shrink-0 border border-gray-200"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
            <p className="text-xs text-gray-400">{t("finder.photoSelected")}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFileSelected(null);
            }}
            className="text-gray-400 hover:text-red-500 text-lg shrink-0 px-2 py-1"
            aria-label={t("common.removePhoto")}
          >
            ✕
          </button>
        </div>
      ) : (
        <>
          <div className="text-2xl mb-1" aria-hidden>
            📷
          </div>
          <p className="text-sm text-gray-600">{t("finder.photoHint")}</p>
        </>
      )}
    </div>
  );
}
