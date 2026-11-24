/* eslint-disable react-refresh/only-export-components */
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { useExploreStore } from '../state/exploreStore';

/** Props của cổng WebGL: nội dung 3D và nội dung thay thế. */
export interface WebGLGateProps {
  children: ReactNode;
  fallback: ReactNode;
}

let cachedWebGLSupport: boolean | null = null;

/** Kiểm tra trình duyệt hỗ trợ WebGL (có cache kết quả); không có document thì false. */
export function probeWebGLSupport(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  if (cachedWebGLSupport !== null) {
    return cachedWebGLSupport;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ||
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    const supported = Boolean(gl);
    if (gl && typeof gl.getExtension === 'function') {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    cachedWebGLSupport = supported;
    return supported;
  } catch {
    return false;
  }
}

/** Props của error boundary quanh canvas: nội dung, nội dung thay thế và hàm báo lỗi. */
interface CanvasErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  // Gọi khi canvas gặp lỗi khi hiển thị.
  onError: (error: Error, info: ErrorInfo) => void;
}

/** Trạng thái của error boundary: đã có lỗi chưa. */
interface CanvasErrorBoundaryState {
  hasError: boolean;
}

/** Error boundary bắt lỗi khi dựng canvas 3D và hiển thị nội dung thay thế. */
class CanvasErrorBoundary extends Component<
  CanvasErrorBoundaryProps,
  CanvasErrorBoundaryState
> {
  state: CanvasErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): CanvasErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError(error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Cổng WebGL: chỉ hiện cảnh 3D khi WebGL dùng được, ngược lại (không hỗ trợ, đánh dấu lỗi hoặc mất ngữ cảnh từ
 * lần thứ hai) hiện nội dung thay thế.
 */
export function WebGLGate({ children, fallback }: WebGLGateProps) {
  const webglUnavailable = useExploreStore(s => s.webglUnavailable);
  const contextLostCount = useExploreStore(s => s.contextLostCount);
  const [supported] = useState<boolean>(() => probeWebGLSupport());

  const shouldFallback = !supported || webglUnavailable || contextLostCount >= 2;

  useEffect(() => {
    if (shouldFallback && !useExploreStore.getState().webglUnavailable) {
      useExploreStore.getState().markWebglUnavailable();
    }
  }, [shouldFallback]);

  if (shouldFallback) {
    return <>{fallback}</>;
  }

  return (
    <CanvasErrorBoundary
      fallback={fallback}
      onError={error => {
        (window as unknown as { __EXPLORE3D_ERROR__?: string }).__EXPLORE3D_ERROR__ =
          error.stack || error.message;
        useExploreStore.getState().markWebglUnavailable();
      }}
    >
      {children}
    </CanvasErrorBoundary>
  );
}

export default WebGLGate;
