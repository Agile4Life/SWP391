import { useSourceLanguage } from "../../shared/i18n/sourceText";
import { LuxuryLoginForm } from './LuxuryLoginForm';
import { AuthLayout } from '../landing/components/PublicLayout';

export function LoginPage() {
  useSourceLanguage();
  return <AuthLayout mode="login"><LuxuryLoginForm /></AuthLayout>;
}
