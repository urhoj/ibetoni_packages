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

module.exports = {
  FENNOA_PAYMENT_STATUS,
  FENNOA_PAYMENT_STATUS_LABELS_FI,
};
