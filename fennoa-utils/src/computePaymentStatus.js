/**
 * Compute Fennoa payment status from invoice amounts and due date.
 * @param {number} totalDue - Amount still owed
 * @param {number} totalGross - Total invoice amount
 * @param {Date|null} dueDate - Invoice due date
 * @returns {string} "paid" | "overdue" | "partially_paid" | "unpaid"
 */
function computePaymentStatus(totalDue, totalGross, dueDate) {
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  if (totalDue === 0) {
    return "paid";
  } else if (dueDate && dueDate < todayUTC && totalDue > 0) {
    return "overdue";
  } else if (totalDue > 0 && totalDue < totalGross) {
    return "partially_paid";
  }
  return "unpaid";
}

module.exports = { computePaymentStatus };
