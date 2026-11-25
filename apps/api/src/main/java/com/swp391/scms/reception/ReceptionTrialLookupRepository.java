package com.swp391.scms.reception;

import com.swp391.scms.membership.entity.MemberTrialRedemption;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Truy vấn chỉ đọc theo lô cho trạng thái gói trải nghiệm khi tra cứu hội viên tại quầy lễ tân. */
public interface ReceptionTrialLookupRepository extends Repository<MemberTrialRedemption, Long> {

    @Query("""
            select t.member.userId from MemberTrialRedemption t
            where t.member.userId in :memberIds
              and upper(t.status) = upper(:status)
            """)
    /** Lấy danh sách userId của hội viên có bản ghi gói trải nghiệm khớp trạng thái cho trước trong một truy vấn. */
    List<Long> findMemberUserIdsWithStatus(@Param("memberIds") Collection<Long> memberIds,
                                           @Param("status") String status);
}
