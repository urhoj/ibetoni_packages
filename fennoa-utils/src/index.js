/**
 * @ibetoni/fennoa-utils
 *
 * Shared Fennoa invoice parsing and payment status utilities for betoni.online.
 * Provides consistent invoice response normalization and payment status computation.
 *
 * @module @ibetoni/fennoa-utils
 */

const { parseFennoaInvoiceResponse } = require("./parseFennoaInvoiceResponse.js");
const { computePaymentStatus } = require("./computePaymentStatus.js");

module.exports = {
  parseFennoaInvoiceResponse,
  computePaymentStatus,
};
