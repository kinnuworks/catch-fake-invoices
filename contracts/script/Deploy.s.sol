// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {InvoiceLedger} from "../src/InvoiceLedger.sol";

contract Deploy is Script {
    function run() external returns (InvoiceLedger ledger) {
        vm.startBroadcast();
        ledger = new InvoiceLedger();
        vm.stopBroadcast();
        console2.log("InvoiceLedger", address(ledger));
    }
}
