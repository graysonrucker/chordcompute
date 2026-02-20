# Inverter

Inverter is a full-stack web application that generates all piano chord voicings across the 88-key range for a given input chord.

## Tech Stack

- Frontend: React (Vite) + TailwindCSS  
- Backend: Node.js + Express  
- Database: SQLite  
- Deployment: Docker  

---

## Overview

Inverter takes a set of MIDI note inputs and generates musically valid piano voicings that:

- Contain the required pitch classes
- Fit within configurable span limits
- Respect minimum and maximum note counts
- Stay within the 88-key piano range
- Avoid duplicate interval structures

The backend exposes a REST API that performs constraint-based voicing generation and ranking. The frontend provides an interactive piano interface for selecting notes and visualizing generated voicings.

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

###Option 2 — Local Development

Clone the repository:

```bash
git clone https://github.com/graysonrucker/Inverter.git
cd Inverter
```
Install backend dependencies:
```bash
npm install
```
Install frontend dependencies:
```bash
cd client
npm install
```
Run the backend (from project root):
```bash
npm start
```
Run the frontend (from client directory):
```bash
npm run dev
```