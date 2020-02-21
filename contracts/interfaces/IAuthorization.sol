pragma solidity 0.5.12;

interface IAuthorization {
    function getKycAddress() external view returns (address);

    function getDepositAddress() external view returns (address);

    function hasDeposited(address user) external view returns (bool);

    function isKYCConfirmed(address user) external view returns (bool);

    function setKYCRegistry(address _kycAddress) external returns (bool);

    function setDepositRegistry(address _depositAddress) external returns (bool);
}
