/**
 * Fennoa payment status constants (ESM)
 */

export const FENNOA_PAYMENT_STATUS = {
  PAID: "paid",
  UNPAID: "unpaid",
  OVERDUE: "overdue",
  PARTIALLY_PAID: "partially_paid",
};

/**
 * Complete invoice status enum.
 * Extends Fennoa payment statuses with legacy invoice states (draft, sent).
 * Used by the reporting SQL CASE statement and frontend status display.
 */
export const INVOICE_STATUS = {
  ...FENNOA_PAYMENT_STATUS,
  DRAFT: "draft",
  SENT: "sent",
  UNKNOWN: "unknown",
};

export const INVOICE_STATUS_LABELS_FI = {
  [FENNOA_PAYMENT_STATUS.PAID]: "Maksettu",
  [FENNOA_PAYMENT_STATUS.UNPAID]: "Maksamatta",
  [FENNOA_PAYMENT_STATUS.OVERDUE]: "Erääntynyt",
  [FENNOA_PAYMENT_STATUS.PARTIALLY_PAID]: "Osittain maksettu",
  [INVOICE_STATUS.DRAFT]: "Luonnos",
  [INVOICE_STATUS.SENT]: "Lähetetty",
  [INVOICE_STATUS.UNKNOWN]: "Tuntematon",
};
