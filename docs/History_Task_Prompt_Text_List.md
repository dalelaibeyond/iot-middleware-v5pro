# History Task Prompt Text List

### Task Prompt 1 - **Kickoff**

```markdown
"Act as a Senior Node.js Developer. We are starting the IoT Middleware V5 project.
I have initialized the project structure.
Please review 03_MASTER_TASK_LIST.md.
We will adopt an Iterative Implementation Strategy.
Goal: Complete Phase 1 (Foundation) and Phase 2 (Ingress & Parsers) first.
Let's start with Task 1.2 and 1.3 (Logger and EventBus) to establish the core infrastructure. Please implement these files following the structure in 01_PROJECT_STRUCTURE.md."
```

### Task Prompt 2  -  **Scaffolding**

```markdown
@docs/01_PROJECT_STRUCTURE.md @docs/03_MASTER_TASK_LIST.md

Act as a Senior DevOps Engineer.
I have initialized `package.json`.
Please look at `01_PROJECT_STRUCTURE.md`.

**Task:**
1. Create the complete directory structure shown in Section 1 (config, src/core, src/modules, test, etc.).
2. Create empty placeholder files for the "Key Files" listed (app.js, EventBus.js, Logger.js, etc.) so we have a place to start coding.
3. Create the `.env.example` file with placeholders for MQTT and DB credentials.

Do not write implementation logic yet, just set up the file system skeleton.
```

### Task Prompt 3 -  **Core Infrastructure**

```markdown
@docs/02_TOTAL_DESIGN_GUIDE.md @docs/01_PROJECT_STRUCTURE.md

Act as a Senior Node.js Developer.
We are executing **Phase 1** of the Master Task List.

**Task:** Implement the Core Infrastructure.

1. **`src/core/Logger.js`**: Implement a Winston logger. It should log to console (colored) and a file (`combined.log`).
2. **`src/core/EventBus.js`**: Implement a Singleton class extending Node's `EventEmitter`. It should log every event emitted to the Logger (debug level) for tracing.
3. **`config/default.json`**: Create a basic configuration structure for `mqtt` (brokerUrl, topic) and `logging` (level).

**Code Style:**
- Use ES Modules (`import/export`) or CommonJS (`require`) consistently (recommend CommonJS for Node backend stability).
- Add JSDoc comments to methods.
```

### Task Prompt 4 -  **The First "Tracer Bullet"**

```markdown
@docs/V5008_V1.4.md @src/core/Logger.js

Act as a Senior Node.js Developer.
We are executing **Phase 2, Task 2.2** of the Master Task List.

**Task:** Implement `src/modules/normalizer/parsers/V5008Parser.js`.

**Requirements:**
1. Read the `V5008_V1.4.md` spec carefully.
2. Implement the `parse(topic, messageBuffer)` method.
3. Handle the Binary Parsing Logic (Hex to Decimal, Signed Integers for Temp).
4. **Strict Constraint:** Ensure `modId` is converted to String, and `ts` (ISO Timestamp) is injected at the root.
5. Map `resultCode` to "Success" or "Failure" (do not use Hex A1).

**Verification:**
After writing the code, create a test file `test/v5008-parser.test.js` using the "Heartbeat" and "Temp_Hum" examples from the doc to assert the output is correct.
```

### Task Prompt 4 - **Implement V6800 Parser**

```markdown
@docs/V6800_V1.3.md @openspec/contracts/v6800-output.yaml

Act as a Senior Node.js Developer.
We are executing **Phase 2, Task 2.3** of the Master Task List.

**Task:** Implement `src/modules/normalizer/parsers/V6800Parser.js`.

**Context:**
The V6800 sends raw JSON strings. You must convert them into the standardized format defined in `v6800-output.yaml`.

**Requirements:**
1.  **Strict Compliance:** The output JSON **MUST** match the schema in `v6800-output.yaml` (keys, types, enums).
2.  **Logic Source:** Use `V6800_V1.3.md` for the raw key mapping logic (e.g. mapping `host_gateway_port_index` -> `modAddr`).
3.  **Array Preservation:** The V6800 message often contains an array of modules. The parser output must preserve this structure in the `data` or `modules` array.
4.  **Error Handling:** Since input is JSON string, wrap `JSON.parse` in a try-catch block.

**Testing:**
After coding, create `test/v6800-parser.test.js` using the "RFID Message" example from the doc to verify the output matches the OpenSpec contract.
```

### Task Prompt 4 -  **Implement the Normalizer**

```markdown
@docs/UnifyNormalizer_V2.0.md @src/modules/normalizer/parsers/V5008Parser.js @src/modules/normalizer/parsers/V6800Parser.js

Act as a Senior Backend Architect.
We are executing **Phase 3, Task 3.1 & 3.2**: The UnifyNormalizer.

**Task:** Implement `src/modules/normalizer/UnifyNormalizer.js`.

**Context:**
This module takes the output from V5008/V6800 parsers and converts them into "Standard Unified Objects" (SUO) for the database.

**Crucial Logic Requirements (Refer to UnifyNormalizer_V2.0.md):**
1.  **State Cache:** Implement a simple in-memory `Map` (or `StateCache.js`) to store the previous RFID state per module.
2.  **V5008 Logic (Diffing):** Compare incoming Snapshot vs Cached State -> Generate Events (Attached/Detached).
3.  **V6800 Logic (Patching):** Apply incoming Events to Cached State -> Generate Snapshot.
4.  **Telemetry:** Flatten sensor arrays into individual metric objects.

**Deliverable:**
- `src/modules/normalizer/StateCache.js` (Simple In-memory store)
- `src/modules/normalizer/UnifyNormalizer.js`
- `test/normalizer.test.js` (Test the diffing logic with mock data)
```