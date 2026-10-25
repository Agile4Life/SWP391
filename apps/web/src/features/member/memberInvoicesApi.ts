import { apiFetch, apiFetchPdf } from '../../shared/api/client';

export interface MemberInvoice {
  id: number;
  paymentId: number;
  invoiceNumber: string;
  issuedAt: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number | null;
}

export const getMyInvoiceByPayment = (paymentId: number) =>
  apiFetch<MemberInvoice>(`/invoices/my/by-payment/${paymentId}`);

export const getMyInvoicePdf = (paymentId: number) =>
  apiFetchPdf(`/invoices/my/by-payment/${paymentId}/download`);
