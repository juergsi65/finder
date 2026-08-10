/**
 * Determinate percentage progress bar - used for uploads (photo upload has
 * real byte-level progress via XHR, see api.js createFoundItem) so the
 * user can see the app is actually working instead of staring at a
 * spinner with no sense of how long it'll take.
 */
export default function ProgressBar({ percent = 0, label }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="w-full" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      {label && (
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-trail-600 rounded-full transition-[width] duration-150 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
