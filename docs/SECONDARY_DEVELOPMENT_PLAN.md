# Secondary Development Plan

## Status

- Upstream: `XiaoDuoYa/codex-with-chatgpt`
- Fork: `joshuayash/codex-with-chatgpt`
- Current phase: **design only**
- Functional development has not started yet.

## Overall Goal

Evolve the project from a "Codex + ChatGPT Web" collaboration model into a more general architecture where:

- an external model acts as **Architect / Reviewer**
- Codex acts as the **Executor**
- repository access remains **read-only for Architect**
- model choice can later evolve into a routed, multi-model system

The implementation should start simple and add routing only after the Architect/Executor split is proven useful in real development tasks.

---

## Core Principles

1. Keep Architect and Executor responsibilities separated.
2. Architect remains read-only by default.
3. Codex remains the only component allowed to modify code, execute shell commands, run tests, and perform Git mutations.
4. Prefer official model APIs over automated interaction with ChatGPT Web.
5. Fetch repository context on demand instead of pushing the whole repository into prompts.
6. Use machine-readable PLAN and REVIEW protocols between Architect and Codex.
7. Keep the provider abstraction model-agnostic even when Phase 1 initially uses only Kimi K3.
8. Add routing, Jev, and multiple providers only after the minimal closed loop is stable.

---

# Phase 1 — Kimi K3 Architect + Codex Executor

## Objective

Validate one question first:

> Does separating architecture/review from execution produce better and more controllable software-development results than letting Codex handle everything alone?

Phase 1 deliberately avoids:

- Jev
- model routing
- multiple Architect models
- cost-aware routing
- risk-aware routing
- automatic escalation
- benchmark-driven model selection

The system should contain only two intelligent roles:

```text
Kimi K3
= Architect + Reviewer

Codex
= Executor
```

## Phase 1 Target Architecture

```text
User Task
   |
   v
Codex
   |
   | request architecture
   v
Kimi K3
Architect
   |
   | read-only repository tools
   |
   +--> repo_tree
   +--> search_code
   +--> read_file
   +--> find_references
   +--> read_test
   |
   v
PLAN
   |
   v
Codex
Executor
   |
   +--> edit files
   +--> shell
   +--> run tests
   +--> git diff
   |
   v
Kimi K3
Reviewer
   |
   +--> git_diff
   +--> read_file
   +--> read_test
   |
   v
APPROVED
or
CHANGES_REQUIRED
```

---

## Phase 1.1 — Provider Abstraction

Introduce a small provider interface without adding multi-model routing yet.

Suggested location:

```text
src/providers/
├── provider.ts
└── kimi.ts
```

Suggested interface:

```ts
interface ArchitectProvider {
  plan(context: ArchitectContext): Promise<Plan>;
  review(context: ReviewContext): Promise<Review>;
}
```

Phase 1 implementation:

```text
KimiArchitectProvider
```

The abstraction is important even though only Kimi K3 exists initially, because later phases should be able to add:

- Claude
- GPT
- Gemini
- other models

without changing orchestration logic.

### Phase 1 configuration

Example:

```yaml
architect:
  provider: kimi
  model: kimi-k3
  reasoning: high
```

Exact model identifiers and API configuration should be verified during implementation.

---

## Phase 1.2 — Read-only Architect Tool Set

Do not give Kimi K3 direct write or shell access.

Start with a deliberately small set of tools:

- `repo_tree`
- `search_code`
- `read_file`
- `find_references`
- `git_status`
- `git_diff`
- `read_test`
- `test_result`
- `execution_summary`

Architect must not receive:

- `write_file`
- `shell`
- `git_commit`
- `git_reset`
- arbitrary command execution

The principle is:

```text
Architect
= understand / plan / review

Codex
= write / execute / test / fix
```

### Context gathering pattern

Kimi should explore the repository incrementally:

```text
Task
 -> repo_tree
 -> search_code
 -> read_file
 -> find_references
 -> read_tests
 -> PLAN
```

Do not send the entire repository into the model context by default.

---

## Phase 1.3 — Machine-readable PLAN Protocol

Kimi should not return only free-form prose.

Introduce a structured PLAN schema.

Example:

```json
{
  "type": "PLAN",
  "taskId": "abc123",
  "summary": "Automatically bootstrap missing trading calendars before import.",
  "scope": [
    "market-import",
    "trading-calendar"
  ],
  "changes": [
    {
      "path": "src/...",
      "action": "modify",
      "intent": "Add calendar bootstrap before import validation",
      "reason": "Imports currently fail when a historical trading calendar is missing"
    }
  ],
  "risks": [
    "Exchange API unavailable",
    "Concurrent calendar bootstrap"
  ],
  "tests": [
    "calendar already exists",
    "calendar missing",
    "provider unavailable"
  ]
}
```

The protocol should clearly answer:

- what should change
- why it should change
- expected affected scope
- risks
- required tests

Codex remains responsible for implementation details.

---

## Phase 1.4 — Codex Execution Protocol

Codex receives the PLAN and performs the implementation.

Typical flow:

```text
PLAN
 ↓
Codex
 ↓
edit
 ↓
test
 ↓
git diff
```

After execution, send only a compact control message back to Architect.

Example:

```json
{
  "type": "EXECUTED",
  "taskId": "abc123",
  "status": "SUCCESS",
  "tests": {
    "passed": 32,
    "failed": 0
  }
}
```

Do not paste large diffs into the control message.

Kimi should retrieve the actual diff through the read-only repository tools.

This preserves the original project's useful separation between:

```text
Control Plane
= task state / PLAN / EXECUTED / REVIEW

Data Plane
= repository files / diff / test results
```

---

## Phase 1.5 — Structured REVIEW Protocol

Kimi performs review after Codex completes implementation.

The reviewer should inspect:

- `git_diff`
- affected files
- relevant tests
- execution/test results

Review schema:

```json
{
  "type": "REVIEW",
  "decision": "CHANGES_REQUIRED",
  "issues": [
    {
      "severity": "HIGH",
      "path": "src/...",
      "problem": "...",
      "reason": "...",
      "suggestion": "..."
    }
  ]
}
```

For Phase 1, keep the decision set deliberately small:

```text
APPROVED
CHANGES_REQUIRED
```

Recommended maximum review iterations:

```text
3
```

This prevents accidental infinite loops.

---

## Phase 1.6 — Run History and Observability

Phase 1 should record every real development run.

Suggested layout:

```text
.c2c/runs/
└── <task-id>/
    ├── task.json
    ├── plan.json
    ├── execution.json
    ├── review-1.json
    ├── review-2.json
    └── summary.json
```

At minimum record:

- original task
- Architect PLAN
- Codex execution status
- tests passed/failed
- number of review iterations
- final result
- Kimi token usage
- Kimi API cost
- total duration
- errors/retries

This run history will become the evidence used in later phases to determine whether routing or stronger models are actually necessary.

---

## Phase 1 Completion Criteria

Phase 1 is not complete merely because the Kimi API is connected.

A real development task must complete the full loop:

```text
User Task
   ↓
Kimi reads repository
   ↓
Kimi produces PLAN
   ↓
Codex implements PLAN
   ↓
Codex runs tests
   ↓
Kimi reads git diff
   ↓
Kimi performs REVIEW
   ↓
Codex fixes issues if required
   ↓
Kimi APPROVED
```

The workflow should not require a human to manually copy:

- source files
- diffs
- test output
- Architect plans
- review feedback

between components.

---

# Phase 2 — Add a Stronger Fallback Model

## Objective

Keep Kimi K3 as the default Architect but introduce one stronger fallback model for tasks that are manually identified as difficult or high-risk.

No Jev yet.

Example:

```text
Normal task
 -> Kimi K3

Complex / high-risk task
 -> Frontier Model
```

In this document, **Frontier Model** means a current top-tier model selected primarily for capability rather than cost. It is a role/category, not a permanently fixed model name.

Possible future candidates may include suitable versions of:

- Claude
- GPT
- Gemini

Selection should be based on the models available when Phase 2 is implemented.

### Phase 2 routing

Initially routing can be explicit/manual:

```text
architect.mode = kimi
architect.mode = strong
```

or simple hard rules.

Do not introduce a learned router yet.

### Phase 2 goals

Evaluate:

- which tasks Kimi struggles with
- whether a stronger model materially improves architecture quality
- whether stronger review catches issues Kimi missed
- incremental API cost
- when escalation is actually worthwhile

---

# Phase 3 — Jev Router + Multi-model Architecture

## Objective

Automate the model-selection decisions validated manually in Phase 2.

At this point introduce:

```text
Jev
= Router / Judge
```

Jev should not become the software Architect.

Its job is bounded decision-making:

- task complexity classification
- architecture-impact scoring
- security/data risk scoring
- model routing
- review routing
- escalation decisions
- confidence estimation

Example output:

```json
{
  "taskComplexity": 4,
  "architectureImpact": 0.87,
  "securityRisk": 0.13,
  "dataRisk": 0.82,
  "requiresDeepReview": true,
  "route": "strong",
  "confidence": 0.91
}
```

Final routing should combine:

```text
Hard Rules
    +
Jev Judgment
    +
Confidence Threshold
    +
Cost Policy
```

### Target Phase 3 Architecture

```text
                 User Task
                     |
                     v
                 Jev Router
                     |
          +----------+----------+
          |                     |
          v                     v
       Kimi K3            Frontier Model
     Default Architect     Strong Architect
          |                     |
          +----------+----------+
                     |
                    PLAN
                     |
                     v
                   Codex
                  Executor
                     |
                     v
                git diff/tests
                     |
                     v
              Jev Review Router
                 /         \
                /           \
          Kimi Review   Strong Review
```

---

# Phase 4 — Cost / Quality Optimization

## Objective

Use historical task data to optimize model selection and review depth.

Potential capabilities:

- cost-aware routing
- risk-aware review
- task-history analysis
- per-model benchmark
- per-task cost tracking
- escalation statistics
- review defect-detection metrics
- reasoning-effort selection
- context-budget selection

The system should eventually answer questions such as:

- Which task types are safe to send to Kimi?
- Which task types benefit from a stronger model?
- When is a second review worthwhile?
- What is the cheapest route that preserves quality?
- Which provider performs best on this repository?

---

# Future Benchmarking

Do not rely only on public coding benchmarks.

Create a repository-specific benchmark from real tasks.

Track:

- plan acceptance rate
- implementation rework count
- review iterations
- missed architectural issues
- defects caught during review
- test failures after implementation
- token usage
- API cost
- task latency
- escalation frequency
- success rate by task category

Phase 1 Kimi-only runs should become the baseline.

Phase 2 results should measure the incremental value of a stronger model.

Phase 3 routing policy should be derived from this evidence.

---

# Proposed Module Evolution

## Phase 1

```text
src/
├── architect/
│   ├── orchestrator.ts
│   ├── protocol.ts
│   ├── context.ts
│   └── review.ts
│
├── providers/
│   ├── provider.ts
│   └── kimi.ts
│
├── mcp/
├── workspace/
├── execution/
└── cli/
```

## Later Phases

```text
src/
├── router/
│   ├── jev.ts
│   ├── rules.ts
│   └── policy.ts
│
├── providers/
│   ├── provider.ts
│   ├── kimi.ts
│   ├── anthropic.ts
│   ├── openai.ts
│   └── gemini.ts
...
```

---

# Current Decision

The development order is now:

```text
Phase 1
Kimi K3 Architect / Reviewer
+
Codex Executor
        |
        v
prove the architecture


Phase 2
Kimi K3
+
one Frontier Model
        |
        v
manual / rule-based escalation


Phase 3
Jev Router
+
Kimi
+
Frontier Model(s)
        |
        v
automatic routing


Phase 4
Cost / Quality Optimizer
        |
        v
data-driven routing and review
```

---

# Explicitly Out of Scope Right Now

No functional implementation should start yet.

Do not currently:

- integrate Kimi API
- integrate Jev
- add other model providers
- implement Architect Orchestrator
- change MCP behavior
- change Codex Skill behavior
- remove browser automation
- add routing logic
- implement benchmarks
- modify production behavior

Current objective remains:

1. preserve the updated development direction
2. review the existing project architecture
3. define the exact Phase 1 implementation tasks
4. only then begin coding
