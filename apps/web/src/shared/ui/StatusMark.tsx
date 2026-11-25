/** Props của dấu trạng thái: loại thành công/lỗi và kích thước. */
interface StatusMarkProps {
  type?: 'success' | 'error';
  size?: number;
}

/** Dấu ✓ / ✕ tự vẽ nét bằng SVG — phản hồi thành công / thất bại. */
export function StatusMark({ type = 'success', size = 56 }: StatusMarkProps) {
  return (
    <svg
      className={`status-mark status-mark--${type}`}
      width={size}
      height={size}
      viewBox="0 0 52 52"
      aria-hidden="true"
    >
      <circle className="status-mark__circle" cx="26" cy="26" r="23" pathLength={1} />
      {type === 'success' ? (
        <path className="status-mark__path" d="M15 27 L22 34 L37 18" pathLength={1} />
      ) : (
        <>
          <path className="status-mark__path" d="M18 18 L34 34" pathLength={1} />
          <path className="status-mark__path status-mark__path--2" d="M34 18 L18 34" pathLength={1} />
        </>
      )}
    </svg>
  );
}
