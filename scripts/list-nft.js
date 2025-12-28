/**
 * List NFT Script - NFTminimintV2
 * Usage: node list-nft.js <tokenId> [walletIndex]
 * 
 * Lists an NFT for sale at 0.00002 ETH
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contract V2 address on Base Chain
const CONTRACT_ADDRESS = '0x85F575D103e13eF7F99a03D42fD7534aEA1C4Bd0';

// Contract ABI (minimal for listing)
const CONTRACT_ABI = [
    'function listNFT(uint256 tokenId) external',
    'function listNFTWithPrice(uint256 tokenId, uint256 price) external',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function getListing(uint256 tokenId) view returns (address seller, uint256 price, bool active)',
    'function getNFTsByOwner(address owner) view returns (uint256[])',
    'function getRarityName(uint256 tokenId) view returns (string)',
    'event NFTListed(address indexed seller, uint256 indexed tokenId, uint256 price, uint256 timestamp)'
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

async function listNFT(tokenId, walletIndex = 0, customPrice = null) {
    const wallets = loadWallets();
    
    if (walletIndex < 0 || walletIndex >= wallets.length) {
        console.error(`❌ Invalid wallet index. Use 0-${wallets.length - 1}`);
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(wallets[walletIndex].privateKey, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    console.log('\n🏪 NFTminimint - List NFT Script');
    console.log('================================');
    console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`👛 Wallet ${walletIndex}: ${wallet.address}`);
    console.log(`🎨 Token ID: ${tokenId}`);

    try {
        // Check ownership
        const owner = await contract.ownerOf(tokenId);
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error(`❌ Wallet does not own token ${tokenId}`);
            console.log(`   Owner: ${owner}`);
            process.exit(1);
        }

        // Check if already listed
        const [seller, price, active] = await contract.getListing(tokenId);
        if (active) {
            console.error(`❌ Token ${tokenId} is already listed`);
            console.log(`   Seller: ${seller}`);
            console.log(`   Price: ${ethers.formatEther(price)} ETH`);
            process.exit(1);
        }

        // Get rarity
        const rarity = await contract.getRarityName(tokenId);
        console.log(`✨ Rarity: ${rarity}`);

        // List the NFT
        let tx;
        let listPrice;
        
        if (customPrice) {
            listPrice = ethers.parseEther(customPrice);
            console.log(`💰 Custom Price: ${customPrice} ETH`);
            tx = await contract.listNFTWithPrice(tokenId, listPrice);
        } else {
            listPrice = ethers.parseEther('0.00002');
            console.log(`💰 Price: 0.00002 ETH (marketplace default)`);
            tx = await contract.listNFT(tokenId);
        }

        console.log(`\n⏳ Transaction submitted: ${tx.hash}`);
        console.log('   Waiting for confirmation...');

        const receipt = await tx.wait();
        
        console.log('\n✅ NFT Listed Successfully!');
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`   TX: https://basescan.org/tx/${tx.hash}`);

        return { success: true, txHash: tx.hash, tokenId, price: ethers.formatEther(listPrice) };

    } catch (error) {
        console.error(`\n❌ Failed to list NFT:`, error.message);
        if (error.reason) console.error(`   Reason: ${error.reason}`);
        return { success: false, error: error.message };
    }
}

// List all NFTs owned by a wallet
async function listAllNFTs(walletIndex = 0) {
    const wallets = loadWallets();
    
    if (walletIndex < 0 || walletIndex >= wallets.length) {
        console.error(`❌ Invalid wallet index. Use 0-${wallets.length - 1}`);
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(wallets[walletIndex].privateKey, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    console.log('\n🏪 NFTminimint - List All NFTs');
    console.log('==============================');
    console.log(`👛 Wallet ${walletIndex}: ${wallet.address}`);

    try {
        const tokenIds = await contract.getNFTsByOwner(wallet.address);
        
        if (tokenIds.length === 0) {
            console.log('📭 No NFTs owned by this wallet');
            return;
        }

        console.log(`📦 Found ${tokenIds.length} NFTs`);
        
        for (const tokenId of tokenIds) {
            const [seller, price, active] = await contract.getListing(tokenId);
            const rarity = await contract.getRarityName(tokenId);
            
            console.log(`\n   Token #${tokenId} (${rarity})`);
            if (active) {
                console.log(`   └─ Listed at ${ethers.formatEther(price)} ETH`);
            } else {
                console.log(`   └─ Not listed`);
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
NFTminimint - List NFT Script
=============================

Usage:
  node list-nft.js <tokenId> [walletIndex] [customPrice]
  node list-nft.js --list-all [walletIndex]

Arguments:
  tokenId      - The NFT token ID to list
  walletIndex  - Which wallet to use (0-9, default: 0)
  customPrice  - Optional custom price in ETH (default: 0.00002)

Examples:
  node list-nft.js 0              # List token 0 from wallet 0
  node list-nft.js 1 2            # List token 1 from wallet 2
  node list-nft.js 0 0 0.001      # List token 0 at 0.001 ETH
  node list-nft.js --list-all 1   # Show all NFTs owned by wallet 1
`);
    process.exit(0);
}

if (args[0] === '--list-all') {
    const walletIndex = parseInt(args[1]) || 0;
    listAllNFTs(walletIndex);
} else if (args.length >= 1) {
    const tokenId = parseInt(args[0]);
    const walletIndex = parseInt(args[1]) || 0;
    const customPrice = args[2] || null;
    listNFT(tokenId, walletIndex, customPrice);
} else {
    console.error('❌ Please provide a token ID');
    console.log('   Usage: node list-nft.js <tokenId> [walletIndex]');
    console.log('   Run with --help for more options');
}
