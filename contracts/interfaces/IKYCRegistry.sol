pragma solidity 0.5.10;

interface IKYCRegistry {
    event RemovedFromKYC(address indexed user);
    event AddedToKYC(address indexed user);

    function isConfirmed(address addr) external view returns (bool);

    function setAdministrator(address _admin) external;

    function removeAddressFromKYC(address addr) external;

    function addAddressToKYC(address addr) external;

}
