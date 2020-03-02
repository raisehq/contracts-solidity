pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ISwapAndDeposit.sol";
import "../interfaces/ISwapAndDepositFactory.sol";

contract DoubleSwapMock {
    constructor() public {}

    function tryDoubleSwap(address swapFactory, address tokenAddress) external {
        address swapAddress = ISwapAndDepositFactory(swapFactory).deploy();
        IERC20(tokenAddress).approve(swapAddress, 2000 ether);
        ISwapAndDeposit(swapAddress).swapAndDeposit(msg.sender, tokenAddress, 1000 ether);
        ISwapAndDeposit(swapAddress).swapAndDeposit(msg.sender, tokenAddress, 1000 ether);
    }

    function checkDestroyed(address swapFactory, address tokenAddress) external {
        address swapAddress = ISwapAndDepositFactory(swapFactory).deploy();
        IERC20(tokenAddress).approve(swapAddress, 2000 ether);
        ISwapAndDeposit(swapAddress).swapAndDeposit(msg.sender, tokenAddress, 1000 ether);
        require(ISwapAndDeposit(swapAddress).isDestroyed(), "should return true");
    }

    function checkMissingExchange(address swapFactory, address tokenAddress) external {
        address swapAddress = ISwapAndDepositFactory(swapFactory).deploy();
        IERC20(tokenAddress).approve(swapAddress, 2000 ether);
        ISwapAndDeposit(swapAddress).swapAndDeposit(msg.sender, tokenAddress, 1000 ether);
        require(ISwapAndDeposit(swapAddress).isDestroyed(), "should return true");
    }
}
