pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../interfaces/IUniswapSwapper.sol";
import "../interfaces/IUniswapSwapperFactory.sol";
import "../CloneFactory.sol";


contract UniswapSwapperFactoryMock is IUniswapSwapperFactory, CloneFactory, Ownable {
    address public libraryAddress;
    address public uniswapAddress;

    event NewSwapContract(address proxyAddress);

    constructor(address _libraryAddress, address _uniswapAddress) public {
        libraryAddress = _libraryAddress;
        uniswapAddress = _uniswapAddress;
    }

    function setUniswapAddress(address _uniswapAddress) public onlyOwner {
        uniswapAddress = _uniswapAddress;
    }

    function setLibraryAddress(address _libraryAddress) public onlyOwner {
        libraryAddress = _libraryAddress;
    }

    function deploy() external returns (address) {
        require(libraryAddress != address(0), "library must be set");
        require(uniswapAddress != address(0), "uniswap must be set");
        address proxyAddress = createClone(libraryAddress);
        require(IUniswapSwapper(proxyAddress).init(uniswapAddress), "Failed to init");

        emit NewSwapContract(proxyAddress);

        return proxyAddress;
    }

    function deployDoubleInitUniswap() external returns (address) {
        require(libraryAddress != address(0), "library must be set");
        require(uniswapAddress != address(0), "uniswap must be set");
        address proxyAddress = createClone(libraryAddress);
        IUniswapSwapper(proxyAddress).init(uniswapAddress);
        IUniswapSwapper(proxyAddress).init(uniswapAddress);

        emit NewSwapContract(proxyAddress);

        return proxyAddress;
    }

    function deployNoInit() external returns (address) {
        require(libraryAddress != address(0), "library must be set");
        require(uniswapAddress != address(0), "uniswap must be set");
        address proxyAddress = createClone(libraryAddress);
        emit NewSwapContract(proxyAddress);

        return proxyAddress;
    }

    function deployZeroAddress() external returns (address) {
        require(libraryAddress != address(0), "library must be set");
        require(uniswapAddress != address(0), "uniswap must be set");
        address proxyAddress = createClone(libraryAddress);
        IUniswapSwapper(proxyAddress).init(address(0));

        emit NewSwapContract(proxyAddress);

        return proxyAddress;
    }

    function isCloned(address target, address query) external view returns (bool result) {
        return isClone(target, query);
    }
}
