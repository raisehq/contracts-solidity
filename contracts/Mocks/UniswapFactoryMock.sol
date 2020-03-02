pragma solidity 0.5.12;

import "./UniswapExchangeMock.sol";

contract UniswapFactoryMock {
    mapping(address => address) public exchanges;

    constructor() public {}

    function createExchange(address tokenA) public returns (address exchange) {
        UniswapExchangeMock exchangeNew = new UniswapExchangeMock();
        exchanges[tokenA] = address(exchangeNew);
        exchange = address(exchangeNew);
        return exchange;
    }

    function getExchange(address token) external view returns (address exchange) {
        return exchanges[token];
    }

}
