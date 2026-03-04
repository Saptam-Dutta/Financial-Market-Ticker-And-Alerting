# Financial Market Ticker & Alerting System

## Sprint 1 – Backend & Infrastructure Foundation (Completed)

### Implemented Features

### 1. Real-Time WebSocket Streaming
- Connected to Binance WebSocket API
- Stable streaming of live trade data
- Automatic reconnection handling
- Continuous price updates

### 2. Data Parsing & Normalization
- Incoming tick data parsed into consistent schema
- Handles malformed/missing fields safely
- Optimized for high-frequency streaming

### 3. Redis Live Data Caching
- Latest price cached using key format:
  
  BTCUSDT:latest
  
- Sub-second retrieval
- Configurable environment-based Redis host

### 4. Docker Containerization
- Node.js backend containerized
- Environment variables externalized
- Image builds successfully
- Backend runs fully inside Docker
- Redis connectivity verified inside container

---

## Architecture (Sprint 1)

WebSocket Stream (Binance)
        ↓
Node.js Backend Service
        ↓
Redis Cache
        ↓
(Ready for Dashboard in Sprint 2)

---

## How to Run (Local Development)

### 1. Run Redis
docker run -d -p 6379:6379 --name redis redis

### 2. Build Backend Image
docker build -t market-backend ./backend

### 3. Run Backend Container
docker run -d --name market-backend
--env REDIS_HOST=host.docker.internal
--env WS_BASE=wss://stream.binance.com:9443/ws
--env SYMBOL=btcusdt
market-backend

### 4. Check Logs
docker logs market-backend


---

## Sprint 1 Status

| User Story | Status |
|------------|--------|
| US‑1 WebSocket Connection | Done |
| US‑2 Data Parsing | Done |
| US‑3 Redis Caching | Done |
| US‑4 Docker Containerization | Done |

Sprint 1 completed successfully.