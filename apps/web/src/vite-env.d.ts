/// <reference types="vite/client" />

// Biến môi trường của Vite mà ứng dụng sử dụng.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

// Khai báo kiểu cho import.meta.
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Mở rộng window cho API Google Identity Services.
interface Window {
  google?: {
    accounts?: {
      id?: {
        initialize: (config: {
          client_id: string;
          // Hàm gọi lại khi Google trả về credential.
          callback: (response: { credential: string }) => void;
          auto_select?: boolean;
          cancel_on_tap_outside?: boolean;
        }) => void;
        prompt: (momentListener?: (notification: {
          // Cho biết lời nhắc Google không được hiển thị.
          isNotDisplayed: () => boolean;
          // Cho biết lời nhắc bị bỏ qua.
          isSkippedMoment: () => boolean;
          // Cho biết lời nhắc bị người dùng đóng.
          isDismissedMoment: () => boolean;
          // Lý do người dùng đóng lời nhắc.
          getDismissedReason: () => string;
          // Lý do lời nhắc không được hiển thị.
          getNotDisplayedReason: () => string;
        }) => void) => void;
        renderButton: (
          parent: HTMLElement,
          options: {
            type?: 'standard' | 'icon';
            theme?: 'outline' | 'filled_blue' | 'filled_black';
            size?: 'large' | 'medium' | 'small';
            text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
            shape?: 'rectangular' | 'pill' | 'circle' | 'square';
            logo_alignment?: 'left' | 'center';
            width?: number | string;
            locale?: string;
          }
        ) => void;
        // Hủy lời nhắc đang hiển thị.
        cancel: () => void;
      };
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          prompt?: string;
          // Hàm gọi lại nhận access token (hoặc lỗi) từ Google OAuth.
          callback: (response: { access_token?: string; error?: string; error_description?: string }) => void;
          error_callback?: (error: { type: string; message?: string }) => void;
        }) => {
          // Yêu cầu access token từ Google.
          requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
        };
      };
    };
  };
}
