package com.swp391.scms.users;

import com.swp391.scms.users.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface MemberRepository extends JpaRepository<Member, Long> {
    Optional<Member> findByMembershipCode(String membershipCode);

    @Query("""
            select m from Member m join fetch m.user u
            where u.deletedAt is null
              and (lower(m.membershipCode) like :pattern or lower(u.fullName) like :pattern
                   or lower(u.email) like :pattern or u.phone like :pattern)
            order by u.fullName
            """)
    List<Member> search(@Param("pattern") String pattern, Pageable pageable);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Member m where m.userId = :userId")
    Optional<Member> findByIdForUpdate(@Param("userId") Long userId);
}
