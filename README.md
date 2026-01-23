# Watchtower NOC Dashboard

Self-hosted Network Operations Center dashboard providing real-time visualization and monitoring of network infrastructure.

## Quick Start

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Tech Stack

**Backend:** FastAPI, Redis, httpx, APScheduler, bcrypt, PyJWT, Pydantic

**Frontend:** Vite, React 18, React Flow (@xyflow/react), Tailwind CSS, Recharts, Zustand

## Configuration

- `config/config.yaml` - Main configuration (auth, data sources, notifications)
- `config/topology.yaml` - Network topology definitions

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/topology | Full topology graph |
| GET | /api/device/{id} | Device details |
| GET | /api/alerts | Active alerts |
| WS | /ws/updates | Real-time stream |

## Project Status

Core visualization complete. Remaining:
- Authentication (JWT login)
- Settings modal UI
- Real API integrations (LibreNMS, Netdisco, Proxmox)
