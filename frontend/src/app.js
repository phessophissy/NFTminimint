// NFTminimint V2 - NFT Minting & Marketplace on Base Chain
// Using Reown AppKit for wallet connection

import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { base } from '@reown/appkit/networks';
import { http, createConfig } from 'wagmi';
import { 
  getAccount, 
  watchAccount,
  writeContract,
  waitForTransactionReceipt,
  readContract
} from '@wagmi/core';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // V1 Contract address on Base Chain (for minting)
  contractAddress: '0x02B7f9205c0e9b3D51E4C473Ea2896eB25E0fbEA',
  
  // V2 Contract address (marketplace) - UPDATE AFTER V2 DEPLOYMENT
  contractAddressV2: '0x0000000000000000000000000000000000000000',
  
  // Reown Project ID - Get from https://cloud.reown.com
  projectId: 'e9132f1c6b85ec793477f0e28cbdeaba',
  
  // Pricing in ETH
  prices: {
    alpha: '0.00005',
    gamma: '0.00006',
    omega: '0.00007',
    marketplace: '0.00002'
  },
  
  // Max supplies
  maxSupply: {
    alpha: 1000,
    gamma: 500,
    omega: 100
  },
  
  // Rarity names
  rarityNames: ['Alpha', 'Gamma', 'Omega']
};

// V1 Contract ABI (for minting)
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
  },
  {
    "inputs": [],
    "name": "gammaMinted",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "omegaMinted",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "minter", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "indexed": false, "internalType": "enum NFTminimint.Rarity", "name": "rarity", "type": "uint8" },
      { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" }
    ],
    "name": "NFTMinted",
    "type": "event"
  }
];

// V2 Contract ABI (for marketplace)
const CONTRACT_ABI_V2 = [
  // Minting functions
  "function mintAlpha() external payable returns (uint256)",
  "function mintGamma() external payable returns (uint256)",
  "function mintOmega() external payable returns (uint256)",
  
  // Marketplace functions
  "function listNFT(uint256 tokenId) external",
  "function listNFTWithPrice(uint256 tokenId, uint256 price) external",
  "function buyNFT(uint256 tokenId) external payable",
  "function cancelListing(uint256 tokenId) external",
  
  // View functions
  "function getListing(uint256 tokenId) external view returns (address seller, uint256 price, bool active)",
  "function getNFTDetails(uint256 tokenId) external view returns (address owner, uint8 rarity, uint256 mintedAt, bool isListed, uint256 listingPrice)",
  "function getActiveListings() external view returns (uint256[] tokenIds, address[] sellers, uint256[] prices)",
  "function getNFTsByOwner(address owner) external view returns (uint256[])",
  "function getRarityName(uint256 tokenId) external view returns (string)",
  "function getTotalMinted() external view returns (uint256)",
  "function getMintStats() external view returns (uint256 totalMinted, uint256 alphaCount, uint256 gammaCount, uint256 omegaCount)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  
  // Constants
  "function ALPHA_PRICE() external view returns (uint256)",
  "function GAMMA_PRICE() external view returns (uint256)",
  "function OMEGA_PRICE() external view returns (uint256)",
  "function MARKETPLACE_PRICE() external view returns (uint256)"
];

// ============================================
// STATE
// ============================================

let state = {
  connected: false,
  address: null,
  appKit: null,
  wagmiConfig: null,
  recentMints: [],
  activeTab: 'mint',
  myNFTs: [],
  marketplaceListings: [],
  marketplaceFilter: 'all'
};

// ============================================
// REOWN APPKIT + WAGMI SETUP
// ============================================

function initializeAppKit() {
  // Create Wagmi adapter for EVM chains
  const wagmiAdapter = new WagmiAdapter({
    networks: [base],
    projectId: CONFIG.projectId,
    ssr: false
  });

  state.wagmiConfig = wagmiAdapter.wagmiConfig;

  // Create AppKit instance
  state.appKit = createAppKit({
    adapters: [wagmiAdapter],
    networks: [base],
    defaultNetwork: base,
    projectId: CONFIG.projectId,
    metadata: {
      name: 'NFTminimint',
      description: 'Mint NFTs on Base Chain',
      url: window.location.origin,
      icons: [`${window.location.origin}/favicon.svg`]
    },
    features: {
      analytics: false,
      email: false,
      socials: false
    },
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#0052ff'
    }
  });

  // Watch for account changes
  watchAccount(state.wagmiConfig, {
    onChange: (account) => {
      state.connected = account.isConnected;
      state.address = account.address;
      updateWalletUI();
      if (account.isConnected) {
        loadContractData();
        loadMyNFTs();
        loadMarketplaceListings();
      }
    }
  });

  console.log('Reown AppKit initialized for Base Chain');
}

// ============================================
// WALLET CONNECTION
// ============================================

async function connectWallet() {
  if (state.appKit) {
    state.appKit.open();
  }
}

function disconnectWallet() {
  if (state.appKit) {
    state.appKit.disconnect();
  }
  state.connected = false;
  state.address = null;
  updateWalletUI();
}

function updateWalletUI() {
  const btn = document.getElementById('connectWallet');
  if (state.connected && state.address) {
    const shortAddr = `${state.address.slice(0, 6)}...${state.address.slice(-4)}`;
    btn.textContent = shortAddr;
    btn.classList.add('connected');
    btn.onclick = disconnectWallet;
  } else {
    btn.textContent = 'Connect Wallet';
    btn.classList.remove('connected');
    btn.onclick = connectWallet;
  }
}

// ============================================
// CONTRACT INTERACTIONS
// ============================================

async function loadContractData() {
  if (CONFIG.contractAddress === '0x0000000000000000000000000000000000000000') {
    console.log('Contract not deployed yet');
    return;
  }

  try {
    // Read minted counts
    const [alphaMinted, gammaMinted, omegaMinted, totalSupply] = await Promise.all([
      readContract(state.wagmiConfig, {
        address: CONFIG.contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'alphaMinted'
      }),
      readContract(state.wagmiConfig, {
        address: CONFIG.contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'gammaMinted'
      }),
      readContract(state.wagmiConfig, {
        address: CONFIG.contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'omegaMinted'
      }),
      readContract(state.wagmiConfig, {
        address: CONFIG.contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'totalSupply'
      })
    ]);

    // Update UI
    document.getElementById('alphaRemaining').textContent = 
      CONFIG.maxSupply.alpha - Number(alphaMinted);
    document.getElementById('gammaRemaining').textContent = 
      CONFIG.maxSupply.gamma - Number(gammaMinted);
    document.getElementById('omegaRemaining').textContent = 
      CONFIG.maxSupply.omega - Number(omegaMinted);
    document.getElementById('totalMinted').textContent = Number(totalSupply);

  } catch (error) {
    console.error('Failed to load contract data:', error);
  }
}

// ============================================
// MINTING
// ============================================

async function mintNFT(rarity) {
  if (!state.connected) {
    showToast('Please connect your wallet first', 'error');
    connectWallet();
    return;
  }

  if (CONFIG.contractAddress === '0x0000000000000000000000000000000000000000') {
    showToast('Contract not deployed yet', 'error');
    return;
  }

  const rarityName = CONFIG.rarityNames[rarity];
  const prices = [CONFIG.prices.alpha, CONFIG.prices.gamma, CONFIG.prices.omega];
  const price = prices[rarity];

  // Get the mint button
  const cards = document.querySelectorAll('.mint-card');
  const card = cards[rarity];
  const btn = card.querySelector('.btn-mint');
  const originalText = btn.textContent;

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Minting...';

    // Convert price to wei
    const priceWei = BigInt(Math.floor(parseFloat(price) * 1e18));

    // Call mint function
    const hash = await writeContract(state.wagmiConfig, {
      address: CONFIG.contractAddress,
      abi: CONTRACT_ABI,
      functionName: 'mint',
      args: [rarity],
      value: priceWei
    });

    showToast(`Transaction submitted! Waiting for confirmation...`, 'success');

    // Wait for confirmation
    const receipt = await waitForTransactionReceipt(state.wagmiConfig, {
      hash
    });

    if (receipt.status === 'success') {
      showToast(`🎉 ${rarityName} NFT minted successfully!`, 'success');
      
      // Add to recent mints
      addRecentMint(rarityName, hash);
      
      // Reload contract data
      await loadContractData();
    } else {
      showToast('Transaction failed', 'error');
    }

  } catch (error) {
    console.error('Mint error:', error);
    
    if (error.message?.includes('User rejected') || error.code === 4001) {
      showToast('Transaction cancelled', 'error');
    } else if (error.message?.includes('insufficient funds')) {
      showToast('Insufficient ETH balance', 'error');
    } else {
      showToast(`Mint failed: ${error.shortMessage || error.message}`, 'error');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// Make mintNFT available globally
window.mintNFT = mintNFT;

// ============================================
// MARKETPLACE FUNCTIONS
// ============================================

// Load user's NFTs
async function loadMyNFTs() {
  if (!state.connected || !state.address) {
    renderMyNFTs();
    return;
  }

  const contractAddr = CONFIG.contractAddressV2 !== '0x0000000000000000000000000000000000000000' 
    ? CONFIG.contractAddressV2 
    : null;

  if (!contractAddr) {
    // Placeholder data for demo
    state.myNFTs = [];
    renderMyNFTs();
    return;
  }

  try {
    const tokenIds = await readContract(state.wagmiConfig, {
      address: contractAddr,
      abi: CONTRACT_ABI_V2,
      functionName: 'getNFTsByOwner',
      args: [state.address]
    });

    state.myNFTs = [];
    for (const tokenId of tokenIds) {
      const [owner, rarity, mintedAt, isListed, listingPrice] = await readContract(state.wagmiConfig, {
        address: contractAddr,
        abi: CONTRACT_ABI_V2,
        functionName: 'getNFTDetails',
        args: [tokenId]
      });

      state.myNFTs.push({
        tokenId: Number(tokenId),
        rarity: Number(rarity),
        rarityName: CONFIG.rarityNames[Number(rarity)],
        isListed,
        listingPrice: listingPrice ? Number(listingPrice) / 1e18 : 0
      });
    }

    renderMyNFTs();
  } catch (error) {
    console.error('Failed to load NFTs:', error);
    state.myNFTs = [];
    renderMyNFTs();
  }
}

// Render user's NFTs
function renderMyNFTs() {
  const container = document.getElementById('myNftsGrid');
  
  if (!state.connected) {
    container.innerHTML = '<p class="empty-state">Connect wallet to see your NFTs.</p>';
    return;
  }

  if (state.myNFTs.length === 0) {
    container.innerHTML = '<p class="empty-state">You don\'t own any NFTs yet. Mint some!</p>';
    return;
  }

  const icons = { Alpha: '🟢', Gamma: '🟣', Omega: '🟠' };
  const colors = { Alpha: 'alpha', Gamma: 'gamma', Omega: 'omega' };

  container.innerHTML = state.myNFTs.map(nft => `
    <div class="nft-card ${colors[nft.rarityName]}">
      <div class="nft-image">
        <img src="https://picsum.photos/seed/${nft.rarityName.toLowerCase()}${nft.tokenId}/200/200" alt="NFT #${nft.tokenId}">
        <span class="rarity-badge ${colors[nft.rarityName]}">${nft.rarityName}</span>
      </div>
      <div class="nft-info">
        <h4>Token #${nft.tokenId}</h4>
        <p>${icons[nft.rarityName]} ${nft.rarityName}</p>
        ${nft.isListed 
          ? `<p class="listed-badge">🏷️ Listed at ${nft.listingPrice} ETH</p>
             <button class="btn btn-secondary" onclick="cancelListing(${nft.tokenId})">Cancel Listing</button>`
          : `<button class="btn btn-primary" onclick="listNFT(${nft.tokenId})">List for Sale</button>`
        }
      </div>
    </div>
  `).join('');
}

// Load marketplace listings
async function loadMarketplaceListings() {
  const contractAddr = CONFIG.contractAddressV2 !== '0x0000000000000000000000000000000000000000' 
    ? CONFIG.contractAddressV2 
    : null;

  if (!contractAddr) {
    // Placeholder for demo
    state.marketplaceListings = [];
    document.getElementById('totalListed').textContent = '0';
    renderMarketplace();
    return;
  }

  try {
    const [tokenIds, sellers, prices] = await readContract(state.wagmiConfig, {
      address: contractAddr,
      abi: CONTRACT_ABI_V2,
      functionName: 'getActiveListings'
    });

    state.marketplaceListings = [];
    for (let i = 0; i < tokenIds.length; i++) {
      const rarityName = await readContract(state.wagmiConfig, {
        address: contractAddr,
        abi: CONTRACT_ABI_V2,
        functionName: 'getRarityName',
        args: [tokenIds[i]]
      });

      state.marketplaceListings.push({
        tokenId: Number(tokenIds[i]),
        seller: sellers[i],
        price: Number(prices[i]) / 1e18,
        rarityName,
        rarity: CONFIG.rarityNames.indexOf(rarityName)
      });
    }

    document.getElementById('totalListed').textContent = state.marketplaceListings.length;
    renderMarketplace();
  } catch (error) {
    console.error('Failed to load listings:', error);
    state.marketplaceListings = [];
    renderMarketplace();
  }
}

// Render marketplace
function renderMarketplace() {
  const container = document.getElementById('marketplaceGrid');
  
  let listings = state.marketplaceListings;
  if (state.marketplaceFilter !== 'all') {
    listings = listings.filter(l => l.rarity === state.marketplaceFilter);
  }

  if (listings.length === 0) {
    container.innerHTML = '<p class="empty-state">No NFTs listed for sale yet.</p>';
    return;
  }

  const icons = { Alpha: '🟢', Gamma: '🟣', Omega: '🟠' };
  const colors = { Alpha: 'alpha', Gamma: 'gamma', Omega: 'omega' };

  container.innerHTML = listings.map(nft => `
    <div class="marketplace-card ${colors[nft.rarityName]}">
      <div class="nft-image">
        <img src="https://picsum.photos/seed/${nft.rarityName.toLowerCase()}${nft.tokenId}/200/200" alt="NFT #${nft.tokenId}">
        <span class="rarity-badge ${colors[nft.rarityName]}">${nft.rarityName}</span>
      </div>
      <div class="nft-info">
        <h4>Token #${nft.tokenId}</h4>
        <p>${icons[nft.rarityName]} ${nft.rarityName}</p>
        <p class="price-tag">💰 ${nft.price} ETH</p>
        <p class="seller">Seller: ${nft.seller.slice(0,6)}...${nft.seller.slice(-4)}</p>
        ${state.address?.toLowerCase() !== nft.seller.toLowerCase() 
          ? `<button class="btn btn-buy" onclick="buyNFT(${nft.tokenId})">Buy Now</button>`
          : `<span class="own-listing">Your listing</span>`
        }
      </div>
    </div>
  `).join('');
}

// List an NFT for sale
async function listNFT(tokenId) {
  if (!state.connected) {
    showToast('Please connect your wallet first', 'error');
    return;
  }

  const contractAddr = CONFIG.contractAddressV2;
  if (contractAddr === '0x0000000000000000000000000000000000000000') {
    showToast('Marketplace contract not deployed yet', 'error');
    return;
  }

  try {
    showToast(`Listing NFT #${tokenId} for 0.00002 ETH...`, 'info');

    const hash = await writeContract(state.wagmiConfig, {
      address: contractAddr,
      abi: CONTRACT_ABI_V2,
      functionName: 'listNFT',
      args: [BigInt(tokenId)]
    });

    showToast('Transaction submitted! Waiting for confirmation...', 'success');

    const receipt = await waitForTransactionReceipt(state.wagmiConfig, { hash });

    if (receipt.status === 'success') {
      showToast(`🎉 NFT #${tokenId} listed successfully!`, 'success');
      await loadMyNFTs();
      await loadMarketplaceListings();
    } else {
      showToast('Transaction failed', 'error');
    }
  } catch (error) {
    console.error('List error:', error);
    showToast(`Failed to list: ${error.shortMessage || error.message}`, 'error');
  }
}

// Buy an NFT from marketplace
async function buyNFT(tokenId) {
  if (!state.connected) {
    showToast('Please connect your wallet first', 'error');
    return;
  }

  const contractAddr = CONFIG.contractAddressV2;
  if (contractAddr === '0x0000000000000000000000000000000000000000') {
    showToast('Marketplace contract not deployed yet', 'error');
    return;
  }

  const listing = state.marketplaceListings.find(l => l.tokenId === tokenId);
  if (!listing) {
    showToast('Listing not found', 'error');
    return;
  }

  try {
    showToast(`Buying NFT #${tokenId} for ${listing.price} ETH...`, 'info');

    const priceWei = BigInt(Math.floor(listing.price * 1e18));

    const hash = await writeContract(state.wagmiConfig, {
      address: contractAddr,
      abi: CONTRACT_ABI_V2,
      functionName: 'buyNFT',
      args: [BigInt(tokenId)],
      value: priceWei
    });

    showToast('Transaction submitted! Waiting for confirmation...', 'success');

    const receipt = await waitForTransactionReceipt(state.wagmiConfig, { hash });

    if (receipt.status === 'success') {
      showToast(`🎉 You bought NFT #${tokenId}!`, 'success');
      await loadMyNFTs();
      await loadMarketplaceListings();
    } else {
      showToast('Transaction failed', 'error');
    }
  } catch (error) {
    console.error('Buy error:', error);
    showToast(`Failed to buy: ${error.shortMessage || error.message}`, 'error');
  }
}

// Cancel a listing
async function cancelListing(tokenId) {
  if (!state.connected) {
    showToast('Please connect your wallet first', 'error');
    return;
  }

  const contractAddr = CONFIG.contractAddressV2;
  if (contractAddr === '0x0000000000000000000000000000000000000000') {
    showToast('Marketplace contract not deployed yet', 'error');
    return;
  }

  try {
    showToast(`Cancelling listing for NFT #${tokenId}...`, 'info');

    const hash = await writeContract(state.wagmiConfig, {
      address: contractAddr,
      abi: CONTRACT_ABI_V2,
      functionName: 'cancelListing',
      args: [BigInt(tokenId)]
    });

    showToast('Transaction submitted! Waiting for confirmation...', 'success');

    const receipt = await waitForTransactionReceipt(state.wagmiConfig, { hash });

    if (receipt.status === 'success') {
      showToast(`✅ Listing cancelled for NFT #${tokenId}`, 'success');
      await loadMyNFTs();
      await loadMarketplaceListings();
    } else {
      showToast('Transaction failed', 'error');
    }
  } catch (error) {
    console.error('Cancel error:', error);
    showToast(`Failed to cancel: ${error.shortMessage || error.message}`, 'error');
  }
}

// Tab switching
function switchTab(tab) {
  state.activeTab = tab;
  
  // Update tab buttons
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.remove('active');
  });
  
  const tabContent = document.getElementById(`${tab}Tab`);
  if (tabContent) {
    tabContent.classList.add('active');
  }

  // Load data for the tab
  if (tab === 'my-nfts' && state.connected) {
    loadMyNFTs();
  } else if (tab === 'marketplace') {
    loadMarketplaceListings();
  }
}

// Marketplace filter
function filterMarketplace(filter) {
  state.marketplaceFilter = filter;
  
  // Update filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', 
      (filter === 'all' && btn.textContent === 'All') ||
      (filter === 0 && btn.textContent === 'Alpha') ||
      (filter === 1 && btn.textContent === 'Gamma') ||
      (filter === 2 && btn.textContent === 'Omega')
    );
  });
  
  renderMarketplace();
}

// Make functions available globally
window.listNFT = listNFT;
window.buyNFT = buyNFT;
window.cancelListing = cancelListing;
window.switchTab = switchTab;
window.filterMarketplace = filterMarketplace;

// ============================================
// RECENT MINTS
// ============================================

function addRecentMint(rarity, txHash) {
  const mint = {
    rarity,
    txHash,
    time: new Date().toLocaleTimeString(),
    address: state.address
  };

  state.recentMints.unshift(mint);
  if (state.recentMints.length > 6) {
    state.recentMints.pop();
  }

  renderRecentMints();
}

function renderRecentMints() {
  const container = document.getElementById('recentMints');
  
  if (state.recentMints.length === 0) {
    container.innerHTML = '<p class="empty-state">No mints yet. Be the first!</p>';
    return;
  }

  const icons = { Alpha: '🟢', Gamma: '🟣', Omega: '🟠' };

  container.innerHTML = state.recentMints.map(mint => `
    <div class="recent-mint">
      <div class="recent-mint-icon">${icons[mint.rarity] || '🎨'}</div>
      <div class="recent-mint-info">
        <h4>${mint.rarity} Minted</h4>
        <p>${mint.address?.slice(0, 6)}...${mint.address?.slice(-4)} • ${mint.time}</p>
      </div>
    </div>
  `).join('');
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };
  
  toast.innerHTML = `
    <span>${icons[type]}</span>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  console.log('🎨 NFTminimint initializing...');
  console.log('Chain: Base Mainnet');
  console.log('Wallet: Reown AppKit + Wagmi');

  // Initialize Reown AppKit
  initializeAppKit();

  // Setup connect button
  document.getElementById('connectWallet').addEventListener('click', connectWallet);

  // Update contract link
  if (CONFIG.contractAddress !== '0x0000000000000000000000000000000000000000') {
    document.getElementById('contractLink').href = 
      `https://basescan.org/address/${CONFIG.contractAddress}`;
    document.getElementById('contractLink').textContent = 
      `${CONFIG.contractAddress.slice(0, 6)}...${CONFIG.contractAddress.slice(-4)}`;
  }

  // Check initial connection
  const account = getAccount(state.wagmiConfig);
  if (account.isConnected) {
    state.connected = true;
    state.address = account.address;
    updateWalletUI();
    loadContractData();
    loadMyNFTs();
    loadMarketplaceListings();
  }

  console.log('✅ NFTminimint ready!');
}

// Start app
document.addEventListener('DOMContentLoaded', init);

// Export for debugging
window.nftminimint = { state, CONFIG };
