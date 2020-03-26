pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/IAuthorization.sol";
import "./interfaces/ILoanContract.sol";
import "./interfaces/IDAIProxy.sol";
import "./interfaces/IUniswapSwapper.sol";
import "./interfaces/IUniswapSwapperFactory.sol";
import "./libs/ERC20Wrapper.sol";

contract DAIProxy is IDAIProxy, Ownable {
    using SafeMath for uint256;

    IAuthorization auth;
    address public administrator;
    address public swapperFactoryAddress;
    bool public hasToDeposit;
    bool public swapEnabled = true;

    event AuthAddressUpdated(address newAuthAddress, address administrator);
    event AdministratorUpdated(address newAdministrator);
    event HasToDeposit(bool value, address administrator);

    constructor(address authAddress, address _swapperFactoryAddress) public {
        auth = IAuthorization(authAddress);
        swapperFactoryAddress = _swapperFactoryAddress;
    }

    function setDepositRequeriment(bool value) external onlyAdmin {
        hasToDeposit = value;
        emit HasToDeposit(value, administrator);
    }

    function setUniswapSwapper(address value) external onlyAdmin {
        swapperFactoryAddress = value;
    }

    function toggleUniswap(bool value) external onlyAdmin {
        swapEnabled = value;
    }

    function setAdministrator(address admin) external onlyOwner {
        administrator = admin;
        emit AdministratorUpdated(administrator);
    }

    function setAuthAddress(address authAddress) external onlyAdmin {
        auth = IAuthorization(authAddress);
        emit AuthAddressUpdated(authAddress, administrator);
    }

    function swapTokenAndFund(
        address loanAddress,
        address inputTokenAddress,
        uint256 inputTokenAmount,
        uint256 fundingAmount
    ) external uniswapIsEnabled onlyHasDepositCanFund onlyKYCCanFund returns (bool) {
        address outputTokenAddress = ILoanContract(loanAddress).getTokenAddress();
        uint256 newFundingAmount = _calculateFunds(loanAddress, fundingAmount);
        require(
            ILoanContract(loanAddress).onFundingReceived(msg.sender, newFundingAmount),
            "funding failed at loan contract"
        );
        require(
            _swapToken(inputTokenAddress, outputTokenAddress, inputTokenAmount, newFundingAmount),
            "error swap"
        );
        require(
            ERC20Wrapper.transfer(outputTokenAddress, loanAddress, newFundingAmount),
            "failed at transferFrom"
        );
        return true;
    }

    function swapEthAndFund(address loanAddress, uint256 fundingAmount)
        external
        payable
        uniswapIsEnabled
        onlyHasDepositCanFund
        onlyKYCCanFund
        returns (bool)
    {
        address outputTokenAddress = ILoanContract(loanAddress).getTokenAddress();
        uint256 newFundingAmount = _calculateFunds(loanAddress, fundingAmount);
        require(
            ILoanContract(loanAddress).onFundingReceived(msg.sender, newFundingAmount),
            "funding failed at loan contract"
        );
        require(_swapEth(outputTokenAddress, newFundingAmount), "error swap");
        require(
            ERC20Wrapper.transfer(outputTokenAddress, loanAddress, newFundingAmount),
            "failed at transferFrom"
        );
        return true;
    }

    function _swapToken(
        address inputTokenAddress,
        address outputTokenAddress,
        uint256 inputTokenAmount,
        uint256 outputTokenAmount
    ) internal returns (bool) {
        address swapperAddress = IUniswapSwapperFactory(swapperFactoryAddress).deploy();
        IUniswapSwapper(swapperAddress).swap(
            msg.sender,
            inputTokenAddress,
            outputTokenAddress,
            inputTokenAmount,
            outputTokenAmount
        );
        require(
            IUniswapSwapper(swapperAddress).isDestroyed() == true,
            "Swap contract should selfdestruct"
        );
        return true;
    }

    function _swapEth(address outputTokenAddress, uint256 outputTokenAmount)
        internal
        returns (bool)
    {
        address swapperAddress = IUniswapSwapperFactory(swapperFactoryAddress).deploy();
        IUniswapSwapper(swapperAddress).swapEth.value(msg.value)(
            msg.sender,
            outputTokenAddress,
            outputTokenAmount
        );
        require(
            IUniswapSwapper(swapperAddress).isDestroyed() == true,
            "Swap contract should selfdestruct"
        );
        return true;
    }

    function fund(address loanAddress, uint256 fundingAmount)
        external
        onlyHasDepositCanFund
        onlyKYCCanFund
    {
        uint256 newFundingAmount = _calculateFunds(loanAddress, fundingAmount);
        require(
            ILoanContract(loanAddress).onFundingReceived(msg.sender, newFundingAmount),
            "funding failed at loan contract"
        );
        require(transfer(loanAddress, newFundingAmount), "erc20 transfer failed");
    }

    function _calculateFunds(address loanAddress, uint256 fundingAmount)
        internal
        returns (uint256)
    {
        uint256 newFundingAmount = fundingAmount;
        uint256 auctionBalance = ILoanContract(loanAddress).getAuctionBalance();
        uint256 maxAmount = ILoanContract(loanAddress).getMaxAmount();

        if (auctionBalance.add(fundingAmount) > maxAmount) {
            newFundingAmount = maxAmount.sub(auctionBalance);
        }
        require(newFundingAmount > 0, "funding amount can not be zero");
        return newFundingAmount;
    }

    function repay(address loanAddress, uint256 repaymentAmount) external onlyKYCCanFund {
        ILoanContract loanContract = ILoanContract(loanAddress);
        require(
            loanContract.onRepaymentReceived(msg.sender, repaymentAmount),
            "repayment failed at loan contract"
        );
        require(transfer(loanAddress, repaymentAmount), "erc20 repayment failed");
    }

    function transfer(address loanAddress, uint256 amount) internal returns (bool) {
        address tokenAddress = ILoanContract(loanAddress).getTokenAddress();
        require(
            ERC20Wrapper.allowance(tokenAddress, msg.sender, address(this)) >= amount,
            "funding not approved"
        );
        uint256 balance = ERC20Wrapper.balanceOf(tokenAddress, msg.sender);
        require(balance >= amount, "Not enough funds");
        require(
            ERC20Wrapper.transferFrom(tokenAddress, msg.sender, loanAddress, amount),
            "failed at transferFrom"
        );

        return true;
    }

    modifier onlyKYCCanFund {
        require(auth.isKYCConfirmed(msg.sender), "user does not have KYC");
        _;
    }

    modifier uniswapIsEnabled {
        require(swapEnabled == true, "uniswap is disabled");
        _;
    }

    modifier onlyHasDepositCanFund {
        if (hasToDeposit) {
            require(auth.hasDeposited(msg.sender), "user does not have a deposit");
        }
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == administrator, "Caller is not an administrator");
        _;
    }
}
