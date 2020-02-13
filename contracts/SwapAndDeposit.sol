pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./interfaces/IDepositRegistry.sol";
import "./interfaces/IUniswapFactory.sol";
import "./interfaces/IUniswapExchange.sol";

contract SwapAndDeposit {
    using SafeMath for uint256;

    address depositAddress;
    address factoryAddress;

    bool isTemplate;

    uint8 constant DEADLINE_BLOCK_LENGTH = 60;
    uint256 constant DEPOSIT_AMOUNT = 200 ether;

    event SwapDeposit(address loan, address guy);

    constructor() public {
        isTemplate = true;
    }

    modifier notTemplate() {
        require(isTemplate == false, "is template contract");
        _;
    }

    function init(address _depositAddress, address _factoryAddress)
        external
        notTemplate
        returns (bool)
    {
        require(depositAddress != address(0), "already init");
        depositAddress = _depositAddress;
        factoryAddress = _factoryAddress;
    }

    function swapTokenToTokenOutput(
        address depositor,
        address inputTokenAddress,
        address outputTokenAddress,
        uint256 inputTokenAmount,
        uint256 outputTokenAmount
    ) internal returns (bool) {
        require(
            IERC20(inputTokenAddress).allowance(msg.sender, address(this)) >= inputTokenAmount,
            "Transfer not allowed"
        );
        require(
            IERC20(inputTokenAddress).transferFrom(msg.sender, address(this), inputTokenAmount),
            "Transfer failed"
        );
        address exchangeAddress = IUniswapFactory(factoryAddress).getExchange(inputTokenAddress);
        IERC20(inputTokenAddress).approve(exchangeAddress, inputTokenAmount);
        uint256 inputTokenSpent = IUniswapExchange(exchangeAddress).tokenToTokenSwapOutput(
            outputTokenAmount,
            inputTokenAmount, // at least prevent to consume more input tokens than the transfer
            uint256(-1), // do not check how much eth is sold prior the swap: input token --> eth --> output token
            block.number.add(DEADLINE_BLOCK_LENGTH), // prevent swap to go throught if is not mined after deadline
            outputTokenAddress
        );
        require(inputTokenSpent > 0, "Swap not spent input token");
        IERC20(inputTokenAddress).transfer(depositor, inputTokenAmount.sub(inputTokenSpent));
        require(IERC20(inputTokenAddress).balanceOf(address(this)) == 0, "input token still here");
        return true;
    }

    function delegateDeposit(
        address depositor,
        address outputTokenAddress,
        uint256 outputTokenAmount
    ) internal returns (bool) {
        IERC20(outputTokenAddress).approve(depositAddress, outputTokenAmount);
        require(IDepositRegistry(depositAddress).delegateDeposit(depositor), "Error while deposit");
        require(
            IERC20(outputTokenAddress).balanceOf(address(this)) == 0,
            "output token still here"
        );
        return true;
    }

    function swapAndDeposit(
        address payable depositor,
        address inputTokenAddress,
        uint256 inputTokenAmount
    ) external notTemplate returns (bool) {
        address outputTokenAddress = IDepositRegistry(depositAddress).getERC20Token();
        require(outputTokenAddress != address(0), "output token is 0");
        require(
            swapTokenToTokenOutput(
                depositor,
                inputTokenAddress,
                outputTokenAddress,
                inputTokenAmount,
                DEPOSIT_AMOUNT
            ),
            "error while swapping"
        );
        require(
            delegateDeposit(depositor, outputTokenAddress, DEPOSIT_AMOUNT),
            "error while deposit"
        );
        emit SwapDeposit(msg.sender, depositor);
        // Self destruct this contract
        selfdestruct(depositor);
        // KEEP IN MIND TO PREVENT MASTER CONTRACT TO EXECUTE SELF-DESTRUCT
    }

}
