# IoT Middleware V5

A modular, event-driven IoT middleware platform for normalizing and storing data from multiple device types.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Status](#status)
- [Documentation](#documentation)

## Overview

IoT Middleware V5 is a production-grade middleware system that:

1. **Ingests** data from MQTT topics (V5008 and V6800 devices)
2. **Normalizes** heterogeneous device protocols into a unified format
3. **Persists** normalized data to MySQL database
4. **Exposes** REST API for real-time data access
5. **Provides** WebSocket interface for real-time updates (planned)

The system follows a **Modular Monolith** architecture where each functional area is a self-contained module that communicates via a central EventBus.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Bootstrap (app.js)          │
│                          │                         │
│                          ▼                         │
│         ┌──────────────────────────────────────┐       │
│         │   ParserRegistry (Dynamic Loading)  │       │
│         │         │                         │       │
│         │         ▼                         │       │
│   ┌──────────────────────────────────────────┐ │       │
│   │       Normalizer (Business Logic)       │ │       │
│   │                                      │       │
│   │     ┌────────────────────────────┐   │       │
│   │     │   Device Parsers         │   │       │
│   │     │   ├─ V5008Parser      │       │       │
│   │     │   └─ V6800Parser      │       │       │
│   │     └────────────────────────────┘   │       │
│   │                                      │       │
│   │         ▼                         │       │
│   ┌──────────────────────────────────┐ │       │
│   │     StorageService (Persistence)  │ │       │
│   └──────────────────────────────────┘ │       │
│                                      │       │
│         ▼                         │       │
│   ┌──────────────────────────────────┐ │       │
│   │    Database (MySQL)             │ │       │
│   └──────────────────────────────────┘ │       │
│                                      │       │
│         ▼                         │       │
│   ┌──────────────────────────────────┐ │       │
│   │      EventBus (Nervous System)  │       │
│   └──────────────────────────────────┘ │       │
│                                      │       │
└─────────────────────────────────────────────────────────┘
```

### Core Components

- **EventBus**: Central event-driven communication hub that decouples all modules
- **Database**: MySQL connection pool with Knex ORM
- **ParserRegistry**: Dynamic parser discovery and topic-based routing
- **UnifyNormalizer**: Business logic for state management and data normalization
- **StorageService**: Persistence layer for routing data to appropriate database tables

### Feature Modules

- **MqttService**: MQTT client for inbound data ingestion
- **ApiServer**: REST API endpoints for external access
- **WebSocketServer**: Real-time data streaming (planned)

### Device Parsers

- **V5008Parser**: Converts binary protocol to Standard Intermediate Format (SIF)
- **V6800Parser**: Converts JSON protocol to Standard Intermediate Format (SIF)

### Data Flow

```
MQTT Broker → MqttService → EventBus → ParserRegistry → Device Parser
                                                              ↓
                                                        UnifyNormalizer → EventBus → StorageService → Database
                                                              ↓
                                                         ApiServer → Client
```

## Features

### Dynamic Parser Loading
- **ParserRegistry** provides centralized parser management
- **Topic-based routing**: Automatically selects appropriate parser based on MQTT topic
- **Extensible**: Easy to add new parsers without modifying core application code
- **Type-safe**: Returns parser instances with proper type checking

### Event-Driven Architecture
- **Loose coupling**: All modules communicate via EventBus, no direct dependencies
- **Scalable**: Easy to add new modules without affecting existing ones
- **Testable**: Each module can be tested independently

### Protocol Support
- **V5008**: Binary protocol with hex-encoded messages
- **V6800**: JSON protocol with structured data
- **Unified Output**: Both parsers produce Standard Intermediate Format (SIF)

### Data Normalization
- **State Management**: Tracks device state changes over time
- **Diffing**: Identifies state transitions and generates events
- **Type Mapping**: Maps device-specific types to standardized types

### Persistence
- **Telemetry**: Time-series sensor data storage
- **RFID Events**: Tag attach/detach event logging
- **Device State**: Current device configuration and status tracking
- **Lifecycle**: Device initialization and metadata storage

### API Access
- **Health Check**: `/health` endpoint for system monitoring
- **Status Monitoring**: Real-time connection and module status
- **Telemetry Query**: Historical data retrieval (planned)

## Project Structure

```
iot-middleware-v5/
├── config/                     # Configuration Profiles
│   ├── default.json            # Base config
│   ├── production.json         # Prod overrides
│   └── modules.json            # Toggle modules on/off
├── docs/                       # Specifications
│   ├── V5008_V1.4.md           # Binary Protocol Spec
│   ├── V6800_V1.3.md           # JSON Protocol Spec
│   ├── UnifyNormalizer_V2.0.md # Logic Spec
│   └── 01_PROJECT_STRUCTURE.md   # This file
├── src/
│   ├── core/                   # Infrastructure Layer
│   │   ├── EventBus.js         # Singleton EventEmitter
│   │   ├── Logger.js           # Winston/Pino wrapper
│   │   ├── Database.js         # MySQL Connection Pool
│   │   └── BaseModule.js       # Abstract class for all modules
│   ├── modules/                # Feature Layers
│   │   ├── mqtt-ingress/       # Inbound Data
│   │   │   └── MqttService.js
│   │   ├── normalizer/         # Business Logic (The Core)
│   │   │   ├── ParserRegistry.js  # Dynamic Parser Loading
│   │   │   ├── parsers/        # Adapters
│   │   │   │   ├── V5008Parser.js
│   │   │   │   └── V6800Parser.js
│   │   │   ├── cache/          # State Management
│   │   │   │   └── StateCache.js
│   │   │   └── UnifyNormalizer.js
│   │   ├── storage/            # Persistence Layer
│   │   │   └── StorageService.js
│   │   ├── api/                # HTTP Access Layer
│   │   │   ├── routes/
│   │   │   └── ApiServer.js
│   │   └── websocket/          # Real-time Access Layer
│   │       └── WebSocketServer.js
│   ├── utils/                  # Helpers
│   │   ├── HexUtils.js
│   │   └── TimeUtils.js
│   └── app.js                  # Application Bootstrap
├── test/                       # Unit & Integration Tests
├── .env.example                # Environment Template
├── docker-compose.yml          # Container Orchestration
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- MySQL 8.0 or higher
- MQTT Broker (e.g., Mosquitto, EMQX)
- npm dependencies

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/iot-middleware-v5.git

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Edit configuration
nano .env

# Start application
npm start
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test
npm test -- registry-test

# Run E2E flow test
npm test -- e2e-flow
```

## Configuration

### Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `3306` |
| `DB_NAME` | Database name | `iot_middleware` |
| `DB_USER` | Database user | `root` |
| `DB_PASSWORD` | Database password | (empty) |
| `MQTT_BROKER_URL` | MQTT broker URL | `mqtt://localhost:1883` |
| `MQTT_USERNAME` | MQTT username | (empty) |
| `MQTT_PASSWORD` | MQTT password | (empty) |
| `MQTT_CLIENT_ID` | MQTT client ID | `iot-middleware-v5` |
| `MQTT_TOPICS` | MQTT topics to subscribe | `V5008Upload/+/#,V6800Upload/+/#` |
| `API_PORT` | API server port | `3000` |
| `API_HOST` | API server host | `0.0.0.0` |

### Module Configuration

Edit `config/modules.json` to enable/disable specific modules:

```json
{
  "modules": {
    "storage": true,
    "mqtt-ingress": true,
    "api": true,
    "websocket": false
  }
}
```

## Status

### Phase 1: Core Infrastructure ✅ Complete
- [x] EventBus implementation
- [x] Logger implementation
- [x] Database connection pool
- [x] BaseModule abstract class

### Phase 2: Device Parsers ✅ Complete
- [x] V5008Parser implementation
- [x] V6800Parser implementation
- [x] ParserRegistry implementation
- [x] Topic-based parser routing
- [x] Dynamic parser loading

### Phase 3: Business Logic ✅ Complete
- [x] UnifyNormalizer implementation
- [x] State management with StateCache
- [x] State diffing and event generation
- [x] Type mapping and normalization

### Phase 4: Persistence Layer ✅ Complete
- [x] StorageService implementation
- [x] Database table routing
- [x] Telemetry storage
- [x] RFID event logging
- [x] Device state tracking
- [x] Lifecycle metadata storage

### Phase 5: API Layer ✅ Complete
- [x] ApiServer implementation
- [x] Health check endpoint
- [x] Module status monitoring
- [x] Connection statistics
- [x] Error handling and logging

### Future Phases
- [ ] WebSocket server implementation
- [ ] Historical data query endpoints
- [ ] Data export functionality
- [ ] Authentication and authorization
- [ ] Rate limiting and caching

## Documentation

- [Project Structure](docs/01_PROJECT_STRUCTURE.md) - Detailed file organization
- [V5008 Protocol](docs/V5008_V1.4.md) - Binary protocol specification
- [V6800 Protocol](docs/V6800_V1.3.md) - JSON protocol specification
- [Normalizer Logic](docs/UnifyNormalizer_V2.0.md) - Business logic specification
- [Master Task List](docs/03_MASTER_TASK_LIST.md) - Development roadmap

## Development

### Adding a New Device Parser

1. Create parser class in `src/modules/normalizer/parsers/YourDeviceParser.js`
2. Implement static `canHandle(topic)` method
3. Implement `parse(topic, message)` method
4. Register parser in `ParserRegistry.js` constructor
5. Add protocol documentation in `docs/`

### Testing Strategy

- **Unit Tests**: Test individual modules in isolation
- **Integration Tests**: Test module interactions via EventBus
- **E2E Tests**: Test complete data flow from MQTT to Database
- **Parser Registry Tests**: Verify topic matching and parser instantiation

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact the development team

---

**Version**: 5.0.0  
**Last Updated**: 2025-12-26
