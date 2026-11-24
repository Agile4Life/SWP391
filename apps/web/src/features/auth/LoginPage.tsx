import { useSourceLanguage } from "../../shared/i18n/sourceText";
import { LuxuryLoginForm } from './LuxuryLoginForm';
import { AuthLayout } from '../landing/components/PublicLayout';

/** Trang đăng nhập: bọc biểu mẫu đăng nhập trong AuthLayout. */
export function LoginPage() {
  useSourceLanguage();
  return <AuthLayout mode="login"><LuxuryLoginForm /></AuthLayout>;
}
