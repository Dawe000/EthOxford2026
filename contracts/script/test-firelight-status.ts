import { ethers } from "hardhat";

/**
 * Test Firelight Vault: Check Status & Balances
 *
 * Run: npx hardhat run script/test-firelight-status.ts --network coston2
 */

const FIRELIGHT_VAULT = "0x91Bfe6A68aB035DFebb6A770FFfB748C03C0E40B";
const FTESTXRP = "0x0b6A3645c240605887a5532109323A3E12273dc7";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

const VAULT_ABI = [
  "function asset() external view returns (address)",
  "function balanceOf(address account) external view returns (uint256)",
  "function convertToAssets(uint256 shares) external view returns (uint256)",
  "function convertToShares(uint256 assets) external view returns (uint256)",
  "function totalAssets() external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function previewDeposit(uint256 assets) external view returns (uint256)",
  "function previewRedeem(uint256 shares) external view returns (uint256)",
  "function maxDeposit(address owner) external view returns (uint256)",
  "function maxRedeem(address owner) external view returns (uint256)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("=== Firelight Vault Status ===");
  console.log("Signer:", signerAddress);
  console.log("Vault:", FIRELIGHT_VAULT);

  // Connect to contracts
  const fxrp = new ethers.Contract(FTESTXRP, ERC20_ABI, signer);
  const vault = new ethers.Contract(FIRELIGHT_VAULT, VAULT_ABI, signer);

  const decimals = await fxrp.decimals();
  const fxrpName = await fxrp.name();
  const fxrpSymbol = await fxrp.symbol();

  console.log(`\n📦 Asset: ${fxrpName} (${fxrpSymbol})`);
  console.log(`🔢 Decimals: ${decimals}`);

  // Vault global stats
  console.log("\n=== Vault Global Stats ===");
  const totalAssets = await vault.totalAssets();
  const totalSupply = await vault.totalSupply();
  console.log(`💰 Total Assets: ${ethers.formatUnits(totalAssets, decimals)} FXRP`);
  console.log(`📊 Total Supply: ${ethers.formatUnits(totalSupply, decimals)} fFXRP`);

  // Exchange rate
  const oneShare = ethers.parseUnits("1", decimals);
  const fxrpPerShare = await vault.convertToAssets(oneShare);
  const sharePerFXRP = await vault.convertToShares(oneShare);
  console.log(`\n💱 Exchange Rate:`);
  console.log(`   1 fFXRP = ${ethers.formatUnits(fxrpPerShare, decimals)} FXRP`);
  console.log(`   1 FXRP = ${ethers.formatUnits(sharePerFXRP, decimals)} fFXRP`);

  // User balances
  console.log("\n=== Your Balances ===");
  const fxrpBalance = await fxrp.balanceOf(signerAddress);
  const fFXRPBalance = await vault.balanceOf(signerAddress);

  console.log(`💵 FXRP: ${ethers.formatUnits(fxrpBalance, decimals)}`);
  console.log(`🎯 fFXRP: ${ethers.formatUnits(fFXRPBalance, decimals)}`);

  if (fFXRPBalance > 0n) {
    const fFXRPValue = await vault.convertToAssets(fFXRPBalance);
    console.log(`💎 fFXRP value: ${ethers.formatUnits(fFXRPValue, decimals)} FXRP`);

    const yield_ = fFXRPValue - fFXRPBalance;
    if (yield_ > 0n) {
      console.log(`✨ Accrued yield: ${ethers.formatUnits(yield_, decimals)} FXRP`);
    }
  }

  // Max operations
  console.log("\n=== Max Operations ===");
  const maxDeposit = await vault.maxDeposit(signerAddress);
  const maxRedeem = await vault.maxRedeem(signerAddress);

  console.log(`📥 Max deposit: ${maxDeposit === ethers.MaxUint256 ? "Unlimited" : ethers.formatUnits(maxDeposit, decimals) + " FXRP"}`);
  console.log(`📤 Max redeem: ${ethers.formatUnits(maxRedeem, decimals)} fFXRP`);

  // Preview operations
  if (fxrpBalance > 0n) {
    const previewAmount = fxrpBalance < ethers.parseUnits("1", decimals)
      ? fxrpBalance
      : ethers.parseUnits("1", decimals);

    const previewShares = await vault.previewDeposit(previewAmount);
    console.log(`\n📊 Preview: Deposit ${ethers.formatUnits(previewAmount, decimals)} FXRP`);
    console.log(`   → Get ${ethers.formatUnits(previewShares, decimals)} fFXRP`);
  }

  if (fFXRPBalance > 0n) {
    const previewAmount = fFXRPBalance < ethers.parseUnits("1", decimals)
      ? fFXRPBalance
      : ethers.parseUnits("1", decimals);

    const previewAssets = await vault.previewRedeem(previewAmount);
    console.log(`\n📊 Preview: Redeem ${ethers.formatUnits(previewAmount, decimals)} fFXRP`);
    console.log(`   → Get ${ethers.formatUnits(previewAssets, decimals)} FXRP`);
  }

  // Summary
  console.log("\n=== Summary ===");
  if (fxrpBalance === 0n && fFXRPBalance === 0n) {
    console.log("💡 Get FTestXRP from: https://faucet.flare.network");
    console.log("💡 Then run: npx hardhat run script/test-firelight-deposit.ts --network coston2");
  } else if (fxrpBalance > 0n && fFXRPBalance === 0n) {
    console.log("✅ You have FXRP ready to deposit");
    console.log("💡 Run: npx hardhat run script/test-firelight-deposit.ts --network coston2");
  } else if (fFXRPBalance > 0n) {
    console.log("✅ You have fFXRP earning yield!");
    console.log("💡 To redeem: npx hardhat run script/test-firelight-redeem.ts --network coston2");
  }
}

main().catch(console.error);
