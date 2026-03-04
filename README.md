# UI Navigator – AI-Powered Visual Browser Agent

UI Navigator is an AI agent that observes a live browser, interprets the visual content using **Gemini 2.0 Flash** multimodal capabilities, and performs actions on the page based on natural-language user intent.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 + Tailwind)   port 3000          │
│  • URL input & navigation                               │
│  • Intent/instruction textarea                          │
│  • Live screenshot display                              │
│  • Agent analysis / action cards                        │
│  • Interaction history log                              │
└───────────────────┬────────────────────────────────────┘
                    │ REST API
┌───────────────────▼────────────────────────────────────┐
│  Backend (FastAPI + Python 3.11)    port 8080           │
│  • BrowserManager  – Playwright headless Chromium       │
│  • UINavigatorAgent – Gemini 2.0 Flash multimodal       │
│  • Session management (in-memory)                       │
└───────────────────────────────────────────────────────-─┘
                    │ Deployed to
         Google Cloud Run (us-central1)
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 20+ |
| Docker & Docker Compose | latest |
| Google Cloud CLI (`gcloud`) | latest |
| Gemini API key | – |

---

## Quick Start (Local)

### 1. Clone and set up environment variables

```bash
git clone <repo-url>
cd animated-journey

cp .env.example .env          # or create .env manually
```

Create a `.env` file in the repo root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

> Get a free Gemini API key at <https://aistudio.google.com/app/apikey>

---

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

* Frontend → <http://localhost:3000>
* Backend API → <http://localhost:8080>
* API docs → <http://localhost:8080/docs>

---

### 3. Run without Docker

#### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium

GEMINI_API_KEY=your_key uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

#### Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8080 npm run dev
```

---

## Backend API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/session/start` | Start a new browser session |
| DELETE | `/api/session/{id}` | Close a browser session |
| POST | `/api/navigate` | Navigate to a URL |
| POST | `/api/execute` | Analyze screenshot & optionally execute actions |
| GET | `/api/screenshot/{id}` | Get current screenshot |

### `/api/execute` request body

```json
{
  "session_id": "uuid",
  "user_intent": "Search for the latest AI news",
  "auto_execute": true
}
```

### `/api/execute` response

```json
{
  "session_id": "uuid",
  "screenshot": "<base64-png>",
  "analysis": "I see a Google search page...",
  "plan": "I will type the search query and press Enter",
  "actions": [
    {"type": "click", "x": 640, "y": 400},
    {"type": "type", "text": "latest AI news"},
    {"type": "press_key", "key": "Enter"}
  ],
  "response": "I found the search box and will now search for AI news.",
  "executed_actions": [...],
  "current_url": "https://www.google.com/search?q=latest+AI+news"
}
```

---

## Deploy to Google Cloud Run

### Prerequisites

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com
```

### Deploy via Cloud Build

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _GEMINI_API_KEY="your_key_here",_REGION_SUFFIX="xxxxxxxx-uc.a"
```

### Manual deploy (backend only)

```bash
# Build & push
docker build -t gcr.io/YOUR_PROJECT/ui-navigator-backend ./backend
docker push gcr.io/YOUR_PROJECT/ui-navigator-backend

# Deploy
gcloud run deploy ui-navigator-backend \
  --image gcr.io/YOUR_PROJECT/ui-navigator-backend \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --set-env-vars GEMINI_API_KEY=your_key
```

---

## Project Structure

```
animated-journey/
├── backend/
│   ├── main.py          # FastAPI app & API endpoints
│   ├── agent.py         # Gemini 2.0 Flash multimodal agent
│   ├── browser.py       # Playwright browser automation
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx     # Main UI
│   │   │   └── layout.tsx
│   │   ├── lib/
│   │   │   └── api.ts       # Backend API client
│   │   └── types/
│   │       └── index.ts     # Shared types
│   ├── next.config.mjs
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── cloudbuild.yaml
└── README.md
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| AI Model | Gemini 2.0 Flash (Google GenAI SDK) |
| Browser Automation | Playwright (headless Chromium) |
| Backend Framework | FastAPI (Python 3.11) |
| Frontend Framework | Next.js 14 (TypeScript) |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Cloud Hosting | Google Cloud Run |
| Container Build | Google Cloud Build |

---

## License

MIT