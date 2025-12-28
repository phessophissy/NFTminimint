/**
 * Buy NFT Script - NFTminimintV2
 * Usage: node buy-nft.js <tokenId> [walletIndex]
 * 
 * Buys a listed NFT from the marketplace
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contract V2 address - UPDATE AFTER DEPLOYMENT
const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: Update with V2 address

// Contract ABI (minimal for buying)
const CONTRACT_ABI = [
    'function buyNFT(uint256 tokenId) external payable',
    'function getListing(uint256 tokenId) view returns (address seller, uint256 price, bool active)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function getRarityName(uint256 tokenId) view returns (string)',
    'function getActiveListings() view returns (uint256[] tokenIds, address[] sellers, uint256[] prices)',
    'event NFTSold(address indexed seller, address indexed buyer, uint256 indexed tokenId, uint256 price, uint256 timestamp)'
];

// Base Chain config
const RPC_URL = 'https://mainnet.base.org';

// Load wallets
function loadWallets() {
    const walletsPath = path.join(__dirname, 'wallets.json');
    if (!fs.existsSync(walletsPath)) {
        console.error('❌ wallets.json not found. Run generate-wallets.js first.');
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(walletsPath, 'utf8'));
}

async function buyNFT(tokenId, walletIndex = 0) {
    const wallets = loadWallets();
    
    if (walletIndex < 0 || walletIndex >= wallets.length) {
        console.error(`❌ Invalid wallet index. Use 0-${wallets.length - 1}`);
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(wallets[walletIndex].privateKey, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    console.log('\n🛒 NFTminimint - Buy NFT Script');
    console.log('===============================');
    console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`👛 Wallet ${walletIndex}: ${wallet.address}`);
    console.log(`🎨 Token ID: ${tokenId}`);

    try {
        // Check wallet balance
        const balance = await provider.getBalance(wallet.address);
        console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

        // Check listing
        const [seller, price, active] = await contract.getListing(tokenId);
        
        if (!active) {
            console.error(`❌ Token ${tokenId} is not listed for sale`);
            process.exit(1);
        }

        // Check not buying own NFT
        if (seller.toLowerCase() === wallet.address.toLowerCase()) {
            console.error(`❌ Cannot buy your own NFT`);
            process.exit(1);
        }

        const priceEth = ethers.formatEther(price);
        console.log(`\n📋 Listing Details:`);
        console.log(`   Seller: ${seller}`);
        console.log(`   Price: ${priceEth} ETH`);

        // Get rarity
        const rarity = await contract.getRarityName(tokenId);
        console.log(`   Rarity: ${rarity}`);

        // Check sufficient balance (price + gas estimate)
        const gasEstimate = await contract.buyNFT.estimateGas(tokenId, { value: price });
        const feeData = await provider.getFeeData();
        const gasCost = gasEstimate * feeData.gasPrice;
        const totalCost = price + gasCost;

        if (balance < totalCost) {
            console.error(`\n❌ Insufficient balance`);
            console.log(`   Need: ${ethers.formatEther(totalCost)} ETH (${priceEth} + gas)`);
            console.log(`   Have: ${ethers.formatEther(balance)} ETH`);
            process.exit(1);
        }

        console.log(`   Gas Est: ~${ethers.formatEther(gasCost)} ETH`);

        // Execute purchase
        console.log(`\n⏳ Buying NFT...`);
        const tx = await contract.buyNFT(tokenId, { value: price });
        
        console.log(`   Transaction: ${tx.hash}`);
        console.log('   Waiting for confirmation...');

        const receipt = await tx.wait();
        
        console.log('\n✅ NFT Purchased Successfully!');
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`   TX: https://basescan.org/tx/${tx.hash}`);
        console.log(`\n🎉 You now own Token #${tokenId} (${rarity})!`);

        return { success: true, txHash: tx.hash, tokenId, price: priceEth };

    } catch (error) {
        console.error(`\n❌ Failed to buy NFT:`, error.message);
        if (error.reason) console.error(`   Reason: ${error.reason}`);
        return { success: false, error: error.message };
    }
}

// Show all active listings
async function showActiveListings() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    console.log('\n🏪 NFTminimint - Active Listings');
    console.log('================================');
    console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);

    try {
        const [tokenIds, sellers, prices] = await contract.getActiveListings();

        if (tokenIds.length === 0) {
            console.log('\n📭 No NFTs currently listed for sale');
            return;
        }

        console.log(`\n📦 Found ${tokenIds.length} listings:\n`);

        for (let i = 0; i < tokenIds.length; i++) {
            const rarity = await contract.getRarityName(tokenIds[i]);
            console.log(`   Token #${tokenIds[i]} (${rarity})`);
            console.log(`   ├─ Seller: ${sellers[i]}`);
            console.log(`   └─ Price: ${ethers.formatEther(prices[i])} ETH`);
            console.log('');
        }

    } catch (error) {
        console.error(`\n❌ Error fetching listings:`, error.message);
    }
}

// Main execution
const args = process.argv.slice(2);

if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
NFTminimint - Buy NFT Script
============================

Usage:
  node buy-nft.js <tokenId> [walletIndex]
  node buy-nft.js --listings

Arguments:
  tokenId      - The NFT token ID to buy
  walletIndex  - Which wallet to use (0-9, default: 0)

Options:
  --listings   - Show all active marketplace listings
  --help, -h   - Show this help message

Examples:
  node buy-nft.js 0              # Buy token 0 using wallet 0
  node buy-nft.js 1 2            # Buy token 1 using wallet 2
  node buy-nft.js --listings     # View all listings
`);
    process.exit(0);
}

if (args[0] === '--listings') {
    showActiveListings();
} else if (args.length >= 1) {
    const tokenId = parseInt(args[0]);
    const walletIndex = parseInt(args[1]) || 0;
    buyNFT(tokenId, walletIndex);
} else {
    console.error('❌ Please provide a token ID');
    console.log('   Usage: node buy-nft.js <tokenId> [walletIndex]');
    console.log('   Run with --help for more options');
}
