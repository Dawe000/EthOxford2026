import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";

/**
 * Firelight Vault Integration Tests
 * Tests ERC-4626 vault operations: deposit, mint, withdraw, redeem
 *
 * Note: These tests simulate Firelight Vault behavior locally.
 * For full integration testing, deploy to Coston2 and test against real vault.
 */
describe("Firelight Vault Integration", function () {
  let vault: Contract;
  let fxrp: Contract;
  let agent: SignerWithAddress;
  let client: SignerWithAddress;

  const INITIAL_FXRP = ethers.parseUnits("10000", 6); // 10k FXRP (6 decimals)
  const DEPOSIT_AMOUNT = ethers.parseUnits("1000", 6); // 1k FXRP

  beforeEach(async function () {
    [agent, client] = await ethers.getSigners();

    // Deploy mock FXRP token (6 decimals like real FTestXRP)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    fxrp = await MockERC20.deploy("FTest XRP", "FXRP", 6);
    await fxrp.waitForDeployment();

    // Deploy mock ERC-4626 vault
    const MockVault = await ethers.getContractFactory("MockERC4626Vault");
    vault = await MockVault.deploy(await fxrp.getAddress(), "Firelight FXRP", "fFXRP");
    await vault.waitForDeployment();

    // Mint FXRP to agent
    await fxrp.mint(agent.address, INITIAL_FXRP);
  });

  describe("Deposit & Mint (Instant Operations)", function () {
    it("should deposit FXRP and receive fFXRP shares (1:1 ratio initially)", async function () {
      // Approve vault
      await fxrp.connect(agent).approve(await vault.getAddress(), DEPOSIT_AMOUNT);

      // Deposit FXRP
      const tx = await vault.connect(agent).deposit(DEPOSIT_AMOUNT, agent.address);
      await tx.wait();

      // Check fFXRP balance (should be 1:1 initially)
      const fFXRPBalance = await vault.balanceOf(agent.address);
      expect(fFXRPBalance).to.equal(DEPOSIT_AMOUNT);

      // Check FXRP was transferred
      const fxrpBalance = await fxrp.balanceOf(agent.address);
      expect(fxrpBalance).to.equal(INITIAL_FXRP - DEPOSIT_AMOUNT);
    });

    it("should mint exact fFXRP shares for calculated FXRP amount", async function () {
      const desiredShares = ethers.parseUnits("500", 6); // Want 500 fFXRP

      // Preview how much FXRP needed
      const assetsNeeded = await vault.previewMint(desiredShares);

      // Approve and mint
      await fxrp.connect(agent).approve(await vault.getAddress(), assetsNeeded);
      await vault.connect(agent).mint(desiredShares, agent.address);

      // Check exact shares received
      const fFXRPBalance = await vault.balanceOf(agent.address);
      expect(fFXRPBalance).to.equal(desiredShares);
    });

    it("should handle deposit with yield (exchange rate > 1)", async function () {
      // Initial deposit
      await fxrp.connect(agent).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(agent).deposit(DEPOSIT_AMOUNT, agent.address);

      // Simulate yield by sending FXRP to vault
      const yieldAmount = ethers.parseUnits("100", 6); // 10% yield
      await fxrp.mint(await vault.getAddress(), yieldAmount);

      // Second deposit should get fewer shares (exchange rate > 1)
      await fxrp.connect(agent).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      const sharesBefore = await vault.balanceOf(agent.address);

      await vault.connect(agent).deposit(DEPOSIT_AMOUNT, agent.address);

      const sharesAfter = await vault.balanceOf(agent.address);
      const sharesReceived = sharesAfter - sharesBefore;

      // Should receive less than 1:1 due to yield
      expect(sharesReceived).to.be.lt(DEPOSIT_AMOUNT);
    });
  });

  describe("Redeem (Delayed Operation)", function () {
    beforeEach(async function () {
      // Setup: Agent has fFXRP shares
      await fxrp.connect(agent).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(agent).deposit(DEPOSIT_AMOUNT, agent.address);
    });

    it("should redeem fFXRP shares for FXRP", async function () {
      const sharesToRedeem = ethers.parseUnits("500", 6);

      // Preview redemption
      const expectedFXRP = await vault.previewRedeem(sharesToRedeem);

      // Redeem shares
      await vault.connect(agent).redeem(sharesToRedeem, agent.address, agent.address);

      // Check FXRP received
      const fxrpBalance = await fxrp.balanceOf(agent.address);
      const expectedBalance = INITIAL_FXRP - DEPOSIT_AMOUNT + expectedFXRP;
      expect(fxrpBalance).to.equal(expectedBalance);

      // Check fFXRP burned
      const fFXRPBalance = await vault.balanceOf(agent.address);
      expect(fFXRPBalance).to.equal(DEPOSIT_AMOUNT - sharesToRedeem);
    });

    it("should redeem with yield (receive more FXRP than deposited)", async function () {
      const initialFXRPBalance = await fxrp.balanceOf(agent.address);

      // Simulate yield
      const yieldAmount = ethers.parseUnits("100", 6); // 10% yield
      await fxrp.mint(await vault.getAddress(), yieldAmount);

      // Redeem all shares
      const allShares = await vault.balanceOf(agent.address);
      await vault.connect(agent).redeem(allShares, agent.address, agent.address);

      // Should receive original deposit + yield
      const finalFXRPBalance = await fxrp.balanceOf(agent.address);
      expect(finalFXRPBalance).to.be.gt(initialFXRPBalance);
      expect(finalFXRPBalance).to.equal(INITIAL_FXRP + yieldAmount);
    });
  });

  describe("Withdraw (Delayed Operation)", function () {
    beforeEach(async function () {
      await fxrp.connect(agent).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(agent).deposit(DEPOSIT_AMOUNT, agent.address);
    });

    it("should withdraw specific FXRP amount by burning shares", async function () {
      const withdrawAmount = ethers.parseUnits("500", 6);

      // Preview shares to burn
      const sharesToBurn = await vault.previewWithdraw(withdrawAmount);

      // Withdraw
      await vault.connect(agent).withdraw(withdrawAmount, agent.address, agent.address);

      // Check FXRP received
      const fxrpBalance = await fxrp.balanceOf(agent.address);
      expect(fxrpBalance).to.equal(INITIAL_FXRP - DEPOSIT_AMOUNT + withdrawAmount);

      // Check shares burned
      const fFXRPBalance = await vault.balanceOf(agent.address);
      expect(fFXRPBalance).to.equal(DEPOSIT_AMOUNT - sharesToBurn);
    });
  });

  describe("Exchange Rate & Conversions", function () {
    it("should calculate correct exchange rate after yield", async function () {
      // Deposit
      await fxrp.connect(agent).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(agent).deposit(DEPOSIT_AMOUNT, agent.address);

      // Initial rate should be 1:1
      const oneShare = ethers.parseUnits("1", 6);
      let fxrpPerShare = await vault.convertToAssets(oneShare);
      expect(fxrpPerShare).to.equal(oneShare);

      // Add yield
      const yieldAmount = ethers.parseUnits("100", 6);
      await fxrp.mint(await vault.getAddress(), yieldAmount);

      // Rate should increase
      fxrpPerShare = await vault.convertToAssets(oneShare);
      expect(fxrpPerShare).to.be.gt(oneShare);
    });

    it("should convert between shares and assets correctly", async function () {
      await fxrp.connect(agent).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(agent).deposit(DEPOSIT_AMOUNT, agent.address);

      // Convert shares → assets
      const shares = ethers.parseUnits("100", 6);
      const assets = await vault.convertToAssets(shares);

      // Convert assets → shares (should match original)
      const sharesBack = await vault.convertToShares(assets);
      expect(sharesBack).to.equal(shares);
    });
  });

  describe("Agent Workflow: Deposit → Task → Redeem", function () {
    it("should earn yield while fFXRP is used as collateral", async function () {
      const stakeAmount = ethers.parseUnits("100", 6);

      // 1. Agent deposits FXRP to vault
      await fxrp.connect(agent).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(agent).deposit(DEPOSIT_AMOUNT, agent.address);

      const initialShares = await vault.balanceOf(agent.address);

      // 2. Simulate: Agent stakes fFXRP as collateral in escrow
      // (In real system, agent would call escrow.acceptTask with fFXRP)
      // Here we just track that fFXRP is "locked"
      const lockedShares = stakeAmount;

      // 3. Simulate: Task execution time + yield accrual
      const yieldDuringTask = ethers.parseUnits("50", 6); // 5% yield
      await fxrp.mint(await vault.getAddress(), yieldDuringTask);

      // 4. Simulate: Task completes, fFXRP returned to agent
      // Agent still has all shares, but they're worth more now

      // 5. Agent redeems shares
      await vault.connect(agent).redeem(initialShares, agent.address, agent.address);

      // Agent should receive original deposit + yield
      const finalFXRPBalance = await fxrp.balanceOf(agent.address);
      expect(finalFXRPBalance).to.equal(INITIAL_FXRP + yieldDuringTask);
    });
  });

  describe("Validation & Edge Cases", function () {
    it("should revert if trying to deposit more than balance", async function () {
      const tooMuch = INITIAL_FXRP + ethers.parseUnits("1", 6);
      await fxrp.connect(agent).approve(await vault.getAddress(), tooMuch);

      await expect(
        vault.connect(agent).deposit(tooMuch, agent.address)
      ).to.be.reverted;
    });

    it("should revert if trying to redeem more shares than owned", async function () {
      await fxrp.connect(agent).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(agent).deposit(DEPOSIT_AMOUNT, agent.address);

      const tooManyShares = DEPOSIT_AMOUNT + ethers.parseUnits("1", 6);

      await expect(
        vault.connect(agent).redeem(tooManyShares, agent.address, agent.address)
      ).to.be.reverted;
    });

    it("should handle zero deposits correctly", async function () {
      await expect(
        vault.connect(agent).deposit(0, agent.address)
      ).to.be.reverted;
    });
  });

  describe("Multi-User Scenarios", function () {
    it("should handle multiple users with independent shares", async function () {
      // Agent deposits
      await fxrp.connect(agent).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(agent).deposit(DEPOSIT_AMOUNT, agent.address);

      // Client deposits
      await fxrp.mint(client.address, DEPOSIT_AMOUNT);
      await fxrp.connect(client).approve(await vault.getAddress(), DEPOSIT_AMOUNT);
      await vault.connect(client).deposit(DEPOSIT_AMOUNT, client.address);

      // Both should have shares
      const agentShares = await vault.balanceOf(agent.address);
      const clientShares = await vault.balanceOf(client.address);

      expect(agentShares).to.be.gt(0);
      expect(clientShares).to.be.gt(0);

      // Agent redeems (shouldn't affect client)
      await vault.connect(agent).redeem(agentShares, agent.address, agent.address);

      const clientSharesAfter = await vault.balanceOf(client.address);
      expect(clientSharesAfter).to.equal(clientShares);
    });
  });
});
