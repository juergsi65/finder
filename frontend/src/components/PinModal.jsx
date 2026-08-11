import { useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { useTranslation } from "../i18n/LanguageContext.jsx";
import { createPin, updatePin, deletePin } from "../api.js";
import Spinner from "./Spinner.jsx";

/**
 * Handles both "create a new note pin at this map position" (pass
 * `createAt: {lat, lng}`) and "view/edit/delete an existing one" (pass
 * `pin`) - one modal, two entry points, since the form itself is
 * identical either way and the view state is just "create mode with the
 * fields pre-filled and read-only until Edit is pressed".
 */
export default function PinModal({ pin, createAt, onClose, onCreated, onUpdated, onDeleted }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isCreate = !pin;
  const isOwner = pin && user && (user.id === pin.owner?.id || user.role === "admin");

  const [editing, setEditing] = useState(isCreate);
  const [title, setTitle] = useState(pin?.title || "");
  const [description, setDescription] = useState(pin?.description || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError(t("pin.errors.noTitle"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isCreate) {
        const created = await createPin({ lat: createAt.lat, lng: createAt.lng, title, description });
        onCreated?.(created);
      } else {
        const updated = await updatePin(pin.id, { title, description });
        onUpdated?.(updated);
        setEditing(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t("pin.confirmDelete"))) return;
    setDeleting(true);
    setError("");
    try {
      await deletePin(pin.id);
      onDeleted?.(pin.id);
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1300] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-float w-full sm:max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
            <span aria-hidden>📌</span> {isCreate ? t("pin.newHeading") : editing ? t("pin.editHeading") : t("pin.viewHeading")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition"
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("pin.title")}</label>
              <input
                type="text"
                autoFocus
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("pin.titlePlaceholder")}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("pin.descriptionOptional")}</label>
              <textarea
                rows={3}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("pin.descriptionPlaceholder")}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-trail-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2">
              {!isCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setTitle(pin.title || "");
                    setDescription(pin.description || "");
                    setError("");
                  }}
                  className="flex-1 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition"
                >
                  {t("pin.cancel")}
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-trail-600 hover:bg-trail-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
              >
                {saving && <Spinner className="w-4 h-4" />}
                {saving ? t("pin.saving") : t("pin.save")}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-lg font-semibold text-slate-800">{pin.title}</p>
              {pin.description && <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{pin.description}</p>}
            </div>
            <p className="text-xs text-slate-400">
              {t("pin.by")} {pin.owner?.display_name || t("pin.someone")}
              {pin.created_at && ` · ${new Date(pin.created_at).toLocaleDateString()}`}
            </p>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            {isOwner && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex-1 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition"
                >
                  {t("pin.edit")}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 border border-red-200 text-red-600 font-semibold py-2.5 rounded-xl hover:bg-red-50 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {deleting && <Spinner className="w-4 h-4" />}
                  {deleting ? t("pin.deleting") : t("pin.delete")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
