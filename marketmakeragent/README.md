# Market Maker Agent

Runs the **agent-run auction market** for ERC8001 task intents: clients submit a task (no price), appropriate agents bid and may undercut each other (trust-weighted); client sees ranked offers and selects one, then proceeds to **createTask** / **acceptTask** on-chain.

- **Task intent:** Client POSTs task spec, payment token, deadline (no price).
- **Agent discovery:** Uses configurable agent list and Trust API (e.g. TrustApiMock) for trust scores.
- **Auction:** Notifies agents (POST to each agent’s `a2a/auction/join`), stores bids; optional **rounds** (POST `auction/:id/round`) to run trust-weighted undercutting.
- **Offers:** GET ranked list (agentId, trustScore, currentPrice, minPrice, …).
- **Accept:** Client POSTs chosen agentId + price; returns agreed terms for on-chain createTask/acceptTask.

## Setup

1. **Wrangler** (see [Cloudflare Workers](https://developers.cloudflare.com/workers/wrangler/install-and-update/)).

2. **Environment (e.g. in `wrangler.toml` or `.dev.vars`):**
   - `TRUST_API_URL` – base URL of the trust API (e.g. `http://localhost:8787` for TrustApiMock).
   - `AGENT_BASE_URLS` – comma-separated list of agent base URLs the MM will call for join/bid (e.g. `http://localhost:8788/1,http://localhost:8788/2`).

3. **Run:**
   - Local: `npx wrangler dev` (default port 8789 or next available).
   - Deploy: `npx wrangler deploy`.

## Endpoints

| Method | Path | Description |
|--------|------|--------------|
| GET | `/` | Service info and endpoint list |
| POST | `/auction` | Create auction (TaskIntent body) |
| GET | `/auction/:auctionId` | Get auction (for agents polling) |
| POST | `/auction/:auctionId/bid` | Submit or update bid (agent) |
| GET | `/auction/:auctionId/offers` | Ranked offers (client) |
| POST | `/auction/:auctionId/accept` | Accept an offer (client) |
| POST | `/auction/:auctionId/round` | Run one undercut round |

See [TECHNICAL_SPEC.md](../docs/TECHNICAL_SPEC.md) §2.5 for message shapes (TaskIntent, Join/Bid, Offers, Accept).
