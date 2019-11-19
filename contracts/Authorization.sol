pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./DepositRegistry.sol";
import "./KYCRegistry.sol";

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

    function setKYCRegistry(address kycAddress) public onlyOwner returns (bool) {
        kyc = KYCRegistry(kycAddress);
        return true;
    }

    function setDepositRegistry(address depositAddress) public onlyOwner returns (bool) {
        deposit = DepositRegistry(depositAddress);
        return true;
    }
}
