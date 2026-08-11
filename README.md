# TrailFound 🧭

Mobiler Web-App-Prototyp, der Sportler:innen hilft, verlorene Ausrüstung
(Trinkflaschen, Radcomputer, Pumpen, Brillen, ...) wiederzufinden - über eine
interaktive Karte mit Fund-Pins, eine GPX-/Strava-gestützte Routensuche und
ein datenschutzfreundliches internes Nachrichtensystem.

## Funktionen im Überblick

1. **Startseite = Karte.** Beim Öffnen zeigt TrailFound sofort eine
   interaktive Karte mit allen aktiven Fund-Pins in der Umgebung, plus einer
   Zahl wie "5 Gegenstände in deiner Nähe (5 km)". Kategorie-Chips filtern
   die Karte visuell.
2. **Sprache:** Deutsch (Standard) und Englisch per Umschalter oben rechts,
   inkl. nativer Formularvalidierung in der gewählten Sprache.
3. **Konten & Rollen:** Registrierung/Login mit JWT-Session und
   bcrypt-gehashten Passwörtern. Rollen: **Admin** (volle Moderation +
   Nutzerverwaltung), **Standard-Nutzer** und **Verein/Gruppe** (z.B. lokale
   Wandervereine, mit eigenem Anzeigenamen). Das erste registrierte Konto
   wird automatisch Admin; alle weiteren Registrierungen sind niemals Admin.
4. **Fund melden** (Login erforderlich): Pflichtfelder Titel, Kategorie und
   Foto; Funddatum wird automatisch mit "heute" vorbelegt und ist editierbar;
   Standort per Klick auf die Karte; Beschreibung optional. Der Foto-Upload
   zeigt einen echten Prozent-Fortschrittsbalken.
5. **Suchen:** Suchwort (z.B. "Garmin Uhr") + GPX-Track der eigenen Tour
   hochladen - die App gleicht **jeden Meter der Route** (nicht nur die
   aufgezeichneten GPS-Punkte) mit aktiven Fund-Pins ab und zeigt
   ausschließlich Treffer im Umkreis. Während des Uploads läuft ein
   Prozent-Fortschrittsbalken, während der serverseitigen Berechnung ein
   Ladebalken. Alternative: die Umkreissuche direkt auf der Startseiten-Karte.
6. **Strava-Add-on:** "Mit Strava verbinden" im Profil (echter OAuth-2.0-Flow)
   und der Button "Hast du bei deiner heutigen Aktivität etwas verloren?" auf
   der Such-Seite - ruft die heutige Strava-Aktivität ab und gleicht sie mit
   derselben Logik wie ein GPX-Upload ab. Erfordert eine eigene
   Strava-API-App (siehe unten) - ohne Konfiguration bleibt der Button sauber
   deaktiviert.
7. **Finder kontaktieren:** Internes Nachrichtensystem pro Fund-Pin. Weder
   Sucher:in noch Finder:in sehen jemals die E-Mail-Adresse der Gegenseite -
   der Server leitet neue Nachrichten optional per System-E-Mail weiter
   (SMTP konfigurierbar).
8. **Archiv:** Finder:in oder Admin können einen Fund als "erledigt" markieren
   - er verschwindet sofort aus Karte und Suche, bleibt aber im
   Admin-Archiv einsehbar und wiederherstellbar.

## Tech-Stack

- **Frontend:** React + Vite, Tailwind CSS, React-Leaflet (OpenStreetMap),
  React Router, eigenes leichtgewichtiges i18n (DE/EN)
- **Backend:** Python + FastAPI, `gpxpy` fürs GPX-Parsing, `bcrypt` fürs
  Passwort-Hashing, `PyJWT` für Login-Sessions, `httpx` für die Strava-API
- **Datenbank:** SQLite (SQLAlchemy). Für den Umstieg auf PostgreSQL+PostGIS
  müssten nur `database.py`/`main.py` angepasst werden.

## Projektstruktur

```
backend/
  main.py            FastAPI-App, REST-Endpunkte (Found Items, Auth, Admin,
                      Messaging)
  models.py          SQLAlchemy-Modelle: User, FoundItem, Conversation, Message
  schemas.py         Pydantic-Schemas + Kategorien
  database.py        SQLite-Setup
  auth.py            Passwort-Hashing (bcrypt) + JWT-Erzeugung/-Prüfung
  geo.py             Punkt-zu-Strecke-Distanzberechnung
  gpx_matching.py     GPX-Parsing + Matching-Logik (Kernstück der Suche)
  search.py          Gemeinsame Matching-Logik für GPX-Upload & Strava
  strava.py          Strava-OAuth-Connect + "heutige Aktivität"-Abgleich
  email_utils.py     SMTP-Relay für Nachrichtenbenachrichtigungen (optional)
  requirements.txt
  uploads/           Hochgeladene Fotos (zur Laufzeit)

frontend/
  src/
    pages/Home.jsx         Startseite: Karte + Nähe-Zähler + Kategorie-Filter
    pages/FinderMode.jsx   Fund melden (Titel/Kategorie/Foto Pflicht, Funddatum)
    pages/Search.jsx       Suchwort + GPX-Upload + Strava-Add-on + Treffer
    pages/Login.jsx, Register.jsx   Anmeldung / Registrierung (mit Rollenwahl)
    pages/Profile.jsx      Profil, Strava-Connect, Komoot/Garmin-Platzhalter
    pages/Admin.jsx        Nutzer- + Fund-Pin-Verwaltung inkl. Archiv (nur Admin)
    pages/Messages.jsx, Conversation.jsx   Nachrichten-Postfach + Chat-Thread
    AuthContext.jsx         Login-Status, JWT-Handling
    i18n/                   Sprachkontext + DE-/EN-Wörterbücher
    components/            Navbar, FoundItemsMap, MapPicker (Leaflet),
                            CategoryPicker, ContactFinderButton, ProgressBar,
                            TopLoadingBar, ...
    api.js                 Backend-API-Client
  Dockerfile               Multi-Stage-Build (Vite-Build -> Nginx)
  nginx.conf               Statisches Hosting + Proxy zu /api, /uploads

docker-compose.yml          Startet Frontend (Port 80) + Backend (Port 8000)
```

## Lokal starten

### Backend (Port 8000)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend (Port 5173)

```bash
cd frontend
npm install
npm run dev
```

Die App ist dann unter `http://localhost:5173` erreichbar (mobil testen:
gleiches WLAN, `http://<Rechner-IP>:5173`). Der Vite-Dev-Server proxyt
`/api` und `/uploads` automatisch zu `http://localhost:8000`.

## Mit Docker starten

```bash
docker compose up -d --build
```

Startet **frontend** (Nginx, Port 80, proxyt `/api`+`/uploads` intern zum
Backend) und **backend** (FastAPI/Uvicorn, Port 8000). SQLite-Datenbank
(`backend_data`) und Fotos (`backend_uploads`) liegen in benannten
Docker-Volumes und überleben Neustarts/Updates.

### Konfiguration (`.env`-Datei neben `docker-compose.yml`)

```bash
# Pflicht für den Produktivbetrieb - signiert Login-Sessions
JWT_SECRET=$(openssl rand -hex 32)

# Optional: Strava-Add-on aktivieren (App unter
# https://www.strava.com/settings/api registrieren; "Authorization Callback
# Domain" auf diesen Server zeigen lassen)
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
STRAVA_REDIRECT_URI=https://deine-domain.example/api/strava/callback
FRONTEND_URL=https://deine-domain.example

# Bevorzugter E-Mail-Versand: Resend (https://resend.com/api-keys).
# RESEND_FROM funktioniert sofort über Resends Sandbox-Absender, auch ohne
# eigene verifizierte Domain - das verhindert den klassischen 403 beim
# allerersten Versand.
RESEND_API_KEY=re_...
RESEND_FROM="TrailFound <onboarding@resend.dev>"

# Fallback: klassisches SMTP-Relay, wird nur genutzt, wenn kein
# RESEND_API_KEY gesetzt ist
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM="TrailFound <no-reply@deine-domain.example>"
```

Ohne `STRAVA_CLIENT_ID`/`SECRET` bleibt der Strava-Connect-Button im Profil
sichtbar, aber sauber deaktiviert - kein Fehlerzustand. Ohne `RESEND_API_KEY`
und ohne `SMTP_HOST` funktioniert das Nachrichtensystem weiterhin
vollständig in der App, nur die zusätzliche E-Mail-Benachrichtigung
entfällt.

Alle Werte oben lassen sich alternativ auch live über
**Admin → API-Konfiguration** in der Web-Oberfläche setzen/ändern (ohne
Neustart) - die `.env`-Werte sind dann nur noch der Startwert. Jeder
Versandversuch (erfolgreich oder fehlgeschlagen, inkl. Fehlermeldung von
Resend/SMTP) wird zusätzlich in der `email_logs`-Tabelle protokolliert
und ist über `GET /api/admin/email-logs` einsehbar.

#### Fehlerbehebung: "Strava merkt sich die Verbindung nicht"

Zwei Ursachen decken praktisch alle Fälle ab:

1. **`FRONTEND_URL` zeigt nicht auf die echte Domain.** Nach dem
   Token-Austausch leitet der Server den Browser auf
   `${FRONTEND_URL}/profil?strava=connected` weiter. Steht `FRONTEND_URL`
   noch auf dem `localhost:5173`-Default, landet der Nutzer nach einem
   *technisch erfolgreichen* Connect auf einer toten localhost-Seite -
   das sieht exakt so aus wie "die App merkt sich nichts". Prüfen:
   `docker compose exec backend env | grep FRONTEND_URL` muss die echte
   `https://...`-Domain zeigen.
2. **`STRAVA_REDIRECT_URI` weicht vom registrierten Wert ab.** Muss exakt
   `https://<domain>/api/strava/callback` sein (Pfad ist durch den
   Router fix vorgegeben) - identisch in `.env`/Admin-Panel *und* im
   Strava-App-Dashboard unter "Authorization Callback Domain".

Bei jedem fehlgeschlagenen Token-Austausch/Refresh loggt das Backend jetzt
den genauen Grund (`docker compose logs backend`) - Browser-Redirects
können den Fehlergrund selbst nicht transportieren, daher steht die
eigentliche Diagnose immer im Server-Log, nie nur im UI.

Update auf dem Server nach `git pull`:

```bash
docker compose up -d --build
```

## API (Kurzüberblick)

| Methode | Pfad | Zweck |
|---------|------|-------|
| GET | `/api/categories` | Verfügbare Kategorien |
| GET | `/api/found-items` | Aktive Fund-Pins (optional `?category=`, `?lat=&lng=` inkl. `distance_m` sortiert, `?radius_m=`) |
| GET | `/api/found-items/{id}` | Einzelner Fund-Pin |
| POST | `/api/found-items` | Fund melden (Login erforderlich; Titel/Kategorie/Foto Pflicht) |
| PATCH | `/api/found-items/{id}` | Status ändern (aktiv/archiviert) - Melder:in oder Admin |
| DELETE | `/api/found-items/{id}` | Fund-Pin löschen (nur Admin) |
| POST | `/api/search/gpx` | Suchwort + Kategorie + GPX-Datei -> Treffer im Routenradius |
| POST | `/api/auth/register` | Registrieren (Rolle user/verein; erstes Konto wird Admin) |
| POST | `/api/auth/login` | Login, gibt JWT zurück |
| GET/PATCH | `/api/auth/me` | Eigenes Profil lesen/aktualisieren |
| GET | `/api/strava/status` | Strava konfiguriert?/verbunden? |
| GET | `/api/strava/connect` | Strava-OAuth-URL (Login erforderlich) |
| GET | `/api/strava/callback` | OAuth-Redirect-Ziel (von Strava aufgerufen) |
| POST | `/api/strava/disconnect` | Strava-Verbindung trennen |
| GET | `/api/strava/today-track` | Heutige Strava-Aktivität abgleichen |
| POST | `/api/lost-items` | Verlust/Diebstahl melden - löst Umkreis-Alarm-E-Mails aus |
| GET | `/api/lost-items/mine` | Eigene Verlust-/Diebstahlmeldungen |
| POST | `/api/found-items/{id}/contact` | Unterhaltung mit Finder:in starten |
| GET | `/api/conversations` | Eigene Unterhaltungen (inkl. `unread_count` je Thread) |
| GET | `/api/conversations/unread-count` | Ungelesene Nachrichten gesamt (Badge) |
| GET/POST | `/api/conversations/{id}` / `.../messages` | Thread lesen (markiert als gelesen) / antworten |
| GET | `/api/admin/users`, `DELETE .../{id}` | Nutzerverwaltung (nur Admin) |
| GET | `/api/admin/found-items?status_filter=` | Alle Fund-Pins inkl. Archiv (nur Admin) |
| GET | `/api/admin/conversations` | Alle Unterhaltungen zur Moderation (nur Admin) |
| GET | `/api/admin/stats` | Systemweite Kennzahlen (nur Admin) |
| GET/PUT | `/api/admin/settings` | Strava/Resend/SMTP-Konfiguration lesen/ändern (nur Admin) |
| GET | `/api/admin/email-logs?status_filter=&limit=` | Protokoll aller Versandversuche (nur Admin) |

Interaktive API-Doku (Swagger UI) läuft während der Entwicklung unter
`http://localhost:8000/docs`.

## Stand des Prototyps

- Matching-Logik prüft die Distanz zum nächsten Punkt **auf der Strecke**
  (Punkt-zu-Segment-Projektion), nicht nur zu den aufgezeichneten
  GPS-Vertices. Die Suche kombiniert das mit einer Wort-für-Wort-Textsuche
  über Titel/Beschreibung (z.B. findet "Garmin Uhr" auch "Garmin Fenix Uhr").
- GPX-Parsing ist robust gegen unterschiedliche Zeichenkodierungen,
  fehlerhafte/leere Dateien und ungültige Koordinaten (klare
  deutschsprachige Fehlermeldungen, nie ein roher 500er).
- Die Strava-Integration ist vollständig implementiert (OAuth-2.0-Flow,
  Token-Refresh, Aktivitäts-/Stream-Abruf), **erfordert aber eine eigene
  Strava-API-App** (Client-ID/Secret) - das gilt für jede Strava-Anbindung,
  nicht nur für diesen Prototyp. Ohne Konfiguration bleibt die Funktion
  sichtbar, aber inaktiv.
- Das Nachrichtensystem speichert Unterhaltungen vollständig in der
  Datenbank und funktioniert auch ganz ohne SMTP; die E-Mail-Benachrichtigung
  ist ein optionales Extra.
- Komoot-/Garmin-Verknüpfung im Profil ist als Datenfeld + UI vorbereitet,
  aber noch ohne echten OAuth-Flow (manuelle ID-Eingabe als Platzhalter).
- Nächste Schritte für einen produktiven Einsatz: PostgreSQL+PostGIS für
  effizientere Umkreissuche bei vielen Fund-Pins, echte OAuth-Anbindung für
  Komoot/Garmin, Passwort-Reset, Push-Benachrichtigungen, Rate-Limiting für
  Uploads/Login.
