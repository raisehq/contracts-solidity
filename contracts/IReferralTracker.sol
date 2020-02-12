pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract IReferralTracker {
    IERC20 token;

    event ReferralRegistered(
        address referralAddress,
        address indexed referrer,
        address indexed user
    );
    event ReferralBonusWithdrawn(
        address referralAddress,
        address indexed referrer,
        uint256 amount,
        uint256 currentTrackerBalance
    );
    event FundsAdded(address referralAddress, address fundsDepositor, uint256 amount);
    event FundsRemoved(address referralAddress, address fundsWithdrawer, uint256 amount);

    function getTrackerBalance() external view returns (uint256);

    function setAdministrator(address _admin) external;

    function setToken(address _token) external;

    function addFunds(uint256 amount) external;

    function removeFunds(address to) external;

    function registerReferral(address referrer, address user) external returns (bool);

    function withdraw(address to) external;

}
