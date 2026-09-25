# Secondary Development Plan

## Status

- Upstream: `XiaoDuoYa/codex-with-chatgpt`
- Fork: `joshuayash/codex-with-chatgpt`
- Current phase: **design only**
- No functional development should begin yet.

## Goal

Evolve the project from a "Codex + ChatGPT Web" collaboration model into a more general:

**Jev Router + Multi-Model Architect + Codex Executor**

system.

The central idea is to preserve the strongest parts of the existing design while removing the dependency on browser automation against ChatGPT Web.

## Core Principles

1. Keep Architect and Executor responsibilities separated.
2. Architect remains read-only by default.
3. Codex remains the only component allowed to modify code, execute shell commands, run tests, and perform Git mutations.
4. Prefer official model APIs over automated interaction with ChatGPT Web.
5. Introduce Jev as a low-cost Router / Judge rather than as the architecture model itself.
6. Make model providers pluggable so the system is not tied to one vendor.
7. Fetch repository context on demand instead of pushing the whole repository into prompts.
8. Use machine-readable PLAN and REVIEW protocols between Architect and Codex.

## Target Architecture

```text
User Task
   |
   v
Jev Router / Judge
   |
   +---- easy ----------> Cheap Model
   |
   +---- normal --------> Default Architect (e.g. DeepSeek)
   |
   +---- complex/risky -> Frontier Architect (Claude / GPT / Gemini)
                              |
                              v
                           PLAN
                              |
                              v
                            Codex
                         Executor
                              |
                       edit/test/diff
                              |
                              v
                         Jev Review Router
                          /          \
                     low risk      high risk
                        |              |
                       done       Strong Reviewer
```

## Components to Preserve

### Architect / Executor Separation

Architect responsibilities:

- understand the task
- inspect relevant repository context
- reason about architecture
- create implementation plans
- identify risks
- review Codex changes

Codex responsibilities:

- edit files
- execute shell commands
- run tests
- inspect runtime failures
- perform Git operations
- implement fixes

### Read-only Repository Tool Layer

Architect should be able to use tools such as:

- `repo_tree`
- `search_code`
- `read_file`
- `find_references`
- `git_status`
- `git_diff`
- `git_log`
- `read_test`
- `test_result`
- `execution_summary`

Architect should not receive:

- `write_file`
- `shell`
- `git_commit`

### On-demand Context Gathering

Do not send the entire repository into the model context.

Recommended exploration pattern:

```text
Task
 -> repo_map
 -> search_code
 -> read_file
 -> find_references
 -> read_tests
 -> PLAN
```

## Proposed New Modules

```text
src/
├── architect/
│   ├── orchestrator.ts
│   ├── protocol.ts
│   ├── context.ts
│   └── review.ts
│
├── router/
│   ├── jev.ts
│   ├── rules.ts
│   └── policy.ts
│
├── providers/
│   ├── provider.ts
│   ├── deepseek.ts
│   ├── anthropic.ts
│   ├── openai.ts
│   └── gemini.ts
│
├── mcp/
├── workspace/
├── execution/
└── cli/
```

## Architect Provider Abstraction

```ts
interface ArchitectProvider {
  plan(context: ArchitectContext): Promise<Plan>;
  review(context: ReviewContext): Promise<Review>;
}
```

Potential implementations:

- `DeepSeekProvider`
- `ClaudeProvider`
- `OpenAIProvider`
- `GeminiProvider`

The core orchestration layer should not hard-code any model.

## Jev Responsibilities

Jev should not design the system architecture itself.

Jev should be used for bounded decisions such as:

- task complexity classification
- architecture impact scoring
- security/data risk scoring
- model routing
- review routing
- escalation decisions
- confidence-based fallback

Example routing output:

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

The final route should be determined by:

```text
Hard Rules
    +
Jev Judgment
    +
Confidence Threshold
    +
Cost Policy
```

Examples of hard escalation rules may later include:

- security-sensitive changes
- database migrations
- concurrency-sensitive changes
- large cross-module refactors
- public API contract changes

## Initial Model Strategy

Suggested starting roles:

```text
Jev
= Router / Judge

DeepSeek
= Default Architect / Reviewer

Claude / GPT
= Complex or critical fallback

Gemini
= Optional large-context provider

Codex
= Executor
```

This is only a starting policy. Model selection should remain configurable.

## PLAN Protocol

Move gradually from free-form text to a machine-readable plan.

Example:

```json
{
  "type": "PLAN",
  "taskId": "abc123",
  "summary": "...",
  "changes": [
    {
      "file": "src/...",
      "intent": "...",
      "reason": "..."
    }
  ],
  "risks": [],
  "tests": [],
  "confidence": 0.87
}
```

## REVIEW Protocol

Example:

```json
{
  "type": "REVIEW",
  "decision": "CHANGES_REQUIRED",
  "issues": [
    {
      "severity": "high",
      "file": "...",
      "reason": "...",
      "suggestion": "..."
    }
  ]
}
```

The protocol should make it easy for Codex to distinguish:

- accepted changes
- blocking issues
- non-blocking suggestions
- required tests
- required rework

## Development Roadmap

### V1 - Minimal Closed Loop

Goal: prove the Architect -> Codex -> Review flow.

Planned components:

- Jev integration
- DeepSeek Architect
- Codex Executor
- DeepSeek Reviewer
- standardized PLAN / REVIEW protocol

No broad multi-model routing is required yet.

### V2 - Multi-model Routing

Add:

- Jev-based routing
- multiple Architect providers
- complexity/risk escalation
- confidence gates
- fallback policies

Example:

```text
simple
 -> cheap model

normal
 -> DeepSeek

complex / high-risk
 -> Claude / GPT / Gemini
```

### V3 - Cost and Quality Optimization

Add:

- cost-aware routing
- risk-aware review
- task history
- benchmark suite
- per-model performance metrics
- per-task cost tracking
- escalation statistics
- review defect-detection metrics

## Future Benchmarking

Do not rely only on public coding benchmarks.

Build a project-specific benchmark using real development tasks and track:

- plan acceptance rate
- implementation rework count
- missed architectural issues
- review defects caught
- test failures after implementation
- token/API cost
- execution latency
- escalation frequency

This should become the basis for model-routing policy.

## Explicitly Out of Scope for the Current Phase

Do **not** implement the following yet:

- Jev API integration
- new model providers
- Architect Orchestrator
- routing rules
- MCP redesign
- Codex Skill changes
- browser automation removal
- benchmark implementation
- production code changes

Current objective is only:

1. fork the project
2. preserve this design direction
3. review the existing architecture later
4. define V1 before coding starts
