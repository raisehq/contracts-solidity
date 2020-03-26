pragma solidity 0.5.12;


contract UniswapExchangeMock {
    constructor() public {}

    // keeps input token there due it does not return back to the user
    function tokenToTokenSwapOutput(uint256, uint256, uint256, uint256, address)
        public
        pure
        returns (uint256)
    {
        return 0;
    }

    // 1. sends the Ether to another address, in this case to the zero address
    // 2. does not buy tokens
    function ethToTokenSwapOutput(uint256, uint256) external payable returns (uint256) {
        address(0).transfer(msg.value);
        return 1;
    }
}
