import { useSourceLanguage, sourceText, sourceFormat } from "../../../shared/i18n/sourceText";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PublicCatalog } from '../publicCatalog';
import { localizeSeededCatalogText } from '../publicCatalog';
import { formatPrice, getPackageDetails, isTrialPackage, localizeSeededPackageName, LONG_TERM_DAYS, MIN_TERM_DAYS } from '../../../shared/lib/membershipPresentation';
import { RoundArrow } from './PublicLayout';
import { coachIllustration, coachPortrait } from '../../../shared/lib/coachIllustration';
import { LoadingSkeleton } from '../../../shared/ui/LoadingSkeleton';
import { LoadingImage } from '../../../shared/ui/LoadingImage';

/** Trạng thái của vùng catalog: khung chờ khi đang tải, thông báo lỗi kèm nút thử lại khi không tải được. */
export function CatalogStatus({ loading, retry, kind = 'schedule' }: {
  loading: boolean; retry: () => void; kind?: 'packages' | 'trainers' | 'schedule';
}) {
  useSourceLanguage();
  if (loading) return <LoadingSkeleton label={sourceText("Đang tải thông tin…")} variant="cards"
    count={kind === 'trainers' ? 2 : 3} className={`fit-catalog-skeleton fit-catalog-skeleton--${kind}`} />;
  return <div className="fit-catalog-state" role="alert">
    <p>{sourceText("Chưa tải được thông tin mới nhất. Vui lòng thử lại.")}</p>
    <button type="button" className="fit-pill" onClick={retry}>{sourceText("Thử lại")}</button>
  </div>;
}

/** Bảng các gói tập đang bán (bỏ gói trải nghiệm), chuyển giữa nhóm ngắn hạn và dài hạn, kèm nút tham gia. */
export function CatalogPackages({ catalog, joinPath }: { catalog: PublicCatalog; joinPath: string }) {
  useSourceLanguage();
  const [longTerm, setLongTerm] = useState(false);

  const packages = catalog.packages.filter(pkg => {
    if (pkg.status !== 'active') return false;
    if (isTrialPackage(pkg)) return false;
    // Cùng quy tắc với trang gói hội viên: chỉ quảng cáo gói hội viên mua được (từ 3 tháng).
    if (pkg.durationDays < MIN_TERM_DAYS) return false;
    return longTerm ? pkg.durationDays >= LONG_TERM_DAYS : pkg.durationDays < LONG_TERM_DAYS;
  });

  return <>
    <div className="fit-pricing-switch" data-reveal="soft" aria-label={sourceText("Lọc thời hạn gói tập")}>
      <button type="button" aria-pressed={!longTerm} onClick={() => setLongTerm(false)}>{sourceText("Gói 3 tháng")}</button>
      <button type="button" aria-pressed={longTerm} onClick={() => setLongTerm(true)}>{sourceText("Đồng hành dài hạn (6–12 tháng)")}</button>
    </div>
    {packages.length === 0 && <p className="fit-catalog-state" role="status">{sourceText("Chưa có gói tập phù hợp.")}</p>}
    <div className="fit-pricing-grid" key={String(longTerm)}>
      {packages.map((pkg, index) => {
        const details = getPackageDetails(pkg);
        const isFeatured = index === 1;
        return <article key={pkg.id} className={`fit-plan ${isFeatured ? 'fit-plan-featured' : ''}`} data-reveal="lift">
          <h3>{localizeSeededPackageName(pkg.name)}</h3>
          <div className="fit-plan-price">{formatPrice(pkg.price)}<span>/ {pkg.durationDays} {sourceText(" ngày")}</span></div>
          <p className="fit-plan-summary">{details.summary}</p>
          <ul>{details.benefits.slice(0, 3).map(benefit => <li key={benefit}><span aria-hidden="true">✓</span>{benefit}</li>)}</ul>
          {details.benefits.length > 3 && <details className="fit-plan-more">
            <summary>{sourceText("Xem thêm ")}{details.benefits.length - 3} {sourceText(" quyền lợi")}</summary>
            <ul>{details.benefits.slice(3).map(benefit => <li key={benefit}><span aria-hidden="true">✓</span>{benefit}</li>)}</ul>
          </details>}
          <Link
            className="fit-pill"
            to={joinPath === '/register' || joinPath === '/login' ? `${joinPath}?returnTo=${encodeURIComponent(`/member/packages?packageId=${pkg.id}`)}` : joinPath === '/member/packages' ? `${joinPath}?packageId=${pkg.id}` : joinPath}
          >
            <span>{sourceText("Chọn gói tập")}</span>
            <RoundArrow diagonal />
          </Link>
        </article>;
      })}
    </div>
  </>;
}

/** Danh sách HLV nổi bật, chia trang hai HLV mỗi trang. */
export function CatalogTrainers({ catalog }: { catalog: PublicCatalog }) {
  useSourceLanguage();
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(catalog.coaches.length / 2);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  return <>
    {catalog.coaches.length === 0 && <p className="fit-catalog-state" role="status">{sourceText("Chưa có huấn luyện viên đang hoạt động.")}</p>}
    {pageCount > 1 && <div className="fit-slider-controls" aria-label={sourceText("Chọn nhóm huấn luyện viên")}>{Array.from({ length: pageCount }, (_, index) => <button type="button" key={index} className={currentPage === index ? 'is-active' : ''} aria-label={sourceFormat("Nhóm huấn luyện {0}", index + 1)} aria-pressed={currentPage === index} onClick={() => setPage(index)} />)}</div>}
    <div className="fit-trainer-grid" key={currentPage}>
      {catalog.coaches.slice(currentPage * 2, currentPage * 2 + 2).map(coach => {
        const avatarUrl = coach.avatarUrl?.trim() || null;
        const portrait = coachPortrait(coach.name);
        return <article className="fit-trainer-card" data-reveal="lift" key={coach.id}>
          <Link to={`/trainers/${coach.id}`} className="fit-trainer-card-link" aria-label={sourceFormat("Xem hồ sơ của {0}", coach.name)}>
            <LoadingImage src={avatarUrl || coachIllustration(coach.specialization, coach.name)} alt={avatarUrl || portrait ? coach.name : sourceText('Ảnh minh họa huấn luyện viên theo bộ môn')} loading="lazy" />
            {!avatarUrl && !portrait && <span className="fit-image-caption">{sourceText("Ảnh minh họa")}</span>}
            <div className="fit-trainer-card-info"><span className="fit-trainer-vn-name">{sourceText("Huấn luyện viên")}</span><h3>{coach.name}</h3><p>{coach.specialization ? localizeSeededCatalogText(coach.specialization) : sourceText('Huấn luyện thể thao')}</p><span className="fit-trainer-story-cta">{sourceText("Xem hồ sơ & lịch lớp →")}</span></div>
            <RoundArrow diagonal />
          </Link>
        </article>;
      })}
    </div>
  </>;
}
