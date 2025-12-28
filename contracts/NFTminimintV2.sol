// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title NFTminimintV2
 * @dev ERC721 NFT contract with 3 rarities and built-in marketplace
 * @notice Script-friendly architecture for programmatic interactions
 */
contract NFTminimintV2 is ERC721, ERC721Enumerable, Ownable {
    using Strings for uint256;

    // ============ Enums ============
    enum Rarity { Alpha, Gamma, Omega }

    // ============ Structs ============
    struct NFTMetadata {
        Rarity rarity;
        uint256 mintedAt;
    }

    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    // ============ Constants ============
    uint256 public constant ALPHA_PRICE = 0.00005 ether;
    uint256 public constant GAMMA_PRICE = 0.00006 ether;
    uint256 public constant OMEGA_PRICE = 0.00007 ether;
    uint256 public constant MARKETPLACE_PRICE = 0.00002 ether;

    // ============ State Variables ============
    uint256 private _tokenIdCounter;
    string private _baseTokenURI;

    // NFT metadata mapping
    mapping(uint256 => NFTMetadata) public nftMetadata;

    // Marketplace listings
    mapping(uint256 => Listing) public listings;

    // Track minted counts per rarity
    uint256 public alphaMinted;
    uint256 public gammaMinted;
    uint256 public omegaMinted;

    // ============ Events ============
    // Minting events
    event AlphaMinted(address indexed minter, uint256 indexed tokenId, uint256 timestamp);
    event GammaMinted(address indexed minter, uint256 indexed tokenId, uint256 timestamp);
    event OmegaMinted(address indexed minter, uint256 indexed tokenId, uint256 timestamp);

    // Marketplace events
    event NFTListed(address indexed seller, uint256 indexed tokenId, uint256 price, uint256 timestamp);
    event NFTSold(address indexed seller, address indexed buyer, uint256 indexed tokenId, uint256 price, uint256 timestamp);
    event ListingCancelled(address indexed seller, uint256 indexed tokenId, uint256 timestamp);

    // ============ Constructor ============
    constructor() ERC721("NFTminimint", "MINI") Ownable(msg.sender) {
        _baseTokenURI = "https://nftminimint.vercel.app/metadata/";
    }

    // ============ Minting Functions ============
    
    /**
     * @dev Mint an Alpha rarity NFT
     * @notice Price: 0.00005 ETH
     */
    function mintAlpha() external payable returns (uint256) {
        require(msg.value >= ALPHA_PRICE, "Insufficient payment for Alpha");
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _safeMint(msg.sender, tokenId);
        nftMetadata[tokenId] = NFTMetadata({
            rarity: Rarity.Alpha,
            mintedAt: block.timestamp
        });
        
        alphaMinted++;
        emit AlphaMinted(msg.sender, tokenId, block.timestamp);
        
        // Refund excess payment
        if (msg.value > ALPHA_PRICE) {
            payable(msg.sender).transfer(msg.value - ALPHA_PRICE);
        }
        
        return tokenId;
    }

    /**
     * @dev Mint a Gamma rarity NFT
     * @notice Price: 0.00006 ETH
     */
    function mintGamma() external payable returns (uint256) {
        require(msg.value >= GAMMA_PRICE, "Insufficient payment for Gamma");
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _safeMint(msg.sender, tokenId);
        nftMetadata[tokenId] = NFTMetadata({
            rarity: Rarity.Gamma,
            mintedAt: block.timestamp
        });
        
        gammaMinted++;
        emit GammaMinted(msg.sender, tokenId, block.timestamp);
        
        // Refund excess payment
        if (msg.value > GAMMA_PRICE) {
            payable(msg.sender).transfer(msg.value - GAMMA_PRICE);
        }
        
        return tokenId;
    }

    /**
     * @dev Mint an Omega rarity NFT
     * @notice Price: 0.00007 ETH
     */
    function mintOmega() external payable returns (uint256) {
        require(msg.value >= OMEGA_PRICE, "Insufficient payment for Omega");
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _safeMint(msg.sender, tokenId);
        nftMetadata[tokenId] = NFTMetadata({
            rarity: Rarity.Omega,
            mintedAt: block.timestamp
        });
        
        omegaMinted++;
        emit OmegaMinted(msg.sender, tokenId, block.timestamp);
        
        // Refund excess payment
        if (msg.value > OMEGA_PRICE) {
            payable(msg.sender).transfer(msg.value - OMEGA_PRICE);
        }
        
        return tokenId;
    }

    // ============ Marketplace Functions ============

    /**
     * @dev List an NFT for sale at the fixed marketplace price
     * @param tokenId The token ID to list
     * @notice Fixed price: 0.00002 ETH
     */
    function listNFT(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(!listings[tokenId].active, "Already listed");
        
        // Approve contract to transfer the NFT
        approve(address(this), tokenId);
        
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: MARKETPLACE_PRICE,
            active: true
        });
        
        emit NFTListed(msg.sender, tokenId, MARKETPLACE_PRICE, block.timestamp);
    }

    /**
     * @dev List an NFT with custom price (for flexibility)
     * @param tokenId The token ID to list
     * @param price Custom price in wei
     */
    function listNFTWithPrice(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(!listings[tokenId].active, "Already listed");
        require(price > 0, "Price must be greater than 0");
        
        // Approve contract to transfer the NFT
        approve(address(this), tokenId);
        
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });
        
        emit NFTListed(msg.sender, tokenId, price, block.timestamp);
    }

    /**
     * @dev Buy a listed NFT
     * @param tokenId The token ID to buy
     */
    function buyNFT(uint256 tokenId) external payable {
        Listing storage listing = listings[tokenId];
        require(listing.active, "NFT not listed");
        require(msg.value >= listing.price, "Insufficient payment");
        require(msg.sender != listing.seller, "Cannot buy your own NFT");
        
        address seller = listing.seller;
        uint256 price = listing.price;
        
        // Clear listing
        listing.active = false;
        listing.seller = address(0);
        listing.price = 0;
        
        // Transfer NFT to buyer
        _transfer(seller, msg.sender, tokenId);
        
        // Transfer payment to seller
        payable(seller).transfer(price);
        
        // Refund excess payment
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        emit NFTSold(seller, msg.sender, tokenId, price, block.timestamp);
    }

    /**
     * @dev Cancel a listing
     * @param tokenId The token ID to unlist
     */
    function cancelListing(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(listing.active, "NFT not listed");
        require(listing.seller == msg.sender, "Not the seller");
        
        listing.active = false;
        listing.seller = address(0);
        listing.price = 0;
        
        emit ListingCancelled(msg.sender, tokenId, block.timestamp);
    }

    // ============ View Functions ============

    /**
     * @dev Get listing details for a token
     * @param tokenId The token ID to query
     */
    function getListing(uint256 tokenId) external view returns (
        address seller,
        uint256 price,
        bool active
    ) {
        Listing storage listing = listings[tokenId];
        return (listing.seller, listing.price, listing.active);
    }

    /**
     * @dev Get NFT details including rarity and mint time
     * @param tokenId The token ID to query
     */
    function getNFTDetails(uint256 tokenId) external view returns (
        address owner,
        Rarity rarity,
        uint256 mintedAt,
        bool isListed,
        uint256 listingPrice
    ) {
        NFTMetadata storage metadata = nftMetadata[tokenId];
        Listing storage listing = listings[tokenId];
        
        return (
            ownerOf(tokenId),
            metadata.rarity,
            metadata.mintedAt,
            listing.active,
            listing.price
        );
    }

    /**
     * @dev Get all active listings (for marketplace display)
     * @notice Returns arrays of tokenIds and prices for active listings
     */
    function getActiveListings() external view returns (
        uint256[] memory tokenIds,
        address[] memory sellers,
        uint256[] memory prices
    ) {
        uint256 total = _tokenIdCounter;
        uint256 activeCount = 0;
        
        // Count active listings
        for (uint256 i = 0; i < total; i++) {
            if (listings[i].active) {
                activeCount++;
            }
        }
        
        // Populate arrays
        tokenIds = new uint256[](activeCount);
        sellers = new address[](activeCount);
        prices = new uint256[](activeCount);
        
        uint256 index = 0;
        for (uint256 i = 0; i < total; i++) {
            if (listings[i].active) {
                tokenIds[index] = i;
                sellers[index] = listings[i].seller;
                prices[index] = listings[i].price;
                index++;
            }
        }
        
        return (tokenIds, sellers, prices);
    }

    /**
     * @dev Get NFTs owned by an address
     * @param owner The address to query
     */
    function getNFTsByOwner(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](balance);
        
        for (uint256 i = 0; i < balance; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }
        
        return tokenIds;
    }

    /**
     * @dev Get rarity name as string
     * @param tokenId The token ID to query
     */
    function getRarityName(uint256 tokenId) external view returns (string memory) {
        Rarity rarity = nftMetadata[tokenId].rarity;
        if (rarity == Rarity.Alpha) return "Alpha";
        if (rarity == Rarity.Gamma) return "Gamma";
        return "Omega";
    }

    /**
     * @dev Get total supply of NFTs minted
     */
    function getTotalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @dev Get minting statistics
     */
    function getMintStats() external view returns (
        uint256 totalMinted,
        uint256 alphaCount,
        uint256 gammaCount,
        uint256 omegaCount
    ) {
        return (_tokenIdCounter, alphaMinted, gammaMinted, omegaMinted);
    }

    // ============ Owner Functions ============

    /**
     * @dev Set base URI for token metadata
     * @param baseURI New base URI
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
    }

    // ============ Override Functions ============

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId < _tokenIdCounter, "Token does not exist");
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString(), ".json"));
    }

    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
