import { useLayoutEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import './loading-image.css';

/**
 * Ảnh có lớp chờ tải: đánh dấu aria-busy tới khi ảnh tải xong hoặc lỗi (ảnh đã có sẵn trong cache thì xong
 * ngay).
 *
 * Keep the image's native size and priority; remove the placeholder as soon as it settles.
 */
export function LoadingImage({ src, className = '', onLoad, onError, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const image = useRef<HTMLImageElement>(null);
  const [settledSrc, setSettledSrc] = useState<string>();
  useLayoutEffect(() => {
    if (image.current?.complete && image.current.naturalWidth > 0) setSettledSrc(src);
  }, [src]);
  return <img {...props} ref={image} src={src} className={`loading-image ${className}`} aria-busy={settledSrc !== src}
    onLoad={event => { setSettledSrc(src); onLoad?.(event); }}
    onError={event => { setSettledSrc(src); onError?.(event); }} />;
}
