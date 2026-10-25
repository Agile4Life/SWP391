import { apiFetch } from '../../shared/api/client';

export interface SupportTicket {
  id: number;
  memberId: number;
  subject: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  assignedToName: string | null;
}

export interface SupportMessage {
  id: number;
  senderId: number;
  senderName: string | null;
  senderRole: string | null;
  message: string;
  createdAt: string;
}

interface TicketPage { content: SupportTicket[]; totalPages: number }

export const getMySupportTickets = (page = 0) =>
  apiFetch<TicketPage>(`/support/requests/my?page=${page}&size=20`);

export const createSupportTicket = (subject: string, description: string) =>
  apiFetch<SupportTicket>('/support/requests', {
    method: 'POST', body: JSON.stringify({ subject, description }),
  });

export const getSupportMessages = (id: number) =>
  apiFetch<SupportMessage[]>(`/support/requests/${id}/messages`);

export const sendSupportMessage = (id: number, message: string) =>
  apiFetch<SupportMessage>(`/support/requests/${id}/messages`, {
    method: 'POST', body: JSON.stringify({ message }),
  });
