import SwiftUI
import SceneKit

/// Khám phá trung tâm 3D (SceneKit): tầng, khu vực và trạng thái phòng theo dữ liệu thật.
/// Bản native rút gọn của Explore 3D trên web: mô hình khối theo đa giác của scene web, không có walk-through hay diễn viên động.
struct ExploreView: View {
    @State private var exploded = false
    @State private var levelFilter: String?
    @State private var selected: CenterZone?
    @State private var rooms: [CatalogRoom] = []
    @State private var walk = false
    @State private var walker = Walker()

    private var visibleZones: [CenterZone] { CenterScene.zones.filter { levelFilter == nil || $0.levelId == levelFilter } }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                CenterSceneView(exploded: exploded, levelFilter: walk ? walker.levelId : levelFilter, selectedId: selected?.id, walker: walk ? walker : nil) { id in selected = CenterScene.zones.first { $0.id == id } }
                    .frame(height: walk ? 460 : 340).clipShape(RoundedRectangle(cornerRadius: Metrics.radius, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: Metrics.radius, style: .continuous).stroke(Theme.border))
                    .overlay(alignment: .bottomLeading) { if walk { WalkPad(walker: walker).padding(14) } }
                    .overlay(alignment: .topTrailing) { if walk { levelStepper.padding(10) } }
                Button { toggleWalk() } label: { Label(walk ? t("Thoát chế độ đi bộ", "Exit walk mode") : t("Đi bộ trong trung tâm", "Walk through the center"), systemImage: walk ? "xmark.circle" : "figure.walk") }.buttonStyle(.solSecondary)
                if !walk { HStack {
                    Picker("", selection: $levelFilter) { Text(t("Tất cả", "All")).tag(String?.none); ForEach(CenterScene.levels) { Text($0.code).tag(Optional($0.id)) } }.pickerStyle(.segmented)
                    Toggle(isOn: $exploded) { Image(systemName: "square.3.layers.3d.down.right") }.toggleStyle(.button).tint(Theme.accent)
                } }
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

    private var levelStepper: some View {
        HStack(spacing: 8) {
            Button { stepLevel(-1) } label: { Image(systemName: "arrow.down") }
            Text(CenterScene.levels.first { $0.id == walker.levelId }?.code ?? "").font(.subheadline.weight(.bold)).frame(minWidth: 30)
            Button { stepLevel(1) } label: { Image(systemName: "arrow.up") }
        }.padding(8).background(.ultraThinMaterial, in: Capsule()).foregroundStyle(Theme.text)
    }

    private func toggleWalk() {
        walk.toggle()
        if walk { walker.enter(level: levelFilter ?? "lvl-l1") }
    }

    /// Cầu thang: chuyển sang tầng kế và đặt người đi bộ tại khu lõi (thang máy/cầu thang) của tầng đó nếu có.
    private func stepLevel(_ d: Int) {
        let levels = CenterScene.levels.filter { $0.code != "OUT" }
        guard let i = levels.firstIndex(where: { $0.id == walker.levelId }), levels.indices.contains(i + d) else { return }
        walker.enter(level: levels[i + d].id)
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
    var walker: Walker? = nil
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
        v.allowsCameraControl = walker == nil
        v.autoenablesDefaultLighting = true
        v.antialiasingMode = .multisampling4X
        v.backgroundColor = .clear
        let ambient = SCNNode(); ambient.light = SCNLight(); ambient.light?.type = .ambient; ambient.light?.intensity = 650
        v.scene?.rootNode.addChildNode(ambient)
        let cam = SCNNode(); cam.camera = SCNCamera(); cam.camera?.zFar = 400
        cam.position = SCNVector3(0, 38, 62); cam.look(at: SCNVector3(0, 4, 0))
        v.scene?.rootNode.addChildNode(cam)
        v.pointOfView = cam
        v.addGestureRecognizer(UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tap(_:))))
        context.coordinator.view = v
        rebuild(v, animate: false)
        return v
    }

    func updateUIView(_ v: SCNView, context: Context) {
        context.coordinator.onSelect = onSelect
        context.coordinator.walker = walker
        v.allowsCameraControl = walker == nil
        rebuild(v, animate: true)
        if let w = walker { context.coordinator.attachWalk(to: v, walker: w) } else { context.coordinator.detachWalk(from: v) }
    }

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
            if walker != nil { addWalls(to: node, level: level) }
            root.addChildNode(node)
        }
    }

    /// Tường quanh tầng và nhãn khu vực (chỉ trong chế độ đi bộ).
    private func addWalls(to parent: SCNNode, level: CenterLevel) {
        let pts = level.slab
        for i in 0..<pts.count {
            let a = pts[i], b = pts[(i + 1) % pts.count]
            let len = hypot(b[0] - a[0], b[1] - a[1])
            let wall = SCNNode(geometry: SCNBox(width: len, height: level.height, length: 0.2, chamferRadius: 0))
            wall.geometry?.firstMaterial?.diffuse.contents = UIColor(white: 0.85, alpha: 0.35)
            wall.geometry?.firstMaterial?.isDoubleSided = true
            wall.position = SCNVector3((a[0] + b[0]) / 2, 0.28 + level.height / 2, (a[1] + b[1]) / 2)
            wall.eulerAngles.y = Float(-atan2(b[1] - a[1], b[0] - a[0]))
            parent.addChildNode(wall)
        }
        for z in CenterScene.zones where z.levelId == level.id {
            let c = z.polygon.reduce([0.0, 0.0]) { [$0[0] + $1[0], $0[1] + $1[1]] }.map { $0 / Double(max(1, z.polygon.count)) }
            let text = SCNText(string: z.name.components(separatedBy: " (").first ?? z.name, extrusionDepth: 0.05)
            text.font = UIFont.boldSystemFont(ofSize: 1)
            text.firstMaterial?.diffuse.contents = UIColor.white
            let n = SCNNode(geometry: text); n.scale = SCNVector3(0.55, 0.55, 0.55)
            let (mn, mx) = n.boundingBox; n.pivot = SCNMatrix4MakeTranslation((mx.x - mn.x) / 2 + mn.x, 0, 0)
            n.position = SCNVector3(c[0], 2.6, c[1]); n.constraints = [SCNBillboardConstraint()]
            parent.addChildNode(n)
        }
    }

    private func extrude(_ pts: [[Double]], depth: CGFloat, color: UIColor, lift: Double, name: String?) -> SCNNode {
        let path = UIBezierPath()
        for (i, p) in pts.enumerated() { let pt = CGPoint(x: p[0], y: -p[1]); i == 0 ? path.move(to: pt) : path.addLine(to: pt) }
        path.close()
        let shape = SCNShape(path: path, extrusionDepth: depth)
        let m = SCNMaterial(); m.diffuse.contents = color; m.lightingModel = .blinn; m.isDoubleSided = true
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
        var walker: Walker?
        private var link: CADisplayLink?
        private var pan: UIPanGestureRecognizer?
        init(onSelect: @escaping (String) -> Void) { self.onSelect = onSelect }

        func attachWalk(to v: SCNView, walker: Walker) {
            if pan == nil { let g = UIPanGestureRecognizer(target: self, action: #selector(look(_:))); v.addGestureRecognizer(g); pan = g }
            if link == nil { let l = CADisplayLink(target: self, selector: #selector(step)); l.add(to: .main, forMode: .common); link = l }
            apply(walker, to: v)
        }
        func detachWalk(from v: SCNView) {
            link?.invalidate(); link = nil
            if let p = pan { v.removeGestureRecognizer(p); pan = nil }
        }
        @objc private func look(_ g: UIPanGestureRecognizer) {
            guard let w = walker else { return }
            let t = g.translation(in: g.view); g.setTranslation(.zero, in: g.view)
            w.yaw -= Double(t.x) * 0.005
            w.pitch = max(-0.6, min(0.6, w.pitch - Double(t.y) * 0.004))
        }
        @objc private func step(_ l: CADisplayLink) {
            guard let w = walker, let v = view else { return }
            w.advance(dt: l.targetTimestamp - l.timestamp)
            apply(w, to: v)
        }
        private func apply(_ w: Walker, to v: SCNView) {
            guard let cam = v.pointOfView else { return }
            let level = CenterScene.levels.first { $0.id == w.levelId }
            cam.position = SCNVector3(w.x, (level?.elevation ?? 0) + 0.28 + 1.65, w.z)
            cam.eulerAngles = SCNVector3(w.pitch, w.yaw, 0)
        }
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


/// Trạng thái người đi bộ (góc nhìn thứ nhất): vị trí trong mặt phẳng tầng, hướng nhìn, vận tốc từ joystick.
@Observable
final class Walker {
    var levelId = "lvl-l1"
    var x = 0.0
    var z = 0.0
    var yaw = 0.0
    var pitch = 0.0
    /// Joystick: x = sang phải, y = tiến (−1…1).
    var stick = CGPoint.zero

    func enter(level id: String) {
        levelId = id
        // Đặt ở khu lõi (thang máy/cầu thang) nếu có, ngược lại ở tâm sàn.
        let zones = CenterScene.zones.filter { $0.levelId == id }
        let spot = zones.first { $0.category == "circulation" } ?? zones.first
        if let p = spot?.polygon, !p.isEmpty { x = p.map { $0[0] }.reduce(0, +) / Double(p.count); z = p.map { $0[1] }.reduce(0, +) / Double(p.count) } else { x = 0; z = 0 }
        yaw = 0; pitch = -0.15
    }

    func advance(dt: TimeInterval) {
        guard stick != .zero, let level = CenterScene.levels.first(where: { $0.id == levelId }) else { return }
        let speed = 3.2 * dt
        let fx = -sin(yaw), fz = -cos(yaw)       // hướng nhìn
        let rx = cos(yaw), rz = -sin(yaw)        // bên phải
        let nx = x + (fx * Double(stick.y) + rx * Double(stick.x)) * speed
        let nz = z + (fz * Double(stick.y) + rz * Double(stick.x)) * speed
        // Va chạm: chỉ đi trong đa giác sàn của tầng.
        if Self.inside(nx, nz, level.slab) { x = nx; z = nz }
        else if Self.inside(nx, z, level.slab) { x = nx }
        else if Self.inside(x, nz, level.slab) { z = nz }
    }

    static func inside(_ px: Double, _ pz: Double, _ poly: [[Double]]) -> Bool {
        var inside = false, j = poly.count - 1
        for i in 0..<poly.count {
            let (xi, zi, xj, zj) = (poly[i][0], poly[i][1], poly[j][0], poly[j][1])
            if (zi > pz) != (zj > pz), px < (xj - xi) * (pz - zi) / (zj - zi) + xi { inside.toggle() }
            j = i
        }
        return inside
    }
}

struct WalkPad: View {
    let walker: Walker
    @State private var drag = CGSize.zero
    var body: some View {
        ZStack {
            Circle().fill(.ultraThinMaterial).frame(width: 120, height: 120)
            Circle().fill(Theme.accent).frame(width: 46, height: 46).offset(drag)
        }
        .gesture(DragGesture(minimumDistance: 0).onChanged { g in
            let r: CGFloat = 50
            let d = CGSize(width: max(-r, min(r, g.translation.width)), height: max(-r, min(r, g.translation.height)))
            drag = d; walker.stick = CGPoint(x: d.width / r, y: -d.height / r)
        }.onEnded { _ in drag = .zero; walker.stick = .zero })
    }
}
