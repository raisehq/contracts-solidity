pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./LoanToken.sol";

contract LoanMaster is Ownable {
    using SafeMath for uint256;
    LoanToken private _token;

    event LenderPayment(
        address originator,
        address lender,
        uint256 weiOfLoan,
        string loanIdentifier,
        uint256 tokenId
    );
    
    event OriginatorPayment(
        address originator,
        address lender,
        uint256 weiOfLoan,
        string loanIdentifier
    );
    // 500 basis points = 5%
    // TODO: Determine sensible default. Can be configured with setFeeRate
    uint256 private _creationFeeBasisPoints = 500;

    // We represent our loans by their identifier & associated tokenIds
    mapping(string => uint256[]) private _loans;

    constructor() public {
        _token = new LoanToken();
    }

    /**
     * @dev Public accessor for the current fee in basis points
     */
    function creationFeeBasisPoints() public view returns (uint256) {
        return _creationFeeBasisPoints;
    }

    /**
     * @dev Public accessor for the token address
     */
    function token() public view returns (address) {
        return address(_token);
    }

    /**
     * @dev Changes the fee rate for loan creation
     * @param newCreationFeeBasisPoints The new fee, in basis points
     */
    function setFeeRate(uint256 newCreationFeeBasisPoints) public onlyOwner {
        require(newCreationFeeBasisPoints < 10000, "Cant charge more than 100% fee");
        _creationFeeBasisPoints = newCreationFeeBasisPoints;
    }

    /**
     * @dev Changes the fee rate for loan creation
     * @param loanIdentifier The server-side loan identifier, created at point of loan match
     */
    function getLoanTokenIds(string memory loanIdentifier) public view returns (uint256[] memory) {
        return _loans[loanIdentifier];
    }

    /**
     * @dev Creates a new loan & token against a loanIdentifier.
     *      This is called by the lender from the platform, with the function values
     *      determined from the loan matching engine.
     * @param originator The originator of the loan, who will receive the funds
     * @param weiOfLoan The loan value, in wei.
     * @param loanIdentifier The server-side loan identifier, created at point of loan match
     */
    function createLoan(
        address payable originator,
        uint256 weiOfLoan,
        string memory loanIdentifier
    ) public payable returns (uint256) {
        // Solidity does not support floating point numbers, hence the uint256
        // data type and multiplying by the basis points then dividing by 10000
        uint256 fee = weiOfLoan.mul(_creationFeeBasisPoints).div(10000);
        uint256 loanAndFee = weiOfLoan.add(fee);
        
        // Validate the loaner has enough balance
        uint256 lenderBalance = msg.sender.balance;
        require(lenderBalance >= loanAndFee, "Insufficient balance to create loan");
        require(msg.value >= loanAndFee, "Insufficient value on the transaction");

        // Validate if a loan already exists that we keep the originator the same
        if (_loans[loanIdentifier].length > 0) {
            // TODO: Possibly make this configurable. You want to keep this number sensible,
            // so that calling completeLoan does not make the transaction run out of gas due to
            // the for loop
            require(_loans[loanIdentifier].length < 100, "Max tokens already reached for loan");

            address currentoriginator = _token.getLoanOriginator(_loans[loanIdentifier][0]);
            require(currentoriginator == originator, "There can only be one originator on a loan");
        }

        uint256 tokenId = _token.createLoanToken(originator, msg.sender, weiOfLoan, loanIdentifier);
        _loans[loanIdentifier].push(tokenId);

        originator.transfer(weiOfLoan);

        address owner = owner();
        address payable payableOwner = address(uint160(owner));
        payableOwner.transfer(fee);
        emit LenderPayment(originator, msg.sender, weiOfLoan, loanIdentifier, tokenId);
        return tokenId;
    }

    function getCalcValuePlusFee(uint256 weiOfLoan) public view returns (uint256) {
        uint256 fee = weiOfLoan.mul(_creationFeeBasisPoints).div(10000);
        uint256 loanAndFee = weiOfLoan.add(fee);
        return loanAndFee;
    }

    /**
     * @dev completeLoan is called by the originator to pay off a loan in its entirety
     *      NB: It is worth considering implementing an incremental payoff method
     * @param loanIdentifier The server-side loan identifier, created at point of loan match
     */
    function completeLoan(string memory loanIdentifier) public payable {
        uint256[] memory loanIds = _loans[loanIdentifier];
        require(loanIds.length > 0, "No tokens associated with this loan");

        // We know that the originator for each loan token under an identifier is the
        // same as its enforce in the createLoanToken method
        address originator = _token.getLoanOriginator(loanIds[0]);
        require(originator == msg.sender, "Only the originator can pay off the loan");

        // We will only do this loop once. The DApp will need to determine the payable
        // balance remaining, to keep gas reasonable
        for (uint256 i = 0; i < loanIds.length; i++) {
            uint256 loanId = loanIds[i];
            address ownerOfLoanToken = _token.ownerOf(loanId);

            // This is the required casting to get a payable address from a standard address
            address payable payableOwner = address(uint160(ownerOfLoanToken));
            uint256 repaymentRemaining = _token.repaymentRemaining(loanId);

            _token.repaymentMade(repaymentRemaining, loanId);
            payableOwner.transfer(repaymentRemaining);
            emit OriginatorPayment(msg.sender, ownerOfLoanToken, repaymentRemaining, loanIdentifier);
        }
    }
}
