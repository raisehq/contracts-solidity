pragma solidity 0.5.12;


contract Selfdestructor {
    constructor() public {}

    function sendEtherWithSelfdestruct(address payable to) external payable {
        selfdestruct(to);
    }
}
