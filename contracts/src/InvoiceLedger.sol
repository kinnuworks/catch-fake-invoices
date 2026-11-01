// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title InvoiceLedger
/// @notice Public record of what a buyer's agent decided about each supplier invoice, how it was paid
/// and whether the supplier confirmed it. Money moves through HSP, not through this contract.
contract InvoiceLedger {
    enum Status {
        None,
        Stopped,
        Approved,
        Paid,
        Delivered
    }

    struct Invoice {
        address buyer;
        address supplier;
        uint96 amountUsdCents;
        Status status;
    }

    /// @dev Keyed by buyer too, so nobody can block a buyer by recording their invoice hash first.
    mapping(address => mapping(bytes32 => Invoice)) private invoices;

    event InvoiceStopped(bytes32 indexed invoiceHash, address indexed buyer, address indexed supplier, uint256 reasons);
    event InvoiceApproved(bytes32 indexed invoiceHash, address indexed buyer, address indexed supplier, uint96 amountUsdCents);
    event PaymentRecorded(bytes32 indexed invoiceHash, address indexed buyer, uint256 chainId, bytes32 txHash, string paymentRequestId);
    event DeliveryConfirmed(bytes32 indexed invoiceHash, address indexed buyer, address indexed supplier, bytes32 deliveryHash);

    error AlreadyRecorded();
    error NotSupplier();
    error WrongStatus();
    error NoReasons();
    error ZeroAddress();

    /// @param reasons Bit flags naming every failed check, so a stop always says why.
    function stop(bytes32 invoiceHash, address supplier, uint256 reasons) external {
        if (reasons == 0) revert NoReasons();
        Status status = invoices[msg.sender][invoiceHash].status;
        if (status != Status.None && status != Status.Stopped) revert AlreadyRecorded();
        invoices[msg.sender][invoiceHash] = Invoice(msg.sender, supplier, 0, Status.Stopped);
        emit InvoiceStopped(invoiceHash, msg.sender, supplier, reasons);
    }

    /// @notice An invoice can be approved once, so the same invoice can't be paid twice through this record.
    function approve(bytes32 invoiceHash, address supplier, uint96 amountUsdCents) external {
        if (supplier == address(0)) revert ZeroAddress();
        if (invoices[msg.sender][invoiceHash].status != Status.None) revert AlreadyRecorded();
        invoices[msg.sender][invoiceHash] = Invoice(msg.sender, supplier, amountUsdCents, Status.Approved);
        emit InvoiceApproved(invoiceHash, msg.sender, supplier, amountUsdCents);
    }

    function recordPayment(bytes32 invoiceHash, uint256 chainId, bytes32 txHash, string calldata paymentRequestId)
        external
    {
        Invoice storage inv = invoices[msg.sender][invoiceHash];
        if (inv.status != Status.Approved) revert WrongStatus();
        inv.status = Status.Paid;
        emit PaymentRecorded(invoiceHash, msg.sender, chainId, txHash, paymentRequestId);
    }

    function confirmDelivery(address buyer, bytes32 invoiceHash, bytes32 deliveryHash) external {
        Invoice storage inv = invoices[buyer][invoiceHash];
        if (inv.supplier != msg.sender) revert NotSupplier();
        if (inv.status != Status.Paid) revert WrongStatus();
        inv.status = Status.Delivered;
        emit DeliveryConfirmed(invoiceHash, buyer, msg.sender, deliveryHash);
    }

    function getInvoice(address buyer, bytes32 invoiceHash) external view returns (Invoice memory) {
        return invoices[buyer][invoiceHash];
    }
}
