pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract KYCRegistry is Ownable {
    mapping(address => bool) public KYCConfirmed;
    address public admin;

    modifier onlyAdmin() {
        require(msg.sender == admin, "caller is not the admin");
        _;
    }

    event RemoveFromKYC(address indexed user);
    event AddToKYC(address indexed user);

    function remove(address addr) public onlyOwner {
        KYCConfirmed[addr] = false;
        emit RemoveFromKYC(addr);
    }

    function add(address addr) public onlyOwner {
        KYCConfirmed[addr] = true;
        emit AddToKYC(addr);
    }

    function isConfirmed(address addr) public view returns (bool) {
        return KYCConfirmed[addr];
    }

    function setAdministrator(address _admin) public onlyOwner {
        admin = _admin;
    }

    function removeAddressFromKYCAdmin(address addr) public onlyAdmin {
        require(KYCConfirmed[addr], "Address not KYCed");
        KYCConfirmed[addr] = false;
        emit RemoveFromKYC(addr);
    }

    function addAddressToKYCAdmin(address addr) public onlyAdmin {
        require(!KYCConfirmed[addr], "Address already KYCed");
        KYCConfirmed[addr] = true;
        emit AddToKYC(addr);
    }
}
