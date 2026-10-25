package com.swp391.scms.ai.service;

import com.swp391.scms.ai.dto.AiChatMessageCreateDto;
import com.swp391.scms.ai.dto.AiChatMessageDto;
import com.swp391.scms.ai.dto.AiChatReplyDto;
import com.swp391.scms.ai.dto.AiChatSessionCreateDto;
import com.swp391.scms.ai.dto.AiChatSessionDto;
import com.swp391.scms.ai.entity.AiChatMessage;
import com.swp391.scms.ai.entity.AiChatSession;
import com.swp391.scms.ai.repository.AiChatMessageRepository;
import com.swp391.scms.ai.repository.AiChatSessionRepository;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

/**
 * Service managing 24/7 AI Chatbot sessions and messages for SCMS members (SCRUM-118).
 */
@Service
public class AiChatService {

    public static final String SYSTEM_PROMPT = """
            Bạn là Trợ lý Tư vấn Thể thao & Dinh dưỡng 24/7 của Trung tâm SCMS (Sports Center Management System).
            Nhiệm vụ của bạn:
            1. Tư vấn các bộ môn thể thao tại trung tâm (Gym, Yoga, Boxing, Swimming, Cardio, CrossFit), lịch tập luyện và phương pháp phục hồi.
            2. Cung cấp lời khuyên dinh dưỡng thể thao cơ bản, tính toán cân đối calo/macro an toàn.
            3. Tuyệt đối bảo mật dữ liệu cá nhân của các hội viên khác.
            4. Từ chối lịch sự mọi câu hỏi ngoài phạm vi thể thao, sức khỏe, dinh dưỡng hoặc dịch vụ trung tâm SCMS.
            """;

    private static final int MAX_CONTEXT_MESSAGES = 6;

    private static final List<String> OFF_TOPIC_KEYWORDS = List.of(
            "chứng khoán", "cổ phiếu", "bitcoin", "crypto", "cá độ", "đánh bạc",
            "chính trị", "hack", "mật khẩu người khác", "thông tin hội viên khác",
            "số điện thoại của", "email của hội viên", "stock market", "gambling",
            "politics", "other member's", "other members"
    );

    private final AiChatSessionRepository sessionRepository;
    private final AiChatMessageRepository messageRepository;
    private final MemberRepository memberRepository;
    private final MessageService messageService;

    @Autowired
    public AiChatService(AiChatSessionRepository sessionRepository,
                         AiChatMessageRepository messageRepository,
                         MemberRepository memberRepository,
                         MessageService messageService) {
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.memberRepository = memberRepository;
        this.messageService = messageService;
    }

    /**
     * Creates a new AI chat session for a member.
     */
    @Transactional
    public AiChatSessionDto createSession(AiChatSessionCreateDto dto, Long currentUserId, String currentRole) {
        Member member = resolveTargetMember(dto != null ? dto.memberId() : null, currentUserId, currentRole);

        AiChatSession session = new AiChatSession();
        session.setMember(member);
        String topic = (dto != null && dto.topic() != null && !dto.topic().isBlank())
                ? dto.topic().trim()
                : "Tư vấn Thể thao & Dinh dưỡng SCMS";
        session.setTopic(topic);
        session.setStartedAt(LocalDateTime.now());

        AiChatSession saved = sessionRepository.save(session);
        return toSessionDto(saved);
    }

    /**
     * Lists chat sessions for the current member.
     */
    @Transactional(readOnly = true)
    public List<AiChatSessionDto> getMySessions(Long currentUserId) {
        Member member = memberRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", currentUserId));
        return sessionRepository.findByMemberUserIdOrderByStartedAtDesc(member.getUserId())
                .stream()
                .map(this::toSessionDto)
                .toList();
    }

    /**
     * Sends a member message in an existing chat session, generates the AI reply with session context,
     * and persists both messages in chronological order.
     */
    @Transactional
    public AiChatReplyDto sendMessage(Long sessionId,
                                      AiChatMessageCreateDto dto,
                                      Long currentUserId,
                                      String currentRole) {
        if (dto == null || dto.message() == null || dto.message().isBlank()) {
            throw new BadRequestException(msg("validation.ai.chat.message.required"));
        }

        AiChatSession session = getAuthorizedSession(sessionId, currentUserId, currentRole);
        List<AiChatMessage> existingHistory = messageRepository.findBySessionIdOrderByCreatedAtAscIdAsc(sessionId);

        LocalDateTime now = LocalDateTime.now();
        AiChatMessage memberMsg = new AiChatMessage();
        memberMsg.setSession(session);
        memberMsg.setSender("member");
        memberMsg.setMessage(dto.message().trim());
        memberMsg.setCreatedAt(now);
        AiChatMessage savedMemberMsg = messageRepository.save(memberMsg);

        String aiReplyText = generateContextualReply(session, existingHistory, dto.message().trim());

        AiChatMessage aiMsg = new AiChatMessage();
        aiMsg.setSession(session);
        aiMsg.setSender("ai");
        aiMsg.setMessage(aiReplyText);
        aiMsg.setCreatedAt(now.plusNanos(1_000_000));
        AiChatMessage savedAiMsg = messageRepository.save(aiMsg);

        return new AiChatReplyDto(
                session.getId(),
                toMessageDto(savedMemberMsg),
                toMessageDto(savedAiMsg),
                savedAiMsg.getMessage()
        );
    }

    /**
     * Retrieves chronological chat history for a session.
     */
    @Transactional(readOnly = true)
    public List<AiChatMessageDto> getSessionHistory(Long sessionId, Long currentUserId, String currentRole) {
        AiChatSession session = getAuthorizedSession(sessionId, currentUserId, currentRole);
        return messageRepository.findBySessionIdOrderByCreatedAtAscIdAsc(session.getId())
                .stream()
                .map(this::toMessageDto)
                .toList();
    }

    private AiChatSession getAuthorizedSession(Long sessionId, Long currentUserId, String currentRole) {
        AiChatSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("error.ai.chat.session.not_found", sessionId));

        if ("MEMBER".equalsIgnoreCase(currentRole)) {
            Long ownerUserId = session.getMember() != null ? session.getMember().getUserId() : null;
            if (ownerUserId == null || !ownerUserId.equals(currentUserId)) {
                throw new AccessDeniedException(msg("coaching.plan.not_owner"));
            }
        }
        return session;
    }

    private Member resolveTargetMember(Long requestedMemberId, Long currentUserId, String currentRole) {
        if ("MEMBER".equalsIgnoreCase(currentRole)) {
            if (requestedMemberId != null && currentUserId != null && !requestedMemberId.equals(currentUserId)) {
                throw new AccessDeniedException(msg("coaching.plan.not_owner"));
            }
            Long targetId = currentUserId != null ? currentUserId : requestedMemberId;
            return memberRepository.findById(targetId)
                    .orElseThrow(() -> new ResourceNotFoundException("resource.member", targetId));
        }
        Long targetId = requestedMemberId != null ? requestedMemberId : currentUserId;
        return memberRepository.findById(targetId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", targetId));
    }

    private String generateContextualReply(AiChatSession session,
                                           List<AiChatMessage> history,
                                           String userMessage) {
        String normalized = userMessage.toLowerCase(Locale.ROOT);

        for (String keyword : OFF_TOPIC_KEYWORDS) {
            if (normalized.contains(keyword)) {
                return "Xin lỗi bạn, tôi là Trợ lý Tư vấn Thể thao & Dinh dưỡng của Trung tâm SCMS. "
                        + "Vì lý do bảo mật và phạm vi chuyên môn, tôi chỉ hỗ trợ các câu hỏi liên quan đến tập luyện thể thao, "
                        + "dinh dưỡng, sức khỏe và dịch vụ lớp học tại SCMS.";
            }
        }

        int startIdx = Math.max(0, history.size() - MAX_CONTEXT_MESSAGES);
        List<AiChatMessage> recentContext = history.subList(startIdx, history.size());
        String previousTopicHint = recentContext.stream()
                .filter(m -> "member".equalsIgnoreCase(m.getSender()))
                .reduce((first, second) -> second)
                .map(AiChatMessage::getMessage)
                .orElse(session.getTopic());

        if (normalized.contains("dinh dưỡng") || normalized.contains("ăn") || normalized.contains("calo")
                || normalized.contains("nutrition") || normalized.contains("diet")) {
            return String.format(
                    "[Trợ lý SCMS - Chủ đề: %s] Về chế độ dinh dưỡng thể thao: Bạn nên ưu tiên bổ sung 1.6-2.0g protein/kg cân nặng mỗi ngày, "
                            + "kết hợp tinh bột hấp thu chậm (yến mạch, gạo lứt, khoai lang) trước buổi tập 60-90 phút và uống đủ 2-2.5 lít nước/ngày.",
                    session.getTopic()
            );
        }

        if (normalized.contains("giảm cân") || normalized.contains("giảm mỡ")
                || normalized.contains("weight loss") || normalized.contains("fat")) {
            return String.format(
                    "[Trợ lý SCMS - Chủ đề: %s] Để giảm mỡ hiệu quả và an toàn tại SCMS, bạn nên kết hợp 3 buổi tập kháng lực (Strength/Gym) "
                            + "với 2 buổi Cardio hoặc HIIT mỗi tuần, duy trì mức thâm hụt 300-500 kcal/ngày và ngủ đủ 7-8 tiếng.",
                    session.getTopic()
            );
        }

        if (normalized.contains("lịch") || normalized.contains("lớp") || normalized.contains("đặt chỗ")
                || normalized.contains("class") || normalized.contains("schedule")) {
            return String.format(
                    "[Trợ lý SCMS - Chủ đề: %s] Bạn có thể tra cứu lịch lớp học (Gym, Yoga, Boxing, Bơi lội) tại mục Lịch Tập trên hệ thống SCMS. "
                            + "Hãy đảm bảo gói tập của bạn đang ở trạng thái Active và đặt lịch trước giờ khai giảng để giữ chỗ.",
                    session.getTopic()
            );
        }

        if (!recentContext.isEmpty()) {
            return String.format(
                    "[Trợ lý SCMS - Tiếp nối hội thoại '%s'] Dựa trên trao đổi trước đó (%s), tôi khuyên bạn nên duy trì cường độ tập luyện điều độ 3-5 buổi/tuần, "
                            + "khởi động kỹ 10 phút trước khi tập và theo dõi chỉ số cơ thể định kỳ trên hệ thống SCMS.",
                    session.getTopic(),
                    abbreviate(previousTopicHint, 50)
            );
        }

        return String.format(
                "[Trợ lý SCMS - %s] Xin chào! Tôi là Trợ lý Tư vấn Thể thao & Dinh dưỡng 24/7 của SCMS. "
                        + "Với câu hỏi của bạn về '%s', tôi gợi ý bạn bắt đầu với kế hoạch tập luyện phù hợp thể trạng, kết hợp khởi động kỹ và dinh dưỡng cân bằng. "
                        + "Bạn muốn tư vấn chi tiết hơn về bài tập, lịch lớp hay chế độ ăn uống?",
                session.getTopic(),
                abbreviate(userMessage, 60)
        );
    }

    private String abbreviate(String text, int maxLength) {
        if (text == null || text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "...";
    }

    private AiChatSessionDto toSessionDto(AiChatSession session) {
        return new AiChatSessionDto(
                session.getId(),
                session.getMember() != null ? session.getMember().getUserId() : null,
                session.getTopic(),
                session.getStartedAt(),
                session.getEndedAt()
        );
    }

    private AiChatMessageDto toMessageDto(AiChatMessage message) {
        return new AiChatMessageDto(
                message.getId(),
                message.getSession() != null ? message.getSession().getId() : null,
                message.getSender(),
                message.getMessage(),
                message.getCreatedAt()
        );
    }

    private String msg(String key, Object... args) {
        if (messageService == null) {
            return key;
        }
        return messageService.getMessage(key, args);
    }
}
