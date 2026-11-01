// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {InvoiceLedger} from "../src/InvoiceLedger.sol";

contract InvoiceLedgerTest is Test {
    InvoiceLedger ledger;
    address buyer = makeAddr("buyer");
    address supplier = makeAddr("supplier");
    address stranger = makeAddr("stranger");
    bytes32 constant INV = keccak256("invoice-1");

    function setUp() public {
        ledger = new InvoiceLedger();
    }

    function _approve() internal {
        vm.prank(buyer);
        ledger.approve(INV, supplier, 12_500);
    }

    function _pay() internal {
        _approve();
        vm.prank(buyer);
        ledger.recordPayment(INV, 84532, keccak256("tx"), "req-1");
    }

    function test_fullLoop() public {
        _pay();
        vm.prank(supplier);
        ledger.confirmDelivery(buyer, INV, keccak256("work"));
        InvoiceLedger.Invoice memory inv = ledger.getInvoice(buyer, INV);
        assertEq(uint8(inv.status), uint8(InvoiceLedger.Status.Delivered));
        assertEq(inv.amountUsdCents, 12_500);
    }

    function test_sameInvoiceCannotBeApprovedTwice() public {
        _approve();
        vm.prank(buyer);
        vm.expectRevert(InvoiceLedger.AlreadyRecorded.selector);
        ledger.approve(INV, supplier, 12_500);
    }

    function test_stopNeedsReason() public {
        vm.prank(buyer);
        vm.expectRevert(InvoiceLedger.NoReasons.selector);
        ledger.stop(INV, supplier, 0);
    }

    function test_stoppedInvoiceIsNotPayable() public {
        vm.startPrank(buyer);
        ledger.stop(INV, supplier, 1);
        vm.expectRevert(InvoiceLedger.WrongStatus.selector);
        ledger.recordPayment(INV, 84532, keccak256("tx"), "req-1");
        vm.stopPrank();
    }

    function test_strangerCannotBlockBuyer() public {
        vm.prank(stranger);
        ledger.approve(INV, stranger, 1);
        _approve();
        assertEq(ledger.getInvoice(buyer, INV).supplier, supplier);
    }

    function test_cannotStopAfterApproval() public {
        _approve();
        vm.prank(buyer);
        vm.expectRevert(InvoiceLedger.AlreadyRecorded.selector);
        ledger.stop(INV, supplier, 1);
    }

    function test_onlyBuyerRecordsPayment() public {
        _approve();
        vm.prank(stranger);
        vm.expectRevert(InvoiceLedger.WrongStatus.selector);
        ledger.recordPayment(INV, 84532, keccak256("tx"), "req-1");
    }

    function test_onlySupplierConfirmsDelivery() public {
        _pay();
        vm.prank(stranger);
        vm.expectRevert(InvoiceLedger.NotSupplier.selector);
        ledger.confirmDelivery(buyer, INV, keccak256("work"));
    }

    function test_noDeliveryBeforePayment() public {
        _approve();
        vm.prank(supplier);
        vm.expectRevert(InvoiceLedger.WrongStatus.selector);
        ledger.confirmDelivery(buyer, INV, keccak256("work"));
    }
}
