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
@Service
public class CurrentCoachMembers {
 private final CurrentCoachMemberRepository members; private final Clock clock; private final MemberProgressLogRepository progressLogs;
 public CurrentCoachMembers(CurrentCoachMemberRepository members,Clock clock){this(members,clock,null);}
 @Autowired public CurrentCoachMembers(CurrentCoachMemberRepository members,Clock clock,@Autowired(required=false) MemberProgressLogRepository progressLogs){this.members=members;this.clock=clock;this.progressLogs=progressLogs;}
 /** Today in the center time zone, for callers that must apply the same "current" window. */
 public LocalDate centerToday(){return today();}
 private LocalDate today(){return LocalDate.now(clock.withZone(ZoneId.of("Asia/Ho_Chi_Minh")));}
 public record MemberOption(Long id,String memberCode,String fullName,String fitnessGoal,String healthNotes,String fitnessLevel,BigDecimal heightCm,BigDecimal weightKg,BigDecimal bmi) {
  public MemberOption(Long id,String memberCode,String fullName,String fitnessGoal,String healthNotes,String fitnessLevel){
   this(id,memberCode,fullName,fitnessGoal,healthNotes,fitnessLevel,null,null,null);
  }
 }
 @Transactional(readOnly=true)
 public List<MemberOption> list(Long userId,String role){
  if(userId==null||!("COACH".equals(role)||"CENTER_MANAGER".equals(role))) throw denied();
  return members.findCurrent("COACH".equals(role)?userId:null,null,today()).stream()
   .map(this::toMemberOption).toList();
 }
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
  return new MemberOption(m.getUserId(),m.getMembershipCode(),m.getUser().getFullName(),m.getFitnessGoal(),m.getHealthNotes(),m.getFitnessLevel(),heightCm,weightKg,bmi);
 }
 public static BigDecimal calculateBmi(BigDecimal heightCm,BigDecimal weightKg){
  if(heightCm==null||weightKg==null||heightCm.compareTo(BigDecimal.ZERO)<=0||weightKg.compareTo(BigDecimal.ZERO)<=0) return null;
  BigDecimal heightMeters=heightCm.divide(BigDecimal.valueOf(100),4,RoundingMode.HALF_UP);
  if(heightMeters.compareTo(BigDecimal.ZERO)<=0) return null;
  return weightKg.divide(heightMeters.multiply(heightMeters),1,RoundingMode.HALF_UP);
 }
 @Transactional(readOnly=true)
 public void requireCoachOf(Long coachId,Long memberId){
  if(coachId==null||memberId==null||members.findCurrent(coachId,memberId,today()).isEmpty()) throw denied();
 }
 private ForbiddenException denied(){return new ForbiddenException("COACH_MEMBER_NOT_ASSIGNED","coaching.member.not_assigned",null,"No current coaching assignment.");}
}
