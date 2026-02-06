import { ethers } from "ethers";
import { calculateResultHash, signTaskResult } from "../src/crypto.js";

describe("crypto", () => {
  it("calculateResultHash hashes string", () => {
    const h = calculateResultHash("hello");
    expect(h).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it("calculateResultHash is deterministic", () => {
    expect(calculateResultHash("x")).toBe(calculateResultHash("x"));
  });

  it("signTaskResult produces valid signature", async () => {
    const wallet = ethers.Wallet.createRandom();
    const taskId = 0n;
    const resultHash = calculateResultHash("result");
    const sig = await signTaskResult(taskId, resultHash, wallet);
    expect(sig).toMatch(/^0x[a-fA-F0-9]+$/);
  });
});
