pragma solidity ^0.5.0;


import 'openzeppelin-solidity/contracts/token/ERC721/ERC721Mintable.sol';
import 'openzeppelin-solidity/contracts/token/ERC721/ERC721Burnable.sol';
// erc721kyc ???
import './Authorization.sol';

contract LoanToken is ERC721Mintable, ERC721Burnable, ERC721KYC {
    Authorization auth;

    modifier onlyKYC { // should it be in its own separete contract ??
        require(auth.isKYCConfirmed(msg.sender), 'user does not have KYC');
        _;
    }

    constructor(address authAddress, address minterAddress) public {
        auth = Authorization(authAddress);
        // what to do with minterAddress ???
    }

    function mint(address to, uint256 tokenId) public onlyMinter {}
    
    function burn(uint256 tokenId) public onlyMinter {}
    
    function ownerOf(uint256 tokenId) public {}
    
    function transferFrom(address from, address to, uint256 tokenId) public onlyKYC {}
}