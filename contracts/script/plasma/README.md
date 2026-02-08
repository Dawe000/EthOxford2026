# Plasma Testnet Scripts

Scripts for deploying and testing on Plasma testnet (chain ID 13473).

## Prerequisites

```bash
cd contracts
npm install
```

## Scripts

### 1. Deploy to Plasma Testnet

Deploy complete contract suite (AgentTaskEscrow, MockOOv3, and optionally MockERC20).

**Option A – Mock token (default):** Deploys MockERC20, mints to client/agent, escrow whitelists it.

```bash
npx hardhat run script/plasma/deploy-plasma-testnet.ts --network plasma-testnet
```

**Option B – Testnet USDT only:** Escrow whitelists only the official Plasma testnet USDT (no mock token, no mint). Client and agent must hold testnet USDT separately.

```bash
PLASMA_USE_TESTNET_USDT=1 npx hardhat run script/plasma/deploy-plasma-testnet.ts --network plasma-testnet
```

Testnet USDT0 contract address: `0x502012b361AebCE43b26Ec812B74D9a51dB4D412` ([testnet.plasmascan.to](https://testnet.plasmascan.to/token/0x502012b361AebCE43b26Ec812B74D9a51dB4D412)).

Default deploy deploys:
- MockERC20 (test token)
- MockOptimisticOracleV3
- AgentTaskEscrow

### 2. Deploy to Sandbox (Local Hardhat Network)

Deploy contracts to local Hardhat network for development.

```bash
npx hardhat run script/plasma/deploy-sandbox.ts
```

### 3. Mint Testnet Tokens

Mint mock USDC tokens for testing on Plasma.

```bash
npx hardhat run script/plasma/mint-testnet-tokens.ts --network plasma-testnet
```

### 4. Print Testnet Addresses

Display deployed contract addresses from Plasma testnet.

```bash
npx hardhat run script/plasma/print-testnet-addresses.ts --network plasma-testnet
```

### 5. Run Complete E2E Flow

Execute full task lifecycle on Plasma testnet.

```bash
# Path A: Happy path (no disputes)
cd contracts
npm run testnet:flow:path-a

# Path B: Client disputes
npm run testnet:flow:path-b

# Path C: Agent escalates to UMA
npm run testnet:flow:path-c
```

**What it does**:
1. Creates a task with USDC payment
2. Agent accepts and stakes USDC
3. Agent completes task
4. Settlement (varies by path)

## Network Configuration

**Plasma Testnet**
- Network name: `plasma-testnet`
- Chain ID: `9746`
- RPC: `https://testnet-rpc.plasma.to` (or `PLASMA_RPC_URL` in .env)
- Native Token: ETH

## Common Workflows

### Initial Setup
```bash
# 1. Deploy contracts
npx hardhat run script/plasma/deploy-plasma-testnet.ts --network plasma-testnet

# 2. Mint test tokens
npx hardhat run script/plasma/mint-testnet-tokens.ts --network plasma-testnet

# 3. Check deployment
npx hardhat run script/plasma/print-testnet-addresses.ts --network plasma-testnet
```

### Test E2E Flow
```bash
cd contracts
npm run testnet:flow:path-a
```

## Flow Paths

### Path A: Happy Path
- Client creates task
- Agent accepts with stake
- Agent completes task
- 24hr cooldown
- Settlement (agent receives payment + stake back)

### Path B: Client Dispute (no UMA)
- `npm run testnet:flow:path-b-concede` – client disputes, agent does nothing, after response window client calls `settleAgentConceded`. No DVM.

### Path B: UMA escalation (test DVM)
- `npm run testnet:flow:path-b-uma-escalate` – client disputes, agent escalates to UMA, then **DVM worker** (cron) resolves via `pushResolution`. Requires:
  - **PINATA_JWT** in `contracts/.env` or `sdk/.env` (IPFS uploads for dispute/evidence).
  - **Agent** must have USDT0 for **escalation bond**: `max(1% of payment, umaConfig.minimumBond)`. Current testnet escrow uses `minimumBond = 1e18` (for 18‑decimal tokens). With **USDT0 (6 decimals)** that is 1e18 raw = 1e12 USDT, so escalation will fail unless you redeploy escrow with a lower `UMA_MINIMUM_BOND` (e.g. `1e6` = 1 USDT in 6 decimals).
- After the script escalates, ensure the **DVM worker** is deployed and its cron runs (or trigger manually); it will call `pushResolution` on MockOOv3. The script polls until task status is Resolved (or 10 min timeout).

### Path C: UMA Escalation
- Client creates task
- Agent accepts with stake
- Agent asserts completion
- Client disputes
- Agent escalates to UMA
- UMA oracle resolves dispute
- Settlement based on oracle result

## Troubleshooting

### Deployment Fails
- Check you have ETH on Plasma testnet (for gas)
- Set `MNEMONIC` or `DEPLOYER_PRIVATE_KEY` in `contracts/.env`
- Verify RPC: `PLASMA_RPC_URL` or default `https://testnet-rpc.plasma.to`

### Transaction Reverts
- Ensure contracts are deployed first
- Check you have minted test tokens
- Verify allowances are set correctly
