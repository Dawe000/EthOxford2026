/**
 * SDK configuration
 */

export interface IpfsConfig {
  provider: "pinata" | "nft.storage";
  apiKey: string;
  /** Return ipfs:// or https:// gateway URL (default: ipfs://) */
  uriScheme?: "ipfs" | "https";
}

export interface SDKConfig {
  /** AgentTaskEscrow contract address */
  escrowAddress: string;
  /** Chain ID */
  chainId: number;
  /** RPC URL - optional if provider/signer already has one */
  rpcUrl?: string;
  /** Market maker API base URL (e.g. https://market-maker-agent..../api) */
  marketMakerUrl?: string;
  /** IPFS pinning config - required for createTask with spec, disputeTask, escalateToUMA */
  ipfs?: IpfsConfig;
}

/** Default IPFS URI scheme */
export const DEFAULT_IPFS_URI_SCHEME = "ipfs" as const;
