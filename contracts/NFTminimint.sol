// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title NFTminimint
 * @dev NFT Minting contract on Base Chain with 3 rarities
 * - Alpha: 0.00005 ETH
 * - Gamma: 0.00006 ETH  
 * - Omega: 0.00007 ETH
 */
contract NFTminimint is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    
    // Rarity enum
    enum Rarity { Alpha, Gamma, Omega }
    
    // Pricing in wei
    uint256 public constant ALPHA_PRICE = 0.00005 ether;
    uint256 public constant GAMMA_PRICE = 0.00006 ether;
    uint256 public constant OMEGA_PRICE = 0.00007 ether;
    
    // Supply limits per rarity
    uint256 public constant ALPHA_MAX_SUPPLY = 1000;
    uint256 public constant GAMMA_MAX_SUPPLY = 500;
    uint256 public constant OMEGA_MAX_SUPPLY = 100;
    
    // Current supply tracking
    uint256 public alphaMinted;
    uint256 public gammaMinted;
    uint256 public omegaMinted;
    
    // Token ID counter
    uint256 private _tokenIdCounter;
    
    // Mapping from token ID to rarity
    mapping(uint256 => Rarity) public tokenRarity;
    
    // Base URI for metadata
    string private _baseTokenURI;
    
    // Events
    event NFTMinted(address indexed minter, uint256 indexed tokenId, Rarity rarity, uint256 price);
    event Withdrawn(address indexed owner, uint256 amount);
    
    constructor(string memory baseURI) ERC721("NFTminimint", "MINT") Ownable(msg.sender) {
        _baseTokenURI = baseURI;
    }
    
    /**
     * @dev Get mint price for a rarity
     */
    function getMintPrice(Rarity rarity) public pure returns (uint256) {
        if (rarity == Rarity.Alpha) return ALPHA_PRICE;
        if (rarity == Rarity.Gamma) return GAMMA_PRICE;
        if (rarity == Rarity.Omega) return OMEGA_PRICE;
        revert("Invalid rarity");
    }
    
    /**
     * @dev Get remaining supply for a rarity
     */
    function getRemainingSupply(Rarity rarity) public view returns (uint256) {
        if (rarity == Rarity.Alpha) return ALPHA_MAX_SUPPLY - alphaMinted;
        if (rarity == Rarity.Gamma) return GAMMA_MAX_SUPPLY - gammaMinted;
        if (rarity == Rarity.Omega) return OMEGA_MAX_SUPPLY - omegaMinted;
        revert("Invalid rarity");
    }
    
    /**
     * @dev Get total minted for a rarity
     */
    function getTotalMinted(Rarity rarity) public view returns (uint256) {
        if (rarity == Rarity.Alpha) return alphaMinted;
        if (rarity == Rarity.Gamma) return gammaMinted;
        if (rarity == Rarity.Omega) return omegaMinted;
        revert("Invalid rarity");
    }
    
    /**
     * @dev Mint an NFT of specified rarity
     */
    function mint(Rarity rarity) external payable nonReentrant {
        uint256 price = getMintPrice(rarity);
        require(msg.value >= price, "Insufficient payment");
        
        // Check supply
        if (rarity == Rarity.Alpha) {
            require(alphaMinted < ALPHA_MAX_SUPPLY, "Alpha supply exhausted");
            alphaMinted++;
        } else if (rarity == Rarity.Gamma) {
            require(gammaMinted < GAMMA_MAX_SUPPLY, "Gamma supply exhausted");
            gammaMinted++;
        } else if (rarity == Rarity.Omega) {
            require(omegaMinted < OMEGA_MAX_SUPPLY, "Omega supply exhausted");
            omegaMinted++;
        }
        
        // Mint token
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _safeMint(msg.sender, tokenId);
        tokenRarity[tokenId] = rarity;
        
        // Refund excess payment
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        emit NFTMinted(msg.sender, tokenId, rarity, price);
    }
    
    /**
     * @dev Batch mint multiple NFTs of same rarity
     */
    function batchMint(Rarity rarity, uint256 amount) external payable nonReentrant {
        require(amount > 0 && amount <= 10, "Invalid amount (1-10)");
        
        uint256 price = getMintPrice(rarity) * amount;
        require(msg.value >= price, "Insufficient payment");
        
        for (uint256 i = 0; i < amount; i++) {
            // Check supply
            if (rarity == Rarity.Alpha) {
                require(alphaMinted < ALPHA_MAX_SUPPLY, "Alpha supply exhausted");
                alphaMinted++;
            } else if (rarity == Rarity.Gamma) {
                require(gammaMinted < GAMMA_MAX_SUPPLY, "Gamma supply exhausted");
                gammaMinted++;
            } else if (rarity == Rarity.Omega) {
                require(omegaMinted < OMEGA_MAX_SUPPLY, "Omega supply exhausted");
                omegaMinted++;
            }
            
            uint256 tokenId = _tokenIdCounter;
            _tokenIdCounter++;
            
            _safeMint(msg.sender, tokenId);
            tokenRarity[tokenId] = rarity;
            
            emit NFTMinted(msg.sender, tokenId, rarity, getMintPrice(rarity));
        }
        
        // Refund excess payment
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
    }
    
    /**
     * @dev Get total supply minted
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }
    
    /**
     * @dev Set base URI for metadata
     */
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    /**
     * @dev Withdraw contract balance
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        payable(owner()).transfer(balance);
        emit Withdrawn(owner(), balance);
    }
    
    /**
     * @dev Get rarity name as string
     */
    function getRarityName(uint256 tokenId) public view returns (string memory) {
        require(tokenId < _tokenIdCounter, "Token does not exist");
        
        Rarity rarity = tokenRarity[tokenId];
        if (rarity == Rarity.Alpha) return "Alpha";
        if (rarity == Rarity.Gamma) return "Gamma";
        if (rarity == Rarity.Omega) return "Omega";
        return "Unknown";
    }
    
    // Override functions
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
