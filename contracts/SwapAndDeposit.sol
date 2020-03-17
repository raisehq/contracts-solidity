pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./interfaces/IDepositRegistry.sol";
import "./interfaces/IUniswapFactory.sol";
import "./interfaces/IUniswapExchange.sol";
import "@nomiclabs/buidler/console.sol";


contract SwapAndDeposit {
    using SafeMath for uint256;

    address depositAddress;
    address factoryAddress;

    bool internal destroyed;
    bool isTemplate;

    uint16 constant DEADLINE_TIME_LENGTH = 300;
    uint256 constant DEPOSIT_AMOUNT = 200 ether;

    event SwapDeposit(address loan, address guy);

    constructor() public {
        isTemplate = true;
    }

    modifier notTemplate() {
        require(isTemplate == false, "is template contract");
        require(destroyed == false, "this contract will selfdestruct");
        _;
    }

    function init(address _depositAddress, address _factoryAddress)
        external
        notTemplate
        returns (bool)
    {
        require(depositAddress == address(0), "deposit already init");
        require(factoryAddress == address(0), "factory already init");
        depositAddress = _depositAddress;
        factoryAddress = _factoryAddress;
        return true;
    }

    function swapTokenToTokenOutput(
        address depositor,
        address inputTokenAddress,
        address outputTokenAddress,
        uint256 inputTokenAmount,
        uint256 outputTokenAmount
    ) internal returns (bool) {
        require(
            IERC20(inputTokenAddress).transferFrom(msg.sender, address(this), inputTokenAmount),
            "error transfer input token to swap"
        );
        IUniswapExchange exchange = IUniswapExchange(
            IUniswapFactory(factoryAddress).getExchange(inputTokenAddress)
        );
        require(address(exchange) != address(0), "exchange can not be 0 address");
        IERC20(inputTokenAddress).approve(address(exchange), inputTokenAmount);
        uint256 inputTokenSpent = exchange.tokenToTokenSwapOutput(
            outputTokenAmount,
            inputTokenAmount, // at least prevent to consume more input tokens than the transfer
            uint256(-1), // do not check how much eth is sold prior the swap: input token --> eth --> output token
            block.timestamp.add(DEADLINE_TIME_LENGTH), // prevent swap to go throught if is not mined after deadline
            outputTokenAddress
        );
        require(inputTokenSpent > 0, "Swap not spent input token");
        require(
            IERC20(inputTokenAddress).transfer(depositor, inputTokenAmount.sub(inputTokenSpent)),
            "error transfer remaining input"
        );
        require(IERC20(inputTokenAddress).balanceOf(address(this)) == 0, "input token still here");
        return true;
    }

    function isDestroyed() external view returns (bool) {
        return destroyed;
    }

    function delegateDeposit(
        address depositor,
        address outputTokenAddress,
        uint256 outputTokenAmount
    ) internal returns (bool) {
        IERC20(outputTokenAddress).approve(depositAddress, outputTokenAmount);
        require(IDepositRegistry(depositAddress).delegateDeposit(depositor), "error while deposit");
        require(IDepositRegistry(depositAddress).hasDeposited(depositor), "should be depositor");
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
    ) external notTemplate {
        require(depositor != address(0), "depositor address can not be 0");
        require(inputTokenAddress != address(0), "input address can not be 0");
        require(inputTokenAmount > 0, "input token amount can not be 0");
        require(depositAddress != address(0) && factoryAddress != address(0), "not init");
        require(
            IDepositRegistry(depositAddress).hasDeposited(depositor) == false,
            "already depositor"
        );
        address outputTokenAddress = IDepositRegistry(depositAddress).getERC20Token();
        require(outputTokenAddress != address(0), "output token can not be 0");
        swapTokenToTokenOutput(
            depositor,
            inputTokenAddress,
            outputTokenAddress,
            inputTokenAmount,
            DEPOSIT_AMOUNT
        );
        delegateDeposit(depositor, outputTokenAddress, DEPOSIT_AMOUNT);
        emit SwapDeposit(msg.sender, depositor);
        // mark this contract as destroyed, so external contract can know this contract is being selfdestruct
        // during this tx, also prevents to call this function during the transaction
        destroyed = true;
        // Self destruct this contract
        selfdestruct(depositor);
    }
}
