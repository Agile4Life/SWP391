#if DEBUG
import Foundation

/// Chế độ demo chỉ có ở bản Debug: `SOL_DEMO_ROLE=member|staff|coach|manager` bỏ qua đăng nhập và trả dữ liệu mẫu,
/// dùng để kiểm tra giao diện khi không có tài khoản test. Không tồn tại trong bản Release.
enum Demo {
    static let role: Role? = {
        switch ProcessInfo.processInfo.environment["SOL_DEMO_ROLE"] {
        case "member": .member; case "staff": .staff; case "coach": .coach; case "manager": .manager; default: nil
        }
    }()

    static let initialTab: Int = Int(ProcessInfo.processInfo.environment["SOL_DEMO_TAB"] ?? "") ?? 0

    private static func day(_ offset: Int) -> String { Fmt.dayString(Calendar.current.date(byAdding: .day, value: offset, to: Date())!) }

    static func response(_ method: String, _ path: String) -> Data? {
        guard role != nil else { return nil }
        let body: String
        switch path {
        case "/memberships/subscriptions/my":
            body = #"{"id":7,"memberId":3,"packageId":2,"packageName":"Gold 3 tháng","startDate":"\#(day(-30))","endDate":"\#(day(60))","status":"active","qrCode":"SOL-DEMO","createdAt":"\#(day(-30))T09:00:00"}"#
        case "/memberships/subscriptions/history":
            body = #"[{"id":7,"memberId":3,"packageId":2,"packageName":"Gold 3 tháng","startDate":"\#(day(-30))","endDate":"\#(day(60))","status":"active"}]"#
        case "/memberships/subscriptions/my/dynamic-qr": body = #"{"qrCode":"SOL-DEMO-\#(Int(Date().timeIntervalSince1970))","expiresInSeconds":30,"generatedAt":"\#(day(0))T09:00:00"}"#
        case "/classes/enrollments/my", "/classes/my-enrollments":
            body = #"[{"id":1,"classId":4,"className":"Yoga buổi sáng","coachName":"Lan Phạm","roomName":"Phòng Yoga","sessionDate":"\#(day(1))","startTime":"07:00:00","endTime":"08:00:00","status":"booked","totalSessions":12,"attendedSessions":4,"remainingSessions":8},{"id":2,"classId":5,"className":"Boxing cơ bản","coachName":"Minh Trần","roomName":"Phòng Boxing","sessionDate":"\#(day(3))","startTime":"18:30:00","endTime":"19:30:00","status":"booked"}]"#
        case "/classes":
            body = #"[{"id":4,"name":"Yoga buổi sáng","disciplineName":"Yoga","coachName":"Lan Phạm","roomName":"Phòng Yoga","capacity":20,"level":"beginner","description":"Khoá yoga cơ bản giúp dẻo dai và thư giãn.","status":"active","price":900000,"startDate":"\#(day(-10))","endDate":"\#(day(40))","recurringDays":"T2, T4, T6","startTime":"07:00:00","endTime":"08:00:00"},{"id":5,"name":"Boxing cơ bản","disciplineName":"Boxing","coachName":"Minh Trần","roomName":"Phòng Boxing","capacity":15,"level":"intermediate","status":"active","price":1200000,"startDate":"\#(day(0))","endDate":"\#(day(45))","recurringDays":"T3, T5","startTime":"18:30:00","endTime":"19:30:00"}]"#
        case "/classes/my-quota": body = #"{"tier":"gold","totalCredits":3,"usedCredits":1,"remainingCredits":2,"unlimited":false,"discountPercent":10}"#
        case "/classes/sessions":
            body = #"[{"id":11,"classId":4,"className":"Yoga buổi sáng","coachName":"Lan Phạm","roomName":"Phòng Yoga","sessionDate":"\#(day(0))","startTime":"07:00:00","endTime":"08:00:00","status":"scheduled","capacity":20,"bookedCount":12},{"id":12,"classId":5,"className":"Boxing cơ bản","coachName":"Minh Trần","roomName":"Phòng Boxing","sessionDate":"\#(day(0))","startTime":"18:30:00","endTime":"19:30:00","status":"scheduled","capacity":15,"bookedCount":9},{"id":13,"classId":4,"className":"Yoga buổi sáng","coachName":"Lan Phạm","roomName":"Phòng Yoga","sessionDate":"\#(day(2))","startTime":"07:00:00","endTime":"08:00:00","status":"scheduled","capacity":20,"bookedCount":12}]"#
        case "/profile": body = #"{"userId":3,"fullName":"Nguyễn Minh Anh","email":"minhanh@example.com","phone":"0912345678","membershipCode":"MB-0003","fitnessGoal":"Tăng cơ","address":null,"avatarUrl":null}"#
        case "/packages": body = #"[{"id":1,"name":"Silver 1 tháng","description":"Tập tự do mọi khung giờ","price":450000,"durationDays":30,"classCreditLimit":1,"status":"active"},{"id":2,"name":"Gold 3 tháng","description":"Ưu tiên đặt lớp, giảm 10% khoá học","price":1200000,"durationDays":90,"classCreditLimit":3,"status":"active"}]"#
        case "/check-in/history": body = #"[{"id":1,"checkInTime":"\#(day(-1))T18:02:11","checkOutTime":"\#(day(-1))T19:40:00","status":"GRANTED","method":"qr"},{"id":2,"checkInTime":"\#(day(-3))T06:30:00","status":"DENIED","denialReason":"Gói tập đã hết hạn"}]"#
        case "/check-in/streak": body = #"{"currentStreak":5,"longestStreak":12,"workoutDays":41,"activeDates":[]}"#
        case "/payments/my": body = #"[{"id":9,"amount":1200000,"method":"online_wallet","status":"success","paidAt":"\#(day(-30))T09:05:00","invoiceNumber":"INV-0009","serviceName":"Gold 3 tháng"}]"#
        case "/wallet/my": body = #"{"balance":350000,"transactions":[{"id":1,"type":"TOPUP_VNPAY","amount":500000,"balanceAfter":500000,"description":"Nạp tiền VNPay","createdAt":"\#(day(-5))T10:00:00"},{"id":2,"type":"PAYMENT_DEBIT","amount":-150000,"balanceAfter":350000,"description":"Thanh toán khoá học","createdAt":"\#(day(-2))T11:00:00"}]}"#
        case "/health/metrics/my": body = #"[{"id":1,"metricName":"Cân nặng","metricValue":72.5,"unit":"kg","recordedAt":"\#(day(-30))T08:00:00"},{"id":2,"metricName":"Cân nặng","metricValue":70.8,"unit":"kg","recordedAt":"\#(day(-15))T08:00:00"},{"id":3,"metricName":"Cân nặng","metricValue":69.9,"unit":"kg","recordedAt":"\#(day(-1))T08:00:00"}]"#
        case "/coaching/training-plans/my": body = #"[{"id":1,"status":"active","startDate":"\#(day(-7))","endDate":"\#(day(21))","goal":"Tăng cơ toàn thân","coachName":"Minh Trần","items":[{"id":1,"dayOfWeek":1,"exerciseName":"Squat","sets":4,"reps":10,"orderIndex":1,"restSeconds":90},{"id":2,"dayOfWeek":3,"exerciseName":"Bench press","sets":4,"reps":8,"orderIndex":1}]}]"#
        case "/notifications": body = #"{"content":[{"id":1,"title":"Lớp sắp bắt đầu","message":"Yoga buổi sáng bắt đầu lúc 07:00 ngày mai.","type":"class_reminder","isRead":false,"createdAt":"\#(day(0))T08:00:00"}]}"#
        case "/notifications/unread-count": body = #"{"count":1}"#
        case "/memberships/subscriptions/pending":
            body = #"[{"id":21,"memberId":5,"membershipCode":"MB-0005","memberName":"Trần Hoàng Nam","memberPhone":"0987654321","packageId":1,"packageName":"Silver 1 tháng","packagePrice":450000,"startDate":"\#(day(0))","endDate":"\#(day(30))"}]"#
        case "/memberships/subscriptions/holds/pending": body = #"[{"id":8,"memberName":"Lê Thu Hà","membershipCode":"MB-0008","packageName":"Gold 3 tháng","holdReason":"Đi công tác 2 tuần","cancelledEnrollmentsCount":2}]"#
        case "/reports/revenue/daily": body = "[" + (0..<10).map { #"{"date":"\#(day(-9 + $0))","revenue":\#(300000 + ($0 * 137) % 9 * 150000),"transactionCount":3}"# }.joined(separator: ",") + "]"
        case "/reports/revenue/by-package": body = #"[{"packageId":1,"packageName":"Silver 1 tháng","revenue":5400000,"subscriptionCount":12,"percentage":40},{"packageId":2,"packageName":"Gold 3 tháng","revenue":8400000,"subscriptionCount":7,"percentage":60}]"#
        case "/reports/transactions/recent": body = #"[{"id":1,"invoiceNumber":"INV-0009","memberName":"Nguyễn Minh Anh","packageName":"Gold 3 tháng","amount":1200000,"method":"cash","paidAt":"\#(day(0))T09:05:00"}]"#
        case "/reports/renewal-rate": body = #"{"renewalRate":68.5}"#
        case "/memberships/cancellations": body = #"[{"id":3,"memberName":"Phạm Quốc Bảo","packageName":"Gold 3 tháng","reason":"Chuyển nơi ở","status":"PENDING","requestedAt":"\#(day(-1))T10:00:00","refundAmount":600000,"requestedByName":"Lễ tân Hoa"}]"#
        default:
            if path.hasPrefix("/attendance/sessions/") { body = #"{"members":[{"memberId":3,"fullName":"Nguyễn Minh Anh","membershipCode":"MB-0003","attendanceStatus":"present","progressScore":85},{"memberId":5,"fullName":"Trần Hoàng Nam","membershipCode":"MB-0005"}]}"# }
            else { return nil }
        }
        return Data(#"{"success":true,"data":\#(body)}"#.utf8)
    }
}
#else
enum Demo { static let initialTab = 0; static let role: Role? = nil }
#endif
