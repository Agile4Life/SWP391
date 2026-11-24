import { PageHeader } from '../../shared/ui/PageHeader';
import { useStaffI18n } from '../operations/staffI18n';
import { SavedTrainingPlans } from './SavedTrainingPlans';
import './coach-training-plan.css';

/**
 * Tab giáo án đã lưu: các giáo án HLV đã kích hoạt, tách khỏi trình soạn giáo án từng bước.
 */
export function CoachSavedPlansPage() {
  const { t } = useStaffI18n();
  return (
    <div data-i18n-managed className="portal-container plan-editor-page">
      <PageHeader title={t("Giáo án đã lưu")} />
      <SavedTrainingPlans />
    </div>
  );
}
