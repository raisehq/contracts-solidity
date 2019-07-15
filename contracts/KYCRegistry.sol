pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract KYCRegistry is Ownable {
    mapping(address => bool) public KYCConfirmed;
    address public admin;

    modifier onlyAdmin() {
        require(msg.sender == admin, "caller is not the admin");
        _;
    }

    event RemovedFromKYC(address indexed user);
    event AddedToKYC(address indexed user);

    function isConfirmed(address addr) public view returns (bool) {
        return KYCConfirmed[addr];
    }

    function setAdministrator(address _admin) public onlyOwner {
        admin = _admin;
    }

    function removeAddressFromKYC(address addr) public onlyAdmin {
        require(KYCConfirmed[addr], "Address not KYCed");
        KYCConfirmed[addr] = false;
        emit RemovedFromKYC(addr);
    }

    function addAddressToKYC(address addr) public onlyAdmin {
        require(!KYCConfirmed[addr], "Address already KYCed");
        KYCConfirmed[addr] = true;
        emit AddedToKYC(addr);
    }
}
