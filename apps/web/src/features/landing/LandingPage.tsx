import { useSourceLanguage } from "../../shared/i18n/sourceText";
import { FitnessLanding } from './components/FitnessLanding';
import { PublicLayout } from './components/PublicLayout';

export function LandingPage() {
  useSourceLanguage();
  return <PublicLayout><FitnessLanding /></PublicLayout>;
}
