import { useSourceLanguage } from "../../shared/i18n/sourceText";
import { FitnessLanding } from './components/FitnessLanding';
import { PublicLayout } from './components/PublicLayout';

/** Trang chủ công khai: hiển thị FitnessLanding trong PublicLayout. */
export function LandingPage() {
  useSourceLanguage();
  return <PublicLayout><FitnessLanding /></PublicLayout>;
}
