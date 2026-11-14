package com.swp391.scms.coaching;
import com.swp391.scms.coaching.repository.CurrentCoachMemberRepository;
import com.swp391.scms.coaching.service.CurrentCoachMembers;
import com.swp391.scms.health.MemberProgressLogRepository;
import com.swp391.scms.health.entity.MemberProgressLog;
import com.swp391.scms.users.entity.*;
import com.swp391.scms.common.exception.ForbiddenException;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class CurrentCoachMembersTest {
 CurrentCoachMemberRepository repository=mock(CurrentCoachMemberRepository.class);
 MemberProgressLogRepository progressLogs=mock(MemberProgressLogRepository.class);
 CurrentCoachMembers service=new CurrentCoachMembers(repository,Clock.fixed(Instant.parse("2026-11-03T17:05:00Z"),ZoneOffset.UTC),progressLogs);
 Member member(long id){User u=new User();u.setId(id);u.setFullName("Test member");Member m=new Member();m.setUserId(id);m.setUser(u);return m;}
 @Test void returnsAuthoritativeClassAndPtOnlyMembersWithoutRosterCalls(){when(repository.findCurrent(20L,null,LocalDate.of(2026,11,4))).thenReturn(List.of(member(10),member(11)));assertThat(service.list(20L,"COACH")).extracting(CurrentCoachMembers.MemberOption::id).containsExactly(10L,11L);}
 @Test void populatesLatestHeightWeightAndAutoCalculatedBmi(){
  when(repository.findCurrent(20L,null,LocalDate.of(2026,11,4))).thenReturn(List.of(member(10)));
  MemberProgressLog h=new MemberProgressLog();h.setMetricName("height");h.setMetricValue(new BigDecimal("172"));
  MemberProgressLog w=new MemberProgressLog();w.setMetricName("weight");w.setMetricValue(new BigDecimal("68"));
  when(progressLogs.findByMemberUserIdOrderByRecordedAtDesc(10L)).thenReturn(List.of(w,h));
  var result=service.list(20L,"COACH");
  assertThat(result).hasSize(1);
  assertThat(result.get(0).heightCm()).isEqualByComparingTo("172");
  assertThat(result.get(0).weightKg()).isEqualByComparingTo("68");
  assertThat(result.get(0).bmi()).isEqualByComparingTo("23.0");
 }
 @Test void expiredOrUnassignedMemberIsDenied(){when(repository.findCurrent(20L,10L,LocalDate.of(2026,11,4))).thenReturn(List.of());assertThatThrownBy(()->service.requireCoachOf(20L,10L)).isInstanceOf(ForbiddenException.class);}
 @Test void currentMemberIsAllowed(){when(repository.findCurrent(20L,10L,LocalDate.of(2026,11,4))).thenReturn(List.of(member(10)));service.requireCoachOf(20L,10L);}
 @Test void staffAndMemberCannotEnumerateCoachMembers(){for(String role:List.of("MEMBER","RECEPTIONIST"))assertThatThrownBy(()->service.list(20L,role)).isInstanceOf(ForbiddenException.class);verifyNoInteractions(repository);}
 @Test void managerRetainsActiveMemberDirectory(){when(repository.findCurrent(null,null,LocalDate.of(2026,11,4))).thenReturn(List.of(member(10)));assertThat(service.list(20L,"CENTER_MANAGER")).hasSize(1);}
 @Test void queryHasAllAuthoritativeRelationsAndOneOuterMemberRow() throws Exception {
  String query=CurrentCoachMemberRepository.class.getMethod("findCurrent",Long.class,Long.class,LocalDate.class).getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
  assertThat(query).contains("select m from Member m", "CoachBooking", "TrainingPlan", "ClassEnrollment", "SessionBooking", "cb.status = 'confirmed'", "cb.bookingDate >= :today", "p.endDate >= :today", "u.deletedAt is null", "u.status = 'active'");
  assertThat(query).doesNotContain("join CoachBooking", "join TrainingPlan");
 }
 @Test void marksSilverMemberWorkoutPlanInvisibleWhileGoldCanView() throws Exception {
  var subscriptions = mock(com.swp391.scms.membership.repository.MembershipSubscriptionRepository.class);
  org.springframework.test.util.ReflectionTestUtils.setField(service, "subscriptionRepository", subscriptions);
  when(repository.findCurrent(20L, null, LocalDate.of(2026, 11, 4))).thenReturn(List.of(member(10), member(11)));
  var silverPkg = new com.swp391.scms.facilities.entity.MembershipPackage();
  silverPkg.setName("Silver 1 tháng");
  silverPkg.setTier("SILVER");
  silverPkg.setDurationDays(30);
  var silverSub = new com.swp391.scms.membership.entity.MembershipSubscription();
  silverSub.setMembershipPackage(silverPkg);
  silverSub.setStartDate(LocalDate.of(2026, 11, 1));
  silverSub.setEndDate(LocalDate.of(2026, 11, 30));
  silverSub.setStatus("active");

  var goldPkg = new com.swp391.scms.facilities.entity.MembershipPackage();
  goldPkg.setName("Gold 1 tháng");
  goldPkg.setTier("GOLD");
  goldPkg.setDurationDays(30);
  var goldSub = new com.swp391.scms.membership.entity.MembershipSubscription();
  goldSub.setMembershipPackage(goldPkg);
  goldSub.setStartDate(LocalDate.of(2026, 11, 1));
  goldSub.setEndDate(LocalDate.of(2026, 11, 30));
  goldSub.setStatus("active");

  when(subscriptions.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(silverSub));
  when(subscriptions.findByMemberUserIdAndStatus(11L, "active")).thenReturn(List.of(goldSub));

  var tree = new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(service.list(20L, "COACH"));
  assertThat(tree.get(0).path("canViewWorkoutPlan").asBoolean(true)).isFalse();
  assertThat(tree.get(1).path("canViewWorkoutPlan").asBoolean(false)).isTrue();
 }
}
