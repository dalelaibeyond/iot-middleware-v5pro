# 03_MASTER_TASK_LIST.md

Based on the previous documents and the architectural evolution we have discussed (Adapter Pattern, Device Shadow, Hybrid Database), I have consolidated everything into three authoritative "Master Documents."

These documents are designed to be fed to an AI Coder to provide context for the **entire project lifecycle**, ensuring the specific parsers fit perfectly into the larger application.

Here is the first document: `*03_MASTER_TASK_LIST.md*`

---

---

### Document 3: Master Task List

*Filename: `03_MASTER_TASK_LIST.md`*

```markdown
# IoT Middleware V5 - Master Task List

This roadmap guides the AI coding process. Dependencies must be respected.

## Phase 1: Foundation (Infrastructure)
*   [ ] **Task 1.1:** Setup Project Skeleton (`package.json`, `eslint`, directory structure).
*   [ ] **Task 1.2:** Implement `Core/Logger.js` and `Core/ConfigManager.js`.
*   [ ] **Task 1.3:** Implement `Core/EventBus.js` (EventEmitter wrapper).
*   [ ] **Task 1.4:** Implement `Core/Database.js` (MySQL connection pool with Knex/MySQL2).

## Phase 2: Ingress & Parsers (The Adapters)
*   [ ] **Task 2.1:** Implement `Modules/MqttService.js`. Connect to broker, handle reconnections.
*   [ ] **Task 2.2:** Implement `Parsers/V5008Parser.js`. (Ref: `V5008_V1.4.md`).
*   [ ] **Task 2.3:** Implement `Parsers/V6800Parser.js`. (Ref: `V6800_V1.3.md`).
*   [ ] **Task 2.4:** Unit Tests for Parsers.

## Phase 3: Core Logic (The Brain)
*   [ ] **Task 3.1:** Implement `Normalizer/StateCache.js`. (In-memory Map or Redis stub).
*   [ ] **Task 3.2:** Implement `Normalizer/UnifyNormalizer.js`. (Ref: `UnifyNormalizer_V2.0.md`).
    *   *Critical:* Implement the V5008 Diffing Logic.
    *   *Critical:* Implement the V6800 Patching Logic.
*   [ ] **Task 3.3:** Integration Test: Feed Mock MQTT Data $\\to$ Parser $\\to$ Normalizer $\\to$ Verify Output.

## Phase 4: Persistence (The Memory)
*   [ ] **Task 4.1:** Define SQL Schema (Migration scripts).
*   [ ] **Task 4.2:** Implement `Storage/StorageService.js`.
    *   Route `SYS_TELEMETRY` to `iot_telemetry`.
    *   Route `SYS_RFID_EVENT` to `iot_rfid_events`.
    *   Route `SYS_*_SNAPSHOT` to `iot_device_state` (Upsert).

## Phase 5: Access & Real-time (The Interface)
*   [ ] **Task 5.1:** Implement `WebSocket/WebSocketServer.js` (Broadcast `data.normalized` events).
*   [ ] **Task 5.2:** Implement `Api/ApiServer.js` (Express.js).
    *   GET `/device/:id/telemetry`
    *   GET `/device/:id/state`

## Phase 6: Orchestration
*   [ ] **Task 6.1:** Implement `app.js` to wire everything together.
*   [ ] **Task 6.2:** Dockerize (`Dockerfile`, `docker-compose.yml`).

```