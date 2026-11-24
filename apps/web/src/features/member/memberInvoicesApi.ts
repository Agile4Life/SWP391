import { apiFetch, apiFetchPdf } from '../../shared/api/client';

/** Hóa đơn của hội viên: số hóa đơn, ngày xuất, tiền trước thuế, thuế và tổng tiền. */
export interface MemberInvoice {
  id: number;
  paymentId: number;
  invoiceNumber: string;
  issuedAt: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number | null;
}

/** Lấy hóa đơn theo khoản thanh toán. */
export const getMyInvoiceByPayment = (paymentId: number) =>
  apiFetch<MemberInvoice>(`/invoices/my/by-payment/${paymentId}`);

/** Tải PDF hóa đơn của một khoản thanh toán. */
export const getMyInvoicePdf = (paymentId: number) =>
  apiFetchPdf(`/invoices/my/by-payment/${paymentId}/download`);
