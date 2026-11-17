import XCTest
@testable import SOL

final class AdminTests: XCTestCase {
    func testProductUpsertSendsInitialStockOnlyForNewVariants() throws {
        let json = #"{"id":1,"name":"Whey","categoryId":2,"form":"powder","active":true,"featured":false,"variants":[{"id":5,"sku":"A","label":"L","price":100,"stock":9,"active":true,"sortOrder":0},{"sku":"B","label":"M","price":200,"stock":3,"active":true,"sortOrder":1}]}"#
        let p = try JSONDecoder().decode(AdminProduct.self, from: Data(json.utf8))
        let body = p.upsert()
        XCTAssertNil(body.variants[0].initialStock)
        XCTAssertEqual(body.variants[1].initialStock, 3)
        XCTAssertEqual(body.form, "powder")
    }

    func testCartMergesVariantsAndCapsQuantity() async {
        await MainActor.run {
            let cart = CartStore.shared
            cart.clear()
            let line = CartLine(variantId: 1, productName: "P", variantLabel: "L", unitPrice: 10, imageUrl: nil, quantity: 15)
            cart.add(line); cart.add(line)
            XCTAssertEqual(cart.lines.count, 1)
            XCTAssertEqual(cart.lines[0].quantity, 20)
            cart.setQuantity(1, 0)
            XCTAssertTrue(cart.lines.isEmpty)
        }
    }

    func testVnpayUrlAllowlist() {
        XCTAssertNotNil(VnpayURL.validated("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?x=1"))
        XCTAssertNil(VnpayURL.validated("https://evil.example/paymentv2/vpcpay.html"))
        XCTAssertNil(VnpayURL.validated("http://sandbox.vnpayment.vn/x"))
    }
}
