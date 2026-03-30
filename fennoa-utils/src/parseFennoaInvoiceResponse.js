/**
 * Parse Fennoa invoice response into a normalized invoice object.
 * Fennoa returns different response formats — this handles all variations.
 * @param {object} responseData - Raw response.data from Fennoa API
 * @returns {{ invoiceData: object, salesInvoice: object }} Normalized invoice data
 */
function parseFennoaInvoiceResponse(responseData) {
  let invoiceData = null;
  if (responseData.data?.Invoice) {
    invoiceData = responseData.data.Invoice;
  } else if (responseData.Invoice) {
    invoiceData = responseData.Invoice;
  } else if (responseData.data) {
    invoiceData = responseData.data;
  } else {
    invoiceData = responseData;
  }

  const salesInvoice = invoiceData.SalesInvoice || invoiceData;
  return { invoiceData, salesInvoice };
}

module.exports = { parseFennoaInvoiceResponse };
