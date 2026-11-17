import SwiftUI
import SceneKit

/// Khám phá trung tâm 3D (SceneKit): tầng, khu vực và trạng thái phòng theo dữ liệu thật.
/// Bản native rút gọn của Explore 3D trên web: mô hình khối theo đa giác của scene web, không có walk-through hay diễn viên động.
struct ExploreView: View {
    @State private var exploded = false
    @State private var levelFilter: String?
    @State private var selected: CenterZone?
    @State private var rooms: [CatalogRoom] = []

    private var visibleZones: [CenterZone] { CenterScene.zones.filter { levelFilter == nil || $0.levelId == levelFilter } }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                CenterSceneView(exploded: exploded, levelFilter: levelFilter, selectedId: selected?.id) { id in selected = CenterScene.zones.first { $0.id == id } }
                    .frame(height: 340).clipShape(RoundedRectangle(cornerRadius: Metrics.radius, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: Metrics.radius, style: .continuous).stroke(Theme.border))
                HStack {
                    Picker("", selection: $levelFilter) { Text(t("Tất cả", "All")).tag(String?.none); ForEach(CenterScene.levels) { Text($0.code).tag(Optional($0.id)) } }.pickerStyle(.segmented)
                    Toggle(isOn: $exploded) { Image(systemName: "square.3.layers.3d.down.right") }.toggleStyle(.button).tint(Theme.accent)
                }
                Text(t("Chạm vào khu vực để xem chi tiết. Kéo để xoay, véo để phóng to.", "Tap a zone for details. Drag to orbit, pinch to zoom.")).font(.footnote).foregroundStyle(Theme.textMuted).frame(maxWidth: .infinity, alignment: .leading)
                if let z = selected { detail(z) }
                SectionTitle(t("Khu vực", "Zones"))
                ForEach(visibleZones) { z in
                    Button { selected = z } label: {
                        HStack { Circle().fill(Color(CenterSceneView.color(for: z))).frame(width: 12, height: 12)
                            VStack(alignment: .leading, spacing: 2) { Text(z.name).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text).multilineTextAlignment(.leading); Text(levelCode(z.levelId)).font(.caption).foregroundStyle(Theme.textMuted) }
                            Spacer() }.card()
                    }.buttonStyle(.plain)
                }
            }.padding(Metrics.pad)
        }
        .navigationTitle(t("Khám phá 3D", "Explore 3D")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .task { rooms = (try? await AdminAPI.rooms()) ?? [] }
    }

    private func levelCode(_ id: String) -> String { CenterScene.levels.first { $0.id == id }?.name ?? "" }

    @ViewBuilder private func detail(_ z: CenterZone) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(z.name).font(.title3.weight(.bold)).foregroundStyle(Theme.text)
            Text(z.detail).font(.subheadline).foregroundStyle(Theme.textMuted)
            if let rn = z.roomName, let room = rooms.first(where: { $0.name == rn }) {
                Divider()
                LabeledRow(label: t("Phòng", "Room"), value: room.name)
                if let c = room.capacity { LabeledRow(label: t("Sức chứa", "Capacity"), value: "\(c)") }
                HStack { Text(t("Trạng thái", "Status")).foregroundStyle(Theme.textMuted).font(.subheadline); Spacer(); Pill(text: room.status == "available" ? t("Đang mở", "Open") : room.status, tone: room.status == "available" ? .success : .warning) }
            }
        }.card()
    }
}

struct CenterSceneView: UIViewRepresentable {
    let exploded: Bool
    let levelFilter: String?
    let selectedId: String?
    let onSelect: (String) -> Void

    static func color(for z: CenterZone) -> UIColor {
        if let a = z.accent, let c = UIColor(cssHex: a) { return c }
        switch z.category {
        case "pool": return UIColor(red: 0.2, green: 0.55, blue: 0.8, alpha: 1)
        case "gym": return UIColor(red: 0.8, green: 0.5, blue: 0.4, alpha: 1)
        case "court": return UIColor(red: 0.3, green: 0.65, blue: 0.45, alpha: 1)
        case "vip": return UIColor(red: 0.75, green: 0.65, blue: 0.35, alpha: 1)
        case "studio": return UIColor(red: 0.6, green: 0.45, blue: 0.75, alpha: 1)
        case "retail": return UIColor(red: 0.85, green: 0.6, blue: 0.3, alpha: 1)
        default: return UIColor(white: 0.62, alpha: 1)
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(onSelect: onSelect) }

    func makeUIView(context: Context) -> SCNView {
        let v = SCNView()
        v.scene = SCNScene()
        v.allowsCameraControl = true
        v.autoenablesDefaultLighting = true
        v.antialiasingMode = .multisampling4X
        v.backgroundColor = .clear
        let cam = SCNNode(); cam.camera = SCNCamera(); cam.camera?.zFar = 400
        cam.position = SCNVector3(0, 38, 62); cam.look(at: SCNVector3(0, 4, 0))
        v.scene?.rootNode.addChildNode(cam)
        v.pointOfView = cam
        v.addGestureRecognizer(UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tap(_:))))
        context.coordinator.view = v
        rebuild(v, animate: false)
        return v
    }

    func updateUIView(_ v: SCNView, context: Context) { context.coordinator.onSelect = onSelect; rebuild(v, animate: true) }

    private func rebuild(_ v: SCNView, animate: Bool) {
        guard let root = v.scene?.rootNode else { return }
        root.childNodes.filter { $0.name == "level" }.forEach { $0.removeFromParentNode() }
        for (i, level) in CenterScene.levels.enumerated() where levelFilter == nil || levelFilter == level.id {
            let y = level.elevation + (exploded ? Double(i) * 7 : 0)
            let node = SCNNode(); node.name = "level"; node.position = SCNVector3(0, y, 0)
            node.addChildNode(extrude(level.slab, depth: 0.28, color: UIColor(white: 0.45, alpha: 1), lift: 0, name: nil))
            for z in CenterScene.zones where z.levelId == level.id {
                let isSel = z.id == selectedId
                let n = extrude(z.polygon, depth: isSel ? 1.4 : 0.5, color: Self.color(for: z), lift: 0.28, name: z.id)
                if isSel { n.geometry?.firstMaterial?.emission.contents = Self.color(for: z).withAlphaComponent(0.5) }
                node.addChildNode(n)
            }
            root.addChildNode(node)
        }
    }

    private func extrude(_ pts: [[Double]], depth: CGFloat, color: UIColor, lift: Double, name: String?) -> SCNNode {
        let path = UIBezierPath()
        for (i, p) in pts.enumerated() { let pt = CGPoint(x: p[0], y: -p[1]); i == 0 ? path.move(to: pt) : path.addLine(to: pt) }
        path.close()
        let shape = SCNShape(path: path, extrusionDepth: depth)
        let m = SCNMaterial(); m.diffuse.contents = color; m.lightingModel = .blinn
        shape.materials = [m]
        let n = SCNNode(geometry: shape)
        n.eulerAngles.x = -.pi / 2
        n.position = SCNVector3(0, lift, 0)
        n.name = name
        return n
    }

    final class Coordinator: NSObject {
        var onSelect: (String) -> Void
        weak var view: SCNView?
        init(onSelect: @escaping (String) -> Void) { self.onSelect = onSelect }
        @objc func tap(_ g: UITapGestureRecognizer) {
            guard let v = view else { return }
            let hits = v.hitTest(g.location(in: v), options: [.searchMode: SCNHitTestSearchMode.all.rawValue])
            if let id = hits.compactMap({ $0.node.name }).first(where: { $0.hasPrefix("zone-") }) { onSelect(id) }
        }
    }
}

extension UIColor {
    convenience init?(cssHex: String) {
        var s = cssHex.trimmingCharacters(in: .whitespaces); if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        self.init(hex: v)
    }
}
