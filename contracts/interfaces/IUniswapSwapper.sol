pragma solidity 0.5.12;


interface IUniswapSwapper {
    event Swap(
        address caller,
        address guy,
        address inputToken,
        address outputToken,
        uint256 inputTokenAmount,
        uint256 outputTokenAmount,
        uint256 inputTokenSpent
    );

    function init(address _factoryAddress) external returns (bool);

    function isDestroyed() external view returns (bool);

    function swap(
        address payable guy,
        address inputTokenAddress,
        address outputTokenAddress,
        uint256 inputTokenAmount,
        uint256 outputTokenAmount
    ) external;

    function swapEth(address payable guy, address outputTokenAddress, uint256 outputTokenAmount)
        external
        payable;
}
