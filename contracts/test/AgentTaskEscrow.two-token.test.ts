import { expect } from "chai";
import { ethers } from "hardhat";
import { deployFixture } from "./helpers/fixtures";
import { advanceCooldown, advancePastDeadline } from "./helpers/time";
import { calculateResultHash, signTaskResult } from "./helpers/crypto";

describe("AgentTaskEscrow - Two-token (payment vs stake)", function () {
  it("happy path: payment in paymentToken, stake in stakeToken, agent receives both correctly", async function () {
    const { escrow, mockToken, client, agent } = await deployFixture();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const stakeToken = await MockERC20.deploy("Stake Token", "STAKE", 18);
    await stakeToken.waitForDeployment();

    const mintAmount = ethers.parseEther("1000000");
    await stakeToken.mint(await agent.getAddress(), mintAmount);

    const paymentAmount = ethers.parseEther("100");
    const stakeAmount = ethers.parseEther("10");
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    const paymentTokenAddr = await mockToken.getAddress();
    const stakeTokenAddr = await stakeToken.getAddress();

    await escrow.connect(client).createTask(
      "ipfs://description",
      paymentTokenAddr,
      paymentAmount,
      deadline,
      stakeTokenAddr
    );

    await stakeToken.connect(agent).approve(await escrow.getAddress(), stakeAmount);
    await escrow.connect(agent).acceptTask(0, stakeAmount);

    await mockToken.connect(client).approve(await escrow.getAddress(), paymentAmount);
    await escrow.connect(client).depositPayment(0);

    const resultHash = calculateResultHash("Task completed");
    const signature = await signTaskResult(0n, resultHash, agent);
    await escrow.connect(agent).assertCompletion(0, resultHash, signature, "");

    await advanceCooldown();

    const agentPaymentBefore = await mockToken.balanceOf(await agent.getAddress());
    const agentStakeBefore = await stakeToken.balanceOf(await agent.getAddress());
    await escrow.connect(agent).settleNoContest(0);
    const agentPaymentAfter = await mockToken.balanceOf(await agent.getAddress());
    const agentStakeAfter = await stakeToken.balanceOf(await agent.getAddress());

    expect(agentPaymentAfter - agentPaymentBefore).to.equal(paymentAmount);
    expect(agentStakeAfter - agentStakeBefore).to.equal(stakeAmount);
  });

  it("timeoutCancellation: client receives payment in paymentToken, slashed stake in stakeToken", async function () {
    const { escrow, mockToken, client, agent } = await deployFixture();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const stakeToken = await MockERC20.deploy("Stake Token", "STAKE", 18);
    await stakeToken.waitForDeployment();
    await stakeToken.mint(await agent.getAddress(), ethers.parseEther("1000000"));

    const paymentAmount = ethers.parseEther("100");
    const stakeAmount = ethers.parseEther("10");
    const deadline = Math.floor(Date.now() / 1000) + 60;
    const paymentTokenAddr = await mockToken.getAddress();
    const stakeTokenAddr = await stakeToken.getAddress();

    await escrow.connect(client).createTask(
      "ipfs://description",
      paymentTokenAddr,
      paymentAmount,
      deadline,
      stakeTokenAddr
    );

    await stakeToken.connect(agent).approve(await escrow.getAddress(), stakeAmount);
    await escrow.connect(agent).acceptTask(0, stakeAmount);
    await mockToken.connect(client).approve(await escrow.getAddress(), paymentAmount);
    await escrow.connect(client).depositPayment(0);

    await advancePastDeadline(deadline);

    const clientPaymentBefore = await mockToken.balanceOf(await client.getAddress());
    const clientStakeBefore = await stakeToken.balanceOf(await client.getAddress());
    await escrow.connect(client).timeoutCancellation(0, "deadline exceeded");
    const clientPaymentAfter = await mockToken.balanceOf(await client.getAddress());
    const clientStakeAfter = await stakeToken.balanceOf(await client.getAddress());

    expect(clientPaymentAfter - clientPaymentBefore).to.equal(paymentAmount);
    expect(clientStakeAfter - clientStakeBefore).to.equal(stakeAmount);
  });

  it("cannotComplete: agent gets stake back in stakeToken, client gets payment in paymentToken", async function () {
    const { escrow, mockToken, client, agent } = await deployFixture();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const stakeToken = await MockERC20.deploy("Stake Token", "STAKE", 18);
    await stakeToken.waitForDeployment();
    await stakeToken.mint(await agent.getAddress(), ethers.parseEther("1000000"));

    const paymentAmount = ethers.parseEther("100");
    const stakeAmount = ethers.parseEther("10");
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    const paymentTokenAddr = await mockToken.getAddress();
    const stakeTokenAddr = await stakeToken.getAddress();

    await escrow.connect(client).createTask(
      "ipfs://description",
      paymentTokenAddr,
      paymentAmount,
      deadline,
      stakeTokenAddr
    );

    await stakeToken.connect(agent).approve(await escrow.getAddress(), stakeAmount);
    await escrow.connect(agent).acceptTask(0, stakeAmount);
    await mockToken.connect(client).approve(await escrow.getAddress(), paymentAmount);
    await escrow.connect(client).depositPayment(0);

    const agentStakeBefore = await stakeToken.balanceOf(await agent.getAddress());
    const clientPaymentBefore = await mockToken.balanceOf(await client.getAddress());
    await escrow.connect(agent).cannotComplete(0, "resource unavailable");
    const agentStakeAfter = await stakeToken.balanceOf(await agent.getAddress());
    const clientPaymentAfter = await mockToken.balanceOf(await client.getAddress());

    expect(agentStakeAfter - agentStakeBefore).to.equal(stakeAmount);
    expect(clientPaymentAfter - clientPaymentBefore).to.equal(paymentAmount);
  });
});
