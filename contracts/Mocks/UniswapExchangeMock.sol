pragma solidity 0.5.12;

contract UniswapExchangeMock {
    constructor() public {}

    function tokenToTokenSwapOutput(uint256, uint256, uint256, uint256, address)
        public
        pure
        returns (uint256)
    {
        return 0;
    }
}
