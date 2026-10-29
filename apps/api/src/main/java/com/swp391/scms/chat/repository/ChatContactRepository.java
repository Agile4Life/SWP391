package com.swp391.scms.chat.repository;

import com.swp391.scms.users.entity.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

/** Chat-specific reads and pair-creation lock; does not change identity management behavior. */
public interface ChatContactRepository extends Repository<User, Long> {
    @Query("select u from User u join fetch u.role where u.id = :id")
    Optional<User> findUser(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> lockUser(@Param("id") Long id);

    @Query(value = "select u from User u join fetch u.role r where u.deletedAt is null and u.status = 'active' "
            + "and r.code in ('RECEPTIONIST', 'COACH') and lower(u.fullName) like lower(concat('%', :query, '%')) order by u.fullName, u.id",
            countQuery = "select count(u) from User u join u.role r where u.deletedAt is null and u.status = 'active' "
            + "and r.code in ('RECEPTIONIST', 'COACH') and lower(u.fullName) like lower(concat('%', :query, '%'))")
    Page<User> search(@Param("query") String query, Pageable page);
}
