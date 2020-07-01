pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./interfaces/IUniswapSwapper.sol";
import "./interfaces/IUniswapFactory.sol";
import "./interfaces/IUniswapExchange.sol";

contract UniswapSwapper is IUniswapSwapper {
    using SafeMath for uint256;

    bool internal destroyed;
    bool isTemplate;

    address internal factoryAddress;

    uint16 constant DEADLINE_TIME_LENGTH = 300;

    event Swap(
        address caller,
        address guy,
        address inputToken,
        address outputToken,
        uint256 inputTokenAmount,
        uint256 outputTokenAmount,
        uint256 inputTokenSpent,
        address factoryAddress
    );

    constructor() public {
        isTemplate = true;
    }

    function init(address _factoryAddress) external notTemplate returns (bool) {
        require(factoryAddress == address(0), "factory already init");
        factoryAddress = _factoryAddress;
        return true;
    }

    modifier notTemplate() {
        require(isTemplate == false, "is template contract");
        require(destroyed == false, "this contract will selfdestruct");
        _;
    }

    function swapTokenToTokenOutput(
        address caller,
        address guy,
        address inputTokenAddress,
        address outputTokenAddress,
        uint256 inputTokenAmount,
        uint256 outputTokenAmount
    ) internal returns (uint256) {
        // Prevent DDOS erc20 attack by calculating balance offset, so if one maliciuous user sends 1 WEI
        // of ERC20 to a precomputed address, it still works.
        uint256 inputBalancePriorOps = IERC20(inputTokenAddress).balanceOf(address(this));
        uint256 outputBalancePriorOps = IERC20(outputTokenAddress).balanceOf(address(this));
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
            IERC20(inputTokenAddress).transfer(guy, inputTokenAmount.sub(inputTokenSpent)),
            "error transfer remaining input"
        );
        require(
            IERC20(outputTokenAddress).transfer(caller, outputTokenAmount),
            "error transfer remaining output"
        );
        require(
            IERC20(inputTokenAddress).balanceOf(address(this)) == inputBalancePriorOps,
            "input token still here"
        );
        require(
            IERC20(outputTokenAddress).balanceOf(address(this)) == outputBalancePriorOps,
            "output token still here"
        );
        return inputTokenSpent;
    }

    function isDestroyed() external view returns (bool) {
        return destroyed;
    }

    function swapEth(
        address payable guy,
        address outputTokenAddress,
        uint256 outputTokenAmount
    ) external payable notTemplate {
        require(factoryAddress != address(0), "factory address not init");
        require(guy != address(0), "guy address can not be 0");
        require(outputTokenAddress != address(0), "output token can not be 0");
        require(msg.value > 0, "ETH value amount can not be 0");
        require(outputTokenAmount > 0, "output token amount can not be 0");

        // Prevent DDOS erc20 attack by calculating balance offset, so if one maliciuous user sends 1 WEI
        // of ERC20 to a precomputed address, it still works.
        uint256 outputBalancePriorOps = IERC20(outputTokenAddress).balanceOf(address(this));
        IUniswapExchange exchange = IUniswapExchange(
            IUniswapFactory(factoryAddress).getExchange(outputTokenAddress)
        );
        require(address(exchange) != address(0), "exchange can not be 0 address");
        uint256 ethCost = exchange.getEthToTokenOutputPrice(outputTokenAmount);
        require(ethCost <= msg.value, "Eth costs greater than input");
        uint256 ethSpent = exchange.ethToTokenSwapOutput.value(ethCost)(
            outputTokenAmount,
            block.timestamp.add(DEADLINE_TIME_LENGTH) // prevent swap to go throught if is not mined after deadline
        );
        require(ethSpent > 0, "ETH not spent");
        require(
            IERC20(outputTokenAddress).balanceOf(address(this)) ==
                outputBalancePriorOps.add(outputTokenAmount),
            "no output token from uniswap"
        );
        require(
            IERC20(outputTokenAddress).transfer(msg.sender, outputTokenAmount),
            "error transfer remaining output"
        );
        require(
            IERC20(outputTokenAddress).balanceOf(address(this)) == outputBalancePriorOps,
            "output token still here"
        );
        emit Swap(
            msg.sender,
            guy,
            address(0),
            outputTokenAddress,
            msg.value,
            outputTokenAmount,
            ethSpent,
            factoryAddress
        );
        // mark this contract as destroyed, so external contract can know this contract is being selfdestruct
        // during this tx, also prevents to call this function again during the transaction
        destroyed = true;
        // Self destruct this contract and send the remaining eth to the user
        selfdestruct(guy);
    }

    function swap(
        address payable guy,
        address inputTokenAddress,
        address outputTokenAddress,
        uint256 inputTokenAmount,
        uint256 outputTokenAmount
    ) external notTemplate {
        require(factoryAddress != address(0), "factory address not init");
        require(guy != address(0), "depositor address can not be 0");
        require(inputTokenAddress != address(0), "input address can not be 0");
        require(outputTokenAddress != address(0), "output token can not be 0");
        require(inputTokenAmount > 0, "input token amount can not be 0");
        require(outputTokenAmount > 0, "output token amount can not be 0");
        uint256 inputTokenSpent = swapTokenToTokenOutput(
            msg.sender,
            guy,
            inputTokenAddress,
            outputTokenAddress,
            inputTokenAmount,
            outputTokenAmount
        );
        emit Swap(
            msg.sender,
            guy,
            inputTokenAddress,
            outputTokenAddress,
            inputTokenAmount,
            outputTokenAmount,
            inputTokenSpent,
            factoryAddress
        );
        // mark this contract as destroyed, so external contract can know this contract is being selfdestruct
        // during this tx, also prevents to call this function again during the transaction
        destroyed = true;
        // Self destruct this contract
        selfdestruct(guy);
    }
}
