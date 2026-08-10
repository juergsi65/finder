import { useEffect, useState, useRef } from "react";

/**
 * Slim animated progress bar pinned to the top of its (relative) container -
 * the classic "page is working" indicator (YouTube/GitHub-style). Used for
 * operations that don't have a real byte-progress signal (e.g. fetching the
 * map's found-items + geolocation on load), so there's still clear visual
 * feedback that something is happening, per the app's "show a progress
 * indicator for longer loading operations" requirement.
 *
 * Auto-advances towards ~90% while `active` is true (slowing down as it
 * approaches, since we don't know the real duration), then snaps to 100%
 * and fades out once `active` becomes false.
 */
export default function TopLoadingBar({ active }) {
  const [percent, setPercent] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (active) {
      setPercent((p) => (p <= 0 ? 15 : p));
      intervalRef.current = setInterval(() => {
        setPercent((p) => (p < 90 ? p + (90 - p) * 0.15 : p));
      }, 200);
      return () => clearInterval(intervalRef.current);
    }

    clearInterval(intervalRef.current);
    setPercent((p) => (p > 0 ? 100 : 0));
    if (percent > 0) {
      const resetTimer = setTimeout(() => setPercent(0), 300);
      return () => clearTimeout(resetTimer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (percent <= 0) return null;

  return (
    <div className="absolute top-0 left-0 right-0 h-1 z-[2000] overflow-hidden pointer-events-none">
      <div
        className="h-full bg-trail-500 transition-all ease-out"
        style={{
          width: `${percent}%`,
          opacity: percent === 100 ? 0 : 1,
          transitionDuration: percent === 100 ? "300ms" : "200ms",
        }}
      />
    </div>
  );
}
