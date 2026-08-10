# TrailFound 🧭

Mobiler Web-App-Prototyp (MVP), der Sportler:innen hilft, verlorene Ausrüstung
(Trinkflaschen, Radcomputer, Pumpen, Brillen, ...) wiederzufinden - über
Fund-Pins auf einer Karte und einen automatischen Abgleich mit dem eigenen
GPX-Track.

## Funktionsweise

1. **Finder** setzt einen Pin auf der Karte an der Fundstelle (oder nutzt den
   📍-Standort-Button), wählt eine Kategorie über die Icon-Auswahl, lädt
   optional ein Foto hoch (Drag & Drop oder Kamera) und beschreibt den Fund.
2. **Sucher** lädt die GPX-Datei der eigenen Route hoch (Drag & Drop) und
   wählt die verlorene Kategorie.
3. Das Backend prüft die **gesamte Route** - nicht nur die aufgezeichneten
   GPS-Punkte, sondern auch die Strecke *zwischen* ihnen - per
   Punkt-zu-Strecken-Distanz darauf, ob ein Fund-Pin derselben Kategorie
   innerhalb von **30 Metern** liegt. Bei einem Treffer erscheint eine
   Benachrichtigung mit Karte (Route + Fund-Pin + exaktem Trefferpunkt) und
   Details.
4. **Konten:** Registrierung/Login (E-Mail + Passwort, JWT-Session). Das
   **erste** registrierte Konto auf einer frischen Installation wird
   automatisch zum Admin - alle weiteren Konten sind normale Nutzer:innen.
   Admins sehen unter `/admin` Nutzer- und Fund-Pin-Verwaltung inkl.
   Löschfunktion. Im Profil (`/profil`) lässt sich (als Platzhalter für
   spätere echte OAuth-Anbindung) eine Strava-/Komoot-/Garmin-Konto-ID
   hinterlegen.

## Tech-Stack

- **Frontend:** React + Vite, Tailwind CSS, React-Leaflet (OpenStreetMap),
  React Router
- **Backend:** Python + FastAPI, `gpxpy` fürs GPX-Parsing, `bcrypt` fürs
  Passwort-Hashing, `PyJWT` für Login-Sessions
- **Datenbank:** SQLite (SQLAlchemy) - Koordinaten als Lat/Lng-Spalten,
  Radius-Abgleich per Punkt-zu-Strecken-Projektion in Python. Für den
  Umstieg auf PostgreSQL + PostGIS müssten nur `database.py`/`main.py`
  angepasst werden.

## Projektstruktur

```
backend/
  main.py            FastAPI-App, REST-Endpunkte (inkl. Auth + Admin)
  models.py          SQLAlchemy-Modelle: FoundItem, User
  schemas.py         Pydantic-Schemas + Kategorien
  database.py        SQLite-Setup
  auth.py            Passwort-Hashing (bcrypt) + JWT-Erzeugung/-Prüfung
  geo.py             Punkt-zu-Strecken-Distanzberechnung
  gpx_matching.py     GPX-Parsing + Matching-Logik (Kernstück)
  requirements.txt
  uploads/           Hochgeladene Fotos (zur Laufzeit)

frontend/
  src/
    pages/Home.jsx         Startseite mit den zwei Haupt-Buttons
    pages/FinderMode.jsx   Modus 1: Pin setzen + Formular
    pages/SeekerMode.jsx   Modus 2: GPX-Upload + Treffer-Anzeige
    pages/Login.jsx, Register.jsx   Anmeldung / Registrierung
    pages/Profile.jsx      Profil + Platzhalter für Strava/Komoot/Garmin
    pages/Admin.jsx        Nutzer- + Fund-Pin-Verwaltung (nur Admins)
    AuthContext.jsx         Login-Status, JWT-Handling
    components/            Navbar, MapPicker (Leaflet), CategoryPicker, ...
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

Für den Server-Betrieb reicht ein einziger Befehl im Hauptverzeichnis:

```bash
docker compose up -d --build
```

Das startet zwei Container:

- **frontend** - fertig gebautes React-App, ausgeliefert über Nginx auf
  Port `80`. Nginx proxyt `/api` und `/uploads` intern an den Backend-Container,
  das Frontend braucht also keine Konfiguration der Backend-URL.
- **backend** - FastAPI/Uvicorn auf Port `8000`.

SQLite-Datenbank (`backend_data`) und hochgeladene Fotos (`backend_uploads`)
liegen in benannten Docker-Volumes und überleben damit Neustarts/Updates
der Container.

**Wichtig für den Produktivbetrieb:** Setze `JWT_SECRET` auf einen eigenen,
zufälligen Wert (signiert die Login-Sessions), z.B. über eine `.env`-Datei
neben `docker-compose.yml`:

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
```

Ohne eigenen Wert läuft ein unsicherer Standardwert - für lokales Testen ok,
für einen öffentlich erreichbaren Server nicht.

Danach ist die App unter `http://<Server-IP>` (Port 80) erreichbar, die
API direkt unter `http://<Server-IP>:8000` (inkl. `/docs`).

Update auf dem Server nach einem `git pull`:

```bash
docker compose up -d --build
```

Container stoppen:

```bash
docker compose down
```

## API (Kurzüberblick)

| Methode | Pfad                  | Zweck                                      |
|---------|-----------------------|---------------------------------------------|
| GET     | `/api/categories`     | Verfügbare Kategorien                      |
| GET     | `/api/found-items`    | Alle Fund-Pins (optional `?category=`)     |
| POST    | `/api/found-items`    | Neuen Fund-Pin anlegen (multipart/form)    |
| DELETE  | `/api/found-items/{id}` | Fund-Pin löschen (nur Admin)             |
| POST    | `/api/match`          | GPX-Datei + Kategorie -> Treffer im 30m-Radius |
| POST    | `/api/auth/register`  | Registrieren (erstes Konto wird Admin)     |
| POST    | `/api/auth/login`     | Login, gibt JWT zurück                     |
| GET     | `/api/auth/me`        | Eigenes Profil (Login erforderlich)        |
| PATCH   | `/api/auth/me`        | Profil aktualisieren (Strava/Komoot/Garmin-ID) |
| GET     | `/api/admin/users`    | Alle Nutzer (nur Admin)                    |
| DELETE  | `/api/admin/users/{id}` | Nutzer löschen (nur Admin)               |
| GET     | `/api/admin/stats`    | Systemweite Kennzahlen (nur Admin)         |

Interaktive API-Doku (Swagger UI) läuft während der Entwicklung unter
`http://localhost:8000/docs`.

## Stand des Prototyps

- Matching-Logik prüft die Distanz zum nächsten Punkt **auf der Strecke**
  (Punkt-zu-Segment-Projektion), nicht nur zu den aufgezeichneten
  GPS-Vertices - so werden auch Funde erkannt, die zwischen zwei
  GPS-Fixes liegen. Verifiziert mit gezielten Test-GPX-Dateien (dichte
  und sparsame Tracks, mehrere Kategorien, ISO-8859-1-kodierte Exporte).
- GPX-Parsing ist robust gegen unterschiedliche Zeichenkodierungen
  (UTF-8, UTF-8-BOM, ISO-8859-1/Windows-1252 wie bei älteren
  Garmin-Exporten) sowie gegen leere Dateien, falsche Dateiendungen und
  ungültige Radius-Werte (klare deutschsprachige Fehlermeldungen).
- Fotos werden lokal unter `backend/uploads/` gespeichert und über
  `/uploads/...` ausgeliefert.
- Login/Registrierung mit gehashten Passwörtern (bcrypt) und JWT-Sessions;
  Rollenmodell "user"/"admin". Strava-/Komoot-/Garmin-Verknüpfung ist als
  Datenfeld + UI vorbereitet, aber noch ohne echten OAuth-Flow (manuelle
  ID-Eingabe als Platzhalter).
- Nächste Schritte für einen produktiven Einsatz: PostgreSQL+PostGIS, echte
  OAuth-Anbindung für Strava/Komoot/Garmin, Passwort-Reset,
  Push-Benachrichtigungen, Rate-Limiting für Uploads/Login.
