# UnifyNormalizer_V2.0.md

Here is the fully updated **UnifyNormalizer V2.0**. It incorporates the **Device Shadow** pattern, the **Read-Modify-Write** strategy for V6800, and the architectural strictness regarding command sending.

This document is now the "Golden Source" for Task 3 (AI Coding of the Normalizer).

---

# UnifyNormalizer.js Design Guide V2.0

*Version: 2.0 (Final Architecture)Dependencies: V5008Parser, V6800Parser*

# Part 1: Overview & Architecture

The **UnifyNormalizer** is the critical "Business Logic" layer of the IoT Middleware. It bridges the gap between device-specific formats and the unified application logic.

### The Core Problem: Protocol Asymmetry

- **V5008** sends **Snapshots** (Full list of tags). It does not explicitly say "Tag A attached".
- **V6800** sends **Events** (Tag A attached). It does not send the full list with every event.

### The Solution: "Device Shadow" Pattern

The Normalizer acts as a state manager. It maintains a **Device Shadow** (Cached State) for every rack.

1. **For V5008:** It compares incoming Snapshots against the Shadow to generate **Events** (Diffing).
2. **For V6800:** It applies incoming Events to the Shadow to generate **Snapshots** (Patching).

**Result:** The Upper Application *always* receives both **Real-time Events** and **Current Snapshots**, regardless of the hardware protocol.

---

# Part 2: Standardized Definitions

### 2.1 Unified Message Types (Canonical List)

The Normalizer outputs an Array of objects. `messageType` must be mapped to these System Types:

| System Type | Description | Source Examples |
| --- | --- | --- |
| `SYS_TELEMETRY` | Time-series data (Temp, Hum, Noise, Power) | `TemHum`, `Noise`, `HeartBeat` |
| `SYS_RFID_EVENT` | Discrete change (Tag Attached/Detached) | `LabelState`(V6800), Calc. Diff(V5008) |
| `SYS_RFID_SNAPSHOT` | Full list of current tags on a module | `LabelState`(V5008), Patched Shadow(V6800) |
| `SYS_STATE_CHANGE` | Discrete state change (Door, Alarm) | `Door`, `DoorState`, `ClrAlarm` |
| `SYS_DEVICE_INFO` | Static info (IP, FW, MAC) | `Init` |
| `SYS_LIFECYCLE` | Device presence status | `HeartBeat` (Status) |
| `SYS_REQUIRE_SYNC` | **NEW:** Request Upper App to query device | Triggered on Cache Miss (V6800) |

### 2.2 Unified Database Schema (Target)

*Reference for object structure design.*

1. **`iot_telemetry`**: Stores split sensor data (`temperature`, `humidity`, `voltage`).
2. **`iot_rfid_events`**: Stores history log (`tag_id`, `action`, `ts`).
3. **`iot_device_state`**: Stores the current Shadow (`json_value`).

---

# Part 3: State Management (The Core Logic)

The `UnifyNormalizer` class requires a `StateCache` dependency (In-Memory Map or Redis wrapper).

### 3.1 V5008 Logic (Snapshot $\to$ Event)

*The device sends the "Whole Picture". We must figure out "What Changed".*

1. **Input:** `ParsedJson.items` (Full List).
2. **Load Shadow:** Get `prevTags` from Cache for this `modAddr`.
3. **Diff Engine:**
    - Tags in `prev` but not in `curr` $\to$ Generate `SYS_RFID_EVENT` (**action: "detached"**).
    - Tags in `curr` but not in `prev` $\to$ Generate `SYS_RFID_EVENT` (**action: "attached"**).
4. **Update Shadow:** Save `curr` to Cache.
5. **Output:** Array containing the generated **Events** + the original **Snapshot**.

### 3.2 V6800 Logic (Event $\to$ Snapshot)

*The device sends "What Changed". We must reconstruct the "Whole Picture".*

1. **Input:** `ParsedJson.items` (List of changes, e.g., "uPos 3 Attached").
2. **Load Shadow:** Get `currentShadow` from Cache.
    - *Critical Edge Case:* If Cache is empty/null, we cannot guarantee a full snapshot.
    - *Action:* Emit `SYS_RFID_EVENT` (pass-through) AND emit `SYS_REQUIRE_SYNC`. Do not emit Snapshot.
3. **Patch Logic:**
    - Loop through input items.
    - If `action == "attached"`, update `currentShadow[uPos]`.
    - If `action == "detached"`, remove `currentShadow[uPos]`.
4. **Update Shadow:** Save `currentShadow` to Cache.
5. **Output:** Array containing the original **Events** + the newly generated **Snapshot**.

### 3.3 Telemetry Logic (Splitting)

*Flatten grouped arrays into individual rows.*

- **Input:** `sensors: [{sensorAddr: 10, temp: 25, hum: 50}]`
- **Output:**
    1. Object: `type: SYS_TELEMETRY`, `key: "temperature"`, `val: 25`, `path: .../S10`
    2. Object: `type: SYS_TELEMETRY`, `key: "humidity"`, `val: 50`, `path: .../S10`

---

# Part 4: Implementation Guide for AI Coding

**Class Name:** `UnifyNormalizer`

### 4.1 Required Helper Methods

The implementation must be modular.

1. **`normalize(parsedData)`**: Main entry point. Switches based on `deviceType` and `messageType`.
2. **`_processV5008Rfid(identity, items)`**: Implements the **Diff Engine** (Sec 3.1).
3. **`_processV6800Rfid(identity, items)`**: Implements the **Patch Engine** (Sec 3.2).
4. **`_flattenTelemetry(identity, sensors/meta)`**: Handles Temp, Hum, and Power data.
5. **`_splitV6800Init(parsedData)`**: Splits the combo message into `SYS_DEVICE_INFO` (Gateway) and `SYS_DEVICE_INFO` (Modules).

### 4.2 State Cache Interface

Mock this interface for the implementation to ensure separation of concerns.

```jsx
class StateCache {
    async get(deviceId, modAddr) { /* returns Map<uPos, TagData> */ }
    async set(deviceId, modAddr, tagDataMap) { /* void */ }
}

```

### 4.3 Output Object Structure

Every item in the returned array must follow this signature:

```jsx
{
  "identity": {
    "deviceId": "...",
    "deviceType": "...",
    "modAddr": 1,        // Number or null
    "sensorAddr": 10     // Number or null
  },
  "type": "SYS_TELEMETRY", // Canonical Type
  "ts": "ISO-8601-String", // From Parser
  "payload": {
    "key": "temperature", // Standardized Key
    "value": 24.5,
    "raw": { ... }        // Optional context
  }
}

```

---

# Part 5: Execution Rules & Constraints

1. **No Command Sending:** The Normalizer **never** invokes the MQTT Client. If the cache is invalid (V6800 missing init), it outputs a `SYS_REQUIRE_SYNC` object. The Storage/Controller layer handles that later.
2. **Type Safety:** `modAddr` must always be treated as an Integer for indexing. `modId` is a String.
3. **V6800 Init Handling:**
    - V6800 `Init` contains the full rack state.
    - **Action:** When `Init` is received, the Normalizer must **Overwrite** the `StateCache` completely with the new data, ensuring the "Shadow" is synchronized.

---

This document is ready to be fed into your AI coding tool for **Task 3**. It provides specific algorithmic instructions for the tricky state management parts.