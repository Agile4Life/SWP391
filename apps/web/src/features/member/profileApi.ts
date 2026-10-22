import { apiFetch } from '../../shared/api/client';

export interface Profile {
  userId: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  avatarUrl: string | null;
  address: string | null;
  membershipCode: string | null;
  healthNotes: string | null;
  fitnessGoal: string | null;
  fitnessLevel: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

export interface HealthMetric {
  id: number;
  metricName: string;
  metricValue: number;
  unit: string | null;
  recordedAt: string;
}

export interface NewHealthMetric {
  metricName: string;
  metricValue: number;
  unit: string | null;
}

export const getProfile = () => apiFetch<Profile>('/profile');

export const updateProfile = (profile: Profile) =>
  apiFetch<Profile>('/profile', { method: 'PUT', body: JSON.stringify(profile) });

export const listHealthMetrics = (memberId: number) =>
  apiFetch<HealthMetric[]>(`/members/${memberId}/health-metrics`);

export const addHealthMetric = (memberId: number, metric: NewHealthMetric) =>
  apiFetch(`/members/${memberId}/health-metrics`, { method: 'POST', body: JSON.stringify(metric) });

export const updateHealthMetric = (memberId: number, metricId: number, metric: NewHealthMetric) =>
  apiFetch<HealthMetric>(`/members/${memberId}/health-metrics/${metricId}`, {
    method: 'PUT',
    body: JSON.stringify(metric),
  });

export const deleteHealthMetric = (memberId: number, metricId: number) =>
  apiFetch(`/members/${memberId}/health-metrics/${metricId}`, {
    method: 'DELETE',
  });
