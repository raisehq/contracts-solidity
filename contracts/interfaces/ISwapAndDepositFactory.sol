pragma solidity 0.5.12;

interface ISwapAndDepositFactory {
    event SwapContract(address newSwap);

    function setAuthAddress(address _authAddress) external;

    function setUniswapAddress(address _uniswapAddress) external;

    function setLibraryAddress(address _libraryAddress) external;

    function deploy() external returns (address proxyAddress);
}
