import { useState } from 'react';
import { useI18n } from '../../shared/i18n';
import { Modal } from '../../shared/ui/Modal';

export interface LightboxImage {
  url: string;
  title: string;
  alt: string;
}

/**
 * Hộp thoại phóng to ảnh giấy tờ (CCCD / Hộ chiếu / biên lai) ngay trong ứng dụng, hỗ trợ phóng to 2x để kiểm tra
 * số giấy tờ rõ ràng trên cả màn hình nhỏ mà không phải mở tab mới.
 */
export function DocumentImageLightbox({
  image,
  onClose,
}: {
  image: LightboxImage | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [zoomed, setZoomed] = useState(false);

  if (!image) return null;

  return (
    <Modal
      title={image.title}
      onClose={() => {
        setZoomed(false);
        onClose();
      }}
      className="document-lightbox-modal"
    >
      <div className="document-lightbox">
        <div className={`document-lightbox__viewport${zoomed ? ' is-zoomed' : ''}`}>
          <img
            src={image.url}
            alt={image.alt}
            className="document-lightbox__img"
            onClick={() => setZoomed((prev) => !prev)}
          />
        </div>
        <div className="document-lightbox__actions">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setZoomed((prev) => !prev)}
          >
            {zoomed ? t('Thu nhỏ (100%)', 'Reset zoom (100%)') : t('Phóng to (200%)', 'Zoom in (200%)')}
          </button>
          <a
            href={image.url}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary btn-sm"
          >
            {t('Mở ảnh gốc', 'Open original')}
          </a>
        </div>
      </div>
    </Modal>
  );
}
