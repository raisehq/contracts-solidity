pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';


contract KYCRegistry is Ownable {
    mapping(address => bool) KYCConfirmed;

    function remove(address addr) public onlyOwner{
        KYCConfirmed[addr] = false;
    }

    function add(address addr) public onlyOwner{
        KYCConfirmed[addr] = true;
    }

    function isConfirmed(address addr) public view returns (bool) {
        return KYCConfirmed[addr];
    }
}