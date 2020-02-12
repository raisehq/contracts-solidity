pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./IDepositRegistry.sol";
import "./IUniswapFactory.sol";
import "./IUniswapExchange.sol";

contract SwapAndDeposit {
    address public depositAddress;
    address public factoryAddress;
    address public admin;

    IDepositRegistry deposit;
    IUniswapFactory factory;

    uint256 deadlineBlockLength = 60;

    constructor(address _depositAddress, address _factoryAddress) public {
      depositAddress = _depositAddress;
      deposit = IDepositRegistry(depositAddress);
      factoryAddress = _factoryAddress;
      factory = IUniswapFactory(factoryAddress);
      owner = msg.sender;
      admin = msg.sender;
    }

    function setDeadlineBlockLength(uint256 blocks) onlyAdmin {
      deadlineBlockLength = blocks;
    }

    function swapTokenToTokenOutput(
        address swapFrom,
        address inputTokenAddress,
        address outputTokenAddress,
        address depositor,
        uint256 inputTokenAmount,
        uint256 outputTokenAmount
    ) external returns (bool) {
      require(
          IERC20(inputTokenAddress).allowance(msg.sender, address(this)) >= inputTokenAmount),
          "Transfer not allowed"
      );
      require(
          IERC20(inputTokenAddress).transferFrom(msg.sender, address(this), inputTokenAmount),
          "Transfer failed"
      );
      address exchangeAddress = factory.getExchangeAddress(inputTokenAddress)
      uint256 inputTokenSpent = IUniswapExchange(exchangeAddress).tokenToTokenSwapOutput(
          outputTokenAmount,
          inputTokenAmount, // at least prevent to consume more input tokens than the transfer
          uint(-1), // do not check how much eth is sold prior the swap: input token --> eth --> output token 
          block.number + deadlineBlockLength, // prevent swap to go throught if is not mined after deadline
          outputTokenAddress
      );
      require(inputTokenSpent > 0, 'Swap does not spent any input token');
      
      // Approve the 3rd party contract to take tokens from this contract
      IERC20(inputTokenAddress).approve(targetContract, inputTokenAmount);
      
      // Call
      require()

      // Self destruct this contract
      selfdestruct(msg.sender);
    }

    function swapAndDeposit(address swapFrom, address inputTokenAddress, address outputTokenAddress, address depositor, uint256 inputTokenAmount, uint256 outputTokenAmount) {
      this.swapTokenToTokenOutput(
          swapFrom,
          inputTokenAddress,
          outputTokenAddress,
          depositor,
          inputTokenAmount,
          outputTokenAmount)
        }

}
