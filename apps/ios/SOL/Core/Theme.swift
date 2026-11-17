import SwiftUI
import UIKit

extension Color {
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
}

/// Token theo DESIGN.md: Light charcoal–salmon, Dark charcoal–bạc (silver).
enum Theme {
    static let background = Color(light: 0xF5F4F2, dark: 0x202020)
    static let surface = Color(light: 0xFFFFFF, dark: 0x292929)
    static let surfaceRaised = Color(light: 0xEFEDEA, dark: 0x323232)
    static let border = Color(light: 0xDDD9D4, dark: 0x3C3C3C)
    static let text = Color(light: 0x202020, dark: 0xF2F2F2)
    static let textMuted = Color(light: 0x6B6761, dark: 0xA3A3A3)
    static let accent = Color(light: 0xCE9180, dark: 0xC8CDD6)
    static let accentText = Color(light: 0xA35B49, dark: 0xE2E6EC)
    static let onAccent = Color(light: 0x202020, dark: 0x202020)
    static let success = Color(light: 0x2E7D4F, dark: 0x5CC48A)
    static let warning = Color(light: 0xB7791F, dark: 0xE0B25C)
    static let danger = Color(light: 0xC0392B, dark: 0xF07A6C)
}

enum Metrics {
    static let radius: CGFloat = 20
    static let pad: CGFloat = 16
}
