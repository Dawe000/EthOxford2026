import { ethers } from "hardhat";

/**
 * Debug Firelight Vault - Check why deposit is reverting
 */

const FIRELIGHT_VAULT = "0x91Bfe6A68aB035DFebb6A770FFfB748C03C0E40B";
const FTESTXRP = "0x0b6A3645c240605887a5532109323A3E12273dc7";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const VAULT_ABI = [
  "function asset() external view returns (address)",
  "function deposit(uint256 assets, address receiver) external returns (uint256)",
  "function maxDeposit(address owner) external view returns (uint256)",
  "function previewDeposit(uint256 assets) external view returns (uint256)",
  "function totalAssets() external view returns (uint256)",
  "function currentPeriod() external view returns (uint256)",
  "function nextPeriodEnd() external view returns (uint256)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("=== Firelight Vault Debug ===");
  console.log("Signer:", signerAddress);

  const fxrp = new ethers.Contract(FTESTXRP, ERC20_ABI, signer);
  const vault = new ethers.Contract(FIRELIGHT_VAULT, VAULT_ABI, signer);

  const decimals = await fxrp.decimals();

  // Check asset
  const asset = await vault.asset();
  console.log(`\n✅ Vault asset: ${asset}`);
  console.log(`   Expected: ${FTESTXRP}`);
  console.log(`   Match: ${asset.toLowerCase() === FTESTXRP.toLowerCase()}`);

  // Check balances
  const fxrpBalance = await fxrp.balanceOf(signerAddress);
  console.log(`\n💵 FXRP balance: ${ethers.formatUnits(fxrpBalance, decimals)}`);

  // Check allowance
  const allowance = await fxrp.allowance(signerAddress, FIRELIGHT_VAULT);
  console.log(`🔐 Allowance: ${ethers.formatUnits(allowance, decimals)}`);

  // Check maxDeposit
  try {
    const maxDeposit = await vault.maxDeposit(signerAddress);
    console.log(`\n📥 Max deposit: ${maxDeposit === ethers.MaxUint256 ? "Unlimited" : ethers.formatUnits(maxDeposit, decimals)}`);
  } catch (e: any) {
    console.log(`\n❌ maxDeposit() failed: ${e.message}`);
  }

  // Check period info (if available)
  try {
    const currentPeriod = await vault.currentPeriod();
    const nextPeriodEnd = await vault.nextPeriodEnd();
    console.log(`\n📅 Current period: ${currentPeriod}`);
    console.log(`⏰ Next period end: ${nextPeriodEnd} (${new Date(Number(nextPeriodEnd) * 1000).toISOString()})`);
  } catch (e: any) {
    console.log(`\n⚠️  Period info not available (functions may not exist)`);
  }

  // Try small deposit
  const smallAmount = ethers.parseUnits("0.1", decimals);
  console.log(`\n🧪 Testing small deposit: ${ethers.formatUnits(smallAmount, decimals)} FXRP`);

  try {
    const preview = await vault.previewDeposit(smallAmount);
    console.log(`   Preview: ${ethers.formatUnits(preview, decimals)} fFXRP`);
  } catch (e: any) {
    console.log(`   ❌ Preview failed: ${e.message}`);
  }

  // Try calling with static call to get revert reason
  console.log(`\n🔍 Trying static call to get revert reason...`);
  try {
    await vault.deposit.staticCall(smallAmount, signerAddress);
    console.log(`   ✅ Static call succeeded - deposit should work!`);
  } catch (e: any) {
    console.log(`   ❌ Static call failed:`);
    console.log(`   ${e.message}`);

    // Try to decode revert reason
    if (e.data) {
      console.log(`   Raw error data: ${e.data}`);

      // Common ERC-4626 revert reasons
      if (e.data.includes("0x6fad7612")) {
        console.log(`   → ERC4626ExceededMaxDeposit`);
      } else if (e.data.includes("0x936941fc")) {
        console.log(`   → ERC4626ExceededMaxMint`);
      }
    }
  }

  // Check if FXRP contract is correct
  console.log(`\n🔍 Checking FXRP contract...`);
  try {
    const fxrpDecimals = await fxrp.decimals();
    console.log(`   Decimals: ${fxrpDecimals}`);

    const fxrpBalance2 = await fxrp.balanceOf(signerAddress);
    console.log(`   Balance check: ${ethers.formatUnits(fxrpBalance2, decimals)}`);
  } catch (e: any) {
    console.log(`   ❌ FXRP contract issue: ${e.message}`);
  }

  // Check vault total assets
  try {
    const totalAssets = await vault.totalAssets();
    console.log(`\n📦 Vault total assets: ${ethers.formatUnits(totalAssets, decimals)} FXRP`);
  } catch (e: any) {
    console.log(`\n❌ totalAssets() failed: ${e.message}`);
  }
}

main().catch(console.error);
