# Carcassonne: War of Ages

A web-based real-time strategy/tile-laying game combining Carcassonne's tile placement mechanics with Age of Empires' conquest-driven RTS gameplay.

## 🎮 Game Overview

- **Genre**: Real-Time Strategy (RTS) / Tile-Laying Hybrid
- **Platform**: Web-based (Static HTML/CSS/JS with PixiJS)
- **Players**: 2-4 players with AI opponents
- **Duration**: 20-30 minutes per game

## 🏗️ Project Structure

```
REIGN/
├── frontend/          # Static HTML/CSS/JS client
│   ├── src/
│   ├── assets/
│   └── index.html
├── backend/           # FastAPI server
│   ├── src/
│   ├── tests/
│   └── requirements.txt
├── shared/            # Common schemas and types
└── docs/             # Documentation
```

## 🚀 Quick Start

### Frontend (Static Site)
```bash
cd frontend
# Open index.html in your browser or serve with a simple HTTP server
python -m http.server 8000
```

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn src.main:app --reload
```

## 📖 Documentation

- [Game Design Document](scripts/GameDesign.md)
- [Development Roadmap](scripts/Phases.md)
- [Task Management](.taskmaster/tasks/tasks.json)

## 🔧 Development

- **Frontend**: Vanilla HTML/CSS/JS with PixiJS for 2D rendering
- **Backend**: FastAPI with WebSocket support for real-time multiplayer
- **Hosting**: Netlify (frontend) + Render (backend)

## 📝 License

MIT License - See LICENSE file for details 