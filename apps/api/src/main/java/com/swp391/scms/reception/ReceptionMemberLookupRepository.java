package com.swp391.scms.reception;

import com.swp391.scms.users.entity.Member;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Truy vấn chỉ đọc tra cứu hội viên cho lễ tân với ESCAPE '\\' tường minh cho toán tử LIKE. */
public interface ReceptionMemberLookupRepository extends Repository<Member, Long> {

    @Query("""
            select m from Member m join fetch m.user u
            where u.deletedAt is null
              and (lower(m.membershipCode) like :pattern escape '\\'
                   or lower(u.fullName) like :pattern escape '\\'
                   or lower(u.email) like :pattern escape '\\'
                   or u.phone like :pattern escape '\\')
            order by u.fullName
            """)
    /** Tìm tối đa theo Pageable các hội viên chưa xóa khớp mẫu đã escape ký tự wildcard LIKE. */
    List<Member> searchEscaped(@Param("pattern") String pattern, Pageable pageable);
}
