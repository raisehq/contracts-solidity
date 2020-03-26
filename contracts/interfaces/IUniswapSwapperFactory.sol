pragma solidity 0.5.12;


interface IUniswapSwapperFactory {
    event SwapContract(address newSwap);

    function setUniswapAddress(address _uniswapAddress) external;

    function setLibraryAddress(address _libraryAddress) external;

    function deploy() external returns (address proxyAddress);
}
