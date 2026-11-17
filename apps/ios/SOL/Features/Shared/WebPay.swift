import SwiftUI
import SafariServices

/// Mở trang thanh toán VNPay (chỉ host sandbox/production hợp lệ) trong Safari View Controller.
struct SafariView: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController { SFSafariViewController(url: url) }
    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}

enum VnpayURL {
    static func validated(_ raw: String) -> URL? {
        guard let url = URL(string: raw), url.scheme == "https", let host = url.host,
              host == "sandbox.vnpayment.vn" || host == "pay.vnpay.vn" else { return nil }
        return url
    }
}

struct PDFSheet: View {
    let data: Data
    let name: String
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            PDFKitView(data: data)
                .navigationTitle(name).navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button(t("Đóng", "Close")) { dismiss() } }
                    ToolbarItem(placement: .primaryAction) { ShareLink(item: data, preview: SharePreview(name)) }
                }
        }
    }
}

import PDFKit
struct PDFKitView: UIViewRepresentable {
    let data: Data
    func makeUIView(context: Context) -> PDFView { let v = PDFView(); v.autoScales = true; v.document = PDFDocument(data: data); return v }
    func updateUIView(_ uiView: PDFView, context: Context) {}
}
