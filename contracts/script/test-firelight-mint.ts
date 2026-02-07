import { ethers } from "hardhat";

/**
 * Test Firelight Vault: Mint exact fFXRP shares
 *
 * Run: npx hardhat run script/test-firelight-mint.ts --network coston2
 */

const FIRELIGHT_VAULT = "0x91Bfe6A68aB035DFebb6A770FFfB748C03C0E40B";
const FTESTXRP = "0x0b6A3645c240605887a5532109323A3E12273dc7";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const VAULT_ABI = [
  "function mint(uint256 shares, address receiver) external returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function convertToAssets(uint256 shares) external view returns (uint256)",
  "function previewMint(uint256 shares) external view returns (uint256)",
  "function maxMint(address owner) external view returns (uint256)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("=== Firelight Vault Mint Test ===");
  console.log("Signer:", signerAddress);
  console.log("Vault:", FIRELIGHT_VAULT);

  // Connect to contracts
  const fxrp = new ethers.Contract(FTESTXRP, ERC20_ABI, signer);
  const vault = new ethers.Contract(FIRELIGHT_VAULT, VAULT_ABI, signer);

  const decimals = await fxrp.decimals();

  // Check FTestXRP balance
  const fxrpBalance = await fxrp.balanceOf(signerAddress);
  console.log(`\n📊 FTestXRP Balance: ${ethers.formatUnits(fxrpBalance, decimals)} FXRP`);

  if (fxrpBalance === 0n) {
    console.log("\n⚠️  No FTestXRP! Get some from: https://faucet.flare.network");
    return;
  }

  // Desired shares: mint 1-2 fFXRP shares
  const desiredShares = ethers.parseUnits("1", decimals);
  console.log(`\n🎯 Desired fFXRP shares: ${ethers.formatUnits(desiredShares, decimals)}`);

  // Preview mint - how much FXRP needed?
  const assetsNeeded = await vault.previewMint(desiredShares);
  console.log(`💰 FXRP needed: ${ethers.formatUnits(assetsNeeded, decimals)} FXRP`);

  if (fxrpBalance < assetsNeeded) {
    console.log(`\n⚠️  Insufficient FXRP! Need ${ethers.formatUnits(assetsNeeded, decimals)}, have ${ethers.formatUnits(fxrpBalance, decimals)}`);
    return;
  }

  // Check max mint
  const maxMint = await vault.maxMint(signerAddress);
  if (maxMint < desiredShares) {
    console.log(`\n⚠️  Exceeds max mint! Max: ${ethers.formatUnits(maxMint, decimals)}`);
    return;
  }

  // Check if approval needed (approve more than needed for safety)
  const approvalAmount = assetsNeeded * 110n / 100n; // 10% buffer
  const currentAllowance = await fxrp.allowance(signerAddress, FIRELIGHT_VAULT);
  if (currentAllowance < approvalAmount) {
    console.log("\n🔐 Approving vault to spend FXRP...");
    const approveTx = await fxrp.approve(FIRELIGHT_VAULT, approvalAmount);
    await approveTx.wait();
    console.log(`✅ Approved ${ethers.formatUnits(approvalAmount, decimals)} FXRP`);
  } else {
    console.log("\n✅ Already approved");
  }

  // Get balances before
  const fFXRPBefore = await vault.balanceOf(signerAddress);
  const fxrpBefore = await fxrp.balanceOf(signerAddress);

  // Mint shares
  console.log("\n🚀 Minting fFXRP shares from Firelight Vault...");
  const mintTx = await vault.mint(desiredShares, signerAddress, {
    gasLimit: 500000, // Set manual gas limit
  });
  const receipt = await mintTx.wait();
  console.log("✅ Mint successful!");
  console.log(`📝 TX: ${receipt!.hash}`);

  // Check balances after
  const fFXRPAfter = await vault.balanceOf(signerAddress);
  const fxrpAfter = await fxrp.balanceOf(signerAddress);

  const sharesMinted = fFXRPAfter - fFXRPBefore;
  const fxrpSpent = fxrpBefore - fxrpAfter;

  console.log(`\n🎉 fFXRP minted: ${ethers.formatUnits(sharesMinted, decimals)}`);
  console.log(`💵 FXRP spent: ${ethers.formatUnits(fxrpSpent, decimals)}`);

  // Verify exact shares
  if (sharesMinted === desiredShares) {
    console.log("✅ Got exact shares requested!");
  } else {
    console.log(`⚠️  Shares mismatch! Wanted ${ethers.formatUnits(desiredShares, decimals)}, got ${ethers.formatUnits(sharesMinted, decimals)}`);
  }

  // Show new balances
  console.log(`\n📊 New balances:`);
  console.log(`   fFXRP: ${ethers.formatUnits(fFXRPAfter, decimals)}`);
  console.log(`   FXRP: ${ethers.formatUnits(fxrpAfter, decimals)}`);

  // Show current value
  const currentValue = await vault.convertToAssets(fFXRPAfter);
  console.log(`💎 Current fFXRP value: ${ethers.formatUnits(currentValue, decimals)} FXRP`);
}

main().catch(console.error);
