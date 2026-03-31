/**
 * Fennoa payment status constants
 * Single source of truth for payment status values and Finnish labels.
 */

const FENNOA_PAYMENT_STATUS = {
  PAID: "paid",
  UNPAID: "unpaid",
  OVERDUE: "overdue",
  PARTIALLY_PAID: "partially_paid",
};

const FENNOA_PAYMENT_STATUS_LABELS_FI = {
  [FENNOA_PAYMENT_STATUS.PAID]: "Maksettu",
  [FENNOA_PAYMENT_STATUS.UNPAID]: "Maksamatta",
  [FENNOA_PAYMENT_STATUS.OVERDUE]: "Erääntynyt",
  [FENNOA_PAYMENT_STATUS.PARTIALLY_PAID]: "Osittain maksettu",
};

const FENNOA_PAYMENT_STATUS_SEVERITY = {
  [FENNOA_PAYMENT_STATUS.PAID]: "success",
  [FENNOA_PAYMENT_STATUS.OVERDUE]: "warning",
  [FENNOA_PAYMENT_STATUS.PARTIALLY_PAID]: "info",
  [FENNOA_PAYMENT_STATUS.UNPAID]: "info",
};

/**
 * Complete invoice status enum.
 * Extends Fennoa payment statuses with legacy invoice states (draft, sent).
 * Used by the reporting SQL CASE statement and frontend status display.
 */
const INVOICE_STATUS = {
  ...FENNOA_PAYMENT_STATUS,
  DRAFT: "draft",
  SENT: "sent",
  UNKNOWN: "unknown",
};

const INVOICE_STATUS_LABELS_FI = {
  ...FENNOA_PAYMENT_STATUS_LABELS_FI,
  [INVOICE_STATUS.DRAFT]: "Luonnos",
  [INVOICE_STATUS.SENT]: "Lähetetty",
  [INVOICE_STATUS.UNKNOWN]: "Tuntematon",
};

module.exports = {
  FENNOA_PAYMENT_STATUS,
  FENNOA_PAYMENT_STATUS_LABELS_FI,
  FENNOA_PAYMENT_STATUS_SEVERITY,
  INVOICE_STATUS,
  INVOICE_STATUS_LABELS_FI,
};
