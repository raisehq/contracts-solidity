pragma solidity 0.5.12;

contract UniswapExchangeMock {
    constructor() public {}

    function tokenToTokenSwapOutput(
        uint256 tokens_bought,
        uint256 max_tokens_sold,
        uint256 max_eth_sold,
        uint256 deadline,
        address token_addr
    ) public returns (uint256) {
        return 0;
    }
}
