// Browser verification only. Production content always comes from /public/catalog.
const packages = [30, 90, 365].map((durationDays, index) => ({
  id: index + 1, name: `Gói kiểm chứng ${durationDays} ngày`, description: 'Quyền lợi từ danh mục portal',
  price: [789000, 2100000, 7000000][index], durationDays, classCreditLimit: index ? null : 8, status: 'active',
}));
const coaches = ['Strength & Barbell', 'Movement & Core', 'Aquatics & Tennis'].map((specialization, index) => ({
  id: index + 1, name: `HLV kiểm chứng ${index + 1}`, specialization,
  bio: 'Hồ sơ đã cập nhật tại portal.', certification: 'Chứng chỉ huấn luyện', avatarUrl: null,
}));
const sessions = Array.from({ length: 6 }, (_, index) => {
  const date = new Date(); date.setDate(date.getDate() + 1 + Math.floor(index / 2));
  return {
    id: index + 1, classId: index + 1, className: `Lớp kiểm chứng ${index + 1}`,
    disciplineId: Math.floor(index / 2) + 1, disciplineName: coaches[Math.floor(index / 2)].specialization,
    coachId: Math.floor(index / 2) + 1, coachName: coaches[Math.floor(index / 2)].name,
    roomId: 1, roomName: 'Phòng 1',
    sessionDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    startTime: '09:00:00', endTime: '10:00:00', status: 'scheduled', cancelReason: null, capacity: 12, bookedCount: 5,
  };
});
module.exports = { packages, coaches, sessions };
