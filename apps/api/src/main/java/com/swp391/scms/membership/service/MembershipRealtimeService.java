package com.swp391.scms.membership.service;

import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.membership.dto.MembershipRealtimeSession;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cấp thông tin kênh realtime Supabase cho hội viên: chỉ dùng khóa publishable (khởi động sẽ báo lỗi nếu cấu
 * hình nhầm khóa bí mật) và chủ đề ngẫu nhiên riêng cho từng hội viên, không chứa dữ liệu.
 */
@Service
public class MembershipRealtimeService {
    private final MemberRepository members;
    private final String url;
    private final String publishableKey;

    /** Đọc địa chỉ Supabase và khóa publishable; từ chối nếu khóa không phải dạng publishable. */
    public MembershipRealtimeService(MemberRepository members,
            @Value("${app.supabase.url:}") String url,
            @Value("${app.supabase.publishable-key:}") String publishableKey) {
        this.members = members;
        this.url = url;
        this.publishableKey = publishableKey;
        if (!publishableKey.isBlank() && !publishableKey.startsWith("sb_publishable_")) {
            throw new IllegalArgumentException("SUPABASE_PUBLISHABLE_KEY must be a publishable key, never a secret key");
        }
    }

    /**
     * Mở kênh realtime cho hội viên: chưa cấu hình thì trả "chưa bật"; lần đầu thì tạo chủ đề ngẫu nhiên và lưu
     * lại.
     */
    @Transactional
    public MembershipRealtimeSession open(AuthenticatedPrincipal principal) {
        if (principal == null || !"MEMBER".equals(principal.role())) {
            throw new ForbiddenException("FORBIDDEN", "error.forbidden", null, null);
        }
        if (url.isBlank() || publishableKey.isBlank()) {
            return new MembershipRealtimeSession(false, null, null, null);
        }
        var member = members.findByUserIdForUpdate(principal.id())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", principal.id()));
        if (member.getPaymentRealtimeTopic() == null) {
            member.setPaymentRealtimeTopic(UUID.randomUUID());
        }
        return new MembershipRealtimeSession(true, url, publishableKey, "membership:" + member.getPaymentRealtimeTopic());
    }
}
