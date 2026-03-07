# Financial Market Ticker & Alerting System

A real-time cryptocurrency market dashboard built with Node.js, WebSocket streaming, Redis caching, Docker, and Chart.js. Displays live BTC/USDT candlestick charts with historical data powered by the Binance API.

**Team:**
- Saptam Kumar Dutta — Cloud & Infrastructure Lead
- Rishabh Ahuja — Backend & Data Streaming Lead
- Gavit Priyanshu Bhimsing — Frontend & Visualization Lead

---

## Project Status

| Sprint | Focus | Status |
|--------|-------|--------|
| Sprint 1 | Backend & Infrastructure Foundation | Completed |
| Sprint 2 | Cloud Deployment & Dashboard | Completed |
| Sprint 3 | Alerting, Security & Multi-Asset | Upcoming |
| Sprint 4 | Technical Indicators & UI Polish | Upcoming |

---

## Sprint 1 – Backend & Infrastructure Foundation

### Implemented Features

#### 1. Real-Time WebSocket Streaming
- Connected to Binance WebSocket API (`btcusdt@trade`)
- Stable streaming of live trade data
- Automatic reconnection handling
- Continuous price updates stored in-memory (`priceHistory`)

#### 2. Data Parsing & Normalization
- Incoming tick data parsed into consistent schema `{ price, time }`
- Handles malformed/missing fields safely
- Optimized for high-frequency streaming

#### 3. Redis Live Data Caching
- Latest price cached using key format: `latest:BTCUSDT`
- Sub-second retrieval (p99 < 10ms)
- Configurable environment-based Redis host via `.env`

#### 4. Docker Containerization
- Node.js backend fully containerized
- Environment variables externalized via `.env`
- Redis runs as a separate container
- Backend-to-Redis connectivity verified inside Docker network

### Architecture (Sprint 1)

```
WebSocket Stream (Binance)
        ↓
Node.js Backend Service
        ↓
Redis Cache (latest:BTCUSDT)
        ↓
(Ready for Dashboard — Sprint 2)
```

### Sprint 1 Story Status

| Story | Description | Points | Status |
|-------|-------------|--------|--------|
| US-1 | WebSocket Market API Connection | 8 | Done |
| US-2 | Streaming Data Parsing & Normalization | 5 | Done |
| US-3 | Redis Live Data Caching | 8 | Done |
| US-4 | Docker Containerization of Node.js Service | 5 | Done |

**Sprint 1 Total: 26 / 26 points completed**

---

## Sprint 2 – Cloud Deployment & Dashboard

### Implemented Features

#### 5. Cloud VM Deployment (US-5)
- Backend deployed to **Amazon EC2**
- Service accessible via public IP on port `3000`
- Auto-restart enabled on container failure
- Deployed using Docker on EC2 instance

#### 6. Real-Time Candlestick Chart (US-8)
- Interactive candlestick chart built with `chartjs-chart-financial`
- **500 historical candles** loaded from Binance REST API on startup
- Live WebSocket ticks seamlessly merged on top of historical data
- Chart updates every 5 seconds without page refresh or flicker
- Update-in-place pattern prevents canvas reuse errors

#### 7. Timeframe Selection (US-10)
- Timeframe selector with **1m / 5m / 1h / 1d** buttons
- Chart reloads within 500ms of timeframe change
- Selected timeframe persists across page refreshes via `localStorage`
- Server-side candle aggregation via `/candles?tf=<minutes>`
- Smart candle limits per timeframe for optimal readability:

| Timeframe | Candles Shown | Window |
|-----------|--------------|--------|
| 1m | 120 | Last 2 hours |
| 5m | 288 | Last 24 hours |
| 1h | 168 | Last 7 days |
| 1d | 365 | Last 1 year |

### Architecture (Sprint 2)

```
Binance REST API ──────────────────────────────┐
(Historical candles — /candles/history)        │
                                               ▼
WebSocket Stream (Binance) → Node.js Backend → Redis Cache
                                    ↓
                             REST API Endpoints
                                    ↓
                           Frontend Dashboard
                         (Candlestick Chart +
                          Timeframe Selector +
                          Live Price Ticker)
                                    ↓
                            Amazon EC2 (Public)
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/price` | Latest live BTC/USDT price |
| GET | `/history` | Raw price tick history (in-memory) |
| GET | `/candles?tf=<mins>` | Aggregated candles from live ticks |
| GET | `/candles/history?tf=<mins>&limit=<n>` | Historical candles from Binance REST API (Redis-cached 60s) |
| POST | `/alert` | Store a price alert threshold in Redis |

### Sprint 2 Story Status

| Story | Description | Points | Status |
|-------|-------------|--------|--------|
| US-5 | Cloud VM Container Deployment | 8 | Done |
| US-8 | Real-Time Candlestick Chart Display | 8 | Done |
| US-10 | Timeframe Selection (1m, 5m, 1h, 1d) | 5 | Done |

**Sprint 2 Total: 21 / 21 points completed**

---

## How to Run

### Prerequisites
- Docker Desktop installed and running
- Node.js (for local frontend serving)

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd Financial-Market-Ticker-And-Alerting
```

### 2. Start backend services (Redis + Node.js)
```bash
cd backend
docker-compose up -d
```

### 3. Check backend is running
```bash
docker ps
# Should show: market-backend and redis containers
```

### 4. Verify backend health
```bash
curl http://localhost:3000/
# Response: Backend is running
```

### 5. Serve the frontend
```bash
cd frontend
npx serve . -p 8080
```

Then open `http://localhost:8080` in your browser.

### 6. Check logs
```bash
docker logs market-backend
```

---

## Project Structure

```
Financial-Market-Ticker-And-Alerting/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express server + all API endpoints
│   │   ├── websocket.js      # Binance WebSocket connection
│   │   ├── redisClient.js    # Redis connection helper
│   │   ├── parser.js         # Data parsing & normalization
│   │   └── utils/
│   │       └── candles.js    # Candlestick aggregation utility
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env                  # Environment variables (not committed)
├── frontend/
│   ├── index.html            # Dashboard UI
│   ├── app.js                # Chart logic, timeframe selector, live updates
│   └── style.css             # Dark theme dashboard styles
├── .gitignore
└── README.md
```

---

## Environment Variables

Create `backend/.env` with the following:

```env
PORT=3000
REDIS_HOST=redis
REDIS_PORT=6379
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Data Source | Binance WebSocket API + Binance REST API |
| Backend | Node.js, Express |
| Caching | Redis |
| Containerization | Docker, Docker Compose |
| Cloud | Amazon EC2 |
| Frontend | HTML, CSS, JavaScript |
| Charting | Chart.js, chartjs-chart-financial, chartjs-adapter-date-fns |
