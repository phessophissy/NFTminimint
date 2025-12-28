// Mint Alpha NFTs from 10 wallets on Base Chain
// Contract: 0x02B7f9205c0e9b3D51E4C473Ea2896eB25E0fbEA

const { ethers } = require('ethers');

// Base Chain RPC
const BASE_RPC = 'https://mainnet.base.org';
const CONTRACT_ADDRESS = '0x02B7f9205c0e9b3D51E4C473Ea2896eB25E0fbEA';

// Alpha price: 0.00005 ETH
const ALPHA_PRICE = ethers.parseEther('0.00005');

// Rarity enum: Alpha = 0, Gamma = 1, Omega = 2
const RARITY_ALPHA = 0;

// Contract ABI (only mint function needed)
const CONTRACT_ABI = [
  {
    "inputs": [{ "internalType": "enum NFTminimint.Rarity", "name": "rarity", "type": "uint8" }],
    "name": "mint",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "alphaMinted",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// 10 Generated wallets (private keys)
const WALLET_PRIVATE_KEYS = [
  '0x60a9371ebd5e0d65cc70efada2cf9c89554a1782a041585c735b7541419aeb8b',
  '0x2dc90b865b1c00dcab37cd19034238978447f6fdb560375c069a157f5ad8d553',
  '0xea87fd11b0c379a836eeaa92560c65ae4648f951dff1cd64bcb9122463e355bc',
  '0x8ae4ffa1f39ce497362ae9b7035c1249153591d778579aaf99c5623369b8bf6b',
  '0xa4e66db4c4ba166693e6b7c47fc3291722b62bf99a15a203df387d8b000c8ade',
  '0x856216a417d259e3cdd9cd690e52f199c56831e1a051a012c42aa82eb10d351a',
  '0xae95b40afbe146fac20cb7ccbfa96ddd310a861ac4fae2f85ab394ec69678eb7',
  '0x250ee9d15463f659b64a9d5a5c18854cc40b565cf1ce78500856927aa8133d6e',
  '0x48a1a6c4bc6f38958f7d0d065819fc1e963eaa78cd4aaf95bd30bea9c9106469',
  '0x70bd87d9e5318854d62b1603699b6d9d4dde5725d767b34619f583921f8100ff'
];

async function checkBalance(wallet, provider) {
  const balance = await provider.getBalance(wallet.address);
  return balance;
}

async function mintAlphaNFT(wallet, contract, index) {
  console.log(`\n[Wallet ${index + 1}] ${wallet.address}`);
  
  try {
    // Check balance
    const balance = await wallet.provider.getBalance(wallet.address);
    const balanceEth = ethers.formatEther(balance);
    console.log(`  Balance: ${balanceEth} ETH`);
    
    // Estimate gas
    const gasEstimate = await contract.mint.estimateGas(RARITY_ALPHA, { value: ALPHA_PRICE });
    const feeData = await wallet.provider.getFeeData();
    const gasCost = gasEstimate * feeData.gasPrice;
    const totalCost = ALPHA_PRICE + gasCost;
    
    console.log(`  Mint price: ${ethers.formatEther(ALPHA_PRICE)} ETH`);
    console.log(`  Gas estimate: ~${ethers.formatEther(gasCost)} ETH`);
    console.log(`  Total needed: ~${ethers.formatEther(totalCost)} ETH`);
    
    if (balance < totalCost) {
      console.log(`  ❌ Insufficient balance! Need ${ethers.formatEther(totalCost - balance)} more ETH`);
      return { success: false, reason: 'insufficient_balance', address: wallet.address };
    }
    
    // Send mint transaction
    console.log(`  Minting Alpha NFT...`);
    const tx = await contract.mint(RARITY_ALPHA, { 
      value: ALPHA_PRICE,
      gasLimit: gasEstimate * 120n / 100n // 20% buffer
    });
    
    console.log(`  TX Hash: ${tx.hash}`);
    console.log(`  Waiting for confirmation...`);
    
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log(`  ✅ Successfully minted Alpha NFT!`);
      console.log(`  Block: ${receipt.blockNumber}`);
      return { success: true, txHash: tx.hash, address: wallet.address };
    } else {
      console.log(`  ❌ Transaction failed`);
      return { success: false, reason: 'tx_failed', address: wallet.address };
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, reason: error.message, address: wallet.address };
  }
}

async function main() {
  console.log('========================================');
  console.log('  NFTminimint - Alpha NFT Minting');
  console.log('========================================');
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Chain: Base (Chain ID: 8453)`);
  console.log(`RPC: ${BASE_RPC}`);
  console.log(`Alpha Price: ${ethers.formatEther(ALPHA_PRICE)} ETH`);
  console.log('========================================');
  
  // Connect to Base
  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  
  // Check current Alpha minted count
  const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  const alphaMinted = await readContract.alphaMinted();
  console.log(`\nAlpha NFTs already minted: ${alphaMinted}/1000`);
  
  const results = [];
  
  // Process each wallet
  for (let i = 0; i < WALLET_PRIVATE_KEYS.length; i++) {
    const wallet = new ethers.Wallet(WALLET_PRIVATE_KEYS[i], provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    
    const result = await mintAlphaNFT(wallet, contract, i);
    results.push(result);
    
    // Small delay between transactions
    if (i < WALLET_PRIVATE_KEYS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log('\n========================================');
  console.log('  MINTING SUMMARY');
  console.log('========================================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\nSuccessful mints:');
    successful.forEach(r => {
      console.log(`  ${r.address}`);
      console.log(`    TX: https://basescan.org/tx/${r.txHash}`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\nFailed mints:');
    failed.forEach(r => {
      console.log(`  ${r.address}: ${r.reason}`);
    });
  }
  
  // Check new Alpha minted count
  const newAlphaMinted = await readContract.alphaMinted();
  console.log(`\nAlpha NFTs now minted: ${newAlphaMinted}/1000`);
  
  console.log('\n========================================');
  console.log('View on BaseScan:');
  console.log(`https://basescan.org/address/${CONTRACT_ADDRESS}`);
  console.log('========================================');
}

main().catch(console.error);
