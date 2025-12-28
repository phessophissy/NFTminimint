// Generate 10 Base-compatible wallets
// Base is EVM-compatible, so standard Ethereum wallets work on Base

const { Wallet } = require('ethers');

console.log('========================================');
console.log('  Base Chain Wallet Generator');
console.log('  Chain: Base (Ethereum L2)');
console.log('  RPC: https://mainnet.base.org');
console.log('  Chain ID: 8453');
console.log('========================================\n');

const wallets = [];

for (let i = 0; i < 10; i++) {
  const wallet = Wallet.createRandom();
  wallets.push({
    index: i + 1,
    address: wallet.address,
    privateKey: wallet.privateKey
  });
}

// Output as JSON
console.log('Generated Wallets (JSON):');
console.log(JSON.stringify(wallets.map(w => ({
  address: w.address,
  privateKey: w.privateKey
})), null, 2));

console.log('\n========================================');
console.log('  Wallet Details');
console.log('========================================\n');

wallets.forEach((w, i) => {
  console.log(`Wallet ${w.index}:`);
  console.log(`  Address:     ${w.address}`);
  console.log(`  Private Key: ${w.privateKey}`);
  console.log('');
});

console.log('========================================');
console.log('⚠️  SECURITY WARNING');
console.log('========================================');
console.log('These private keys grant full control of the wallets.');
console.log('Store them securely and never share them.');
console.log('Anyone with the private key can access the funds.');
console.log('========================================\n');
