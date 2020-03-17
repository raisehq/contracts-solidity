pragma solidity 0.5.12;

interface IDepositRegistry {
    struct Deposit {
        bool deposited;
        bool unlockedForWithdrawal;
    }

    event UserDepositCompleted(address depositRegistry, address indexed user);
    event UserWithdrawnCompleted(address depositRegistry, address indexed user);
    event AddressUnlockedForWithdrawal(address depositRegistry, address indexed user);
    event MigrationFinished(address depositRegistry);

    function setReferralTracker(address) external;

    function setERC20Token(address) external;

    function setKYC(address) external;

    function setAdministrator(address _admin) external;

    function migrate(address[] calldata depositors, address oldDeposit) external;

    function finishMigration() external;

    function depositFor(address from) external returns (bool);

    function depositForWithReferral(address from, address referrer) external returns (bool);

    function delegateDeposit(address to) external returns (bool);

    function withdraw(address to) external;

    function unlockAddressForWithdrawal(address user) external;

    function hasDeposited(address user) external view returns (bool);

    function isUnlocked(address user) external view returns (bool);

    function getERC20Token() external view returns (address);

    function getDepositRegistryByUser(address user) external view returns (address);
}
