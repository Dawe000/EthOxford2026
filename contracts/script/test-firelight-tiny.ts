import { ethers } from "hardhat";

/**
 * Test Firelight Vault with tiny amount (0.01 FXRP)
 */

const FIRELIGHT_VAULT = "0x91Bfe6A68aB035DFebb6A770FFfB748C03C0E40B";
const FTESTXRP = "0x0b6A3645c240605887a5532109323A3E12273dc7";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const VAULT_ABI = [
  "function deposit(uint256 assets, address receiver) external returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("=== Tiny Deposit Test ===");
  console.log("Signer:", signerAddress);

  const fxrp = new ethers.Contract(FTESTXRP, ERC20_ABI, signer);
  const vault = new ethers.Contract(FIRELIGHT_VAULT, VAULT_ABI, signer);

  const decimals = await fxrp.decimals();
  const tinyAmount = ethers.parseUnits("0.01", decimals); // 0.01 FXRP

  console.log(`\nDepositing: ${ethers.formatUnits(tinyAmount, decimals)} FXRP`);

  // Approve
  console.log("Approving...");
  const approveTx = await fxrp.approve(FIRELIGHT_VAULT, tinyAmount);
  await approveTx.wait();
  console.log("✅ Approved");

  // Deposit with manual gas
  console.log("Depositing...");
  const depositTx = await vault.deposit(tinyAmount, signerAddress, {
    gasLimit: 500000,
  });
  const receipt = await depositTx.wait();
  console.log("✅ Success!");
  console.log(`TX: ${receipt!.hash}`);

  // Check balance
  const fFXRPBalance = await vault.balanceOf(signerAddress);
  console.log(`\nfFXRP balance: ${ethers.formatUnits(fFXRPBalance, decimals)}`);
}

main().catch(console.error);
