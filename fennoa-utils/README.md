# @ibetoni/fennoa-utils

Shared Fennoa invoice parsing and payment status utilities for betoni.online.

## Functions

### `parseFennoaInvoiceResponse(responseData)`

Normalizes the different response formats Fennoa API returns for invoice data.

Returns `{ invoiceData, salesInvoice }` where `salesInvoice` is the unwrapped invoice object.

### `computePaymentStatus(totalDue, totalGross, dueDate)`

Computes payment status from invoice amounts and due date. Uses UTC for date comparison.

Returns one of: `"paid"`, `"overdue"`, `"partially_paid"`, `"unpaid"`.

## Usage

```javascript
const { parseFennoaInvoiceResponse, computePaymentStatus } = require("@ibetoni/fennoa-utils");
const { FENNOA_PAYMENT_STATUS } = require("@ibetoni/constants/fennoa");

const { salesInvoice } = parseFennoaInvoiceResponse(response.data);
const status = computePaymentStatus(totalDue, totalGross, dueDate);

if (status === FENNOA_PAYMENT_STATUS.OVERDUE) {
  // handle overdue
}
```
