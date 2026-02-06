import {
  keccak256,
  solidityPacked,
  getBytes,
  toUtf8Bytes,
  type Signer,
} from "ethers";

/**
 * Cryptographic utilities - matches AgentTaskEscrow contract exactly.
 * Contract uses keccak256(abi.encode(taskId, resultHash)) and EIP-191.
 */

/** Hash a task result (string or bytes) to bytes32 */
export function calculateResultHash(result: string | Uint8Array): string {
  const bytes = typeof result === "string" ? toUtf8Bytes(result) : result;
  return keccak256(bytes);
}

/** Sign taskId + resultHash for assertCompletion - EIP-191 personal sign */
export async function signTaskResult(
  taskId: bigint,
  resultHash: string,
  signer: Signer
): Promise<string> {
  const messageHash = keccak256(
    solidityPacked(["uint256", "bytes32"], [taskId, resultHash])
  );
  const signature = await signer.signMessage(getBytes(messageHash));
  return signature;
}
