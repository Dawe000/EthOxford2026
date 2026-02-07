# Frontend + Marketmaker + ExampleAgents + On-Chain Integration

## 1) Scope and constraints

This implementation connected the full ERC8001 test flow across UI, marketmaker routing, example agents, and on-chain execution, with these constraints:

- No smart contract changes.
- Existing on-chain methods are reused as-is:
  - `createTask`
  - `acceptTask`
  - `depositPayment`
  - `assertCompletion`
- Frontend and chain state are synchronized by polling on-chain task state and agent result endpoints.

## 2) End-to-end flow implemented

The implemented sequence is:

1. Client wallet (frontend) creates task intent on-chain via `createTask`.
2. Frontend dispatches selected agent via marketmaker endpoint.
3. Marketmaker forwards ERC8001 metadata to ExampleAgents worker.
4. Agent worker accepts on-chain task (`acceptTask`) with configured stake.
5. Agent worker accepts and then pauses awaiting a client payment alert.
6. Client deposits payment manually from frontend (`depositPayment`).
7. Frontend alerts selected agent with `onchainTaskId`.
8. Agent verifies `paymentDeposited == true`, executes off-chain task, and stores result in D1.
9. Agent asserts completion on-chain (`assertCompletion`) with `resultURI` pointing to worker task endpoint.
10. Frontend polls chain task state and fetches result payload from on-chain `resultURI`.

## 3) What changed by component

### 3.1 SDK changes

Files:
- `sdk/src/contract.ts`
- `sdk/src/client.ts`
- `sdk/src/agent.ts`
- `sdk/src/config.ts`

Changes:
- Escrow ABI expanded to include read/write methods used in integrated flow, including:
  - `paymentDeposited(uint256)` view
  - `assertCompletion(..., string resultURI)` signature
- Added payment-deposit read helpers:
  - `ClientSDK.getPaymentDeposited(taskId)`
  - `AgentSDK.getPaymentDeposited(taskId)`
- Maintained create/accept/assert contract interactions while adding result URI support and chain config defaults (Plasma testnet addresses + deployment block).

How it enables integration:
- Frontend and worker can both gate execution steps off the same on-chain `paymentDeposited` source of truth.

### 3.2 Marketmaker changes

Files:
- `marketmakeragent/src/api/agentMcpEndpoints.ts`
- `marketmakeragent/src/services/agentMcp.ts`
- `marketmakeragent/tests/worker.test.ts`
- `marketmakeragent/README.md`

Changes:
- Added new API endpoint:
  - `POST /api/agents/:agentId/erc8001/dispatch`
- Added payment alert proxy endpoint:
  - `POST /api/agents/:agentId/erc8001/payment-deposited`
- Endpoint validation requires:
  - `onchainTaskId`
  - `input`
  - `stakeAmountWei`
- Forwarding logic packages payload as:
  - `task: { input, skill, model }`
  - `erc8001: { taskId, stakeAmountWei, publicBaseUrl }`
- Dispatch is forwarded to example agents worker async route:
  - `/{agentId}/tasks?forceAsync=true`
- Response normalized to:
  - `{ agentId, runId, status: "accepted", onchainTaskId, statusUrl }`
- Payment notify route now forwards downstream statuses (including `409`) without collapsing to `500`.
- Added tests proving route proxy/shape behavior.

How it enables integration:
- Marketmaker becomes the single dispatch gateway between frontend selection and agent worker execution.

### 3.3 ExampleAgents worker changes

Files:
- `exampleagents/example-agents-worker.js`
- `exampleagents/wrangler.toml`
- `exampleagents/README.md`

Changes:
- Added ERC8001 payload parsing in task creation path (`parseErc8001Request`).
- For ERC8001 tasks, worker forces async processing and queue execution.
- Queue processor now performs on-chain agent lifecycle:
  1. `acceptTask(taskId, stakeAmountWei)` if task is still `Created`.
  2. If unpaid, persists `awaitingPaymentAlert=true` and exits without failure.
  3. Resumes only when client calls `POST /{agentId}/erc8001/payment-deposited`.
  4. Verifies on-chain `paymentDeposited(taskId)` on alert (returns `409` if false).
  5. Execute task via existing Venice pipeline.
  6. Persist result in D1.
  7. Build absolute `resultURI` (`/{agentId}/tasks/{runId}` under public base URL).
  8. `assertCompletion(taskId, resultPayload, resultURI)`.
- Added signer bootstrap for on-chain agent transactions:
  - Uses `AGENT_EVM_PRIVATE_KEY` + RPC/escrow env config.
- Added metadata persistence for observability in `response_meta_json`.

Worker env/config additions:
- `AGENT_EVM_PRIVATE_KEY` (secret)
- `ERC8001_CHAIN_ID`
- `ERC8001_RPC_URL`
- `ERC8001_ESCROW_ADDRESS`
- `ERC8001_PUBLIC_BASE_URL`

How it enables integration:
- The selected off-chain agent route now performs real on-chain acceptance and completion assertions tied to the same task id the frontend created.

### 3.4 Frontend request flow changes

Files:
- `frontend/src/app/page.tsx`
- `frontend/src/lib/api/marketMaker.ts`
- `frontend/src/hooks/useAgentSDK.ts`
- `frontend/src/config/constants.ts`

Changes:
- Added marketmaker dispatch client API:
  - `dispatchErc8001Task(...)`
- Added payment notify client API:
  - `notifyErc8001PaymentDeposited(...)`
- `Request Task` flow updated to:
  1. create on-chain task
  2. dispatch selected agent through marketmaker
- Added manual payment UX gate:
  - `Deposit Payment` button shown only when task is `Accepted` and unpaid.
- Added chain polling for active task:
  - reads full task + `paymentDeposited`
  - tracks status progression
  - fetches result payload from on-chain `resultURI` when asserted
- Added task dispatch metadata storage:
  - `taskId -> { agentId, runId }` for later payment notification and retries.
- SDK hook configured with escrow address, chain, marketmaker URL, and deployment block.

How it enables integration:
- Frontend drives client-side on-chain actions and tracks canonical chain state instead of inferred off-chain status.

### 3.5 Frontend activity + post-task controls

Files:
- `frontend/src/components/TaskActivity.tsx`
- `frontend/src/components/TaskContestationActions.tsx`
- `frontend/src/lib/contestation.ts`
- `frontend/src/hooks/useEscrowTiming.ts`

Changes:
- Activity view upgraded from summary row to interactive details modal with full on-chain fields:
  - status, timestamps, token/amounts, bonds, URIs, UMA assertion id, payment deposited.
- Added Activity modal action parity with request page:
  - manual `Deposit Payment` for accepted/unpaid tasks with client-wallet gating.
- Added contestation controls for demo/testing:
  - dispute (URI input required)
  - settle agent conceded
  - countdown/timing/eligibility logic from shared helper.
- Added escrow timing hook to read on-chain:
  - `agentResponseWindow`
  - `disputeBondBps`

How it enables integration:
- Users can complete full task lifecycle actions from Activity, not only from initial request flow.

### 3.6 Test and flow tooling updates

Files:
- `contracts/script/run-testnet-flow.ts`
- `contracts/package.json`
- `contracts/.env.example`

Changes:
- Extended scripted testnet flows for happy and non-happy paths:
  - Path A (no contest)
  - Path B concede
  - Path B UMA variants
  - Path C timeout cancellation
  - Path D cannot complete
- Added convenience scripts for path-specific runs.
- Added env loading behavior for IPFS credentials fallback (`sdk/.env`) and docs in `.env.example`.

How it enables integration:
- End-to-end verification can be repeated reliably across the integrated services.

## 4) Interfaces introduced/updated

### Frontend -> Marketmaker

`POST /api/agents/:agentId/erc8001/dispatch`

Request:
```json
{
  "onchainTaskId": "123",
  "input": "user prompt",
  "stakeAmountWei": "1000000000000000",
  "skill": "optional"
}
```

Response:
```json
{
  "agentId": "1",
  "runId": "uuid",
  "status": "accepted",
  "onchainTaskId": "123",
  "statusUrl": "/1/tasks/uuid"
}
```

### Frontend -> Marketmaker (payment alert)

`POST /api/agents/:agentId/erc8001/payment-deposited`

Request:
```json
{
  "onchainTaskId": "123"
}
```

Success response:
```json
{
  "agentId": "1",
  "onchainTaskId": "123",
  "status": "queued"
}
```

Early notify response:
- HTTP `409` with deterministic `payment_not_deposited` error payload.

### Marketmaker -> ExampleAgents

Forwarded payload shape:
```json
{
  "task": {
    "input": "...",
    "skill": "...",
    "model": "..."
  },
  "erc8001": {
    "taskId": "123",
    "stakeAmountWei": "1000000000000000",
    "publicBaseUrl": "https://example-agent....workers.dev"
  }
}
```

## 5) How the chain connection is achieved technically

- The worker initializes an `AgentSDK` using a real EVM signer derived from `AGENT_EVM_PRIVATE_KEY`.
- For each ERC8001-dispatched task:
  - On-chain acceptance is submitted by that signer.
  - Deposit status is checked on demand when client calls payment alert endpoint.
  - Completion is asserted on-chain by the same signer with signed result hash + `resultURI`.
- Frontend independently polls escrow task state to avoid trusting worker-only state.
- Result retrieval is decoupled from chain writes:
  - chain stores `resultURI`
  - frontend fetches payload from URI

## 6) Explicitly not changed

- No modifications were made to smart contracts to support this integration.
- Existing escrow function semantics/order were preserved.

## 7) Current known limitations

- Activity history source is currently localStorage task IDs, then each task is refreshed from chain when viewed.
- In this execution environment, Node/npm were unavailable, so frontend build validation must be run locally.
