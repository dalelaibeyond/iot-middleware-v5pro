# 01_PROJECT_STRUCTURE.md

Based on the previous documents and the architectural evolution we have discussed (Adapter Pattern, Device Shadow, Hybrid Database), I have consolidated everything into three authoritative "Master Documents."

These documents are designed to be fed to an AI Coder to provide context for the **entire project lifecycle**, ensuring the specific parsers fit perfectly into the larger application.

Here is the first document: `*01_PROJECT_STRUCTURE.md*`

---

### Document 1: Project Structure

*Filename: `01_PROJECT_STRUCTURE.md`*

```markdown
# IoT Middleware V5 - Project Structure

## 1. Directory Layout Strategy
The project follows a **Modular Monolith** structure. Each functional area is a "Module" that communicates via the Core EventBus.

```text
iot-middleware-v5/
├── config/                     # Configuration Profiles
│   ├── default.json            # Base config
│   ├── production.json         # Prod overrides
│   └── modules.json            # Toggle modules on/off
├── docs/                       # Specifications
│   ├── V5008_V1.4.md           # Binary Protocol Spec
│   ├── V6800_V1.3.md           # JSON Protocol Spec
│   └── UnifyNormalizer_V2.0.md # Logic Spec
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

## 2. Key File Descriptions

| File | Role |
| --- | --- |
| `app.js` | Bootstrapper. Loads config, connects DB, initializes enabled modules with dynamic parser loading via ParserRegistry. |
| `EventBus.js` | The nervous system. Decouples MQTT from Database and API. |
| `ParserRegistry.js` | Central registry for dynamic parser discovery and topic-based routing. Manages V5008 and V6800 parsers. |
| `V5008Parser.js` | Converts Binary Buffers $\to$ Standard Intermediate Format (SIF). |
| `V6800Parser.js` | Converts Raw JSON $\to$ Standard Intermediate Format (SIF). |
| `UnifyNormalizer.js` | Converts SIF $\to$ Standard Unified Objects (SUO). Handles State/Diffing. |
| `StorageService.js` | Routes SUO arrays to specific SQL tables (`iot_telemetry`, etc.). |