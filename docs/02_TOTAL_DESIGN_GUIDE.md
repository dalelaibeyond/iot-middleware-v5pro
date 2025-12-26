# 02_TOTAL_DESIGN_GUIDE.md

Based on the previous documents and the architectural evolution we have discussed (Adapter Pattern, Device Shadow, Hybrid Database), I have consolidated everything into three authoritative "Master Documents."

These documents are designed to be fed to an AI Coder to provide context for the **entire project lifecycle**, ensuring the specific parsers fit perfectly into the larger application.

Here is the first document: `*02_TOTAL_DESIGN_GUIDE.md*`

---

```markdown

---

### Document 2: Total Design Guide
*Filename: `02_TOTAL_DESIGN_GUIDE.md`*

```markdown
# IoT Middleware V5 - Total Design Guide

## 1. System Architecture
The system relies on an **Event-Driven Pipeline**. Data flows unidirectionally from Ingress to Persistence/Output.

### The Pipeline Flow
1.  **Ingress:** `MqttService` subscribes to `V5008Upload/+/#` and `V6800Upload/+/#`.
2.  **Parsing (Adapter):** Raw messages are routed to `V5008Parser` or `V6800Parser` based on topic. Output is **SIF** (Standard Intermediate Format).
3.  **Normalization (Logic):** `UnifyNormalizer` applies "Device Shadow" logic (diffing/patching) to standardize behavior. Output is **SUO** (Standard Unified Objects).
4.  **Distribution:** The EventBus emits `data.normalized`.
5.  **Persistence:** `StorageService` listens to `data.normalized` and writes to MySQL.
6.  **Presentation:** `WebSocketServer` and `ApiServer` read from DB or listen to events for real-time dashboards.

## 2. Data Lifecycle & Formats

### Stage 1: Raw Data
*   V5008: Binary Buffer (Hex).
*   V6800: Non-standard JSON.

### Stage 2: Standard Intermediate Format (SIF)
*Produced by Parsers.*
*   Standardized Keys: `deviceId`, `modAddr`, `sensorAddr`, `temp`, `hum`.
*   Standardized Types: `resultCode` is always "Success"/"Failure".
*   Structure: Nested (Arrays of modules/sensors are preserved).

### Stage 3: Standard Unified Objects (SUO)
*Produced by Normalizer.*
*   Flattened: No arrays. One object per data point.
*   Categorized: `type` is `SYS_TELEMETRY`, `SYS_RFID_EVENT`, etc.
*   Contextualized: Includes Database Path (`deviceId/M1/S10`).

## 3. Database Strategy (Hybrid Schema)

| Table | Purpose | Data Type | Volume |
| :--- | :--- | :--- | :--- |
| `iot_telemetry` | Analytics (Charts) | Numeric (Temp, Hum, V, A) | High |
| `iot_rfid_events`| Audit Trail | Logs (Attached/Detached) | Medium |
| `iot_device_state`| Current Status | JSON Snapshots (Full Rack Map) | Low (Updates) |

## 4. State Management (The Shadow)
Since V5008 sends Snapshots and V6800 sends Events, the `UnifyNormalizer` maintains an in-memory (or Redis) **State Cache**.
*   **V5008:** Snapshot $\\to$ Diff against Cache $\\to$ Generate Events.
*   **V6800:** Event $\\to$ Patch Cache $\\to$ Generate Snapshot.

```