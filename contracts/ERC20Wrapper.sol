pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

contract ERC20Wrapper is ERC20Detailed {
    function transfer(address _to, uint256 _quantity) external returns (bool) {
        if (isIssuedToken()) {
            this.transfer(_to, _quantity);
            // Check that transfer returns true or null
            require(checkSuccess(), "ERC20Wrapper.transfer: Bad return value");
        } else {
            return this.transfer(_to, _quantity);
        }
    }

    function transferFrom(address _from, address _to, uint256 _quantity) external returns (bool) {
        if (isIssuedToken()) {
            this.transferFrom(_from, _to, _quantity);
            // Check that transferFrom returns true or null
            require(checkSuccess(), "ERC20Wrapper.transferFrom: Bad return value");
        } else {
            return this.transferFrom(_from, _to, _quantity);
        }
    }

    function approve(address _spender, uint256 _quantity) external returns (bool) {
        if (isIssuedToken()) {
            this.approve(_spender, _quantity);
            // Check that approve returns true or null
            require(checkSuccess(), "ERC20Wrapper.approve: Bad return value");
        } else {
            return this.approve(_spender, _quantity);
        }
    }

    function isIssuedToken() private returns (bool) {
        return (keccak256(abi.encodePacked((this.symbol()))) ==
            keccak256(abi.encodePacked(("USDT"))));
    }

    // ============ Private Functions ============

    /**
     * Checks the return value of the previous function up to 32 bytes. Returns true if the previous
     * function returned 0 bytes or 1.
     */
    function checkSuccess() private pure returns (bool) {
        // default to failure
        uint256 returnValue = 0;

        assembly {
            // check number of bytes returned from last function call
            switch returndatasize
                // no bytes returned: assume success
                case 0x0 {
                    returnValue := 1
                }
                // 32 bytes returned
                case 0x20 {
                    // copy 32 bytes into scratch space
                    returndatacopy(0x0, 0x0, 0x20)

                    // load those bytes into returnValue
                    returnValue := mload(0x0)
                }
                // not sure what was returned: dont mark as success
                default {

                }
        }

        // check if returned value is one or nothing
        return returnValue == 1;
    }
}
