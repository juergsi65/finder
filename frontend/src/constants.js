// Shared app-wide constants.

// Munich, just as a sensible default center when geolocation isn't available.
export const DEFAULT_CENTER = [48.1372, 11.5754];

// Radius (meters) used for the "X Gegenstände in deiner Nähe" count on the
// home map.
export const NEARBY_RADIUS_M = 5000;

// Radius (km) the backend uses for the automatic lost/stolen alert email -
// mirrors backend/main.py's ALERT_RADIUS_M, kept here just for display copy
// (the actual matching always happens server-side).
export const ALERT_RADIUS_KM = 15;
