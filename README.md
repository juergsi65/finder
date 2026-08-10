# TrailFound 🧭

Mobiler Web-App-Prototyp (MVP), der Sportler:innen hilft, verlorene Ausrüstung
(Trinkflaschen, Radcomputer, Pumpen, Brillen, ...) wiederzufinden - über
Fund-Pins auf einer Karte und einen automatischen Abgleich mit dem eigenen
GPX-Track.

## Funktionsweise

1. **Finder** setzt einen Pin auf der Karte an der Fundstelle, wählt eine
   Kategorie, lädt optional ein Foto hoch und beschreibt den Fund.
2. **Sucher** lädt die GPX-Datei der eigenen Route hoch und wählt die
   verlorene Kategorie.
3. Das Backend prüft für jeden Track-Punkt der Route, ob ein Fund-Pin
   derselben Kategorie innerhalb von **30 Metern** liegt (Haversine-Distanz).
   Bei einem Treffer erscheint eine Benachrichtigung samt Karte und Details.

## Tech-Stack

- **Frontend:** React + Vite, Tailwind CSS, React-Leaflet (OpenStreetMap)
- **Backend:** Python + FastAPI, `gpxpy` fürs GPX-Parsing
- **Datenbank:** SQLite (SQLAlchemy) - Koordinaten als Lat/Lng-Spalten,
  Radius-Abgleich per Haversine-Formel in Python. Für den Umstieg auf
  PostgreSQL + PostGIS müssten nur `database.py`/`main.py` angepasst werden.

## Projektstruktur

```
backend/
  main.py            FastAPI-App, REST-Endpunkte
  models.py          SQLAlchemy-Modell FoundItem
  schemas.py         Pydantic-Schemas + Kategorien
  database.py        SQLite-Setup
  geo.py             Haversine-Distanzberechnung
  gpx_matching.py     GPX-Parsing + Matching-Logik (Kernstück)
  requirements.txt
  uploads/           Hochgeladene Fotos (zur Laufzeit)

frontend/
  src/
    pages/Home.jsx         Startseite mit den zwei Haupt-Buttons
    pages/FinderMode.jsx   Modus 1: Pin setzen + Formular
    pages/SeekerMode.jsx   Modus 2: GPX-Upload + Treffer-Anzeige
    components/            Navbar, MapPicker (Leaflet)
    api.js                 Backend-API-Client
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

## API (Kurzüberblick)

| Methode | Pfad                  | Zweck                                      |
|---------|-----------------------|---------------------------------------------|
| GET     | `/api/categories`     | Verfügbare Kategorien                      |
| GET     | `/api/found-items`    | Alle Fund-Pins (optional `?category=`)     |
| POST    | `/api/found-items`    | Neuen Fund-Pin anlegen (multipart/form)    |
| DELETE  | `/api/found-items/{id}` | Fund-Pin löschen                         |
| POST    | `/api/match`          | GPX-Datei + Kategorie -> Treffer im 30m-Radius |

Interaktive API-Doku (Swagger UI) läuft während der Entwicklung unter
`http://localhost:8000/docs`.

## Stand des Prototyps

- Matching-Logik ist mit einer Test-GPX-Datei verifiziert (Haversine-Distanz,
  30m-Radius, mehrere Kategorien).
- Fotos werden lokal unter `backend/uploads/` gespeichert und über
  `/uploads/...` ausgeliefert.
- Kein Login/Auth - für den MVP bewusst weggelassen.
- Nächste Schritte für einen produktiven Einsatz: PostgreSQL+PostGIS,
  Nutzer-Accounts, Push-Benachrichtigungen, Rate-Limiting für Uploads.
