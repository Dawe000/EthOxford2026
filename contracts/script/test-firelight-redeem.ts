import { ethers } from "hardhat";

/**
 * Test Firelight Vault: Redeem fFXRP → Receive FTestXRP
 *
 * Run: npx hardhat run script/test-firelight-redeem.ts --network coston2
 */

const FIRELIGHT_VAULT = "0x91Bfe6A68aB035DFebb6A770FFfB748C03C0E40B";
const FTESTXRP = "0x0b6A3645c240605887a5532109323A3E12273dc7";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const VAULT_ABI = [
  "function redeem(uint256 shares, address receiver, address owner) external returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function convertToAssets(uint256 shares) external view returns (uint256)",
  "function previewRedeem(uint256 shares) external view returns (uint256)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("=== Firelight Vault Redeem Test ===");
  console.log("Signer:", signerAddress);
  console.log("Vault:", FIRELIGHT_VAULT);

  // Connect to contracts
  const fxrp = new ethers.Contract(FTESTXRP, ERC20_ABI, signer);
  const vault = new ethers.Contract(FIRELIGHT_VAULT, VAULT_ABI, signer);

  const decimals = await fxrp.decimals();

  // Check fFXRP balance
  const fFXRPBalance = await vault.balanceOf(signerAddress);
  console.log(`\n📊 fFXRP Balance: ${ethers.formatUnits(fFXRPBalance, decimals)} fFXRP`);

  if (fFXRPBalance === 0n) {
    console.log("\n⚠️  No fFXRP to redeem! Deposit first using test-firelight-deposit.ts");
    return;
  }

  // Calculate current value
  const currentValue = await vault.convertToAssets(fFXRPBalance);
  console.log(`💎 Current value: ${ethers.formatUnits(currentValue, decimals)} FXRP`);

  // Redeem amount: use half or all
  const redeemAmount = fFXRPBalance / 2n; // Redeem 50%
  console.log(`\n💸 Redeeming: ${ethers.formatUnits(redeemAmount, decimals)} fFXRP`);

  // Preview redemption
  const expectedFXRP = await vault.previewRedeem(redeemAmount);
  console.log(`📈 Expected FXRP: ${ethers.formatUnits(expectedFXRP, decimals)} FXRP`);

  // Check FXRP balance before
  const fxrpBefore = await fxrp.balanceOf(signerAddress);
  console.log(`💵 FXRP before: ${ethers.formatUnits(fxrpBefore, decimals)} FXRP`);

  // Redeem from vault
  console.log("\n🚀 Redeeming from Firelight Vault...");
  console.log("⏳ Note: Firelight uses period-based withdrawals - you may need to wait and claim later!");

  const redeemTx = await vault.redeem(redeemAmount, signerAddress, signerAddress);
  const receipt = await redeemTx.wait();
  console.log("✅ Redeem initiated!");
  console.log(`📝 TX: ${receipt!.hash}`);

  // Check balances after
  const fxrpAfter = await fxrp.balanceOf(signerAddress);
  const fFXRPAfter = await vault.balanceOf(signerAddress);

  console.log(`\n🎉 New fFXRP balance: ${ethers.formatUnits(fFXRPAfter, decimals)} fFXRP`);
  console.log(`💵 New FXRP balance: ${ethers.formatUnits(fxrpAfter, decimals)} FXRP`);

  const fxrpReceived = fxrpAfter - fxrpBefore;
  if (fxrpReceived > 0n) {
    console.log(`✨ FXRP received: ${ethers.formatUnits(fxrpReceived, decimals)} FXRP`);
  } else {
    console.log("\n⚠️  No FXRP received yet - withdrawal may be period-based!");
    console.log("📅 Check pending withdrawals and claim after period ends");
  }

  // Show remaining fFXRP value
  if (fFXRPAfter > 0n) {
    const remainingValue = await vault.convertToAssets(fFXRPAfter);
    console.log(`💎 Remaining fFXRP value: ${ethers.formatUnits(remainingValue, decimals)} FXRP`);
  }
}

main().catch(console.error);
