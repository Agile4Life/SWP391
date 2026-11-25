package com.swp391.scms.audit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.security.AuthenticatedPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Ghi nhật ký kiểm toán (audit log) tự động cho mọi hàm service gắn @Audited: chụp dữ liệu trước và sau khi
 * chạy (không khóa ghi) rồi lưu vào audit_logs. Khi có {@link AuditLogWriter}, bản ghi audit được lưu sau khi
 * giao dịch nghiệp vụ commit trong một giao dịch độc lập ({@code REQUIRES_NEW}), tránh làm hỏng giao dịch
 * chính hoặc giữ khóa trước khi kiểm tra phân quyền.
 */
@Aspect
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class AuditAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditAspect.class);

    private final AuditLogRepository repository;
    private final ObjectMapper objectMapper;
    private final EntityManager entityManager;
    private final AuditLogWriter auditLogWriter;

    /** Constructor cho test, không chụp dữ liệu từ database. */
    public AuditAspect(AuditLogRepository repository, ObjectMapper objectMapper) {
        this(repository, objectMapper, null, null);
    }

    /** Constructor cho test có EntityManager để chụp dữ liệu trước/sau. */
    public AuditAspect(AuditLogRepository repository, ObjectMapper objectMapper, EntityManager entityManager) {
        this(repository, objectMapper, entityManager, null);
    }

    /** Constructor Spring dùng: có EntityManager để chụp dữ liệu không khóa và AuditLogWriter tách giao dịch. */
    @Autowired
    public AuditAspect(AuditLogRepository repository,
                       ObjectMapper objectMapper,
                       @Autowired(required = false) EntityManager entityManager,
                       @Autowired(required = false) AuditLogWriter auditLogWriter) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.entityManager = entityManager;
        this.auditLogWriter = auditLogWriter;
    }

    /**
     * Bao quanh hàm @Audited: xác định id bản ghi (tham số đầu tiên, hoặc tham số thứ hai với buổi lớp), chụp
     * dữ liệu cũ, chạy hàm, chụp dữ liệu mới rồi ghi log.
     */
    @Around("@annotation(audited)")
    public Object around(ProceedingJoinPoint joinPoint, Audited audited) throws Throwable {
        Object[] args = joinPoint.getArgs();
        Long id = args.length > 0 && args[0] instanceof Long value ? value : null;
        if ("class_sessions".equals(audited.entity()) && args.length > 1 && args[1] instanceof Long sessionId) {
            id = sessionId;
        }
        JsonNode oldValue = snapshot(audited.entity(), id, args);
        Object result = joinPoint.proceed();
        JsonNode newValue = snapshot(audited.entity(), id, args);
        record(joinPoint, audited, result, oldValue, newValue);
        return result;
    }

    /** Ghi log khi chỉ có kết quả trả về (không chụp dữ liệu trước/sau). */
    public void record(JoinPoint joinPoint, Audited audited, Object result) {
        record(joinPoint, audited, result, null, null);
    }

    /**
     * Tạo bản ghi audit: người thực hiện, hành động, loại và id bản ghi, giá trị cũ/mới (dạng JSON) và IP. Với
     * cập nhật hồ sơ, ảnh và KYC thì không lưu giá trị mới để tránh ghi dữ liệu cá nhân nhạy cảm. Lỗi khi ghi
     * log chỉ cảnh báo, không làm hỏng thao tác chính.
     */
    private void record(JoinPoint joinPoint, Audited audited, Object result, JsonNode oldValue, JsonNode snapshot) {
        try {
            JsonNode newValue = snapshot != null ? snapshot : result == null
                    || "PROFILE_UPDATE".equals(audited.action())
                    || "PROFILE_AVATAR_UPDATE".equals(audited.action())
                    || "MEMBER_KYC_SUBMIT".equals(audited.action())
                    ? null : objectMapper.valueToTree(result);
            AuditLog entry = new AuditLog();
            entry.setUserId(currentUserId());
            entry.setAction(audited.action());
            entry.setEntityType(audited.entity());
            entry.setEntityId(resolveEntityId(audited.entity(), joinPoint.getArgs(), newValue));
            entry.setOldValue(oldValue == null ? null : oldValue.toString());
            entry.setNewValue(newValue == null ? null : newValue.toString());
            entry.setIpAddress(currentIp());
            persist(entry, audited.action());
        } catch (RuntimeException e) {
            log.warn("Could not write audit log for action {}", audited.action(), e);
        }
    }

    /**
     * Lưu bản ghi audit: khi có AuditLogWriter và đang ở trong giao dịch, đăng ký ghi sau commit trong giao
     * dịch REQUIRES_NEW để vừa không ghi log cho thao tác bị rollback vừa không làm hỏng giao dịch nghiệp vụ.
     */
    private void persist(AuditLog entry, String action) {
        if (auditLogWriter != null) {
            if (TransactionSynchronizationManager.isSynchronizationActive()
                    && TransactionSynchronizationManager.isActualTransactionActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        try {
                            auditLogWriter.save(entry);
                        } catch (RuntimeException e) {
                            log.warn("Could not write audit log for action {}", action, e);
                        }
                    }
                });
                return;
            }
            auditLogWriter.save(entry);
            return;
        }
        repository.save(entry);
    }

    /**
     * Chụp các trường quan trọng của bản ghi theo loại (người dùng, HLV, lễ tân, yêu cầu hỗ trợ, gói tập, thanh
     * toán, lớp, buổi lớp, điểm danh, quyền của vai trò) bằng thao tác đọc không khóa để không bao giờ lấy
     * khóa ghi trước khi kiểm tra phân quyền hoặc gây tràn lock timeout. Loại không hỗ trợ thì trả null.
     */
    private JsonNode snapshot(String entity, Long id, Object[] args) {
        if (entityManager == null || id == null) return null;
        try {
            var node = objectMapper.createObjectNode();
            switch (entity) {
                case "users" -> {
                    var user = entityManager.find(com.swp391.scms.users.entity.User.class, id);
                    if (user == null) return null;
                    node.put("id", id).put("fullName", user.getFullName()).put("email", user.getEmail())
                            .put("phone", user.getPhone()).put("status", user.getStatus())
                            .put("gender", user.getGender())
                            .put("address", user.getAddress());
                    if (user.getDob() != null) node.put("dob", user.getDob().toString());
                    if (user.getDeletedAt() != null) node.put("deletedAt", user.getDeletedAt().toString());
                }
                case "coaches" -> {
                    var coach = entityManager.find(com.swp391.scms.users.entity.Coach.class, id);
                    if (coach == null) return null;
                    node.put("id", id).put("specialization", coach.getSpecialization())
                            .put("bio", coach.getBio()).put("certification", coach.getCertification());
                }
                case "receptionists" -> {
                    var receptionist = entityManager.find(com.swp391.scms.users.entity.Receptionist.class, id);
                    if (receptionist == null) return null;
                    node.put("id", id).put("shift", receptionist.getShift());
                }
                case "support_requests" -> {
                    var request = entityManager.find(com.swp391.scms.support.entity.SupportRequest.class, id);
                    if (request == null) return null;
                    node.put("id", id).put("status", request.getStatus());
                    if (request.getAssignedTo() != null) node.put("assignedTo", request.getAssignedTo().getId());
                    if (request.getEscalatedAt() != null) node.put("escalatedAt", request.getEscalatedAt().toString());
                }
                case "membership_packages" -> {
                    var pkg = entityManager.find(com.swp391.scms.facilities.entity.MembershipPackage.class, id);
                    if (pkg == null) return null;
                    node.put("id", id).put("name", pkg.getName()).put("description", pkg.getDescription())
                            .put("price", pkg.getPrice()).put("durationDays", pkg.getDurationDays())
                            .put("classCreditLimit", pkg.getClassCreditLimit()).put("status", pkg.getStatus());
                }
                case "payments" -> {
                    var payment = entityManager.find(com.swp391.scms.finance.entity.Payment.class, id);
                    if (payment == null) return null;
                    node.put("id", id).put("amount", payment.getAmount()).put("method", payment.getMethod())
                            .put("status", payment.getStatus()).put("note", payment.getNote());
                }
                case "classes" -> {
                    var gymClass = entityManager.find(com.swp391.scms.scheduling.entity.GymClass.class, id);
                    if (gymClass == null) return null;
                    node.put("id", id).put("name", gymClass.getName()).put("capacity", gymClass.getCapacity())
                            .put("level", gymClass.getLevel()).put("status", gymClass.getStatus());
                    if (gymClass.getDiscipline() != null) node.put("disciplineId", gymClass.getDiscipline().getId());
                    if (gymClass.getCoach() != null) node.put("coachId", gymClass.getCoach().getUserId());
                    if (gymClass.getRoom() != null) node.put("roomId", gymClass.getRoom().getId());
                }
                case "class_sessions" -> {
                    var session = entityManager.find(com.swp391.scms.scheduling.entity.ClassSession.class, id);
                    if (session == null) return null;
                    node.put("id", id).put("status", session.getStatus());
                    if (session.getGymClass() != null) node.put("classId", session.getGymClass().getId());
                    if (session.getSessionDate() != null) node.put("sessionDate", session.getSessionDate().toString());
                    if (session.getStartTime() != null) node.put("startTime", session.getStartTime().toString());
                    if (session.getEndTime() != null) node.put("endTime", session.getEndTime().toString());
                }
                case "session_attendance" -> {
                    // Ai được đánh dấu gì trong buổi (memberId -> status); không có thông tin liên hệ trong
                    // log.
                    var records = node.putObject("records");
                    node.put("sessionId", id);
                    entityManager.createQuery("select a.member.userId, a.status from SessionAttendance a where a.session.id = :id "
                                    + "order by a.member.userId", Object[].class)
                            .setParameter("id", id).getResultList()
                            .forEach(row -> records.put(String.valueOf(row[0]), String.valueOf(row[1])));
                }
                case "role_permissions" -> {
                    if (args.length < 2 || !(args[1] instanceof Long permissionId)) return null;
                    var role = entityManager.find(com.swp391.scms.users.entity.Role.class, id);
                    if (role == null) return null;
                    boolean granted = role.getPermissions() != null && role.getPermissions().stream()
                            .anyMatch(permission -> permissionId.equals(permission.getId()));
                    node.put("roleId", id).put("permissionId", permissionId).put("granted", granted);
                }
                default -> { return null; }
            }
            return node;
        } catch (RuntimeException e) {
            log.warn("Could not capture audit snapshot for {}", entity, e);
            return null;
        }
    }

    /**
     * Id bản ghi để lưu vào log: id buổi lớp (tham số thứ hai), tham số đầu tiên kiểu Long, hoặc trường id
     * trong kết quả trả về.
     */
    private Long resolveEntityId(String entity, Object[] args, JsonNode newValue) {
        if ("class_sessions".equals(entity) && args.length > 1 && args[1] instanceof Long sessionId) {
            return sessionId;
        }
        if (args.length > 0 && args[0] instanceof Long id) {
            return id;
        }
        return newValue != null && newValue.hasNonNull("id") ? newValue.get("id").asLong() : null;
    }

    /** Id người đang đăng nhập (null nếu chạy ngoài request, ví dụ job định kỳ). */
    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof AuthenticatedPrincipal principal ? principal.id() : null;
    }

    /** Địa chỉ IP của request hiện tại (null nếu chạy ngoài request). */
    private String currentIp() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs
                ? ((HttpServletRequest) attrs.getRequest()).getRemoteAddr()
                : null;
    }
}
