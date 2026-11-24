package com.swp391.scms.finance;

import com.swp391.scms.finance.entity.Invoice;
import com.swp391.scms.finance.entity.InvoiceItem;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/** Bộ kiểm thử cho InvoiceComputedColumn (invoice computed column). */
class InvoiceComputedColumnTest {

    @Test
    @DisplayName("Should accurately compute total_amount as (subtotal_amount + tax_amount)")
    void shouldComputeInvoiceTotalAmount() {
        Invoice invoice = new Invoice();
        invoice.setSubtotalAmount(new BigDecimal("1500000.00"));
        invoice.setTaxAmount(new BigDecimal("150000.00"));

        BigDecimal expectedTotal = new BigDecimal("1650000.00");
        assertEquals(expectedTotal, invoice.getTotalAmount());
    }

    @Test
    @DisplayName("Should accurately compute total_amount when tax is null or zero")
    void shouldComputeInvoiceTotalAmountWithZeroOrNullTax() {
        Invoice invoice = new Invoice();
        invoice.setSubtotalAmount(new BigDecimal("1500000.00"));
        invoice.setTaxAmount(null);

        assertEquals(new BigDecimal("1500000.00"), invoice.getTotalAmount());

        invoice.setTaxAmount(BigDecimal.ZERO);
        assertEquals(new BigDecimal("1500000.00"), invoice.getTotalAmount());
    }

    @Test
    @DisplayName("Should preserve database-populated total_amount if set")
    void shouldPreserveDatabasePopulatedTotalAmount() {
        Invoice invoice = new Invoice();
        invoice.setSubtotalAmount(new BigDecimal("1000000.00"));
        invoice.setTaxAmount(new BigDecimal("100000.00"));
        invoice.setTotalAmount(new BigDecimal("1100000.00"));

        assertEquals(new BigDecimal("1100000.00"), invoice.getTotalAmount());
    }

    @Test
    @DisplayName("Should accurately compute item amount as (quantity * unit_price)")
    void shouldComputeInvoiceItemAmount() {
        InvoiceItem item = new InvoiceItem();
        item.setDescription("Buổi tập PT 1:1");
        item.setQuantity(4);
        item.setUnitPrice(new BigDecimal("350000.00"));

        BigDecimal expectedAmount = new BigDecimal("1400000.00");
        assertEquals(expectedAmount, item.getAmount());
    }

    @Test
    @DisplayName("Should return ZERO for item amount when quantity or unit price is null")
    void shouldHandleNullQuantityOrUnitPrice() {
        InvoiceItem item = new InvoiceItem();
        item.setQuantity(null);
        item.setUnitPrice(new BigDecimal("350000.00"));
        assertEquals(BigDecimal.ZERO, item.getAmount());

        item.setQuantity(2);
        item.setUnitPrice(null);
        assertEquals(BigDecimal.ZERO, item.getAmount());
    }

    @Test
    @DisplayName("Should preserve database-populated item amount if set")
    void shouldPreserveDatabasePopulatedItemAmount() {
        InvoiceItem item = new InvoiceItem();
        item.setQuantity(2);
        item.setUnitPrice(new BigDecimal("50000.00"));
        item.setAmount(new BigDecimal("100000.00"));

        assertEquals(new BigDecimal("100000.00"), item.getAmount());
    }

    @Test
    @DisplayName("Should support adding and removing items with cascading relationship")
    void shouldSupportInvoiceItemsRelationship() {
        Invoice invoice = new Invoice();
        invoice.setSubtotalAmount(new BigDecimal("2000000.00"));

        InvoiceItem item1 = new InvoiceItem("Gói Gym", 1, new BigDecimal("1500000.00"));
        InvoiceItem item2 = new InvoiceItem("Nước điện giải", 5, new BigDecimal("100000.00"));

        invoice.addItem(item1);
        invoice.addItem(item2);

        assertEquals(2, invoice.getItems().size());
        assertEquals(invoice, item1.getInvoice());
        assertEquals(invoice, item2.getInvoice());

        invoice.removeItem(item2);
        assertEquals(1, invoice.getItems().size());
        assertNull(item2.getInvoice());
    }
}
