const { FENNOA_PAYMENT_STATUS } = require("@ibetoni/constants/fennoa");

/**
 * Compute Fennoa payment status from invoice amounts and due date.
 * @param {number} totalDue - Amount still owed
 * @param {number} totalGross - Total invoice amount
 * @param {Date|null} dueDate - Invoice due date
 * @returns {string} FENNOA_PAYMENT_STATUS value
 */
function computePaymentStatus(totalDue, totalGross, dueDate) {
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  if (totalDue === 0) {
    return FENNOA_PAYMENT_STATUS.PAID;
  } else if (dueDate && dueDate < todayUTC && totalDue > 0) {
    return FENNOA_PAYMENT_STATUS.OVERDUE;
  } else if (totalDue > 0 && totalDue < totalGross) {
    return FENNOA_PAYMENT_STATUS.PARTIALLY_PAID;
  }
  return FENNOA_PAYMENT_STATUS.UNPAID;
}

module.exports = { computePaymentStatus };
