import SwiftUI
import AVFoundation

/// Quét QR bằng camera (AVFoundation). Trả về chuỗi đầu tiên đọc được.
struct QRScannerView: UIViewControllerRepresentable {
    let onCode: (String) -> Void
    func makeUIViewController(context: Context) -> ScannerController { let c = ScannerController(); c.onCode = onCode; return c }
    func updateUIViewController(_ uiViewController: ScannerController, context: Context) {}

    final class ScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
        var onCode: ((String) -> Void)?
        private let session = AVCaptureSession()
        private var preview: AVCaptureVideoPreviewLayer?
        private var done = false

        override func viewDidLoad() {
            super.viewDidLoad()
            view.backgroundColor = .black
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized: setup()
            case .notDetermined: AVCaptureDevice.requestAccess(for: .video) { ok in DispatchQueue.main.async { if ok { self.setup() } else { self.denied() } } }
            default: denied()
            }
        }

        private func denied() {
            let label = UILabel()
            label.text = t("Cần quyền camera để quét mã QR. Hãy bật trong Cài đặt.", "Camera access is needed to scan QR codes. Enable it in Settings.")
            label.textColor = .white; label.numberOfLines = 0; label.textAlignment = .center
            label.frame = view.bounds.insetBy(dx: 24, dy: 24); label.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            view.addSubview(label)
        }

        private func setup() {
            guard let device = AVCaptureDevice.default(for: .video), let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) else { denied(); return }
            session.addInput(input)
            let out = AVCaptureMetadataOutput()
            guard session.canAddOutput(out) else { return }
            session.addOutput(out)
            out.setMetadataObjectsDelegate(self, queue: .main)
            out.metadataObjectTypes = [.qr]
            let layer = AVCaptureVideoPreviewLayer(session: session)
            layer.videoGravity = .resizeAspectFill
            layer.frame = view.bounds
            view.layer.addSublayer(layer)
            preview = layer
            DispatchQueue.global(qos: .userInitiated).async { self.session.startRunning() }
        }

        override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); preview?.frame = view.bounds }
        override func viewWillDisappear(_ animated: Bool) { super.viewWillDisappear(animated); if session.isRunning { session.stopRunning() } }

        func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput objects: [AVMetadataObject], from connection: AVCaptureConnection) {
            guard !done, let code = (objects.first as? AVMetadataMachineReadableCodeObject)?.stringValue else { return }
            done = true
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            onCode?(code)
        }
    }
}
