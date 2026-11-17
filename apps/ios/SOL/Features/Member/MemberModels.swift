import Foundation

struct Subscription: Decodable, Identifiable, Hashable {
    let id: Int
    let memberId: Int?
    let packageId: Int?
    let packageName: String
    let previousSubscriptionId: Int?
    let startDate: String
    let endDate: String
    let status: String
    let qrCode: String?
    let createdAt: String?
    let upgradeCharge: Double?
    let quotedPrice: Double?
    let holdStatus: String?
    let holdReason: String?
    let remainingValue: Double?

    var isActive: Bool { status == "active" }
    var isPending: Bool { status == "pending_payment" }
    var amountDue: Double? { upgradeCharge ?? quotedPrice }
}

struct MembershipPackage: Decodable, Identifiable, Hashable {
    let id: Int
    let name: String
    let description: String?
    let price: Double
    let durationDays: Int
    let classCreditLimit: Int?
    let status: String?
}

struct ClassEnrollment: Decodable, Identifiable, Hashable {
    let id: Int
    let classId: Int
    let className: String
    let coachName: String?
    let roomName: String?
    let sessionDate: String?
    let startTime: String?
    let endTime: String?
    let status: String
    let totalSessions: Int?
    let attendedSessions: Int?
    let remainingSessions: Int?
}

struct GymClass: Decodable, Identifiable, Hashable {
    let id: Int
    let name: String
    let disciplineName: String?
    let coachName: String?
    let roomName: String?
    let capacity: Int?
    let level: String?
    let description: String?
    let status: String?
    let price: Double?
    let startDate: String?
    let endDate: String?
    let recurringDays: String?
    let startTime: String?
    let endTime: String?
}

struct Quota: Decodable {
    let tier: String?
    let totalCredits: Int?
    let usedCredits: Int?
    let remainingCredits: Int?
    let unlimited: Bool?
    let enrollBlockedUntil: String?
    let discountPercent: Int?
}

struct ClassSession: Decodable, Identifiable, Hashable {
    let id: Int
    let classId: Int
    let className: String
    let coachName: String?
    let roomName: String?
    let sessionDate: String
    let startTime: String
    let endTime: String
    let status: String
    let capacity: Int?
    let bookedCount: Int?
}

struct DynamicQr: Decodable {
    let qrCode: String
    let expiresInSeconds: Int
    let generatedAt: String?
}

struct Checkin: Decodable, Identifiable, Hashable {
    let id: Int
    let memberId: Int?
    let memberName: String?
    let checkInTime: String
    let checkOutTime: String?
    let method: String?
    let gate: String?
    let status: String
    let denialReason: String?
    let packageName: String?
    let remainingDays: Int?
    var granted: Bool { ["GRANTED", "success"].contains(status) }
}

struct WorkoutStreak: Decodable {
    let currentStreak: Int
    let longestStreak: Int
    let workoutDays: Int
    let activeDates: [String]?
}

struct Payment: Decodable, Identifiable, Hashable {
    let id: Int
    let memberName: String?
    let subscriptionId: Int?
    let amount: Double
    let method: String?
    let status: String
    let paidAt: String?
    let createdAt: String?
    let invoiceNumber: String?
    let serviceType: String?
    let serviceName: String?
}

struct WalletTransaction: Decodable, Identifiable, Hashable {
    let id: Int
    let type: String
    let amount: Double
    let balanceAfter: Double?
    let description: String?
    let createdAt: String
}

struct Wallet: Decodable {
    let balance: Double
    let updatedAt: String?
    let transactions: [WalletTransaction]?
}

struct VnpayCheckout: Decodable {
    let reference: String
    let paymentUrl: String
    let amount: Double
    let expiresAt: String?
}

struct VnpayStatus: Decodable {
    let reference: String
    let status: String
}

struct HealthMetric: Decodable, Identifiable, Hashable {
    let id: Int
    let metricName: String
    let metricValue: Double
    let unit: String?
    let recordedAt: String
}

struct TrainingItem: Decodable, Identifiable, Hashable {
    let id: Int
    let dayOfWeek: Int?
    let exerciseName: String
    let description: String?
    let sets: Int?
    let reps: Int?
    let durationMinutes: Int?
    let restSeconds: Int?
    let orderIndex: Int?
}

struct TrainingPlan: Decodable, Identifiable, Hashable {
    let id: Int
    let status: String
    let startDate: String?
    let endDate: String?
    let goal: String?
    let coachName: String?
    let items: [TrainingItem]
}

struct AppNotification: Decodable, Identifiable, Hashable {
    let id: Int
    let title: String
    let message: String
    let type: String?
    let isRead: Bool
    let createdAt: String
}

struct NotificationPage: Decodable {
    let content: [AppNotification]
}

struct UnreadCount: Decodable { let count: Int }

struct Profile: Decodable {
    let userId: Int
    let fullName: String
    let email: String?
    let phone: String?
    let dob: String?
    let gender: String?
    let avatarUrl: String?
    let address: String?
    let membershipCode: String?
    let healthNotes: String?
    let fitnessGoal: String?
    let fitnessLevel: String?
    let emergencyContactName: String?
    let emergencyContactPhone: String?
    let specialization: String?
    let bio: String?
    let certification: String?
    let shift: String?
    let kycStatus: String?
}
