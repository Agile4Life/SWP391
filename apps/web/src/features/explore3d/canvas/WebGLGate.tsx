/* eslint-disable react-refresh/only-export-components */
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { useExploreStore } from '../state/exploreStore';

export interface WebGLGateProps {
  children: ReactNode;
  fallback: ReactNode;
}

let cachedWebGLSupport: boolean | null = null;

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

interface CanvasErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError: (error: Error, info: ErrorInfo) => void;
}

interface CanvasErrorBoundaryState {
  hasError: boolean;
}

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
