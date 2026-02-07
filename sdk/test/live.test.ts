/**
 * Live tests - run against Plasma testnet (chainId 9746).
 *
 * Setup:
 * 1. Set SDK_LIVE_TESTNET=1 and MNEMONIC in env
 * 2. Ensure client/agent addresses are funded
 *
 * Skip unless SDK_LIVE_TESTNET=1 and MNEMONIC are set.
 * Optional: SDK_LIVE_RUN_FLOW=1 to run a full Path A flow (creates task, costs tokens).
 */

import { ethers } from "ethers";
import {
  ClientSDK,
  AgentSDK,
  getPlasmaTestnetConfig,
  getNextTaskId,
  getTask,
  getTasksByClient,
  getTasksByAgent,
  isInProgress,
  isContested,
  isResolved,
  TaskStatus,
} from "../src/index.js";

const MNEMONIC = process.env.MNEMONIC;
const SDK_LIVE_TESTNET = process.env.SDK_LIVE_TESTNET === "1";
const SDK_LIVE_RUN_FLOW = process.env.SDK_LIVE_RUN_FLOW === "1";

function getSigner(index: number): ethers.Wallet {
  const cfg = getPlasmaTestnetConfig();
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
  const m = ethers.Mnemonic.fromPhrase(MNEMONIC!.trim());
  const root = ethers.HDNodeWallet.fromSeed(m.computeSeed());
  const derived = root.derivePath(`m/44'/60'/0'/0/${index}`);
  return derived.connect(provider);
}

const describeLive =
  SDK_LIVE_TESTNET && MNEMONIC?.trim() ? describe : describe.skip;

describeLive("SDK live (Plasma testnet)", () => {
  let client: ethers.Wallet;
  let agent: ethers.Wallet;
  let clientSdk: ClientSDK;
  let agentSdk: AgentSDK;
  let config: ReturnType<typeof getPlasmaTestnetConfig>;

  beforeAll(() => {
    config = getPlasmaTestnetConfig();
    client = getSigner(1);
    agent = getSigner(2);
    clientSdk = new ClientSDK(config, client);
    agentSdk = new AgentSDK(config, agent);
  });

  it("getNextTaskId returns a number", async () => {
    const nextId = await getNextTaskId(config.escrowAddress, client.provider!);
    expect(typeof nextId).toBe("bigint");
    expect(nextId >= 0n).toBe(true);
  });

  it("getTask fetches existing task when taskId < nextTaskId", async () => {
    const nextId = await getNextTaskId(config.escrowAddress, client.provider!);
    if (nextId === 0n) {
      expect(await getTasksByClient(config.escrowAddress, client.provider!, client.address)).toEqual([]);
      return;
    }
    const task = await getTask(config.escrowAddress, client.provider!, 0n);
    expect(task).toBeDefined();
    expect(task.id).toBe(0n);
    expect(task.status).toBeDefined();
    expect(typeof task.client).toBe("string");
    expect(typeof task.agent).toBe("string");
  });

  it("getTasksByClient returns tasks created by client", async () => {
    const tasks = await getTasksByClient(
      config.escrowAddress,
      client.provider!,
      client.address
    );
    expect(Array.isArray(tasks)).toBe(true);
    for (const t of tasks) {
      expect(t.client.toLowerCase()).toBe(client.address.toLowerCase());
    }
  });

  it("getTasksByAgent returns tasks accepted by agent", async () => {
    const tasks = await getTasksByAgent(
      config.escrowAddress,
      agent.provider!,
      agent.address
    );
    expect(Array.isArray(tasks)).toBe(true);
    for (const t of tasks) {
      expect(t.agent.toLowerCase()).toBe(agent.address.toLowerCase());
    }
  });

  it("clientSdk.getMyTasks and agentSdk.getMyTasks work", async () => {
    const clientTasks = await clientSdk.getMyTasks();
    const agentTasks = await agentSdk.getMyTasks();
    expect(Array.isArray(clientTasks)).toBe(true);
    expect(Array.isArray(agentTasks)).toBe(true);
  });

  it("status helpers work on a task", async () => {
    const nextId = await getNextTaskId(config.escrowAddress, client.provider!);
    if (nextId === 0n) return;
    const task = await getTask(config.escrowAddress, client.provider!, 0n);
    expect(isInProgress(task) || isResolved(task) || isContested(task)).toBe(true);
    if (task.status === TaskStatus.Resolved) {
      expect(isResolved(task)).toBe(true);
    }
  });

  it("getTasksNeedingAction returns array", async () => {
    const clientActions = await clientSdk.getTasksNeedingAction();
    const agentActions = await agentSdk.getTasksNeedingAction();
    expect(Array.isArray(clientActions)).toBe(true);
    expect(Array.isArray(agentActions)).toBe(true);
  });
});

const describeLiveFlow = SDK_LIVE_RUN_FLOW && SDK_LIVE_TESTNET && MNEMONIC?.trim()
  ? describe
  : describe.skip;

describeLiveFlow("SDK live Path A flow (Plasma testnet)", () => {
  it("full Path A: create -> accept -> deposit -> assert -> settle", async () => {
    const config = getPlasmaTestnetConfig();
    const client = getSigner(1);
    const agent = getSigner(2);
    const clientSdk = new ClientSDK(config, client);
    const agentSdk = new AgentSDK(config, agent);

    const tokenAddr = config.mockTokenAddress!;
    const paymentAmount = ethers.parseEther("100");
    const stakeAmount = ethers.parseEther("10");
    const deadline = Math.floor(Date.now() / 1000) + 86400;

    const taskId = await clientSdk.createTask(
      "ipfs://description",
      tokenAddr,
      paymentAmount,
      deadline
    );

    await agentSdk.acceptTask(taskId, stakeAmount);
    await clientSdk.depositPayment(taskId);
    await agentSdk.assertCompletion(taskId, "Task completed successfully");

    const COOLDOWN = 180;
    await new Promise((r) => setTimeout(r, (COOLDOWN + 5) * 1000));

    await agentSdk.settleNoContest(taskId);

    const token = new ethers.Contract(
      tokenAddr,
      ["function balanceOf(address) view returns (uint256)"],
      agent.provider
    );
    const balance = await token.balanceOf(agent.address);
    expect(balance).toBeGreaterThan(0n);
  }, 300000);
});
