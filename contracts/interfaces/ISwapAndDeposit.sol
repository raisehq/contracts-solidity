pragma solidity 0.5.12;


interface ISwapAndDeposit {
    event SwapDeposit(address loan, address guy);

    function init(address _depositAddress, address _factoryAddress) external returns (bool);

    function isDestroyed() external view returns (bool);

    function swapAndDeposit(
        address payable depositor,
        address inputTokenAddress,
        uint256 inputTokenAmount
    ) external;
}
