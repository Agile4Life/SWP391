package com.swp391.scms.facilities;

import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API bộ môn yêu thích của hội viên (SCRUM-133; tính năng đã ngừng, chỉ bật khi
 * {@code app.legacy.favorite-disciplines-enabled=true}).
 */
@RestController
@ConditionalOnProperty(name = "app.legacy.favorite-disciplines-enabled", havingValue = "true")
@RequestMapping("/api/v1/members/me/favorite-disciplines")
public class MemberFavoriteDisciplineController {

    private final MemberRepository memberRepository;
    private final DisciplineRepository disciplineRepository;
    private final MessageService messageService;

    /** Nhận repository hội viên, bộ môn và MessageService. */
    public MemberFavoriteDisciplineController(
            MemberRepository memberRepository,
            DisciplineRepository disciplineRepository,
            MessageService messageService) {
        this.memberRepository = memberRepository;
        this.disciplineRepository = disciplineRepository;
        this.messageService = messageService;
    }

    /** GET: danh sách id bộ môn yêu thích của hội viên. */
    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<Long>>> getFavoriteDisciplines(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        Member member = memberRepository.findById(principal.id())
                .orElseThrow(() -> new ResourceNotFoundException("Member", principal.id()));

        List<Long> favoriteIds = member.getFavoriteDisciplines().stream()
                .map(Discipline::getId)
                .toList();

        String msg = messageService != null
                ? messageService.getMessage("message.member.favorite_disciplines_success", "Lấy danh sách bộ môn yêu thích thành công")
                : "Lấy danh sách bộ môn yêu thích thành công";
        return ResponseEntity.ok(ApiResponse.ok(msg, favoriteIds));
    }

    /** POST /{disciplineId}/toggle: thêm hoặc bỏ một bộ môn khỏi danh sách yêu thích. */
    @PostMapping("/{disciplineId}/toggle")
    @Transactional
    public ResponseEntity<ApiResponse<List<Long>>> toggleFavoriteDiscipline(
            @AuthenticationPrincipal AuthenticatedPrincipal principal,
            @PathVariable("disciplineId") Long disciplineId) {
        Member member = memberRepository.findById(principal.id())
                .orElseThrow(() -> new ResourceNotFoundException("Member", principal.id()));

        Discipline discipline = disciplineRepository.findById(disciplineId)
                .orElseThrow(() -> new ResourceNotFoundException("Discipline", disciplineId));

        if (member.getFavoriteDisciplines().contains(discipline)) {
            member.getFavoriteDisciplines().remove(discipline);
        } else {
            member.getFavoriteDisciplines().add(discipline);
        }

        memberRepository.save(member);

        List<Long> updatedIds = member.getFavoriteDisciplines().stream()
                .map(Discipline::getId)
                .toList();

        String msg = messageService != null
                ? messageService.getMessage("message.member.favorite_discipline_toggled", "Cập nhật bộ môn yêu thích thành công")
                : "Cập nhật bộ môn yêu thích thành công";
        return ResponseEntity.ok(ApiResponse.ok(msg, updatedIds));
    }
}
