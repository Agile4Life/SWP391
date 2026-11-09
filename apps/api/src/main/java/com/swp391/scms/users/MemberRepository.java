package com.swp391.scms.users;

import com.swp391.scms.users.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

@Repository
public interface MemberRepository extends JpaRepository<Member, Long> {
    Optional<Member> findByMembershipCode(String membershipCode);

    /** Registered, active members nobody has measured yet: the people a coach may give a first assessment. */
    @Query("""
            select m from Member m join fetch m.user u
            where u.deletedAt is null and u.status = 'active'
              and not exists (select 1 from MemberProgressLog l where l.member = m)
              and (lower(m.membershipCode) like :pattern or lower(u.fullName) like :pattern
                   or lower(u.email) like :pattern or u.phone like :pattern)
            order by u.fullName
            """)
    List<Member> searchWithoutMeasurements(@Param("pattern") String pattern, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Member m where m.userId = :memberId")
    Optional<Member> findByUserIdForUpdate(@Param("memberId") Long memberId);

    @Query("""
            select m from Member m join fetch m.user u
            where u.deletedAt is null
              and (lower(m.membershipCode) like :pattern or lower(u.fullName) like :pattern
                   or lower(u.email) like :pattern or u.phone like :pattern)
            order by u.fullName
            """)
    List<Member> search(@Param("pattern") String pattern, Pageable pageable);

    @org.springframework.data.jpa.repository.Modifying
    @Query(value = "delete from member_favorite_disciplines where discipline_id = :disciplineId", nativeQuery = true)
    void removeFavoriteDiscipline(@Param("disciplineId") Long disciplineId);
}
