/**
 * Cancel Listing / Sell (Transfer) NFT Script - NFTminimintV2
 * Usage: node sell-nft.js <command> <tokenId> [options]
 * 
 * Commands:
 *   cancel <tokenId>              - Cancel a listing
 *   transfer <tokenId> <toAddress> - Transfer NFT directly
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contract V2 address on Base Chain
const CONTRACT_ADDRESS = '0x85F575D103e13eF7F99a03D42fD7534aEA1C4Bd0';

// Contract ABI
const CONTRACT_ABI = [
    'function cancelListing(uint256 tokenId) external',
    'function safeTransferFrom(address from, address to, uint256 tokenId) external',
    'function transferFrom(address from, address to, uint256 tokenId) external',
    'function getListing(uint256 tokenId) view returns (address seller, uint256 price, bool active)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function getRarityName(uint256 tokenId) view returns (string)',
    'function getNFTsByOwner(address owner) view returns (uint256[])',
    'event ListingCancelled(address indexed seller, uint256 indexed tokenId, uint256 timestamp)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
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

// Cancel a marketplace listing
async function cancelListing(tokenId, walletIndex = 0) {
    const wallets = loadWallets();
    
    if (walletIndex < 0 || walletIndex >= wallets.length) {
        console.error(`❌ Invalid wallet index. Use 0-${wallets.length - 1}`);
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(wallets[walletIndex].privateKey, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    console.log('\n🚫 NFTminimint - Cancel Listing');
    console.log('===============================');
    console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`👛 Wallet ${walletIndex}: ${wallet.address}`);
    console.log(`🎨 Token ID: ${tokenId}`);

    try {
        // Check listing
        const [seller, price, active] = await contract.getListing(tokenId);
        
        if (!active) {
            console.error(`❌ Token ${tokenId} is not listed`);
            process.exit(1);
        }

        if (seller.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error(`❌ You are not the seller of this listing`);
            console.log(`   Seller: ${seller}`);
            process.exit(1);
        }

        const rarity = await contract.getRarityName(tokenId);
        console.log(`\n📋 Current Listing:`);
        console.log(`   Rarity: ${rarity}`);
        console.log(`   Price: ${ethers.formatEther(price)} ETH`);

        // Cancel listing
        console.log(`\n⏳ Cancelling listing...`);
        const tx = await contract.cancelListing(tokenId);
        
        console.log(`   Transaction: ${tx.hash}`);
        console.log('   Waiting for confirmation...');

        const receipt = await tx.wait();
        
        console.log('\n✅ Listing Cancelled!');
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`   TX: https://basescan.org/tx/${tx.hash}`);

        return { success: true, txHash: tx.hash, tokenId };

    } catch (error) {
        console.error(`\n❌ Failed to cancel listing:`, error.message);
        if (error.reason) console.error(`   Reason: ${error.reason}`);
        return { success: false, error: error.message };
    }
}

// Transfer NFT directly to another address
async function transferNFT(tokenId, toAddress, walletIndex = 0) {
    const wallets = loadWallets();
    
    if (walletIndex < 0 || walletIndex >= wallets.length) {
        console.error(`❌ Invalid wallet index. Use 0-${wallets.length - 1}`);
        process.exit(1);
    }

    if (!ethers.isAddress(toAddress)) {
        console.error(`❌ Invalid recipient address: ${toAddress}`);
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(wallets[walletIndex].privateKey, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    console.log('\n📤 NFTminimint - Transfer NFT');
    console.log('=============================');
    console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`👛 From Wallet ${walletIndex}: ${wallet.address}`);
    console.log(`📬 To Address: ${toAddress}`);
    console.log(`🎨 Token ID: ${tokenId}`);

    try {
        // Check ownership
        const owner = await contract.ownerOf(tokenId);
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error(`❌ Wallet does not own token ${tokenId}`);
            console.log(`   Owner: ${owner}`);
            process.exit(1);
        }

        // Check if listed - must cancel first
        const [seller, price, active] = await contract.getListing(tokenId);
        if (active) {
            console.error(`❌ Token ${tokenId} is currently listed`);
            console.log(`   Cancel the listing first using: node sell-nft.js cancel ${tokenId}`);
            process.exit(1);
        }

        const rarity = await contract.getRarityName(tokenId);
        console.log(`\n📋 NFT Details:`);
        console.log(`   Rarity: ${rarity}`);

        // Transfer
        console.log(`\n⏳ Transferring NFT...`);
        const tx = await contract.safeTransferFrom(wallet.address, toAddress, tokenId);
        
        console.log(`   Transaction: ${tx.hash}`);
        console.log('   Waiting for confirmation...');

        const receipt = await tx.wait();
        
        console.log('\n✅ NFT Transferred Successfully!');
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`   TX: https://basescan.org/tx/${tx.hash}`);
        console.log(`\n📬 Token #${tokenId} (${rarity}) now belongs to ${toAddress}`);

        return { success: true, txHash: tx.hash, tokenId, to: toAddress };

    } catch (error) {
        console.error(`\n❌ Failed to transfer NFT:`, error.message);
        if (error.reason) console.error(`   Reason: ${error.reason}`);
        return { success: false, error: error.message };
    }
}

// Show NFTs owned by wallet with listing status
async function showMyNFTs(walletIndex = 0) {
    const wallets = loadWallets();
    
    if (walletIndex < 0 || walletIndex >= wallets.length) {
        console.error(`❌ Invalid wallet index. Use 0-${wallets.length - 1}`);
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(wallets[walletIndex].privateKey, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    console.log('\n📦 NFTminimint - My NFTs');
    console.log('========================');
    console.log(`👛 Wallet ${walletIndex}: ${wallet.address}`);

    try {
        const balance = await provider.getBalance(wallet.address);
        console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

        const tokenIds = await contract.getNFTsByOwner(wallet.address);

        if (tokenIds.length === 0) {
            console.log('\n📭 No NFTs owned by this wallet');
            return;
        }

        console.log(`\n🎨 Owned NFTs (${tokenIds.length}):\n`);

        for (const tokenId of tokenIds) {
            const [seller, price, active] = await contract.getListing(tokenId);
            const rarity = await contract.getRarityName(tokenId);
            
            console.log(`   Token #${tokenId} (${rarity})`);
            if (active) {
                console.log(`   └─ 🏷️  Listed at ${ethers.formatEther(price)} ETH`);
            } else {
                console.log(`   └─ ✨ Not listed`);
            }
        }

    } catch (error) {
        console.error(`\n❌ Error:`, error.message);
    }
}

// Main execution
const args = process.argv.slice(2);

if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
NFTminimint - Sell/Transfer/Cancel Script
=========================================

Usage:
  node sell-nft.js cancel <tokenId> [walletIndex]
  node sell-nft.js transfer <tokenId> <toAddress> [walletIndex]
  node sell-nft.js --my-nfts [walletIndex]

Commands:
  cancel     - Cancel an active listing (unlist NFT)
  transfer   - Transfer NFT directly to another address (free transfer, not sale)

Options:
  --my-nfts  - Show all NFTs owned by wallet with listing status
  --help, -h - Show this help message

Arguments:
  tokenId     - The NFT token ID
  toAddress   - Recipient address (for transfer)
  walletIndex - Which wallet to use (0-9, default: 0)

Examples:
  node sell-nft.js cancel 0              # Cancel listing for token 0
  node sell-nft.js cancel 1 2            # Cancel listing using wallet 2
  node sell-nft.js transfer 0 0x123...   # Transfer token 0 to address
  node sell-nft.js --my-nfts             # Show NFTs for wallet 0
  node sell-nft.js --my-nfts 3           # Show NFTs for wallet 3

Note: To SELL an NFT (receive payment), use list-nft.js to list it,
      then the buyer uses buy-nft.js to purchase it.
`);
    process.exit(0);
}

if (args[0] === '--my-nfts') {
    const walletIndex = parseInt(args[1]) || 0;
    showMyNFTs(walletIndex);
} else if (args[0] === 'cancel' && args.length >= 2) {
    const tokenId = parseInt(args[1]);
    const walletIndex = parseInt(args[2]) || 0;
    cancelListing(tokenId, walletIndex);
} else if (args[0] === 'transfer' && args.length >= 3) {
    const tokenId = parseInt(args[1]);
    const toAddress = args[2];
    const walletIndex = parseInt(args[3]) || 0;
    transferNFT(tokenId, toAddress, walletIndex);
} else {
    console.error('❌ Invalid command');
    console.log('   Usage: node sell-nft.js <cancel|transfer> <tokenId> [options]');
    console.log('   Run with --help for more options');
}
