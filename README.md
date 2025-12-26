# NFTminimint

NFT minting platform on Base Chain with three rarity tiers.

## Rarities & Pricing

| Rarity | Price | Max Supply |
|--------|-------|------------|
| **Alpha** 🟢 | 0.00005 ETH | 1,000 |
| **Gamma** 🟣 | 0.00006 ETH | 500 |
| **Omega** 🟠 | 0.00007 ETH | 100 |

## Tech Stack

- **Blockchain:** Base Chain (Mainnet)
- **Smart Contract:** Solidity (ERC721)
- **Frontend:** Vanilla JS + Vite
- **Wallet:** Reown AppKit + Wagmi

## Project Structure

```
NFTminimint/
├── contracts/
│   └── NFTminimint.sol    # ERC721 contract
└── frontend/
    ├── src/app.js         # Main app logic
    ├── index.html         # Frontend UI
    └── public/
        └── styles.css     # Styling
```

## Setup

```bash
cd frontend
npm install
npm run dev
```

## Deploy Contract

Deploy `contracts/NFTminimint.sol` to Base Chain using Remix, Hardhat, or Foundry.

After deployment, update the contract address in `frontend/src/app.js`:

```javascript
contractAddress: '0xYOUR_CONTRACT_ADDRESS',
```

## Live Demo

https://nftminimint.vercel.app

## License

MIT
