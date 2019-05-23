pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol';
import 'openzeppelin-solidity/contracts/token/ERC721/ERC721Mintable.sol';
import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

// Refer to open zepplin to better understand the methods that are inherited here
contract LoanToken is ERC721Full, ERC721Mintable, Ownable {
    using SafeMath for uint256;

    /**
     * @dev The Loan Struct.
     *      We do not directly store the loan on an ERC721 token.
     *      Instead, as tokenIds are immutable, as we create tokens,
     *      we create corresponding loan structs and push them to
     *      an immuatable list. This way, the same loan info will always be linked
     *      to the same token.
     *      NB: We do not store the lender address, as the owner of the token will
     *      always be the person to who the money is owed (original lender, loan transfer etc) 
     */
    struct Loan {
        uint256 loanAmount;
        uint256 amountPayed;
        address originator;
    }

    Loan[] private _loans;

    constructor() ERC721Full("HeroToken", "HLT") public {
    }

    /**
     * @dev Creates a new Non-fungible token for a loan.
     *      This includes the ERC721 token, and the loan information
     *      which is immutably linked through tokenId to the loan list
     * @param originator loan originator, who will be required to make payment
     * @param lender The person who is lending funds, and will own the ERC721 token
     * @param loanAmount Amount loaned, in wei
     * @param loanIdentifier The server-side loan identifier, created at point of loan match
     */
    function createLoanToken(
        address originator,
        address lender,
        uint256 loanAmount,
        string memory loanIdentifier
    ) public onlyOwner returns (uint256) {
        Loan memory loan = Loan({
            originator: originator,
            loanAmount: loanAmount,
            amountPayed: 0
        });

        uint256 loanId = _loans.push(loan) - 1;
        _mintLoanTokenTo(lender, loanId, loanIdentifier);
        return loanId;
    }

    /**
     * @dev Returns the repayment remaining of a loan, in wei
     * @param loanId The unique ID of the loan
     */
    function repaymentRemaining(uint256 loanId) public view returns (uint256) {
        Loan memory loan = _loans[loanId];
        return loan.loanAmount.sub(loan.amountPayed);
    }

    /**
     * @dev Returns the immutable originator of a loan
     * @param loanId The unique ID of the loan
     */
    function getLoanOriginator(uint256 loanId) public view returns (address) {
        Loan memory loan = _loans[loanId];
        return loan.originator;
    }

    /**
     * @dev Tracks repayments made against a loan.
     *      NB: This does not handle payments, that is done in th
     *      master contract
     * @param amount Amount repayed, in wei
     * @param loanId The unique ID of the loan
     */
    function repaymentMade(uint256 amount, uint256 loanId) public onlyOwner {
        Loan storage loan = _loans[loanId];
        uint256 repayment = loan.amountPayed.add(amount);

        require(repayment <= loan.loanAmount, "Cannot overpay loan");

        loan.amountPayed = repayment;
    }

    /**
     * @dev Mints a new loan, to the lender
     * @param to The address of the lender to receive the token
     * @param tokenId The unique ID of the token
     * @param tokenURI A direct reference to the loanIdentifier
     */
    function _mintLoanTokenTo(address to, uint256 tokenId, string memory tokenURI) internal {
        super._mint(to, tokenId);
        super._setTokenURI(tokenId, tokenURI);
    }
}
