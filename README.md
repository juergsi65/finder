# TrailFound 🧭

Mobiler Web-App-Prototyp (MVP), der Sportler:innen hilft, verlorene Ausrüstung
(Trinkflaschen, Radcomputer, Pumpen, Brillen, ...) wiederzufinden - Fundstücke
sind feste GPS-Punkte auf einer interaktiven Karte, kein Routen-Upload nötig.

## Funktionsweise

1. **Startseite = Karte.** Beim Öffnen der App fragt TrailFound den eigenen
   Standort ab und zeigt sofort eine interaktive Karte mit allen gemeldeten
   Fund-Pins, plus einer Zahl wie "3 Gegenstände in deiner Nähe (5 km)".
   Kategorie-Chips ("Alle", 🧴 Trinkflasche, 📟 Radcomputer, ...) filtern die
   Karte visuell.
2. **Finder** tippt auf der Karte eine Fundstelle an (oder nutzt den
   🎯-Standort-Button), wählt eine Kategorie über die Icon-Auswahl, lädt
   optional ein Foto hoch (Drag & Drop oder Kamera, mit Fortschrittsbalken)
   und beschreibt den Fund.
3. **Konten:** Registrierung/Login (E-Mail + Passwort, JWT-Session). Das
   **erste** registrierte Konto auf einer frischen Installation wird
   automatisch zum Admin - alle weiteren Konten sind normale Nutzer:innen
   ohne Admin-Rechte. Admins sehen unter `/admin` Nutzer- und
   Fund-Pin-Verwaltung inkl. Löschfunktion. Im Profil (`/profil`) lässt sich
   (als Platzhalter für spätere echte OAuth-Anbindung) eine
   Strava-/Komoot-/Garmin-Konto-ID hinterlegen.

## Tech-Stack

- **Frontend:** React + Vite, Tailwind CSS, React-Leaflet (OpenStreetMap),
  React Router
- **Backend:** Python + FastAPI, `bcrypt` fürs Passwort-Hashing, `PyJWT` für
  Login-Sessions
- **Datenbank:** SQLite (SQLAlchemy) - Fundstücke sind Lat/Lng-Punkte; die
  "in deiner Nähe"-Distanz wird serverseitig per Haversine-Formel berechnet
  (`GET /api/found-items?lat=&lng=`). Für den Umstieg auf PostgreSQL +
  PostGIS müssten nur `database.py`/`main.py` angepasst werden.

## Projektstruktur

```
backend/
  main.py            FastAPI-App, REST-Endpunkte (inkl. Auth + Admin)
  models.py          SQLAlchemy-Modelle: FoundItem, User
  schemas.py         Pydantic-Schemas + Kategorien
  database.py        SQLite-Setup
  auth.py            Passwort-Hashing (bcrypt) + JWT-Erzeugung/-Prüfung
  geo.py             Haversine-Distanzberechnung ("X in deiner Nähe")
  requirements.txt
  uploads/           Hochgeladene Fotos (zur Laufzeit)

frontend/
  src/
    pages/Home.jsx         Startseite: interaktive Karte + Nähe-Zähler + Filter
    pages/FinderMode.jsx   Fund melden: Pin setzen + Formular + Upload-Fortschritt
    pages/Login.jsx, Register.jsx   Anmeldung / Registrierung
    pages/Profile.jsx      Profil + Platzhalter für Strava/Komoot/Garmin
    pages/Admin.jsx        Nutzer- + Fund-Pin-Verwaltung (nur Admins)
    AuthContext.jsx         Login-Status, JWT-Handling
    components/            Navbar, FoundItemsMap, MapPicker (Leaflet),
                            CategoryPicker, ProgressBar, TopLoadingBar, ...
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
| GET     | `/api/found-items`    | Fund-Pins (optional `?category=`; mit `?lat=&lng=` inkl. `distance_m`, nächstgelegene zuerst; zusätzlich `?radius_m=` filtert serverseitig) |
| POST    | `/api/found-items`    | Neuen Fund-Pin anlegen (multipart/form)    |
| DELETE  | `/api/found-items/{id}` | Fund-Pin löschen (nur Admin)             |
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

- Kein Routen-/GPX-Abgleich mehr - Fundstücke sind der Ausgangspunkt.
  `GET /api/found-items?lat=&lng=` berechnet die Haversine-Distanz jedes
  Pins zur übergebenen Position serverseitig und liefert sie sortiert
  zurück; das Frontend zeigt daraus direkt den "X in deiner Nähe"-Zähler
  und die Kartenpins - ganz ohne separate Matching-Logik.
- Uploads (Fund-Foto) laufen über `XMLHttpRequest` mit echtem
  Byte-Fortschritt, angezeigt als Prozent-Ladebalken; beim ersten Laden der
  Karte (Standortabfrage + Fund-Pins) läuft oben ein schlanker
  Fortschrittsbalken, damit sichtbar ist, dass die App arbeitet.
- Fotos werden lokal unter `backend/uploads/` gespeichert und über
  `/uploads/...` ausgeliefert.
- Login/Registrierung mit gehashten Passwörtern (bcrypt) und JWT-Sessions;
  Rollenmodell "user"/"admin" - normale Registrierungen sind nie Admin.
  Strava-/Komoot-/Garmin-Verknüpfung ist als Datenfeld + UI vorbereitet,
  aber noch ohne echten OAuth-Flow (manuelle ID-Eingabe als Platzhalter).
- Nächste Schritte für einen produktiven Einsatz: PostgreSQL+PostGIS für
  effizientere Umkreissuche bei vielen Fund-Pins, echte OAuth-Anbindung für
  Strava/Komoot/Garmin, Passwort-Reset, Push-Benachrichtigungen,
  Rate-Limiting für Uploads/Login.
