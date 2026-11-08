#!/usr/bin/env python3
"""Generate docs/diagrams/screen_flow_diagram.drawio using drawio-skill conventions.

Splits the SCMS Screen Flow Diagram into 7 clean, uncrowded tabs (8-13 nodes per tab):
  1. Tổng quan điều hướng (Overview)
  2. Public, Cửa hàng & Xác thực (Public, Shop & Auth)
  3. Hội viên - Mua gói & Tập luyện (Member Core Journey)
  4. Hội viên - Mua sắm, Hỗ trợ & Cá nhân (Member Shop, Support & Profile)
  5. Lễ tân (Receptionist / Staff)
  6. Huấn luyện viên (Coach)
  7. Quản lý (Center Manager) & Admin
"""

from __future__ import annotations

from pathlib import Path
import xml.etree.ElementTree as ET

OUT_FILE = Path(__file__).resolve().parent / "screen_flow_diagram.drawio"

# Built-in drawio-skill palette (from references/xml-authoring.md)
PALETTE = {
    "blue": ("#dae8fc", "#6c8ebf", "#1a365d"),      # primary screens / member
    "green": ("#d5e8d4", "#82b366", "#1b4332"),     # success / entry / public / check-in
    "yellow": ("#fff2cc", "#d6b656", "#5c4813"),    # decision / guard / billing
    "orange": ("#ffe6cc", "#d79b00", "#663c00"),    # staff / operations / shop
    "red": ("#f8cecc", "#b85450", "#58151c"),       # support / admin / escalation
    "purple": ("#e1d5e7", "#9673a6", "#3c1e54"),    # auth / coach / AI
    "grey": ("#f5f5f5", "#666666", "#333333"),      # shared utility / external
}

FONT = "fontFamily=Plus Jakarta Sans,Helvetica,Arial,sans-serif;"

STYLE_TITLE = (
    f"text;html=1;{FONT}fontSize=18;fontStyle=1;fillColor=none;strokeColor=none;"
    "align=left;verticalAlign=middle;fontColor=#1e293b;convertToSvg=1;"
)
STYLE_SUBTITLE = (
    f"text;html=1;{FONT}fontSize=12;fontStyle=2;fillColor=none;strokeColor=none;"
    "align=left;verticalAlign=middle;fontColor=#64748b;convertToSvg=1;"
)


def container_style(color_key: str) -> str:
    fill, stroke, font_color = PALETTE[color_key]
    return (
        f"swimlane;startSize=30;whiteSpace=wrap;html=1;pointerEvents=0;collapsible=0;"
        f"rounded=1;arcSize=6;fillColor={fill};strokeColor={stroke};fontColor={font_color};"
        f"{FONT}fontSize=13;fontStyle=1;swimlaneFillColor=#ffffff;convertToSvg=1;"
    )


def node_style(color_key: str, shape: str = "rounded=1;arcSize=12;", bold: bool = False) -> str:
    fill, stroke, font_color = PALETTE[color_key]
    fstyle = "fontStyle=1;" if bold else ""
    return (
        f"{shape}whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};"
        f"fontColor={font_color};{FONT}fontSize=12;{fstyle}convertToSvg=1;"
    )


def edge_style(color: str = "#475569", dashed: bool = False, extra: str = "") -> str:
    dash_str = "dashed=1;dashPattern=6 4;" if dashed else ""
    return (
        "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;"
        f"html=1;endArrow=block;endSize=8;strokeWidth=1.5;strokeColor={color};"
        f"fontColor=#1e293b;labelBackgroundColor=#ffffff;{FONT}fontSize=10;"
        f"convertToSvg=1;{dash_str}{extra}"
    )


def ports(exit_x: float, exit_y: float, entry_x: float, entry_y: float) -> str:
    return (
        f"exitX={exit_x:g};exitY={exit_y:g};exitDx=0;exitDy=0;"
        f"entryX={entry_x:g};entryY={entry_y:g};entryDx=0;entryDy=0;"
    )


class PageBuilder:
    def __init__(self, page_id: str, name: str, title: str, subtitle: str):
        self.page_id = page_id
        self.name = name
        self.diagram = ET.Element("diagram", {"id": page_id, "name": name})
        self.model = ET.SubElement(
            self.diagram,
            "mxGraphModel",
            {
                "dx": "1600",
                "dy": "1000",
                "grid": "1",
                "gridSize": "10",
                "guides": "1",
                "tooltips": "1",
                "connect": "1",
                "arrows": "1",
                "fold": "1",
                "page": "1",
                "pageScale": "1",
                "pageWidth": "1600",
                "pageHeight": "1000",
                "background": "#ffffff",
            },
        )
        self.root = ET.SubElement(self.model, "root")
        ET.SubElement(self.root, "mxCell", {"id": "0"})
        ET.SubElement(self.root, "mxCell", {"id": "1", "parent": "0"})

        self.add_vertex("hdr_title", title, STYLE_TITLE, 40, 20, 1000, 30)
        self.add_vertex("hdr_sub", subtitle, STYLE_SUBTITLE, 40, 50, 1200, 20)

    def add_vertex(
        self,
        cid: str,
        label: str,
        style: str,
        x: int,
        y: int,
        w: int,
        h: int,
        parent: str = "1",
        link_page_id: str | None = None,
    ):
        if link_page_id:
            uo = ET.SubElement(
                self.root,
                "UserObject",
                {
                    "id": cid,
                    "label": label,
                    "link": f"data:page/id,{link_page_id}",
                },
            )
            cell = ET.SubElement(
                uo,
                "mxCell",
                {"style": style, "vertex": "1", "parent": parent},
            )
        else:
            cell = ET.SubElement(
                self.root,
                "mxCell",
                {
                    "id": cid,
                    "value": label,
                    "style": style,
                    "vertex": "1",
                    "parent": parent,
                },
            )
        ET.SubElement(
            cell,
            "mxGeometry",
            {
                "x": str(x),
                "y": str(y),
                "width": str(w),
                "height": str(h),
                "as": "geometry",
            },
        )

    def add_edge(
        self,
        eid: str,
        source: str,
        target: str,
        label: str = "",
        color: str = "#475569",
        dashed: bool = False,
        extra_style: str = "",
        waypoints: list[tuple[int, int]] | None = None,
        offset: tuple[int, int] | None = None,
    ):
        cell = ET.SubElement(
            self.root,
            "mxCell",
            {
                "id": eid,
                "value": label,
                "style": edge_style(color=color, dashed=dashed, extra=extra_style),
                "edge": "1",
                "parent": "1",
                "source": source,
                "target": target,
            },
        )
        geom = ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
        if offset is not None:
            ET.SubElement(
                geom,
                "mxPoint",
                {"x": str(offset[0]), "y": str(offset[1]), "as": "offset"},
            )
        if waypoints:
            arr = ET.SubElement(geom, "Array", {"as": "points"})
            for wx, wy in waypoints:
                ET.SubElement(arr, "mxPoint", {"x": str(wx), "y": str(wy)})

    def add_legend(self, x: int, y: int, items: list[tuple[str, str]]):
        rows = len(items)
        h = 40 + 30 * rows
        self.add_vertex(
            "legend",
            "Chú giải (Legend)",
            f"swimlane;startSize=26;rounded=1;arcSize=8;whiteSpace=wrap;html=1;pointerEvents=0;collapsible=0;fillColor=#f8fafc;strokeColor=#94a3b8;fontColor=#1e293b;{FONT}fontSize=12;fontStyle=1;convertToSvg=1;",
            x,
            y,
            280,
            h,
        )
        for idx, (color_key, text) in enumerate(items):
            fill, stroke, _ = PALETTE[color_key]
            ry = 34 + idx * 30
            self.add_vertex(
                f"leg_sw_{idx}",
                "",
                f"rounded=1;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};convertToSvg=1;",
                14,
                ry,
                30,
                18,
                parent="legend",
            )
            self.add_vertex(
                f"leg_tx_{idx}",
                text,
                f"text;html=1;align=left;verticalAlign=middle;fillColor=none;strokeColor=none;{FONT}fontSize=11;fontColor=#334155;convertToSvg=1;",
                54,
                ry - 1,
                216,
                20,
                parent="legend",
            )


def build_page_1_overview() -> ET.Element:
    p = PageBuilder(
        "page-overview",
        "1. Tổng quan điều hướng",
        "SƠ ĐỒ LUỒNG MÀN HÌNH TỔNG QUAN (MASTER SCREEN FLOW)",
        "Kiến trúc điều hướng toàn hệ thống SCMS | Nhấp vào các khối Phân hệ (Tab 2–7) để chuyển nhanh sang trang chi tiết",
    )

    # Container 1: Public & Auth Entry (y=100..250)
    p.add_vertex("c_pub", "1. Khu vực Công khai & Xác thực (Public & Auth)", container_style("green"), 40, 100, 1480, 150)
    p.add_vertex(
        "ov_landing",
        "<b>Trang chủ Landing</b>&#xa;<code>/</code>&#xa;(Khám phá CLB &amp; Gói tập)",
        node_style("green", bold=True),
        40,
        50,
        240,
        70,
        parent="c_pub",
        link_page_id="page-public-auth",
    )
    p.add_vertex(
        "ov_catalog",
        "<b>Khám phá Bộ môn &amp; HLV</b>&#xa;<code>/sports/:id</code> | <code>/trainers/:id</code>",
        node_style("green"),
        360,
        50,
        250,
        70,
        parent="c_pub",
        link_page_id="page-public-auth",
    )
    p.add_vertex(
        "ov_shop_pub",
        "<b>Cửa hàng &amp; Checkout Khách</b>&#xa;<code>/products</code> → <code>/checkout</code>",
        node_style("orange"),
        690,
        50,
        250,
        70,
        parent="c_pub",
        link_page_id="page-public-auth",
    )
    p.add_vertex(
        "ov_register",
        "<b>Đăng ký &amp; Xác thực OTP</b>&#xa;<code>/register</code>",
        node_style("purple"),
        1020,
        50,
        200,
        70,
        parent="c_pub",
        link_page_id="page-public-auth",
    )
    p.add_vertex(
        "ov_login",
        "<b>Đăng nhập Hệ thống</b>&#xa;<code>/login</code>",
        node_style("purple", bold=True),
        1270,
        50,
        180,
        70,
        parent="c_pub",
        link_page_id="page-public-auth",
    )

    # Container 2: Protected AppLayout & Role Router (y=310..470)
    p.add_vertex("c_guard", "2. Lớp Bảo vệ & Khung Portal Chung (AppLayout + RoleGuard)", container_style("yellow"), 40, 310, 1480, 160)
    p.add_vertex(
        "ov_shared_profile",
        "<b>Hồ sơ &amp; Chỉ số Sức khỏe</b>&#xa;<code>/member/profile</code>&#xa;(Dùng chung 5 vai trò)",
        node_style("grey"),
        50,
        55,
        230,
        70,
        parent="c_guard",
    )
    p.add_vertex(
        "ov_shared_noti",
        "<b>Hộp thư Thông báo</b>&#xa;<code>/member/notifications</code>&#xa;(Member, Staff, Coach, Manager)",
        node_style("grey"),
        330,
        55,
        230,
        70,
        parent="c_guard",
    )
    # Abs x = 40 + 605 = 645..925, centerX = 785 (matches ov_role_coach centerX = 785)
    p.add_vertex(
        "ov_portal_home",
        "<b>Cổng Điều hướng Vai trò</b>&#xa;<code>/portal</code> (PortalHome)&#xa;Kiểm tra JWT &amp; <code>homePath(role)</code>",
        node_style("yellow", shape="rounded=1;arcSize=16;", bold=True),
        605,
        45,
        280,
        90,
        parent="c_guard",
    )
    p.add_vertex(
        "ov_shared_chat",
        "<b>Tin nhắn &amp; Trợ lý AI Chat</b>&#xa;<code>/messages</code> + <code>ChatWidget</code>&#xa;(Member, Staff, Coach)",
        node_style("grey"),
        970,
        55,
        250,
        70,
        parent="c_guard",
    )

    # Container 3: Role-Based Sub-Portals (y=550..740)
    p.add_vertex("c_roles", "3. Các Phân hệ Nghiệp vụ theo Vai trò (Nhấp để mở Tab chi tiết)", container_style("blue"), 40, 550, 1480, 190)
    p.add_vertex(
        "ov_role_member",
        "<b>PHÂN HỆ HỘI VIÊN (MEMBER)</b>&#xa;Mặc định: <code>/member/dashboard</code>&#xa;14 màn hình (Xem Tab 3 &amp; Tab 4)",
        node_style("blue", bold=True),
        40,
        60,
        250,
        90,
        parent="c_roles",
        link_page_id="page-member-core",
    )
    p.add_vertex(
        "ov_role_staff",
        "<b>PHÂN HỆ LỄ TÂN (STAFF)</b>&#xa;Mặc định: <code>/staff/reception</code>&#xa;7 màn hình (Xem Tab 5)",
        node_style("orange", bold=True),
        330,
        60,
        250,
        90,
        parent="c_roles",
        link_page_id="page-receptionist",
    )
    p.add_vertex(
        "ov_role_coach",
        "<b>PHÂN HỆ HLV (COACH)</b>&#xa;Mặc định: <code>/staff/attendance</code>&#xa;4 màn hình + AI (Xem Tab 6)",
        node_style("purple", bold=True),
        620,
        60,
        250,
        90,
        parent="c_roles",
        link_page_id="page-coach",
    )
    p.add_vertex(
        "ov_role_manager",
        "<b>QUẢN LÝ (CENTER MANAGER)</b>&#xa;Mặc định: <code>/manager/reports</code>&#xa;12 màn hình (Xem Tab 7)",
        node_style("yellow", bold=True),
        910,
        60,
        250,
        90,
        parent="c_roles",
        link_page_id="page-manager-admin",
    )
    p.add_vertex(
        "ov_role_admin",
        "<b>QUẢN TRỊ HỆ THỐNG (ADMIN)</b>&#xa;Mặc định: <code>/admin/users</code>&#xa;Quản lý RBAC (Xem Tab 7)",
        node_style("red", bold=True),
        1200,
        60,
        240,
        90,
        parent="c_roles",
        link_page_id="page-manager-admin",
    )

    # Edges with explicit ports & non-crossing corridor waypoints
    p.add_edge("e_ov_1", "ov_landing", "ov_catalog", "Xem môn tập", extra_style=ports(1, 0.5, 0, 0.5))
    p.add_edge("e_ov_2", "ov_catalog", "ov_shop_pub", "Cửa hàng", extra_style=ports(1, 0.5, 0, 0.5))
    p.add_edge("e_ov_3", "ov_shop_pub", "ov_register", "Tạo TK", extra_style=ports(1, 0.5, 0, 0.5))
    p.add_edge("e_ov_4", "ov_register", "ov_login", "Xong OTP", extra_style=ports(1, 0.5, 0, 0.5))
    p.add_edge(
        "e_ov_5",
        "ov_login",
        "ov_portal_home",
        "JWT hợp lệ",
        color="#6b21a8",
        extra_style=ports(0.5, 1, 0.5, 0),
        waypoints=[(1400, 280), (785, 280)],
    )
    p.add_edge("e_ov_shared1", "ov_portal_home", "ov_shared_noti", "Topbar", dashed=True, extra_style=ports(0, 0.5, 1, 0.5))
    p.add_edge("e_ov_shared2", "ov_shared_noti", "ov_shared_profile", "Sidebar", dashed=True, extra_style=ports(0, 0.5, 1, 0.5))
    p.add_edge("e_ov_shared3", "ov_portal_home", "ov_shared_chat", "Chat / AI", dashed=True, extra_style=ports(1, 0.5, 0, 0.5))

    # Nested river routing from ov_portal_home (abs x=645..925, bottom y=445) to 5 role cards (top y=610)
    p.add_edge(
        "e_ov_r1",
        "ov_portal_home",
        "ov_role_member",
        "MEMBER",
        color="#1d4ed8",
        extra_style=ports(0.15, 1, 0.5, 0),
        waypoints=[(687, 495), (205, 495)],
    )
    p.add_edge(
        "e_ov_r2",
        "ov_portal_home",
        "ov_role_staff",
        "STAFF",
        color="#b45309",
        extra_style=ports(0.325, 1, 0.5, 0),
        waypoints=[(736, 520), (495, 520)],
    )
    p.add_edge(
        "e_ov_r3",
        "ov_portal_home",
        "ov_role_coach",
        "COACH",
        color="#6b21a8",
        extra_style=ports(0.5, 1, 0.5, 0),
    )
    p.add_edge(
        "e_ov_r4",
        "ov_portal_home",
        "ov_role_manager",
        "MANAGER",
        color="#a16207",
        extra_style=ports(0.675, 1, 0.5, 0),
        waypoints=[(834, 520), (1075, 520)],
    )
    p.add_edge(
        "e_ov_r5",
        "ov_portal_home",
        "ov_role_admin",
        "ADMIN",
        color="#b91c1c",
        extra_style=ports(0.85, 1, 0.5, 0),
        waypoints=[(883, 495), (1360, 495)],
    )

    p.add_legend(
        40,
        760,
        [
            ("green", "Trang Công khai (Public)"),
            ("purple", "Xác thực / Huấn luyện viên"),
            ("yellow", "Điều hướng RoleGuard / Quản lý"),
            ("blue", "Phân hệ Hội viên (Member)"),
            ("orange", "Phân hệ Lễ tân & Cửa hàng"),
            ("red", "Quản trị Hệ thống (Admin)"),
            ("grey", "Tiện ích Dùng chung (Shared)"),
        ],
    )
    return p.diagram


def build_page_2_public_auth() -> ET.Element:
    p = PageBuilder(
        "page-public-auth",
        "2. Public, Cửa hàng & Xác thực",
        "LUỒNG MÀN HÌNH CÔNG KHAI, CỬA HÀNG & XÁC THỰC (PUBLIC & AUTH FLOW)",
        "Bao gồm khách vãng lai khám phá bộ môn, mua lẻ sản phẩm tại cửa hàng công khai và đăng ký/đăng nhập tài khoản",
    )

    # Container 1: Public Discovery (x=40..480, y=110..710)
    p.add_vertex("c_disc", "1. Khám phá Trung tâm & Bộ môn (Public Website)", container_style("green"), 40, 110, 440, 600)
    p.add_vertex(
        "pub_home",
        "<b>Trang chủ SÖL Fitness</b>&#xa;<code>/</code> (LandingPage)&#xa;Hero, Bộ môn, Gói tập, HLV",
        node_style("green", bold=True),
        80,
        60,
        280,
        85,
        parent="c_disc",
    )
    p.add_vertex(
        "pub_sports",
        "<b>Chi tiết Bộ môn Thể thao</b>&#xa;<code>/swimming</code>, <code>/tennis</code>, <code>/boxing</code>&#xa;<code>/badminton</code>, <code>/yoga</code>, <code>/sports/:sportId</code>",
        node_style("green"),
        80,
        235,
        280,
        90,
        parent="c_disc",
    )
    p.add_vertex(
        "pub_trainers",
        "<b>Hồ sơ &amp; Câu chuyện HLV</b>&#xa;<code>/trainers</code>&#xa;<code>/trainers/:trainerId</code>",
        node_style("green"),
        80,
        420,
        280,
        85,
        parent="c_disc",
    )

    # Container 2: Public Shop (x=540..980, y=110..710)
    p.add_vertex("c_shop", "2. Cửa hàng Công khai (Public Shop)", container_style("orange"), 540, 110, 440, 600)
    p.add_vertex(
        "pub_products",
        "<b>Danh mục Sản phẩm</b>&#xa;<code>/products</code> (ProductsPage)&#xa;Lọc danh mục, tìm kiếm, giỏ hàng",
        node_style("orange", bold=True),
        80,
        60,
        280,
        85,
        parent="c_shop",
    )
    p.add_vertex(
        "pub_product_detail",
        "<b>Chi tiết Sản phẩm</b>&#xa;<code>/products/:slug</code>&#xa;(ProductDetailPage)",
        node_style("orange"),
        80,
        240,
        280,
        85,
        parent="c_shop",
    )
    p.add_vertex(
        "pub_checkout",
        "<b>Thanh toán Đơn hàng</b>&#xa;<code>/checkout</code> (CheckoutPage)&#xa;Đặt hàng &amp; nhận tại quầy / giao hàng",
        node_style("orange"),
        80,
        420,
        280,
        85,
        parent="c_shop",
    )

    # Container 3: Auth & Onboarding (x=1040..1520, y=110..710)
    p.add_vertex("c_auth", "3. Đăng ký, OTP & Đăng nhập (Auth Flow)", container_style("purple"), 1040, 110, 480, 600)
    p.add_vertex(
        "auth_register",
        "<b>Đăng ký Tài khoản Hội viên</b>&#xa;<code>/register</code> (RegisterPage)&#xa;Nhập Họ tên, Email, SĐT, Mật khẩu",
        node_style("purple"),
        100,
        55,
        280,
        80,
        parent="c_auth",
    )
    p.add_vertex(
        "auth_otp",
        "<b>Xác thực Mã OTP Email</b>&#xa;<code>/register</code> (Bước Verify OTP)&#xa;Kích hoạt trạng thái <code>active</code>",
        node_style("purple"),
        100,
        185,
        280,
        80,
        parent="c_auth",
    )
    p.add_vertex(
        "auth_login",
        "<b>Đăng nhập Hệ thống</b>&#xa;<code>/login</code> (LoginPage)&#xa;Tài khoản/Mật khẩu hoặc Google OAuth",
        node_style("purple", bold=True),
        100,
        315,
        280,
        80,
        parent="c_auth",
    )
    p.add_vertex(
        "auth_portal",
        "<b>Cổng Điều hướng Portal</b>&#xa;<code>/portal</code> (PortalHome)&#xa;Chuyển tới Dashboard theo Role",
        node_style("yellow", bold=True),
        100,
        450,
        280,
        90,
        parent="c_auth",
        link_page_id="page-overview",
    )

    # Vertical edges in Container 1
    p.add_edge("e_p2_1", "pub_home", "pub_sports", "Chọn bộ môn", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_p2_2", "pub_sports", "pub_trainers", "Xem HLV bộ môn", extra_style=ports(0.5, 1, 0.5, 0))

    # Edges to/in Container 2
    p.add_edge("e_p2_3", "pub_home", "pub_products", "Mở Cửa hàng", extra_style=ports(1, 0.5, 0, 0.5))
    p.add_edge("e_p2_4", "pub_products", "pub_product_detail", "Chọn SP", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_p2_5", "pub_product_detail", "pub_checkout", "Thanh toán giỏ", extra_style=ports(0.5, 1, 0.5, 0))

    # Edges to/in Container 3
    p.add_edge(
        "e_p2_6",
        "pub_home",
        "auth_register",
        "Đăng ký ngay",
        color="#6b21a8",
        extra_style=ports(0.5, 0, 0.5, 0),
        waypoints=[(260, 85), (1280, 85)],
    )
    p.add_edge("e_p2_7", "auth_register", "auth_otp", "Gửi mã OTP", color="#6b21a8", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_p2_8", "auth_otp", "auth_login", "Xác thực đúng", color="#15803d", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge(
        "e_p2_9",
        "pub_trainers",
        "auth_login",
        "Đăng ký tập / Mua gói",
        color="#6b21a8",
        dashed=True,
        extra_style=ports(0.5, 1, 0, 0.75),
        waypoints=[(260, 735), (1010, 735), (1010, 485)],
    )
    p.add_edge(
        "e_p2_10",
        "pub_checkout",
        "auth_login",
        "Yêu cầu đăng nhập",
        color="#b45309",
        dashed=True,
        extra_style=ports(1, 0.5, 0, 0.25),
        waypoints=[(995, 572), (995, 445)],
    )
    p.add_edge("e_p2_11", "auth_login", "auth_portal", "JWT + Role", color="#15803d", extra_style=ports(0.5, 1, 0.5, 0))

    p.add_legend(
        40,
        755,
        [
            ("green", "Trang giới thiệu công khai"),
            ("orange", "Luồng cửa hàng & giỏ hàng"),
            ("purple", "Luồng xác thực & OTP"),
            ("yellow", "Cổng điều hướng vào Portal"),
        ],
    )
    return p.diagram


def build_page_3_member_core() -> ET.Element:
    p = PageBuilder(
        "page-member-core",
        "3. Hội viên - Mua gói & Tập luyện",
        "LUỒNG MÀN HÌNH HỘI VIÊN: MUA GÓI, ĐẶT LỊCH & TẬP LUYỆN (MEMBER CORE FLOW)",
        "Vai trò: MEMBER | Hành trình cốt lõi từ Bảng điều khiển → Mua gói VNPay → Đặt lớp/Sân → Quét QR Check-in → Tiến độ",
    )

    # Container 1: Member Entry & Discovery (x=40..420, y=110..730)
    p.add_vertex("c_m_hub", "1. Trung tâm Hội viên (Member Hub)", container_style("blue"), 40, 110, 380, 620)
    p.add_vertex(
        "m_dashboard",
        "<b>Bảng điều khiển Hội viên</b>&#xa;<code>/member/dashboard</code>&#xa;Tổng quan gói tập, lịch sắp tới, chuỗi tập",
        node_style("blue", bold=True),
        50,
        60,
        280,
        90,
        parent="c_m_hub",
    )
    p.add_vertex(
        "m_explore",
        "<b>Tham quan Không gian 3D</b>&#xa;<code>/member/explore</code>&#xa;Khám phá phòng tập &amp; khu vực bộ môn",
        node_style("blue"),
        50,
        240,
        280,
        85,
        parent="c_m_hub",
    )
    p.add_vertex(
        "m_more_services",
        "<b>Mua sắm, Hỗ trợ &amp; Cá nhân</b>&#xa;<code>/member/orders</code> | <code>/member/support</code>&#xa;(Nhấp để mở Tab 4)",
        node_style("grey", bold=True),
        50,
        430,
        280,
        90,
        parent="c_m_hub",
        link_page_id="page-member-services",
    )

    # Container 2: Subscription & Payment Flow (x=470..910, y=110..730)
    p.add_vertex("c_m_pkg", "2. Luồng Mua & Gia hạn Gói tập (Subscription & Billing)", container_style("yellow"), 470, 110, 440, 620)
    p.add_vertex(
        "m_packages",
        "<b>Danh mục Gói tập Hội viên</b>&#xa;<code>/member/packages</code>&#xa;Chọn gói mới, gia hạn hoặc nâng cấp",
        node_style("yellow", bold=True),
        80,
        60,
        280,
        85,
        parent="c_m_pkg",
    )
    p.add_vertex(
        "m_pkg_checkout",
        "<b>Thanh toán Gói tập</b>&#xa;<code>/member/packages/checkout</code>&#xa;Đối soát báo giá &amp; tạo giao dịch VNPay",
        node_style("yellow"),
        80,
        205,
        280,
        85,
        parent="c_m_pkg",
    )
    p.add_vertex(
        "m_vnpay_return",
        "<b>Kết quả Thanh toán VNPay</b>&#xa;<code>/member/payments/vnpay/return</code>&#xa;Xác nhận trạng thái &amp; kích hoạt gói",
        node_style("green"),
        80,
        350,
        280,
        85,
        parent="c_m_pkg",
    )
    p.add_vertex(
        "m_invoices",
        "<b>Giao dịch &amp; Hóa đơn Điện tử</b>&#xa;<code>/member/invoices</code>&#xa;Tra cứu lịch sử thanh toán &amp; tải PDF",
        node_style("yellow"),
        80,
        495,
        280,
        85,
        parent="c_m_pkg",
    )

    # Container 3: Booking, Check-in & Training Progress (x=960..1520, y=110..730)
    p.add_vertex("c_m_train", "3. Đặt lịch, Check-in & Theo dõi Tập luyện (Training & Access)", container_style("green"), 960, 110, 560, 620)
    p.add_vertex(
        "m_classes",
        "<b>Lịch học &amp; Đặt chỗ Lớp</b>&#xa;<code>/member/classes</code>&#xa;Đặt chỗ theo buổi/tuần/tháng, hủy lịch",
        node_style("blue", bold=True),
        40,
        60,
        220,
        85,
        parent="c_m_train",
    )
    p.add_vertex(
        "m_courts",
        "<b>Đặt sân Thể thao</b>&#xa;<code>/member/courts</code>&#xa;Giữ sân Tennis, Cầu lông, Bơi lội",
        node_style("blue"),
        300,
        60,
        220,
        85,
        parent="c_m_train",
    )
    p.add_vertex(
        "m_card",
        "<b>Thẻ Hội viên Điện tử</b>&#xa;<code>/member/card</code>&#xa;Hiển thị mã QR định danh &amp; hạn gói",
        node_style("green", bold=True),
        40,
        235,
        220,
        85,
        parent="c_m_train",
    )
    p.add_vertex(
        "m_checkin",
        "<b>Quét QR Cổng Check-in</b>&#xa;<code>/member/check-in</code>&#xa;Check-in vào cổng &amp; lịch sử ra vào",
        node_style("green", bold=True),
        300,
        235,
        220,
        85,
        parent="c_m_train",
    )
    p.add_vertex(
        "m_progress",
        "<b>Tiến độ &amp; Giáo án Tập luyện</b>&#xa;<code>/member/progress</code>&#xa;Bài tập HLV giao, BMI &amp; đánh giá buổi",
        node_style("purple", bold=True),
        40,
        420,
        220,
        85,
        parent="c_m_train",
    )
    p.add_vertex(
        "m_streak",
        "<b>Chuỗi Ngày tập (Streak)</b>&#xa;<code>/member/streak</code>&#xa;Thống kê duy trì thói quen tập luyện",
        node_style("purple"),
        300,
        420,
        220,
        85,
        parent="c_m_train",
    )

    # Edges with explicit ports
    p.add_edge("e_m3_1", "m_dashboard", "m_explore", "Khám phá 3D", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_m3_2", "m_explore", "m_more_services", "Tiện ích khác", dashed=True, extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_m3_3", "m_dashboard", "m_packages", "Mua / Gia hạn gói", color="#a16207", extra_style=ports(1, 0.5, 0, 0.5))
    p.add_edge("e_m3_4", "m_packages", "m_pkg_checkout", "Chọn gói tập", color="#a16207", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_m3_5", "m_pkg_checkout", "m_vnpay_return", "VNPay Callback", color="#15803d", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_m3_6", "m_vnpay_return", "m_invoices", "Xuất hóa đơn", color="#a16207", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge(
        "e_m3_7",
        "m_vnpay_return",
        "m_card",
        "Cấp QR Active",
        color="#15803d",
        extra_style=ports(1, 0.5, 0, 0.5),
        waypoints=[(935, 502), (935, 387)],
    )
    p.add_edge(
        "e_m3_8",
        "m_dashboard",
        "m_classes",
        "Đặt lịch học",
        color="#1d4ed8",
        extra_style=ports(0.5, 0, 0.5, 0),
        waypoints=[(230, 85), (1110, 85)],
    )
    p.add_edge("e_m3_9", "m_classes", "m_courts", "Đặt sân lẻ", color="#1d4ed8", extra_style=ports(1, 0.5, 0, 0.5))
    p.add_edge("e_m3_10", "m_classes", "m_card", "Lấy mã QR", color="#15803d", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_m3_11", "m_card", "m_checkin", "Quét tại cổng", color="#15803d", extra_style=ports(1, 0.5, 0, 0.5))
    p.add_edge("e_m3_12", "m_card", "m_progress", "Xem giáo án", color="#6b21a8", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_m3_13", "m_checkin", "m_streak", "Ghi nhận buổi tập", color="#6b21a8", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_m3_14", "m_progress", "m_streak", "Theo dõi chuỗi", color="#6b21a8", extra_style=ports(1, 0.5, 0, 0.5))

    p.add_legend(
        40,
        755,
        [
            ("blue", "Điều hướng & Đặt lịch Hội viên"),
            ("yellow", "Luồng Mua gói & Hóa đơn"),
            ("green", "Thẻ QR & Check-in Cổng"),
            ("purple", "Tiến độ, Giáo án & Streak"),
            ("grey", "Liên kết sang Tab 4 (Mua sắm/Hỗ trợ)"),
        ],
    )
    return p.diagram


def build_page_4_member_services() -> ET.Element:
    p = PageBuilder(
        "page-member-services",
        "4. Hội viên - Mua sắm & Hỗ trợ",
        "LUỒNG MÀN HÌNH HỘI VIÊN: MUA SẮM, HỖ TRỢ, CHAT AI & HỒ SƠ (MEMBER SERVICES)",
        "Vai trò: MEMBER | Quản lý đơn hàng sản phẩm, gửi yêu cầu hỗ trợ/khiếu nại, trò chuyện AI Chatbot và cập nhật sức khỏe",
    )

    # Container 1: Member Entry (x=40..400, y=110..670)
    p.add_vertex("c_ms_hub", "1. Điểm xuất phát (Member Hub)", container_style("blue"), 40, 110, 360, 560)
    p.add_vertex(
        "ms_dashboard",
        "<b>Bảng điều khiển Hội viên</b>&#xa;<code>/member/dashboard</code>&#xa;(Nhấp để quay lại Tab 3)",
        node_style("blue", bold=True),
        40,
        70,
        280,
        90,
        parent="c_ms_hub",
        link_page_id="page-member-core",
    )
    p.add_vertex(
        "ms_notifications",
        "<b>Hộp thư Thông báo</b>&#xa;<code>/member/notifications</code>&#xa;Nhắc lịch tập, trạng thái đơn &amp; gói tập",
        node_style("grey"),
        40,
        235,
        280,
        85,
        parent="c_ms_hub",
    )

    # Container 2: Shop & Orders (x=460..920, y=110..670)
    p.add_vertex("c_ms_shop", "2. Mua sắm Sản phẩm & Đơn hàng (Shop & Orders)", container_style("orange"), 460, 110, 460, 560)
    p.add_vertex(
        "ms_products",
        "<b>Cửa hàng Sản phẩm Nội khu</b>&#xa;<code>/member/products</code>&#xa;(Tab Cửa hàng trong MemberOrdersPage)",
        node_style("orange", bold=True),
        90,
        70,
        280,
        85,
        parent="c_ms_shop",
    )
    p.add_vertex(
        "ms_orders",
        "<b>Danh sách Đơn hàng Của tôi</b>&#xa;<code>/member/orders</code>&#xa;Theo dõi trạng thái thanh toán &amp; nhận hàng",
        node_style("orange", bold=True),
        90,
        235,
        280,
        85,
        parent="c_ms_shop",
    )
    p.add_vertex(
        "ms_order_detail",
        "<b>Chi tiết Đơn hàng</b>&#xa;<code>/member/orders/:orderId</code>&#xa;Danh sách mặt hàng, mã đơn &amp; hóa đơn",
        node_style("orange"),
        90,
        400,
        280,
        85,
        parent="c_ms_shop",
    )

    # Container 3: Support, AI Chat & Profile (x=980..1500, y=110..670)
    p.add_vertex("c_ms_sup", "3. Hỗ trợ, Trò chuyện AI & Hồ sơ (Support, AI & Profile)", container_style("purple"), 980, 110, 520, 560)
    p.add_vertex(
        "ms_support",
        "<b>Hỗ trợ &amp; Khiếu nại (Tickets)</b>&#xa;<code>/member/support</code>&#xa;Tạo phiếu hỗ trợ, phản hồi với Lễ tân/Quản lý",
        node_style("red", bold=True),
        120,
        70,
        280,
        85,
        parent="c_ms_sup",
    )
    p.add_vertex(
        "ms_messages",
        "<b>Tin nhắn &amp; Trợ lý AI Chatbot</b>&#xa;<code>/messages</code> + <code>ChatWidget</code>&#xa;Tư vấn dinh dưỡng/bài tập với AI hoặc nhắn HLV",
        node_style("purple", bold=True),
        120,
        235,
        280,
        85,
        parent="c_ms_sup",
    )
    p.add_vertex(
        "ms_profile",
        "<b>Hồ sơ Cá nhân &amp; Chỉ số Sức khỏe</b>&#xa;<code>/member/profile</code> (hoặc <code>/profile</code>)&#xa;Cập nhật chiều cao, cân nặng, mục tiêu, chấn thương",
        node_style("green", bold=True),
        120,
        400,
        280,
        85,
        parent="c_ms_sup",
    )

    # Edges
    p.add_edge("e_ms_1", "ms_dashboard", "ms_notifications", "Chuông thông báo", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_ms_2", "ms_dashboard", "ms_products", "Mua phụ kiện/dinh dưỡng", color="#b45309", extra_style=ports(1, 0.5, 0, 0.5))
    p.add_edge("e_ms_3", "ms_products", "ms_orders", "Đặt mua thành công", color="#b45309", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_ms_4", "ms_orders", "ms_order_detail", "Xem chi tiết đơn", color="#b45309", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge(
        "e_ms_5",
        "ms_dashboard",
        "ms_support",
        "Gửi yêu cầu hỗ trợ",
        color="#b91c1c",
        extra_style=ports(0.5, 0, 0.5, 0),
        waypoints=[(220, 85), (1240, 85)],
    )
    p.add_edge("e_ms_6", "ms_support", "ms_messages", "Trao đổi trực tiếp", color="#6b21a8", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_ms_7", "ms_messages", "ms_profile", "Cập nhật hồ sơ thể chất", color="#15803d", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_ms_8", "ms_notifications", "ms_orders", "Thông báo đơn hàng", dashed=True, extra_style=ports(1, 0.5, 0, 0.5))

    p.add_legend(
        40,
        700,
        [
            ("blue", "Bảng điều khiển Hội viên"),
            ("orange", "Cửa hàng & Quản lý Đơn hàng"),
            ("red", "Hỗ trợ & Khiếu nại (Support Tickets)"),
            ("purple", "Tin nhắn & Trợ lý AI Chatbot"),
            ("green", "Hồ sơ Cá nhân & Sức khỏe"),
        ],
    )
    return p.diagram


def build_page_5_receptionist() -> ET.Element:
    p = PageBuilder(
        "page-receptionist",
        "5. Lễ tân (Receptionist)",
        "LUỒNG MÀN HÌNH NHÂN VIÊN LỄ TÂN (RECEPTIONIST / STAFF SCREEN FLOW)",
        "Vai trò: STAFF (RECEPTIONIST) | Mặc định sau đăng nhập: /staff/reception | Nghiệp vụ quầy POS, Check-in, Lịch & Hỗ trợ",
    )

    # Container 1: Front Desk & Gate (x=40..480, y=110..670)
    p.add_vertex("c_st_desk", "1. Quầy Lễ tân & Kiểm soát Cổng (Front Desk & Gate)", container_style("orange"), 40, 110, 440, 560)
    p.add_vertex(
        "st_reception",
        "<b>Quầy Lễ tân &amp; Thu ngân POS</b>&#xa;<code>/staff/reception</code> (Màn hình mặc định)&#xa;Tra cứu HV (SĐT/CCCD/Mã), bán gói, thu tiền, in HĐ",
        node_style("orange", bold=True),
        70,
        70,
        300,
        90,
        parent="c_st_desk",
    )
    p.add_vertex(
        "st_checkin",
        "<b>Cổng Quét QR Check-in Sảnh</b>&#xa;<code>/staff/check-in</code>&#xa;Quét camera QR hoặc nhập mã kiểm tra hạn gói",
        node_style("green", bold=True),
        70,
        245,
        300,
        90,
        parent="c_st_desk",
    )
    p.add_vertex(
        "st_profile",
        "<b>Hồ sơ Cá nhân &amp; Ca trực</b>&#xa;<code>/member/profile</code>&#xa;Cập nhật thông tin cá nhân &amp; ca làm việc (Shift)",
        node_style("grey"),
        70,
        420,
        300,
        85,
        parent="c_st_desk",
    )

    # Container 2: Scheduling & Orders (x=540..980, y=110..670)
    p.add_vertex("c_st_ops", "2. Điều phối Lịch học, Sân & Đơn hàng (Operations)", container_style("blue"), 540, 110, 440, 560)
    p.add_vertex(
        "st_classes",
        "<b>Quản lý Lớp học &amp; Xếp lịch</b>&#xa;<code>/staff/classes</code>&#xa;Xem thời khóa biểu, hỗ trợ đặt/hủy lớp tại quầy",
        node_style("blue", bold=True),
        70,
        70,
        300,
        90,
        parent="c_st_ops",
    )
    p.add_vertex(
        "st_courts",
        "<b>Quản lý Lượt đặt sân</b>&#xa;<code>/staff/courts</code>&#xa;Theo dõi và xác nhận lịch đặt sân thể thao",
        node_style("blue"),
        70,
        245,
        300,
        90,
        parent="c_st_ops",
    )
    p.add_vertex(
        "st_orders",
        "<b>Quản lý Đơn hàng Sản phẩm</b>&#xa;<code>/staff/orders</code>&#xa;Xác nhận thanh toán &amp; bàn giao sản phẩm tại quầy",
        node_style("orange", bold=True),
        70,
        420,
        300,
        85,
        parent="c_st_ops",
    )

    # Container 3: Support & Internal Requests (x=1040..1500, y=110..670)
    p.add_vertex("c_st_sup", "3. Chăm sóc Khách hàng & Nội bộ (Support & HR)", container_style("purple"), 1040, 110, 460, 560)
    p.add_vertex(
        "st_support",
        "<b>Hộp thư Hỗ trợ Hội viên</b>&#xa;<code>/staff/support</code>&#xa;Xử lý ticket hỗ trợ hoặc chuyển cấp lên Quản lý",
        node_style("red", bold=True),
        80,
        70,
        300,
        90,
        parent="c_st_sup",
    )
    p.add_vertex(
        "st_requests",
        "<b>Đơn từ Nội bộ Nhân sự</b>&#xa;<code>/staff/requests</code>&#xa;Gửi đơn xin nghỉ phép / đổi ca trực cho Quản lý",
        node_style("purple", bold=True),
        80,
        245,
        300,
        90,
        parent="c_st_sup",
    )
    p.add_vertex(
        "st_messages",
        "<b>Tin nhắn &amp; Thông báo</b>&#xa;<code>/messages</code> | <code>/member/notifications</code>&#xa;Liên lạc trực tiếp với Hội viên &amp; HLV",
        node_style("grey"),
        80,
        420,
        300,
        85,
        parent="c_st_sup",
    )

    # Edges
    p.add_edge("e_st_1", "st_reception", "st_checkin", "Xong đăng ký → Quét cổng", color="#15803d", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_st_2", "st_checkin", "st_profile", "Ca trực lễ tân", dashed=True, extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_st_3", "st_reception", "st_classes", "Đặt lịch lớp tại quầy", color="#1d4ed8", extra_style=ports(1, 0.5, 0, 0.5))
    p.add_edge("e_st_4", "st_classes", "st_courts", "Kiểm tra lịch sân", color="#1d4ed8", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_st_5", "st_courts", "st_orders", "Giao hàng tại quầy", color="#b45309", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge(
        "e_st_6",
        "st_reception",
        "st_support",
        "Tiếp nhận khiếu nại",
        color="#b91c1c",
        extra_style=ports(0.5, 0, 0.5, 0),
        waypoints=[(260, 85), (1270, 85)],
    )
    p.add_edge("e_st_7", "st_support", "st_requests", "Đơn nội bộ / Đổi ca", color="#6b21a8", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_st_8", "st_requests", "st_messages", "Nhắn tin & Thông báo", dashed=True, extra_style=ports(0.5, 1, 0.5, 0))

    p.add_legend(
        40,
        700,
        [
            ("orange", "Quầy POS Lễ tân & Đơn hàng"),
            ("green", "Cổng Quét QR Check-in"),
            ("blue", "Điều phối Lớp học & Đặt sân"),
            ("red", "Xử lý Ticket Hỗ trợ & Khiếu nại"),
            ("purple", "Đơn từ Nội bộ (Nghỉ phép/Đổi ca)"),
        ],
    )
    return p.diagram


def build_page_6_coach() -> ET.Element:
    p = PageBuilder(
        "page-coach",
        "6. Huấn luyện viên (Coach)",
        "LUỒNG MÀN HÌNH HUẤN LUYỆN VIÊN & AI COACHING (COACH SCREEN FLOW)",
        "Vai trò: COACH | Mặc định sau đăng nhập: /staff/attendance | Quản lý lịch dạy, điểm danh và soạn giáo án với AI",
    )

    # Container 1: Teaching & Attendance (x=40..480, y=110..650)
    p.add_vertex("c_co_teach", "1. Lịch giảng dạy & Điểm danh (Schedule & Attendance)", container_style("blue"), 40, 110, 440, 540)
    p.add_vertex(
        "co_attendance",
        "<b>Điểm danh Học viên Buổi tập</b>&#xa;<code>/staff/attendance</code> (Màn hình mặc định)&#xa;Chọn buổi học, điểm danh Present/Absent/Late &amp; ghi chú",
        node_style("green", bold=True),
        70,
        70,
        300,
        95,
        parent="c_co_teach",
    )
    p.add_vertex(
        "co_classes",
        "<b>Lịch dạy &amp; Danh sách Học viên</b>&#xa;<code>/coach/classes</code> (hoặc <code>/staff/coach-classes</code>)&#xa;Thời khóa biểu tuần của HLV &amp; hồ sơ học viên lớp",
        node_style("blue", bold=True),
        70,
        260,
        300,
        95,
        parent="c_co_teach",
    )

    # Container 2: AI Training Plans (x=540..1000, y=110..650)
    p.add_vertex("c_co_ai", "2. Soạn Giáo án & Trợ lý AI Coaching (AI Training Plans)", container_style("purple"), 540, 110, 460, 540)
    p.add_vertex(
        "co_plans",
        "<b>Soạn Giáo án &amp; AI Gợi ý</b>&#xa;<code>/coach/training-plans</code>&#xa;Chọn học viên, nhập mục tiêu &amp; gọi AI sinh giáo án",
        node_style("purple", bold=True),
        80,
        70,
        300,
        90,
        parent="c_co_ai",
    )
    p.add_vertex(
        "co_health",
        "<b>Phân tích Chỉ số Thể chất Học viên</b>&#xa;<code>CoachHealthMetrics</code>&#xa;Xem BMI, tiền sử chấn thương &amp; lịch sử tập luyện",
        node_style("yellow"),
        80,
        230,
        300,
        85,
        parent="c_co_ai",
    )
    p.add_vertex(
        "co_saved_plans",
        "<b>Duyệt &amp; Giao Giáo án Tập luyện</b>&#xa;<code>TrainingPlanResults</code> / <code>SavedTrainingPlans</code>&#xa;Chỉnh sửa bài tập (sets/reps) &amp; xuất bản cho Hội viên",
        node_style("green", bold=True),
        80,
        385,
        300,
        90,
        parent="c_co_ai",
    )

    # Container 3: Internal Requests & Comm (x=1060..1500, y=110..650)
    p.add_vertex("c_co_comm", "3. Đơn từ Nội bộ & Liên lạc Học viên (Internal & Chat)", container_style("orange"), 1060, 110, 440, 540)
    p.add_vertex(
        "co_requests",
        "<b>Đơn từ Nội bộ (Xin nghỉ / Đổi lịch dạy)</b>&#xa;<code>/staff/requests</code>&#xa;Gửi yêu cầu thay đổi buổi dạy hoặc HLV dạy thay",
        node_style("orange", bold=True),
        70,
        70,
        300,
        90,
        parent="c_co_comm",
    )
    p.add_vertex(
        "co_messages",
        "<b>Tin nhắn Trao đổi Học viên</b>&#xa;<code>/messages</code> + <code>ChatWidget</code>&#xa;Hướng dẫn kỹ thuật &amp; giải đáp bài tập về nhà",
        node_style("blue"),
        70,
        230,
        300,
        85,
        parent="c_co_comm",
    )
    p.add_vertex(
        "co_profile",
        "<b>Thông báo &amp; Hồ sơ Chuyên môn HLV</b>&#xa;<code>/member/notifications</code> | <code>/member/profile</code>&#xa;Cập nhật chứng chỉ (Certification), chuyên môn &amp; Bio",
        node_style("grey"),
        70,
        385,
        300,
        90,
        parent="c_co_comm",
    )

    # Edges
    p.add_edge("e_co_1", "co_attendance", "co_classes", "Xem lịch dạy tuần", color="#1d4ed8", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge(
        "e_co_2",
        "co_classes",
        "co_plans",
        "Chọn HV lập giáo án",
        color="#6b21a8",
        extra_style=ports(1, 0.5, 0, 0.5),
        waypoints=[(510, 417), (510, 225)],
    )
    p.add_edge("e_co_3", "co_plans", "co_health", "Đọc hồ sơ sức khỏe", color="#a16207", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_co_4", "co_health", "co_saved_plans", "AI gợi ý & HLV duyệt", color="#15803d", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_co_5", "co_plans", "co_requests", "Xin đổi ca / nghỉ dạy", color="#b45309", extra_style=ports(1, 0.5, 0, 0.5))
    p.add_edge("e_co_6", "co_requests", "co_messages", "Nhắn tin học viên", color="#1d4ed8", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_co_7", "co_messages", "co_profile", "Hồ sơ & Thông báo", dashed=True, extra_style=ports(0.5, 1, 0.5, 0))

    p.add_legend(
        40,
        690,
        [
            ("green", "Điểm danh & Xuất bản Giáo án"),
            ("blue", "Lịch giảng dạy & Tin nhắn Học viên"),
            ("purple", "Trợ lý AI Gợi ý Giáo án (AI Coaching)"),
            ("yellow", "Chỉ số Thể chất & Chấn thương"),
            ("orange", "Đơn từ Nội bộ HLV"),
        ],
    )
    return p.diagram


def build_page_7_manager_admin() -> ET.Element:
    p = PageBuilder(
        "page-manager-admin",
        "7. Quản lý (Manager) & Admin",
        "LUỒNG MÀN HÌNH QUẢN LÝ TRUNG TÂM & QUẢN TRỊ HỆ THỐNG (MANAGER & ADMIN FLOW)",
        "Vai trò: MANAGER (mặc định /manager/reports) & ADMIN (mặc định /admin/users) | Quản trị toàn diện trung tâm",
    )

    # Container 1: Analytics & Governance (x=40..400, y=110..730)
    p.add_vertex("c_mg_rep", "1. Báo cáo & Giám sát (Analytics & Audit)", container_style("yellow"), 40, 110, 360, 620)
    p.add_vertex(
        "mg_reports",
        "<b>Báo cáo &amp; Doanh thu Trung tâm</b>&#xa;<code>/manager/reports</code> (Mặc định MANAGER)&#xa;Doanh thu, tỷ lệ lấp đầy &amp; thống kê hủy lịch",
        node_style("yellow", bold=True),
        40,
        55,
        280,
        85,
        parent="c_mg_rep",
    )
    p.add_vertex(
        "mg_audit",
        "<b>Nhật ký Kiểm toán &amp; Lấp đầy</b>&#xa;<code>/manager/audit-logs</code>&#xa;Giám sát toàn bộ biến động dữ liệu nhạy cảm",
        node_style("yellow"),
        40,
        225,
        280,
        85,
        parent="c_mg_rep",
    )
    p.add_vertex(
        "mg_support",
        "<b>Khiếu nại Chuyển cấp (Escalated)</b>&#xa;<code>/manager/support</code>&#xa;Xử lý các khiếu nại phức tạp từ Lễ tân chuyển lên",
        node_style("red", bold=True),
        40,
        395,
        280,
        85,
        parent="c_mg_rep",
    )

    # Container 2: Catalogs, Shop & Facilities (x=440..860, y=110..730)
    p.add_vertex("c_mg_cat", "2. Danh mục, Sản phẩm & Thiết bị (Catalogs & Shop)", container_style("orange"), 440, 110, 420, 620)
    p.add_vertex(
        "mg_catalogs",
        "<b>Danh mục Vận hành Trung tâm</b>&#xa;<code>/manager/catalogs</code>&#xa;CRUD Bộ môn (Disciplines), Phòng tập &amp; Gói tập",
        node_style("orange", bold=True),
        70,
        55,
        280,
        80,
        parent="c_mg_cat",
    )
    p.add_vertex(
        "mg_products",
        "<b>Quản lý Danh mục Sản phẩm</b>&#xa;<code>/manager/products</code>&#xa;Tồn kho, giá bán &amp; trạng thái hiển thị",
        node_style("orange", bold=True),
        70,
        180,
        280,
        80,
        parent="c_mg_cat",
    )
    p.add_vertex(
        "mg_product_edit",
        "<b>Thêm mới / Chỉnh sửa Sản phẩm</b>&#xa;<code>/manager/products/new</code>&#xa;<code>/manager/products/:productId</code>",
        node_style("orange"),
        70,
        305,
        280,
        80,
        parent="c_mg_cat",
    )
    p.add_vertex(
        "mg_equipment",
        "<b>Quản lý Máy móc &amp; Thiết bị</b>&#xa;<code>/manager/equipment</code>&#xa;Theo dõi tình trạng bảo trì thiết bị phòng tập",
        node_style("green"),
        70,
        430,
        280,
        75,
        parent="c_mg_cat",
    )
    p.add_vertex(
        "mg_classes_orders",
        "<b>Quản lý Lớp học &amp; Đơn hàng</b>&#xa;<code>/staff/classes</code> | <code>/staff/orders</code>",
        node_style("blue"),
        70,
        540,
        280,
        65,
        parent="c_mg_cat",
    )

    # Container 3: HR, Coaches & Internal Requests (x=900..1260, y=110..730)
    p.add_vertex("c_mg_hr", "3. Quản trị Nhân sự & Huấn luyện viên (HR & Coaches)", container_style("purple"), 900, 110, 360, 620)
    p.add_vertex(
        "mg_staff_acc",
        "<b>Tài khoản Nhân sự Trung tâm</b>&#xa;<code>/manager/staff-accounts</code>&#xa;Quản lý hồ sơ Lễ tân (Ca trực) &amp; HLV",
        node_style("purple", bold=True),
        40,
        55,
        280,
        85,
        parent="c_mg_hr",
    )
    p.add_vertex(
        "mg_coach_assign",
        "<b>Theo dõi HLV &amp; Học viên</b>&#xa;<code>/manager/coach-assignments</code>&#xa;Phân công HLV phụ trách lớp &amp; hội viên",
        node_style("purple"),
        40,
        195,
        280,
        85,
        parent="c_mg_hr",
    )
    p.add_vertex(
        "mg_coach_reviews",
        "<b>Xếp hạng &amp; Đánh giá HLV</b>&#xa;<code>/manager/coach-reviews</code>&#xa;Tổng hợp điểm đánh giá sau buổi tập của HV",
        node_style("purple"),
        40,
        335,
        280,
        85,
        parent="c_mg_hr",
    )
    p.add_vertex(
        "mg_requests",
        "<b>Duyệt Đơn từ Nội bộ</b>&#xa;<code>/manager/requests</code>&#xa;Phê duyệt/Từ chối đơn xin nghỉ &amp; đổi lịch dạy",
        node_style("green", bold=True),
        40,
        475,
        280,
        85,
        parent="c_mg_hr",
    )

    # Container 4: System Admin (x=1300..1560, y=110..730)
    p.add_vertex("c_admin", "4. Quản trị Hệ thống (Role: ADMIN)", container_style("red"), 1300, 110, 260, 620)
    p.add_vertex(
        "ad_users",
        "<b>Tài khoản &amp; Phân quyền RBAC</b>&#xa;<code>/admin/users</code>&#xa;(Mặc định ADMIN)&#xa;Khóa/Mở khóa TK, gán Role",
        node_style("red", bold=True),
        20,
        55,
        220,
        110,
        parent="c_admin",
    )
    p.add_vertex(
        "ad_profile",
        "<b>Hồ sơ Quản trị viên</b>&#xa;<code>/member/profile</code>&#xa;Thông tin tài khoản &amp; bảo mật",
        node_style("grey"),
        20,
        245,
        220,
        85,
        parent="c_admin",
    )

    # Edges
    p.add_edge("e_mg_1", "mg_reports", "mg_audit", "Tra cứu log", color="#a16207", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_mg_2", "mg_audit", "mg_support", "Kiểm tra khiếu nại", color="#b91c1c", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_mg_3", "mg_reports", "mg_catalogs", "Cấu hình danh mục", color="#b45309", extra_style=ports(1, 0.5, 0, 0.5))
    p.add_edge("e_mg_4", "mg_catalogs", "mg_products", "Quản lý cửa hàng", color="#b45309", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_mg_5", "mg_products", "mg_product_edit", "Thêm / Sửa SP", color="#b45309", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_mg_6", "mg_product_edit", "mg_equipment", "Quản lý thiết bị", color="#15803d", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_mg_7", "mg_equipment", "mg_classes_orders", "Lịch lớp & Đơn hàng", color="#1d4ed8", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge(
        "e_mg_8",
        "mg_reports",
        "mg_staff_acc",
        "Quản lý nhân sự",
        color="#6b21a8",
        extra_style=ports(0.5, 0, 0.5, 0),
        waypoints=[(220, 85), (1080, 85)],
    )
    p.add_edge("e_mg_9", "mg_staff_acc", "mg_coach_assign", "Phân công HLV", color="#6b21a8", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_mg_10", "mg_coach_assign", "mg_coach_reviews", "Xem đánh giá HLV", color="#6b21a8", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_mg_11", "mg_coach_reviews", "mg_requests", "Duyệt đơn nghỉ/đổi ca", color="#15803d", extra_style=ports(0.5, 1, 0.5, 0))
    p.add_edge("e_ad_1", "ad_users", "ad_profile", "Hồ sơ cá nhân", dashed=True, extra_style=ports(0.5, 1, 0.5, 0))

    p.add_legend(
        40,
        755,
        [
            ("yellow", "Báo cáo Doanh thu & Kiểm toán"),
            ("orange", "Danh mục Vận hành & Sản phẩm"),
            ("purple", "Quản trị Nhân sự & Huấn luyện viên"),
            ("green", "Thiết bị & Phê duyệt Đơn nội bộ"),
            ("red", "Quản trị RBAC (Admin) & Khiếu nại"),
        ],
    )
    return p.diagram


def main():
    mxfile = ET.Element(
        "mxfile",
        {
            "host": "drawio",
            "version": "26.0.0",
            "type": "device",
        },
    )

    pages = [
        build_page_1_overview(),
        build_page_2_public_auth(),
        build_page_3_member_core(),
        build_page_4_member_services(),
        build_page_5_receptionist(),
        build_page_6_coach(),
        build_page_7_manager_admin(),
    ]
    for page in pages:
        mxfile.append(page)

    ET.indent(mxfile, space="  ")
    xml_bytes = ET.tostring(mxfile, encoding="utf-8", xml_declaration=True)
    OUT_FILE.write_bytes(xml_bytes)
    print(f"Wrote {OUT_FILE} with {len(pages)} pages.")


if __name__ == "__main__":
    main()
