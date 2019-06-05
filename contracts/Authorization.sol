pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import './DepositRegistry.sol';
import './KYCRegistry.sol';

contract Authorization is Ownable {
    KYCRegistry kyc;
    DepositRegistry deposit;

    constructor(address kycAddr, address depositAddr) public {
        kyc = KYCRegistry(kycAddr);
        deposit = DepositRegistry(depositAddr);
    }

    function hasDeposited(address user) public view returns (bool) {
        return deposit.hasDeposited(user);
    }

    function isKYCConfirmed(address user) public view returns (bool) {
        return kyc.isConfirmed(user);
    }
}