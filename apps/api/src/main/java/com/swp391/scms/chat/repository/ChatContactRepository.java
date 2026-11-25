package com.swp391.scms.chat.repository;

import com.swp391.scms.users.entity.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

/**
 * Truy vấn người dùng cho tính năng chat (danh bạ, khóa dòng).
 *
 * Các truy vấn đọc riêng cho chat và khóa tạo cặp hội thoại; không thay đổi hành vi quản lý danh tính.
 */
public interface ChatContactRepository extends Repository<User, Long> {
    /** Lấy người dùng kèm vai trò. */
    @Query("select u from User u join fetch u.role where u.id = :id")
    Optional<User> findUser(@Param("id") Long id);

    /** Lấy người dùng và khóa dòng; dùng để xếp hàng việc tạo hội thoại cho cùng một hội viên. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> lockUser(@Param("id") Long id);

    /**
     * Những người hội viên được phép nhắn: mọi lễ tân, cộng với chỉ những HLV mà họ hiện có liên kết
     * (giáo án đang hoạt động, buổi đặt 1:1 đã xác nhận, lớp đã đăng ký còn buổi sắp tới hoặc buổi học đã đặt).
     * HLV đứng trước để phần HLV trống vẫn hiện ra ở trang đầu.
     */
    @Query(value = """
            select u from User u join fetch u.role r where u.deletedAt is null and u.status = 'active'
            and lower(u.fullName) like lower(concat('%', :query, '%'))
            and (r.code = 'RECEPTIONIST' or (r.code = 'COACH' and (
              exists (select p.id from TrainingPlan p where p.member.userId = :memberId and p.coach.userId = u.id
                and p.status in ('active', 'draft') and p.endDate >= :today)
              or exists (select cb.id from CoachBooking cb where cb.member.userId = :memberId and cb.coach.userId = u.id
                and cb.status = 'confirmed' and cb.bookingDate >= :today)
              or exists (select e.id from ClassEnrollment e where e.member.userId = :memberId and e.gymClass.coach.userId = u.id
                and e.status = 'booked' and e.gymClass.status = 'active' and exists (select s.id from ClassSession s where s.gymClass = e.gymClass
                  and s.status = 'scheduled' and s.sessionDate >= :today))
              or exists (select b.id from SessionBooking b where b.member.userId = :memberId and b.session.gymClass.coach.userId = u.id
                and b.status = 'booked' and b.session.gymClass.status = 'active' and b.session.status = 'scheduled' and b.session.sessionDate >= :today))))
            order by case when r.code = 'COACH' then 0 else 1 end, u.fullName, u.id
            """,
            countQuery = """
            select count(u) from User u join u.role r where u.deletedAt is null and u.status = 'active'
            and lower(u.fullName) like lower(concat('%', :query, '%'))
            and (r.code = 'RECEPTIONIST' or (r.code = 'COACH' and (
              exists (select p.id from TrainingPlan p where p.member.userId = :memberId and p.coach.userId = u.id
                and p.status in ('active', 'draft') and p.endDate >= :today)
              or exists (select cb.id from CoachBooking cb where cb.member.userId = :memberId and cb.coach.userId = u.id
                and cb.status = 'confirmed' and cb.bookingDate >= :today)
              or exists (select e.id from ClassEnrollment e where e.member.userId = :memberId and e.gymClass.coach.userId = u.id
                and e.status = 'booked' and e.gymClass.status = 'active' and exists (select s.id from ClassSession s where s.gymClass = e.gymClass
                  and s.status = 'scheduled' and s.sessionDate >= :today))
              or exists (select b.id from SessionBooking b where b.member.userId = :memberId and b.session.gymClass.coach.userId = u.id
                and b.status = 'booked' and b.session.gymClass.status = 'active' and b.session.status = 'scheduled' and b.session.sessionDate >= :today))))
            """)
    /**
     * Danh bạ của hội viên: lễ tân luôn có; HLV chỉ khi hội viên đang có giáo án, buổi PT sắp tới hoặc lớp với
     * HLV đó; lọc theo tên, HLV đứng trước, có phân trang.
     */
    Page<User> searchForMember(@Param("memberId") Long memberId, @Param("today") java.time.LocalDate today,
                               @Param("query") String query, Pageable page);

    /** Các hội viên đang hoạt động mà lễ tân được phép bắt đầu chat, khớp theo tên hoặc email. */
    @Query(value = "select u from User u join fetch u.role r where u.deletedAt is null and u.status = 'active' "
            + "and r.code = 'MEMBER' and (lower(u.fullName) like lower(concat('%', :query, '%')) "
            + "or lower(u.email) like lower(concat('%', :query, '%'))) order by u.fullName, u.id",
            countQuery = "select count(u) from User u join u.role r where u.deletedAt is null and u.status = 'active' "
            + "and r.code = 'MEMBER' and (lower(u.fullName) like lower(concat('%', :query, '%')) "
            + "or lower(u.email) like lower(concat('%', :query, '%')))")
    /** Danh bạ của lễ tân: mọi hội viên active, tìm theo tên hoặc email, có phân trang. */
    Page<User> searchMembers(@Param("query") String query, Pageable page);

    /**
     * Danh bạ của HLV: chỉ các hội viên active mà HLV hiện đang phụ trách (giáo án còn hạn, buổi PT 1:1 sắp tới,
     * lớp học nhóm hoặc buổi học đã đặt), lọc theo tên, email hoặc mã hội viên và phân trang trực tiếp tại DB.
     */
    @Query(value = """
            select u from User u join fetch u.role r
            where u.deletedAt is null and u.status = 'active' and r.code = 'MEMBER'
            and (lower(u.fullName) like lower(concat('%', :query, '%'))
              or lower(u.email) like lower(concat('%', :query, '%'))
              or exists (select m.userId from Member m where m.userId = u.id
                and lower(m.membershipCode) like lower(concat('%', :query, '%'))))
            and (
              exists (select p.id from TrainingPlan p where p.member.userId = u.id and p.coach.userId = :coachId
                and p.status in ('active', 'draft') and p.endDate >= :today)
              or exists (select cb.id from CoachBooking cb where cb.member.userId = u.id and cb.coach.userId = :coachId
                and cb.status = 'confirmed' and cb.bookingDate >= :today)
              or exists (select e.id from ClassEnrollment e where e.member.userId = u.id and e.gymClass.coach.userId = :coachId
                and e.status = 'booked' and e.gymClass.status = 'active' and exists (select s.id from ClassSession s where s.gymClass = e.gymClass
                  and s.status = 'scheduled' and s.sessionDate >= :today))
              or exists (select b.id from SessionBooking b where b.member.userId = u.id and b.session.gymClass.coach.userId = :coachId
                and b.status = 'booked' and b.session.gymClass.status = 'active' and b.session.status = 'scheduled' and b.session.sessionDate >= :today))
            order by u.fullName, u.id
            """,
            countQuery = """
            select count(u) from User u join u.role r
            where u.deletedAt is null and u.status = 'active' and r.code = 'MEMBER'
            and (lower(u.fullName) like lower(concat('%', :query, '%'))
              or lower(u.email) like lower(concat('%', :query, '%'))
              or exists (select m.userId from Member m where m.userId = u.id
                and lower(m.membershipCode) like lower(concat('%', :query, '%'))))
            and (
              exists (select p.id from TrainingPlan p where p.member.userId = u.id and p.coach.userId = :coachId
                and p.status in ('active', 'draft') and p.endDate >= :today)
              or exists (select cb.id from CoachBooking cb where cb.member.userId = u.id and cb.coach.userId = :coachId
                and cb.status = 'confirmed' and cb.bookingDate >= :today)
              or exists (select e.id from ClassEnrollment e where e.member.userId = u.id and e.gymClass.coach.userId = :coachId
                and e.status = 'booked' and e.gymClass.status = 'active' and exists (select s.id from ClassSession s where s.gymClass = e.gymClass
                  and s.status = 'scheduled' and s.sessionDate >= :today))
              or exists (select b.id from SessionBooking b where b.member.userId = u.id and b.session.gymClass.coach.userId = :coachId
                and b.status = 'booked' and b.session.gymClass.status = 'active' and b.session.status = 'scheduled' and b.session.sessionDate >= :today))
            """)
    Page<User> searchForCoach(@Param("coachId") Long coachId, @Param("today") java.time.LocalDate today,
                              @Param("query") String query, Pageable page);
}
