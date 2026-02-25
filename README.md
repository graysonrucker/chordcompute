# Inverter

Inverter is a full-stack web application that generates piano chord voicings across the 88-key range for a given input chord.

## Tech Stack

- Frontend: React + Vite + TailwindCSS  
- Backend: Node.js + Express  
- Database: SQLite  
- Deployment: Docker  

---

## Overview

Inverter takes a set of MIDI note inputs and generates musically valid piano voicings that:

- Contain the required pitch classes
- Stay within the 88-key piano range
- Avoid duplicate interval structures

The backend exposes a REST API that performs voicing generation. The frontend provides an interactive piano interface for selecting notes and visualizing generated voicings.

Planned Changes/Features

- Voicings fit within configurable span limits
- Sorting options for voicing results (Currently sorted by least span to greatest span)
- Filters for voicing generation, such as human playable, allowing doubling, etc.
- Chord naming for currently selected chord and/or generated voicings
- Auto-selection of notes from given root and templates for chord quality + extensions + omitted notes

---

## How It Works

1. The frontend sends selected MIDI notes to `/api/voicings`.
2. The backend:
   - Sanitizes and sorts input
   - Extracts pitch classes
   - Generates candidate voicings via octave displacement
   - Filters by span, note count, and piano range
   - Deduplicates results by interval pattern
   - Scores and ranks valid voicings
3. Results are returned as JSON and rendered as interactive pianos in the UI.

The core generation logic is implemented in:


server/lib/voicings.js


---

## Running the Application

### Option 1 — Docker (Recommended)

Pull and run the published image:

```bash
docker pull ghcr.io/graysonrucker/inverter:latest
docker run -p 3000:3000 ghcr.io/graysonrucker/inverter:latest
```

Then open:

http://localhost:3000

### Local Development (Requires Node.js 18+ and Git)

Clone the repository:

```bash
git clone https://github.com/graysonrucker/Inverter.git
cd Inverter
```

Install backend dependencies (Inside server directory):

```bash
npm install
```

Install frontend dependencies (Inside client directory):

```bash
npm install
```

Run the backend (Inside server directory):

```bash
npm start
```

Run the frontend (Inside client directory):

```bash
npm run dev
```

Then open:

http://localhost:5173
