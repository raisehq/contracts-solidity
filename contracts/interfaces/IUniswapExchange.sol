pragma solidity 0.5.12;

interface IUniswapExchange {
    // Address of ERC20 token sold on this exchange
    function tokenAddress() external view returns (address token);
    // Address of Uniswap Factory
    function factoryAddress() external view returns (address factory);
    // Provide Liquidity
    function addLiquidity(uint256 min_liquidity, uint256 max_tokens, uint256 deadline)
        external
        payable
        returns (uint256);
    function removeLiquidity(uint256 amount, uint256 min_eth, uint256 min_tokens, uint256 deadline)
        external
        returns (uint256, uint256);
    // Get Prices
    function getEthToTokenInputPrice(uint256 eth_sold)
        external
        view
        returns (uint256 tokens_bought);
    function getEthToTokenOutputPrice(uint256 tokens_bought)
        external
        view
        returns (uint256 eth_sold);
    function getTokenToEthInputPrice(uint256 tokens_sold)
        external
        view
        returns (uint256 eth_bought);
    function getTokenToEthOutputPrice(uint256 eth_bought)
        external
        view
        returns (uint256 tokens_sold);
    // Trade ETH to ERC20
    function ethToTokenSwapInput(uint256 min_tokens, uint256 deadline)
        external
        payable
        returns (uint256 tokens_bought);
    function ethToTokenTransferInput(uint256 min_tokens, uint256 deadline, address recipient)
        external
        payable
        returns (uint256 tokens_bought);
    function ethToTokenSwapOutput(uint256 tokens_bought, uint256 deadline)
        external
        payable
        returns (uint256 eth_sold);
    function ethToTokenTransferOutput(uint256 tokens_bought, uint256 deadline, address recipient)
        external
        payable
        returns (uint256 eth_sold);
    // Trade ERC20 to ETH
    function tokenToEthSwapInput(uint256 tokens_sold, uint256 min_eth, uint256 deadline)
        external
        returns (uint256 eth_bought);
    function tokenToEthTransferInput(
        uint256 tokens_sold,
        uint256 min_eth,
        uint256 deadline,
        address recipient
    ) external returns (uint256 eth_bought);
    function tokenToEthSwapOutput(uint256 eth_bought, uint256 max_tokens, uint256 deadline)
        external
        returns (uint256 tokens_sold);
    function tokenToEthTransferOutput(
        uint256 eth_bought,
        uint256 max_tokens,
        uint256 deadline,
        address recipient
    ) external returns (uint256 tokens_sold);
    // Trade ERC20 to ERC20
    function tokenToTokenSwapInput(
        uint256 tokens_sold,
        uint256 min_tokens_bought,
        uint256 min_eth_bought,
        uint256 deadline,
        address token_addr
    ) external returns (uint256 tokens_bought);
    function tokenToTokenTransferInput(
        uint256 tokens_sold,
        uint256 min_tokens_bought,
        uint256 min_eth_bought,
        uint256 deadline,
        address recipient,
        address token_addr
    ) external returns (uint256 tokens_bought);
    function tokenToTokenSwapOutput(
        uint256 tokens_bought,
        uint256 max_tokens_sold,
        uint256 max_eth_sold,
        uint256 deadline,
        address token_addr
    ) external returns (uint256 tokens_sold);
    function tokenToTokenTransferOutput(
        uint256 tokens_bought,
        uint256 max_tokens_sold,
        uint256 max_eth_sold,
        uint256 deadline,
        address recipient,
        address token_addr
    ) external returns (uint256 tokens_sold);
    // Trade ERC20 to Custom Pool
    function tokenToExchangeSwapInput(
        uint256 tokens_sold,
        uint256 min_tokens_bought,
        uint256 min_eth_bought,
        uint256 deadline,
        address exchange_addr
    ) external returns (uint256 tokens_bought);
    function tokenToExchangeTransferInput(
        uint256 tokens_sold,
        uint256 min_tokens_bought,
        uint256 min_eth_bought,
        uint256 deadline,
        address recipient,
        address exchange_addr
    ) external returns (uint256 tokens_bought);
    function tokenToExchangeSwapOutput(
        uint256 tokens_bought,
        uint256 max_tokens_sold,
        uint256 max_eth_sold,
        uint256 deadline,
        address exchange_addr
    ) external returns (uint256 tokens_sold);
    function tokenToExchangeTransferOutput(
        uint256 tokens_bought,
        uint256 max_tokens_sold,
        uint256 max_eth_sold,
        uint256 deadline,
        address recipient,
        address exchange_addr
    ) external returns (uint256 tokens_sold);
}
