pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';


contract KYCRegistry is Ownable {
    mapping(address => bool) KYCConfirmed;

    event RemoveFromKYC(address indexed user);
    event AddToKYC(address indexed user);

    function remove(address addr) public onlyOwner{
        KYCConfirmed[addr] = false;
        emit RemoveFromKYC(addr);
    }

    function add(address addr) public onlyOwner{
        KYCConfirmed[addr] = true;
        emit AddToKYC(addr);
    }

    function isConfirmed(address addr) public view returns (bool) {
        return KYCConfirmed[addr];
    }
}