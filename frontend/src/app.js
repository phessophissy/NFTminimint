// NFTminimint - NFT Minting on Base Chain
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
  // Contract address - UPDATE AFTER DEPLOYMENT
  contractAddress: '0x0000000000000000000000000000000000000000',
  
  // Reown Project ID - Get from https://cloud.reown.com
  projectId: 'e9132f1c6b85ec793477f0e28cbdeaba',
  
  // Pricing in ETH
  prices: {
    alpha: '0.00005',
    gamma: '0.00006',
    omega: '0.00007'
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

// Contract ABI (simplified for minting)
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

// ============================================
// STATE
// ============================================

let state = {
  connected: false,
  address: null,
  appKit: null,
  wagmiConfig: null,
  recentMints: []
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
  }

  console.log('✅ NFTminimint ready!');
}

// Start app
document.addEventListener('DOMContentLoaded', init);

// Export for debugging
window.nftminimint = { state, CONFIG };
