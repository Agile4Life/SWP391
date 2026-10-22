import { LuxuryLoginForm } from './LuxuryLoginForm';
import { AuthLayout } from '../landing/components/PublicLayout';

export function LoginPage() {
  return <AuthLayout mode="login"><LuxuryLoginForm /></AuthLayout>;
}
