package com.swp391.scms.coaching.service;
import com.swp391.scms.coaching.repository.CurrentCoachMemberRepository;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.health.MemberProgressLogRepository;
import com.swp391.scms.health.entity.MemberProgressLog;
import com.swp391.scms.users.entity.Member;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.List;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
/**
 * Danh sách học viên mà HLV đang phụ trách (có giáo án, buổi PT hoặc lớp còn hiệu lực), kèm số đo mới nhất, BMI
 * và quyền xem giáo án; cũng dùng để kiểm tra "HLV có đang dạy hội viên này không".
 */
@Service
public class CurrentCoachMembers {
 private final CurrentCoachMemberRepository members; private final Clock clock; private final MemberProgressLogRepository progressLogs;
 @Autowired(required=false) private com.swp391.scms.membership.repository.MembershipSubscriptionRepository subscriptionRepository;
 /** Constructor cho test, không có repository số đo. */
 public CurrentCoachMembers(CurrentCoachMemberRepository members,Clock clock){this(members,clock,null);}
 @Autowired public CurrentCoachMembers(CurrentCoachMemberRepository members,Clock clock,@Autowired(required=false) MemberProgressLogRepository progressLogs){this.members=members;this.clock=clock;this.progressLogs=progressLogs;}
 /**
  * Ngày hôm nay theo giờ trung tâm (để nơi gọi dùng cùng một mốc).
  *
  * Today in the center time zone, for callers that must apply the same "current" window.
  */
 public LocalDate centerToday(){return today();}
 /** Ngày hôm nay theo giờ trung tâm. */
 private LocalDate today(){return LocalDate.now(clock.withZone(ZoneId.of("Asia/Ho_Chi_Minh")));}
 /**
  * Một học viên trong danh sách: mã, họ tên, mục tiêu, sức khỏe, trình độ, chiều cao, cân nặng, BMI và có xem
  * được giáo án không.
  */
 public record MemberOption(Long id,String memberCode,String fullName,String fitnessGoal,String healthNotes,String fitnessLevel,BigDecimal heightCm,BigDecimal weightKg,BigDecimal bmi,Boolean canViewWorkoutPlan) {
  /** Constructor không có số đo. */
  public MemberOption(Long id,String memberCode,String fullName,String fitnessGoal,String healthNotes,String fitnessLevel){
   this(id,memberCode,fullName,fitnessGoal,healthNotes,fitnessLevel,null,null,null,true);
  }
  /** Constructor có số đo nhưng mặc định xem được giáo án. */
  public MemberOption(Long id,String memberCode,String fullName,String fitnessGoal,String healthNotes,String fitnessLevel,BigDecimal heightCm,BigDecimal weightKg,BigDecimal bmi){
   this(id,memberCode,fullName,fitnessGoal,healthNotes,fitnessLevel,heightCm,weightKg,bmi,true);
  }
 }
 /** Học viên hiện tại: HLV xem của mình, quản lý xem tất cả; vai trò khác bị từ chối. */
 @Transactional(readOnly=true)
 public List<MemberOption> list(Long userId,String role){
  if(userId==null||!("COACH".equals(role)||"CENTER_MANAGER".equals(role))) throw denied();
  return members.findCurrent("COACH".equals(role)?userId:null,null,today()).stream()
   .map(this::toMemberOption).toList();
 }
 /** Dựng thông tin học viên kèm chiều cao/cân nặng/BMI mới nhất (BMI tính lại từ chiều cao, cân nặng nếu có). */
 private MemberOption toMemberOption(Member m){
  BigDecimal heightCm=null,weightKg=null,recordedBmi=null;
  if(progressLogs!=null&&m.getUserId()!=null){
   List<MemberProgressLog> logs=progressLogs.findByMemberUserIdOrderByRecordedAtDesc(m.getUserId());
   if(logs!=null){
    for(MemberProgressLog log:logs){
     if(log.getMetricName()==null||log.getMetricValue()==null) continue;
     String name=log.getMetricName().toLowerCase(Locale.ROOT);
     if("height".equals(name)&&heightCm==null) heightCm=log.getMetricValue();
     else if("weight".equals(name)&&weightKg==null) weightKg=log.getMetricValue();
     else if("bmi".equals(name)&&recordedBmi==null) recordedBmi=log.getMetricValue();
    }
   }
  }
  BigDecimal bmi=calculateBmi(heightCm,weightKg);
  if(bmi==null) bmi=recordedBmi;
  return new MemberOption(m.getUserId(),m.getMembershipCode(),m.getUser().getFullName(),m.getFitnessGoal(),m.getHealthNotes(),m.getFitnessLevel(),heightCm,weightKg,bmi,canMemberViewWorkoutPlan(m.getUserId()));
 }
 /** Hội viên có được xem giáo án theo hạng gói không (không có gói hiệu lực thì được). */
 private boolean canMemberViewWorkoutPlan(Long memberId){
  if(subscriptionRepository==null||memberId==null) return true;
  LocalDate currentDay=today();
  var current=subscriptionRepository.findByMemberUserIdAndStatus(memberId,"active").stream()
   .filter(s->s.getStartDate()!=null&&s.getEndDate()!=null&&!s.getStartDate().isAfter(currentDay)&&!s.getEndDate().isBefore(currentDay))
   .toList();
  return current.isEmpty()||current.stream().anyMatch(s->com.swp391.scms.facilities.PackageBenefits.canViewWorkoutPlan(s.getMembershipPackage()));
 }
 /** Tính BMI = cân nặng (kg) / chiều cao (m)², làm tròn 1 chữ số; thiếu hoặc không hợp lệ thì null. */
 public static BigDecimal calculateBmi(BigDecimal heightCm,BigDecimal weightKg){
  if(heightCm==null||weightKg==null||heightCm.compareTo(BigDecimal.ZERO)<=0||weightKg.compareTo(BigDecimal.ZERO)<=0) return null;
  BigDecimal heightMeters=heightCm.divide(BigDecimal.valueOf(100),4,RoundingMode.HALF_UP);
  if(heightMeters.compareTo(BigDecimal.ZERO)<=0) return null;
  return weightKg.divide(heightMeters.multiply(heightMeters),1,RoundingMode.HALF_UP);
 }
 /** Bắt buộc HLV đang phụ trách hội viên; không thì 403. */
 @Transactional(readOnly=true)
 public void requireCoachOf(Long coachId,Long memberId){
  if(coachId==null||memberId==null||members.findCurrent(coachId,memberId,today()).isEmpty()) throw denied();
 }
 /** Lỗi 403 "không có phân công huấn luyện hiện tại". */
 private ForbiddenException denied(){return new ForbiddenException("COACH_MEMBER_NOT_ASSIGNED","coaching.member.not_assigned",null,"No current coaching assignment.");}
}
