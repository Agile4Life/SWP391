import { forwardRef, useState, type ChangeEvent } from 'react';
import { useI18n } from '../i18n';
import './file-picker.css';

interface FilePickerProps {
  id?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  /** Visible button text; defaults to "Chọn tệp" / "Choose file". */
  buttonLabel?: string;
  /** Accessible name when no visible <label htmlFor> points at this picker. */
  ariaLabel?: string;
  /** Names to show beside the button. Pass it when the parent owns the selection (so a reset clears the text);
   *  otherwise the picker shows the names of the files picked last. */
  fileNames?: string[];
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Themed file picker: the browser's own "Choose File / No file chosen" text follows the browser language,
 * so the native input is visually hidden (still focusable and labelled) and the visible part is our own,
 * translated through useI18n.
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
