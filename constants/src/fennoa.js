/**
 * Fennoa payment status constants (ESM)
 */

export const FENNOA_PAYMENT_STATUS = {
  PAID: "paid",
  UNPAID: "unpaid",
  OVERDUE: "overdue",
  PARTIALLY_PAID: "partially_paid",
};

export const FENNOA_PAYMENT_STATUS_LABELS_FI = {
  [FENNOA_PAYMENT_STATUS.PAID]: "Maksettu",
  [FENNOA_PAYMENT_STATUS.UNPAID]: "Maksamatta",
  [FENNOA_PAYMENT_STATUS.OVERDUE]: "Erääntynyt",
  [FENNOA_PAYMENT_STATUS.PARTIALLY_PAID]: "Osittain maksettu",
};
