import { describe, it, expect, vi } from "vitest";
import { parseFennoaInvoiceResponse } from "../parseFennoaInvoiceResponse.js";

// Mock @ibetoni/constants/fennoa before importing computePaymentStatus
vi.mock("@ibetoni/constants/fennoa", () => ({
  FENNOA_PAYMENT_STATUS: {
    PAID: "paid",
    UNPAID: "unpaid",
    OVERDUE: "overdue",
    PARTIALLY_PAID: "partially_paid",
  },
}));

const { computePaymentStatus } = await import("../computePaymentStatus.js");

// --- parseFennoaInvoiceResponse ---

describe("parseFennoaInvoiceResponse", () => {
  it("handles data.Invoice format", () => {
    const response = {
      data: {
        Invoice: {
          SalesInvoice: { id: 1, total: 100 },
          otherField: "test",
        },
      },
    };
    const result = parseFennoaInvoiceResponse(response);
    expect(result.invoiceData).toEqual(response.data.Invoice);
    expect(result.salesInvoice).toEqual({ id: 1, total: 100 });
  });

  it("handles Invoice format (no data wrapper)", () => {
    const response = {
      Invoice: {
        SalesInvoice: { id: 2, total: 200 },
      },
    };
    const result = parseFennoaInvoiceResponse(response);
    expect(result.invoiceData).toEqual(response.Invoice);
    expect(result.salesInvoice).toEqual({ id: 2, total: 200 });
  });

  it("handles data format (no Invoice key)", () => {
    const response = {
      data: {
        SalesInvoice: { id: 3, total: 300 },
      },
    };
    const result = parseFennoaInvoiceResponse(response);
    expect(result.invoiceData).toEqual(response.data);
    expect(result.salesInvoice).toEqual({ id: 3, total: 300 });
  });

  it("handles direct format (raw response)", () => {
    const response = {
      SalesInvoice: { id: 4, total: 400 },
    };
    const result = parseFennoaInvoiceResponse(response);
    expect(result.invoiceData).toEqual(response);
    expect(result.salesInvoice).toEqual({ id: 4, total: 400 });
  });

  it("uses invoiceData as salesInvoice when no SalesInvoice key", () => {
    const response = {
      data: { id: 5, total: 500 },
    };
    const result = parseFennoaInvoiceResponse(response);
    expect(result.salesInvoice).toEqual({ id: 5, total: 500 });
  });
});

// --- computePaymentStatus ---

describe("computePaymentStatus", () => {
  it("returns PAID when totalDue is 0", () => {
    expect(computePaymentStatus(0, 1000, new Date())).toBe("paid");
  });

  it("returns OVERDUE when past due and amount owed", () => {
    const pastDate = new Date("2020-01-01");
    expect(computePaymentStatus(500, 1000, pastDate)).toBe("overdue");
  });

  it("returns PARTIALLY_PAID when partial payment made", () => {
    const futureDate = new Date("2099-12-31");
    expect(computePaymentStatus(500, 1000, futureDate)).toBe("partially_paid");
  });

  it("returns UNPAID for full amount due with future date", () => {
    const futureDate = new Date("2099-12-31");
    expect(computePaymentStatus(1000, 1000, futureDate)).toBe("unpaid");
  });

  it("returns UNPAID when no due date and full amount due", () => {
    expect(computePaymentStatus(1000, 1000, null)).toBe("unpaid");
  });

  it("returns PARTIALLY_PAID when partial and no due date", () => {
    expect(computePaymentStatus(500, 1000, null)).toBe("partially_paid");
  });

  it("returns PAID when totalDue is 0 regardless of dueDate", () => {
    const pastDate = new Date("2020-01-01");
    expect(computePaymentStatus(0, 1000, pastDate)).toBe("paid");
  });
});
