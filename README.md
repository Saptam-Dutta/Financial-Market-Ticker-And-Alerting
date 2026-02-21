# Financial-Market-Ticker-And-Alerting

## Sprint 1 Progress (Backend)

Completed components:

- Real-time WebSocket connection to Binance market stream
- Stable auto-reconnect logic
- Trade data parsing and normalization
- Redis caching of latest ticker price
- Environment-based configuration (.env)

Pipeline implemented:

Market WebSocket → Node.js Backend → Redis Cache

Status:
Backend streaming and caching verified locally.
Ready for Docker containerization and cloud deployment.