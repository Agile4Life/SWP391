import { forwardRef, useState, type ChangeEvent } from 'react';
import { useI18n } from '../i18n';
import './file-picker.css';

/** Props của ô chọn tệp: id, loại tệp, chọn nhiều, nhãn nút, tên tệp hiển thị và sự kiện onChange. */
interface FilePickerProps {
  id?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  /** Nhãn hiển thị trên nút; mặc định là "Chọn tệp" / "Choose file". */
  buttonLabel?: string;
  /** Tên trợ năng (accessible name) khi không có thẻ <label htmlFor> hiển thị nào trỏ tới ô chọn tệp này. */
  ariaLabel?: string;
  /** Danh sách tên tệp hiển thị cạnh nút. Truyền khi component cha quản lý lựa chọn (để khi reset sẽ xóa chữ);
   *  ngược lại ô chọn tệp sẽ tự hiển thị tên các tệp được chọn gần nhất. */
  fileNames?: string[];
  // Sự kiện thay đổi của input tệp gốc.
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Ô chọn tệp đồng bộ giao diện: chuỗi "Choose File / No file chosen" gốc của trình duyệt phụ thuộc vào ngôn ngữ
 * trình duyệt, nên input gốc được ẩn về mặt hiển thị (vẫn focus và gắn nhãn được) còn phần hiển thị do ứng dụng tự
 * dựng và dịch qua useI18n.
 */
export const FilePicker = forwardRef<HTMLInputElement, FilePickerProps>(function FilePicker(
  { id, accept, multiple, disabled, className = '', buttonLabel, ariaLabel, fileNames, onChange },
  ref,
) {
  const { t } = useI18n();
  const [picked, setPicked] = useState<string[]>([]);
  const names = fileNames ?? picked;
  const summary = names.length === 0
    ? t('Chưa chọn tệp', 'No file chosen')
    : names.length === 1 ? names[0] : t(`Đã chọn ${names.length} tệp`, `${names.length} files selected`);

  return (
    <label className={`file-picker${disabled ? ' is-disabled' : ''} ${className}`.trim()}>
      <input
        ref={ref}
        id={id}
        type="file"
        className="file-picker__input"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => {
          setPicked(Array.from(event.target.files ?? []).map((file) => file.name));
          onChange(event);
        }}
      />
      <span className="file-picker__button" aria-hidden="true">{buttonLabel ?? t('Chọn tệp', 'Choose file')}</span>
      <span className={`file-picker__name${names.length ? ' has-file' : ''}`} title={names.join(', ') || undefined}>
        {summary}
      </span>
    </label>
  );
});
