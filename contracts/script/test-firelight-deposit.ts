import { ethers } from "hardhat";

/**
 * Test Firelight Vault: Deposit FTestXRP → Receive fFXRP
 *
 * Run: npx hardhat run script/test-firelight-deposit.ts --network coston2
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
  "function asset() external view returns (address)",
  "function deposit(uint256 assets, address receiver) external returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function convertToAssets(uint256 shares) external view returns (uint256)",
  "function previewDeposit(uint256 assets) external view returns (uint256)",
  "function totalAssets() external view returns (uint256)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("=== Firelight Vault Deposit Test ===");
  console.log("Signer:", signerAddress);
  console.log("Vault:", FIRELIGHT_VAULT);
  console.log("Asset:", FTESTXRP);

  // Connect to contracts
  const fxrp = new ethers.Contract(FTESTXRP, ERC20_ABI, signer);
  const vault = new ethers.Contract(FIRELIGHT_VAULT, VAULT_ABI, signer);

  // Check FTestXRP balance
  const fxrpBalance = await fxrp.balanceOf(signerAddress);
  const decimals = await fxrp.decimals();
  console.log(`\n📊 FTestXRP Balance: ${ethers.formatUnits(fxrpBalance, decimals)} FXRP`);

  if (fxrpBalance === 0n) {
    console.log("\n⚠️  No FTestXRP! Get some from: https://faucet.flare.network");
    return;
  }

  // Deposit amount: use 2-3 FXRP or max available
  const maxDeposit = ethers.parseUnits("3", decimals);
  const depositAmount = fxrpBalance < maxDeposit ? fxrpBalance : maxDeposit;

  console.log(`\n💰 Depositing: ${ethers.formatUnits(depositAmount, decimals)} FXRP`);

  // Preview deposit
  const expectedShares = await vault.previewDeposit(depositAmount);
  console.log(`📈 Expected fFXRP shares: ${ethers.formatUnits(expectedShares, decimals)}`);

  // Check exchange rate
  const totalAssets = await vault.totalAssets();
  const oneShare = ethers.parseUnits("1", decimals);
  const fxrpPerShare = await vault.convertToAssets(oneShare);
  console.log(`💱 Exchange rate: 1 fFXRP = ${ethers.formatUnits(fxrpPerShare, decimals)} FXRP`);
  console.log(`📦 Vault total assets: ${ethers.formatUnits(totalAssets, decimals)} FXRP`);

  // Check if approval needed (approve more than needed for safety)
  const approvalAmount = depositAmount * 110n / 100n; // 10% buffer
  const currentAllowance = await fxrp.allowance(signerAddress, FIRELIGHT_VAULT);
  if (currentAllowance < approvalAmount) {
    console.log("\n🔐 Approving vault to spend FXRP...");
    const approveTx = await fxrp.approve(FIRELIGHT_VAULT, approvalAmount);
    await approveTx.wait();
    console.log(`✅ Approved ${ethers.formatUnits(approvalAmount, decimals)} FXRP`);
  } else {
    console.log("\n✅ Already approved");
  }

  // Deposit to vault
  console.log("\n🚀 Depositing to Firelight Vault...");
  try {
    const depositTx = await vault.deposit(depositAmount, signerAddress, {
      gasLimit: 500000, // Set manual gas limit
    });
    const receipt = await depositTx.wait();
    console.log("✅ Deposit successful!");
    console.log(`📝 TX: ${receipt!.hash}`);
  } catch (error: any) {
    console.log("❌ Deposit failed!");
    console.log(`Error: ${error.message}`);

    // Try with smaller amount
    const smallerAmount = ethers.parseUnits("0.1", decimals);
    console.log(`\n🔄 Trying smaller amount: ${ethers.formatUnits(smallerAmount, decimals)} FXRP`);

    try {
      const depositTx = await vault.deposit(smallerAmount, signerAddress, {
        gasLimit: 500000,
      });
      const receipt = await depositTx.wait();
      console.log("✅ Small deposit successful!");
      console.log(`📝 TX: ${receipt!.hash}`);
      return;
    } catch (smallError: any) {
      console.log("❌ Small deposit also failed!");
      console.log(`Error: ${smallError.message}`);
      return;
    }
  }

  // Check fFXRP balance
  const fFXRPBalance = await vault.balanceOf(signerAddress);
  console.log(`\n🎉 New fFXRP balance: ${ethers.formatUnits(fFXRPBalance, decimals)} fFXRP`);

  // Check new FTestXRP balance
  const newFXRPBalance = await fxrp.balanceOf(signerAddress);
  console.log(`💵 Remaining FXRP: ${ethers.formatUnits(newFXRPBalance, decimals)} FXRP`);

  // Calculate current value
  const currentValue = await vault.convertToAssets(fFXRPBalance);
  console.log(`💎 Current fFXRP value: ${ethers.formatUnits(currentValue, decimals)} FXRP`);
}

main().catch(console.error);
