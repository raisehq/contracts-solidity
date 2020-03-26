pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IUniswapSwapper.sol";
import "../interfaces/IUniswapSwapperFactory.sol";


contract DoubleSwapUniswapSwapperMock {
    constructor() public {}

    function tryDoubleSwap(
        address swapFactory,
        address inputTokenAddress,
        address outputTokenAddress
    ) external {
        address swapAddress = IUniswapSwapperFactory(swapFactory).deploy();
        IERC20(inputTokenAddress).approve(swapAddress, 2000 ether);
        IUniswapSwapper(swapAddress).swap(
            msg.sender,
            inputTokenAddress,
            outputTokenAddress,
            1000 ether,
            1 ether
        );
        IUniswapSwapper(swapAddress).swap(
            msg.sender,
            inputTokenAddress,
            outputTokenAddress,
            1000 ether,
            1 ether
        );
    }

    function checkDestroyed(
        address swapFactory,
        address inputTokenAddress,
        address outputTokenAddress
    ) external {
        address swapAddress = IUniswapSwapperFactory(swapFactory).deploy();
        IERC20(inputTokenAddress).approve(swapAddress, 2000 ether);
        IUniswapSwapper(swapAddress).swap(
            msg.sender,
            inputTokenAddress,
            outputTokenAddress,
            1000 ether,
            1 ether
        );
        require(IUniswapSwapper(swapAddress).isDestroyed(), "should return true");
    }

    function checkMissingExchange(
        address swapFactory,
        address inputTokenAddress,
        address outputTokenAddress
    ) external {
        address swapAddress = IUniswapSwapperFactory(swapFactory).deploy();
        IERC20(inputTokenAddress).approve(swapAddress, 2000 ether);
        IUniswapSwapper(swapAddress).swap(
            msg.sender,
            inputTokenAddress,
            outputTokenAddress,
            1000 ether,
            1 ether
        );
    }

    function tryDoubleEthSwap(address swapFactory, address outputTokenAddress) external payable {
        address swapAddress = IUniswapSwapperFactory(swapFactory).deploy();
        IUniswapSwapper(swapAddress).swapEth.value(1 ether)(msg.sender, outputTokenAddress, 10 ether);
        IUniswapSwapper(swapAddress).swapEth.value(1 ether)(msg.sender, outputTokenAddress, 10 ether);
    }

    function checkDestroyedEthSwap(address swapFactory, address outputTokenAddress)
        external
        payable
    {
        address swapAddress = IUniswapSwapperFactory(swapFactory).deploy();
        IUniswapSwapper(swapAddress).swapEth.value(1 ether)(msg.sender, outputTokenAddress, 100 ether);
        require(IUniswapSwapper(swapAddress).isDestroyed(), "should return true");
    }

    function checkMissingExchangeEthSwap(address swapFactory, address outputTokenAddress)
        external
        payable
    {
        address swapAddress = IUniswapSwapperFactory(swapFactory).deploy();
        IUniswapSwapper(swapAddress).swapEth.value(1 ether)(msg.sender, outputTokenAddress, 100 ether);
    }
}
