/*
    Copyright 2018 Set Labs Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

contract ERC20Wrapper is IERC20 {
    // ============ Internal Functions ============
    ERC20Detailed public ERC20Token;
    address token;
    constructor(address tokenAddress) public {
        ERC20Token = ERC20Detailed(tokenAddress);
    }
    function totalSupply() public view returns (uint256) {
        return ERC20Token.totalSupply();
    }
    function balanceOf(address _owner) public view returns (uint256) {
        return ERC20Token.balanceOf(_owner);
    }

    function allowance(address _owner, address _spender) external view returns (uint256) {
        return ERC20Token.allowance(_owner, _spender);
    }

    function transfer(address _to, uint256 _quantity) external returns (bool) {
        if (isIssuedToken()) {
            ERC20Token.transfer(_to, _quantity);
            // Check that transfer returns true or null
            require(checkSuccess(), "ERC20Wrapper.transfer: Bad return value");
        } else {
            return ERC20Token.transfer(_to, _quantity);
        }
    }

    function transferFrom(address _from, address _to, uint256 _quantity) external returns (bool) {
        if (isIssuedToken()) {
            ERC20Token.transferFrom(_from, _to, _quantity);
            // Check that transferFrom returns true or null
            require(checkSuccess(), "ERC20Wrapper.transferFrom: Bad return value");
        } else {
            return ERC20Token.transferFrom(_from, _to, _quantity);
        }
    }

    function approve(address _spender, uint256 _quantity) external returns (bool) {
        if (isIssuedToken()) {
            ERC20Token.approve(_spender, _quantity);
            // Check that approve returns true or null
            require(checkSuccess(), "ERC20Wrapper.approve: Bad return value");
        } else {
            return ERC20Token.approve(_spender, _quantity);
        }
    }

    function isIssuedToken() private returns (bool) {
        return (keccak256(abi.encodePacked((ERC20Token.symbol()))) ==
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
