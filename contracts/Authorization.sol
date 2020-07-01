pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/IDepositRegistry.sol";
import "./interfaces/IKYCRegistry.sol";
import "./interfaces/IAuthorization.sol";

contract Authorization is IAuthorization, Ownable {
    address internal kycAddress;
    address internal depositAddress;

    constructor(address _kycAddress, address _depositAddress) public {
        kycAddress = _kycAddress;
        depositAddress = _depositAddress;
    }

    function getKycAddress() external view returns (address) {
        return kycAddress;
    }

    function getDepositAddress() external view returns (address) {
        return depositAddress;
    }

    function hasDeposited(address user) external view returns (bool) {
        return IDepositRegistry(depositAddress).hasDeposited(user);
    }

    function isKYCConfirmed(address user) external view returns (bool) {
        return IKYCRegistry(kycAddress).isConfirmed(user);
    }

    function setKYCRegistry(address _kycAddress) external onlyOwner returns (bool) {
        kycAddress = _kycAddress;
        return true;
    }

    function setDepositRegistry(address _depositAddress) external onlyOwner returns (bool) {
        depositAddress = _depositAddress;
        return true;
    }
}
