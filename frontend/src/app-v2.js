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
  // Contract address on Base Chain (UPDATE THIS after deploying V2)
  contractAddress: '0x02B7f9205c0e9b3D51E4C473Ea2896eB25E0fbEA',
  
  // Reown Project ID
  projectId: 'e9132f1c6b85ec793477f0e28cbdeaba',
  
  // Pricing in ETH
  prices: {
    alpha: '0.00005',
    gamma: '0.00006',
    omega: '0.00007',
    listing: '0.00002' // Fixed marketplace price
  },
  
  // Max supplies
  maxSupply: {
    alpha: 1000,
    gamma: 500,
    omega: 100
  },
  
  // Rarity names
  rarityNames: ['Alpha', 'Gamma', 'Omega'],
  rarityColors: ['#22c55e', '#a855f7', '#f97316']
};

// Contract ABI for V2 with marketplace
const CONTRACT_ABI = [
  // Minting
  {
    "inputs": [{ "internalType": "enum NFTminimintV2.Rarity", "name": "rarity", "type": "uint8" }],
    "name": "mint",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  // View functions
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
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "tokenRarity",
    "outputs": [{ "internalType": "enum NFTminimintV2.Rarity", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "ownerOf",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Marketplace - List NFT
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "listNFT",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Marketplace - Unlist NFT
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "unlistNFT",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Marketplace - Buy NFT
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "buyNFT",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  // Marketplace - Get active listings
  {
    "inputs": [],
    "name": "getActiveListings",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Marketplace - Get listing count
  {
    "inputs": [],
    "name": "getActiveListingsCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Marketplace - Get listing details
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "getListing",
    "outputs": [
      { "internalType": "address", "name": "seller", "type": "address" },
      { "internalType": "uint256", "name": "price", "type": "uint256" },
      { "internalType": "bool", "name": "active", "type": "bool" },
      { "internalType": "enum NFTminimintV2.Rarity", "name": "rarity", "type": "uint8" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Check if listed
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "isListed",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Get tokens owned by address
  {
    "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
    "name": "getTokensOwnedBy",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Approve (needed for listing)
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Events
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "minter", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "indexed": false, "internalType": "enum NFTminimintV2.Rarity", "name": "rarity", "type": "uint8" },
      { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" }
    ],
    "name": "NFTMinted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "seller", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" }
    ],
    "name": "NFTListed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "seller", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "buyer", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" }
    ],
    "name": "NFTSold",
    "type": "event"
  }
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
  currentTab: 'mint',
  marketplaceFilter: 'all',
  listings: [],
  myNfts: []
};

// ============================================
// REOWN APPKIT + WAGMI SETUP
// ============================================

function initializeAppKit() {
  const wagmiAdapter = new WagmiAdapter({
    networks: [base],
    projectId: CONFIG.projectId,
    ssr: false
  });

  state.wagmiConfig = wagmiAdapter.wagmiConfig;

  state.appKit = createAppKit({
    adapters: [wagmiAdapter],
    networks: [base],
    defaultNetwork: base,
    projectId: CONFIG.projectId,
    metadata: {
      name: 'NFTminimint',
      description: 'Mint & Trade NFTs on Base Chain',
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

  watchAccount(state.wagmiConfig, {
    onChange: (account) => {
      state.connected = account.isConnected;
      state.address = account.address;
      updateWalletUI();
      if (account.isConnected) {
        loadContractData();
        loadMyNFTs();
        loadMarketplace();
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
// TAB NAVIGATION
// ============================================

function switchTab(tab) {
  state.currentTab = tab;
  
  // Update tab buttons
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  const tabMap = {
    'mint': 'mintTab',
    'marketplace': 'marketplaceTab',
    'my-nfts': 'myNftsTab'
  };
  
  document.getElementById(tabMap[tab])?.classList.add('active');
  
  // Load data for active tab
  if (tab === 'marketplace') {
    loadMarketplace();
  } else if (tab === 'my-nfts') {
    loadMyNFTs();
  }
}

// Make switchTab global
window.switchTab = switchTab;

// ============================================
// CONTRACT INTERACTIONS
// ============================================

async function loadContractData() {
  if (CONFIG.contractAddress === '0x0000000000000000000000000000000000000000') {
    console.log('Contract not deployed yet');
    return;
  }

  try {
    const [alphaMinted, gammaMinted, omegaMinted, totalSupply, listingsCount] = await Promise.all([
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
      }),
      readContract(state.wagmiConfig, {
        address: CONFIG.contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'getActiveListingsCount'
      }).catch(() => 0n) // Fallback if V1 contract
    ]);

    document.getElementById('alphaRemaining').textContent = 
      CONFIG.maxSupply.alpha - Number(alphaMinted);
    document.getElementById('gammaRemaining').textContent = 
      CONFIG.maxSupply.gamma - Number(gammaMinted);
    document.getElementById('omegaRemaining').textContent = 
      CONFIG.maxSupply.omega - Number(omegaMinted);
    document.getElementById('totalMinted').textContent = Number(totalSupply);
    document.getElementById('totalListed').textContent = Number(listingsCount);

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

  const rarityName = CONFIG.rarityNames[rarity];
  const prices = [CONFIG.prices.alpha, CONFIG.prices.gamma, CONFIG.prices.omega];
  const price = prices[rarity];

  const cards = document.querySelectorAll('.mint-card');
  const card = cards[rarity];
  const btn = card.querySelector('.btn-mint');
  const originalText = btn.textContent;

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Minting...';

    const priceWei = BigInt(Math.floor(parseFloat(price) * 1e18));

    const hash = await writeContract(state.wagmiConfig, {
      address: CONFIG.contractAddress,
      abi: CONTRACT_ABI,
      functionName: 'mint',
      args: [rarity],
      value: priceWei
    });

    showToast(`Transaction submitted! Waiting for confirmation...`, 'success');

    const receipt = await waitForTransactionReceipt(state.wagmiConfig, { hash });

    if (receipt.status === 'success') {
      showToast(`🎉 ${rarityName} NFT minted successfully!`, 'success');
      addRecentMint(rarityName, hash);
      await loadContractData();
      await loadMyNFTs();
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

window.mintNFT = mintNFT;

// ============================================
// MARKETPLACE - LOAD LISTINGS
// ============================================

async function loadMarketplace() {
  if (!state.wagmiConfig) return;

  const grid = document.getElementById('marketplaceGrid');
  grid.innerHTML = '<p class="loading">Loading marketplace...</p>';

  try {
    const listedTokenIds = await readContract(state.wagmiConfig, {
      address: CONFIG.contractAddress,
      abi: CONTRACT_ABI,
      functionName: 'getActiveListings'
    });

    if (!listedTokenIds || listedTokenIds.length === 0) {
      grid.innerHTML = '<p class="empty-state">No NFTs listed for sale yet.</p>';
      return;
    }

    // Fetch listing details
    const listings = await Promise.all(
      listedTokenIds.map(async (tokenId) => {
        const [seller, price, active, rarity] = await readContract(state.wagmiConfig, {
          address: CONFIG.contractAddress,
          abi: CONTRACT_ABI,
          functionName: 'getListing',
          args: [tokenId]
        });
        return { tokenId: Number(tokenId), seller, price, active, rarity: Number(rarity) };
      })
    );

    state.listings = listings.filter(l => l.active);
    renderMarketplace();

  } catch (error) {
    console.error('Failed to load marketplace:', error);
    grid.innerHTML = '<p class="empty-state">Failed to load marketplace. Contract may not be V2.</p>';
  }
}

function renderMarketplace() {
  const grid = document.getElementById('marketplaceGrid');
  let filtered = state.listings;
  
  if (state.marketplaceFilter !== 'all') {
    filtered = state.listings.filter(l => l.rarity === state.marketplaceFilter);
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<p class="empty-state">No NFTs match this filter.</p>';
    return;
  }

  grid.innerHTML = filtered.map(listing => {
    const rarityName = CONFIG.rarityNames[listing.rarity];
    const isOwn = state.address?.toLowerCase() === listing.seller.toLowerCase();
    
    return `
      <div class="nft-card ${rarityName.toLowerCase()}">
        <div class="nft-image">
          <img src="https://picsum.photos/seed/nft${listing.tokenId}/200/200" alt="NFT #${listing.tokenId}">
          <span class="rarity-badge ${rarityName.toLowerCase()}">${rarityName}</span>
        </div>
        <div class="nft-info">
          <h4>NFT #${listing.tokenId}</h4>
          <p class="seller">Seller: ${listing.seller.slice(0, 6)}...${listing.seller.slice(-4)}</p>
          <div class="price-row">
            <span class="price">${CONFIG.prices.listing} ETH</span>
          </div>
          ${isOwn 
            ? `<button class="btn btn-secondary" onclick="unlistNFT(${listing.tokenId})">Cancel Listing</button>`
            : `<button class="btn btn-buy" onclick="buyNFT(${listing.tokenId})">Buy Now</button>`
          }
        </div>
      </div>
    `;
  }).join('');
}

function filterMarketplace(filter) {
  state.marketplaceFilter = filter;
  
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

window.filterMarketplace = filterMarketplace;

// ============================================
// MARKETPLACE - BUY NFT
// ============================================

async function buyNFT(tokenId) {
  if (!state.connected) {
    showToast('Please connect your wallet first', 'error');
    connectWallet();
    return;
  }

  try {
    showToast('Preparing purchase...', 'info');
    
    const priceWei = BigInt(Math.floor(parseFloat(CONFIG.prices.listing) * 1e18));

    const hash = await writeContract(state.wagmiConfig, {
      address: CONFIG.contractAddress,
      abi: CONTRACT_ABI,
      functionName: 'buyNFT',
      args: [BigInt(tokenId)],
      value: priceWei
    });

    showToast('Transaction submitted! Waiting for confirmation...', 'success');

    const receipt = await waitForTransactionReceipt(state.wagmiConfig, { hash });

    if (receipt.status === 'success') {
      showToast(`🎉 NFT #${tokenId} purchased successfully!`, 'success');
      await loadMarketplace();
      await loadMyNFTs();
      await loadContractData();
    } else {
      showToast('Purchase failed', 'error');
    }

  } catch (error) {
    console.error('Buy error:', error);
    
    if (error.message?.includes('User rejected') || error.code === 4001) {
      showToast('Transaction cancelled', 'error');
    } else if (error.message?.includes('insufficient funds')) {
      showToast('Insufficient ETH balance', 'error');
    } else {
      showToast(`Purchase failed: ${error.shortMessage || error.message}`, 'error');
    }
  }
}

window.buyNFT = buyNFT;

// ============================================
// MY NFTS
// ============================================

async function loadMyNFTs() {
  if (!state.connected || !state.address) {
    document.getElementById('myNftsGrid').innerHTML = 
      '<p class="empty-state">Connect wallet to see your NFTs.</p>';
    return;
  }

  const grid = document.getElementById('myNftsGrid');
  grid.innerHTML = '<p class="loading">Loading your NFTs...</p>';

  try {
    const tokenIds = await readContract(state.wagmiConfig, {
      address: CONFIG.contractAddress,
      abi: CONTRACT_ABI,
      functionName: 'getTokensOwnedBy',
      args: [state.address]
    });

    if (!tokenIds || tokenIds.length === 0) {
      grid.innerHTML = '<p class="empty-state">You don\'t own any NFTs yet. Mint one!</p>';
      return;
    }

    // Get rarity and listing status for each token
    const nfts = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const [rarity, isListed] = await Promise.all([
          readContract(state.wagmiConfig, {
            address: CONFIG.contractAddress,
            abi: CONTRACT_ABI,
            functionName: 'tokenRarity',
            args: [tokenId]
          }),
          readContract(state.wagmiConfig, {
            address: CONFIG.contractAddress,
            abi: CONTRACT_ABI,
            functionName: 'isListed',
            args: [tokenId]
          }).catch(() => false)
        ]);
        return { tokenId: Number(tokenId), rarity: Number(rarity), isListed };
      })
    );

    state.myNfts = nfts;
    renderMyNFTs();

  } catch (error) {
    console.error('Failed to load my NFTs:', error);
    grid.innerHTML = '<p class="empty-state">Failed to load your NFTs.</p>';
  }
}

function renderMyNFTs() {
  const grid = document.getElementById('myNftsGrid');
  
  if (state.myNfts.length === 0) {
    grid.innerHTML = '<p class="empty-state">You don\'t own any NFTs yet. Mint one!</p>';
    return;
  }

  grid.innerHTML = state.myNfts.map(nft => {
    const rarityName = CONFIG.rarityNames[nft.rarity];
    
    return `
      <div class="nft-card ${rarityName.toLowerCase()} ${nft.isListed ? 'listed' : ''}">
        <div class="nft-image">
          <img src="https://picsum.photos/seed/nft${nft.tokenId}/200/200" alt="NFT #${nft.tokenId}">
          <span class="rarity-badge ${rarityName.toLowerCase()}">${rarityName}</span>
          ${nft.isListed ? '<span class="listed-badge">LISTED</span>' : ''}
        </div>
        <div class="nft-info">
          <h4>NFT #${nft.tokenId}</h4>
          ${nft.isListed 
            ? `<p class="status">Listed for ${CONFIG.prices.listing} ETH</p>
               <button class="btn btn-secondary" onclick="unlistNFT(${nft.tokenId})">Cancel Listing</button>`
            : `<button class="btn btn-list" onclick="listNFT(${nft.tokenId})">List for Sale (${CONFIG.prices.listing} ETH)</button>`
          }
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// LIST / UNLIST NFT
// ============================================

async function listNFT(tokenId) {
  if (!state.connected) {
    showToast('Please connect your wallet first', 'error');
    connectWallet();
    return;
  }

  try {
    showToast('Preparing to list NFT...', 'info');

    const hash = await writeContract(state.wagmiConfig, {
      address: CONFIG.contractAddress,
      abi: CONTRACT_ABI,
      functionName: 'listNFT',
      args: [BigInt(tokenId)]
    });

    showToast('Transaction submitted! Waiting for confirmation...', 'success');

    const receipt = await waitForTransactionReceipt(state.wagmiConfig, { hash });

    if (receipt.status === 'success') {
      showToast(`🏷️ NFT #${tokenId} listed for sale!`, 'success');
      await loadMyNFTs();
      await loadMarketplace();
      await loadContractData();
    } else {
      showToast('Listing failed', 'error');
    }

  } catch (error) {
    console.error('List error:', error);
    
    if (error.message?.includes('User rejected') || error.code === 4001) {
      showToast('Transaction cancelled', 'error');
    } else {
      showToast(`Listing failed: ${error.shortMessage || error.message}`, 'error');
    }
  }
}

window.listNFT = listNFT;

async function unlistNFT(tokenId) {
  if (!state.connected) {
    showToast('Please connect your wallet first', 'error');
    return;
  }

  try {
    showToast('Cancelling listing...', 'info');

    const hash = await writeContract(state.wagmiConfig, {
      address: CONFIG.contractAddress,
      abi: CONTRACT_ABI,
      functionName: 'unlistNFT',
      args: [BigInt(tokenId)]
    });

    showToast('Transaction submitted! Waiting for confirmation...', 'success');

    const receipt = await waitForTransactionReceipt(state.wagmiConfig, { hash });

    if (receipt.status === 'success') {
      showToast(`✅ NFT #${tokenId} listing cancelled`, 'success');
      await loadMyNFTs();
      await loadMarketplace();
      await loadContractData();
    } else {
      showToast('Failed to cancel listing', 'error');
    }

  } catch (error) {
    console.error('Unlist error:', error);
    
    if (error.message?.includes('User rejected') || error.code === 4001) {
      showToast('Transaction cancelled', 'error');
    } else {
      showToast(`Failed: ${error.shortMessage || error.message}`, 'error');
    }
  }
}

window.unlistNFT = unlistNFT;

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
  console.log('🎨 NFTminimint V2 initializing...');
  console.log('Chain: Base Mainnet');
  console.log('Features: Mint + Marketplace');

  initializeAppKit();

  document.getElementById('connectWallet').addEventListener('click', connectWallet);

  if (CONFIG.contractAddress !== '0x0000000000000000000000000000000000000000') {
    document.getElementById('contractLink').href = 
      `https://basescan.org/address/${CONFIG.contractAddress}`;
    document.getElementById('contractLink').textContent = 
      `${CONFIG.contractAddress.slice(0, 6)}...${CONFIG.contractAddress.slice(-4)}`;
  }

  const account = getAccount(state.wagmiConfig);
  if (account.isConnected) {
    state.connected = true;
    state.address = account.address;
    updateWalletUI();
    loadContractData();
    loadMyNFTs();
  }

  console.log('✅ NFTminimint V2 ready!');
}

document.addEventListener('DOMContentLoaded', init);

window.nftminimint = { state, CONFIG };
