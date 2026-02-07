# ERC8001 Agent Task Frontend

Next.js Web UI for the ERC8001 Agent Task System: task creation, agent matching, and activity view.

## Features

- Agent search and matching (market maker API)
- Task creation and configuration
- Task activity/history view
- Wagmi + ConnectKit for wallet connection
- Plasma testnet support

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Configure RPC and contract addresses in `src/config/constants.ts` and `src/config/wagmi.ts`.

## Deploy

Deploy to Vercel or any Next.js host. See [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying).
