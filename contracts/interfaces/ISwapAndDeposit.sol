pragma solidity 0.5.10;

interface ISwapAndDeposit {
    event SwapDeposit(address loan, address guy);

    function init(address _depositAddress, address _factoryAddress) external returns (bool);

    function swapAndDeposit(address depositor, address inputTokenAddress, uint256 inputTokenAmount)
        external
        returns (bool);
}
