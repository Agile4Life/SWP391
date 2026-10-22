export interface TrainerProfile {
  slug: string;
  name: string;
  vietnameseName: string;
  specialty: string;
  shortRole: string;
  image: string;
  actionImage: string;
  meta: string;
  experienceYears: number;
  studentsCount: number;
  weeklySessions: number;
  quote: string;
  introSummary: string;
  storyParagraphs: string[];
  milestones: { year: string; title: string; detail: string }[];
  sessionSteps: { step: string; title: string; description: string }[];
  specialties: string[];
  schedulePreview: { day: string; time: string; className: string; zone: string }[];
}

export const trainerProfiles: TrainerProfile[] = [
  {
    slug: 'strength-coach',
    name: 'Strength coach',
    vietnameseName: 'Coach Marcus Cole',
    specialty: 'SỨC MẠNH & THỂ LỰC NỀN TẢNG',
    shortRole: 'Huấn luyện viên Gym & Sức mạnh cơ bản',
    image: 'coach-strength.png',
    actionImage: '/images/fitness/gym-floor.jpg',
    meta: '12+ lớp/tuần · Tập tạ cơ bản & Tăng cơ an toàn',
    experienceYears: 6,
    studentsCount: 420,
    weeklySessions: 14,
    quote: 'Bạn không cần phải khỏe rồi mới đi tập. Chính những buổi tập vừa sức mỗi tuần sẽ giúp bạn khỏe lên một cách tự nhiên nhất.',
    introSummary:
      'Đồng hành cùng người mới bắt đầu, nhân viên văn phòng và sinh viên muốn xây dựng nền tảng thể lực, cải thiện tư thế và làm quen với tạ rời một cách gần gũi, dễ hiểu.',
    storyParagraphs: [
      'Cách đây hơn 7 năm, Marcus Cole từng là một kỹ sư phần mềm ngồi bàn làm việc gần 10 tiếng mỗi ngày, thường xuyên đau mỏi lưng dưới và hụt hơi chỉ sau vài tầng cầu thang. Những ngày đầu bước vào phòng tập, cảm giác ngại ngùng trước dàn máy móc phức tạp từng khiến Marcus muốn bỏ cuộc.',
      'Chính trải nghiệm đó đã định hình cách hướng dẫn của Marcus tại SÖL: không dùng thuật ngữ phức tạp, không ép nâng tạ nặng lấy thành tích, mà bắt đầu từ cách hít thở, cách đứng vững và kiểm soát từng chuyển động cơ bản nhất.',
      'Ngoài khu vực Gym & Free Weights, Marcus còn thiết kế các bài tập bổ trợ sức mạnh chân và cơ lõi (Core) rất thực tế để hội viên có thêm thể lực khi bơi lội hoặc chơi Tennis cuối tuần cùng bạn bè.',
    ],
    milestones: [
      {
        year: 'Khởi đầu',
        title: 'Từ dân văn phòng đau mỏi lưng đến thói quen 3 buổi/tuần',
        detail: 'Tự phục hồi chứng đau lưng cơ năng nhờ tập đúng kỹ thuật Squat, Deadlift nhẹ và bài tập siết cơ bụng.',
      },
      {
        year: 'Chuyên môn',
        title: 'Chứng chỉ Huấn luyện Sức mạnh & Chuyển động an toàn',
        detail: 'Tập trung vào nhóm hội viên mới bắt đầu (Beginner) và người quay lại tập luyện sau thời gian dài gián đoạn.',
      },
      {
        year: 'Tại SÖL',
        title: 'Phụ trách khu vực Strength Floor & Bổ trợ thể lực đa môn',
        detail: 'Hướng dẫn hơn 400 hội viên nắm vững kỹ thuật tạ rời và tự tin tự tập luyện lâu dài.',
      },
    ],
    sessionSteps: [
      {
        step: '01',
        title: 'Trò chuyện & Kiểm tra chuyển động 10 phút đầu',
        description: 'Tìm hiểu thói quen sinh hoạt, các vùng hay mỏi (cổ vai gáy, thắt lưng, khớp gối) để chọn bài tập vừa vặn.',
      },
      {
        step: '02',
        title: 'Làm quen thiết bị & Chỉnh form từng nhịp',
        description: 'Hướng dẫn chi tiết cách đặt chân, giữ thẳng lưng và nhịp thở ở từng máy tập hoặc tạ đơn nhẹ.',
      },
      {
        step: '03',
        title: 'Ghi chú mức tạ & Lịch tập tuần dễ duy trì',
        description: 'Gợi ý lịch tập 3 buổi/tuần kết hợp thêm 1 buổi bơi thả lỏng để cơ thể không bị căng cứng.',
      },
    ],
    specialties: [
      'Hướng dẫn người mới làm quen máy tập & tạ rời',
      'Tăng cơ – Giảm mỡ thực tế cho dân văn phòng',
      'Cải thiện tư thế lưng – vai và giảm mỏi thắt lưng',
      'Tập chân & Core bổ trợ cho Tennis và Bơi lội',
    ],
    schedulePreview: [
      { day: 'Thứ 2 · Thứ 4 · Thứ 6', time: '06:30 — 07:20', className: 'Morning Strength Foundation', zone: 'Strength floor' },
      { day: 'Thứ 3 · Thứ 5', time: '17:30 — 18:25', className: 'Hypertrophy & Barbell Club', zone: 'Free weights' },
      { day: 'Thứ 7', time: '09:00 — 10:00', className: 'Lớp hướng dẫn kỹ thuật tạ cơ bản', zone: 'Strength floor' },
    ],
  },
  {
    slug: 'movement-coach',
    name: 'Movement coach',
    vietnameseName: 'Coach Elena Vance',
    specialty: 'CHUYỂN ĐỘNG, GIÃN CƠ & CÂN BẰNG',
    shortRole: 'Huấn luyện viên Linh hoạt khớp, Core & Phục hồi',
    image: 'coach-movement.png',
    actionImage: '/images/about-movement-studio.jpg',
    meta: '10+ lớp/tuần · Giãn cơ, Core & Mở khớp linh hoạt',
    experienceYears: 5,
    studentsCount: 360,
    weeklySessions: 12,
    quote: 'Một cơ thể khỏe không chỉ là nâng được mức tạ nặng, mà là mỗi sáng thức dậy bạn thấy vai nhẹ, lưng êm và bước đi thật thoải mái.',
    introSummary:
      'Chuyên thiết kế các lớp vận động nhẹ nhàng, giãn cơ chuyên sâu và làm khỏe cơ trọng tâm giúp giảm căng thẳng sau giờ làm và phòng ngừa chấn thương thể thao.',
    storyParagraphs: [
      'Elena Vance từng tham gia nhiều giải chạy bộ và thể thao phong trào thời đại học nhưng liên tục gặp chấn thương cổ chân và đau khớp vai vì thói quen vào sân là vận động mạnh ngay mà bỏ qua sự linh hoạt của khớp.',
      'Khi tìm hiểu sâu về vận động trị liệu và kiểm soát cơ lõi (Core & Mobility), Elena nhận ra rất nhiều người đi làm cũng đang chịu đựng cảm giác cứng khớp hông, mỏi cổ vai gáy mỗi ngày mà nghĩ rằng đó là chuyện bình thường.',
      'Các buổi tập của Elena tại SÖL luôn có nhịp điệu vừa phải, gần gũi và dễ theo kịp. Dù bạn chưa từng tập thể thao hay đang muốn tìm một buổi giãn cơ để bơi sải mượt hơn, vung vợt Tennis thoải mái hơn, Elena đều có cách điều chỉnh bài tập phù hợp với bạn.',
    ],
    milestones: [
      {
        year: 'Trải nghiệm',
        title: 'Vượt qua chấn thương thể thao phong trào nhờ Mobility',
        detail: 'Hiểu rõ tầm quan trọng của việc làm ấm khớp, giãn cơ chủ động và cân bằng hai bên cơ thể.',
      },
      {
        year: 'Đào tạo',
        title: 'Chuyên sâu về Core Stability, Pilates & Giãn cơ phục hồi',
        detail: 'Xây dựng giáo án dễ tập cho cả người lớn tuổi, nhân viên văn phòng lẫn người chơi nhiều môn thể thao.',
      },
      {
        year: 'Tại SÖL',
        title: 'Phụ trách Movement Studio & Chu trình phục hồi đa môn',
        detail: 'Kết hợp các buổi tập mở khớp vai – ngực trên cạn với bài thả lỏng dưới hồ bơi nước ấm.',
      },
    ],
    sessionSteps: [
      {
        step: '01',
        title: 'Thả lỏng nhịp thở & Đánh thức các khớp',
        description: '5–7 phút đầu tập trung hít thở sâu và xoay nhẹ khớp vai, cột sống ngực, cổ chân để rũ bỏ mệt mỏi.',
      },
      {
        step: '02',
        title: 'Chuỗi bài tập Core & Giãn cơ có hướng dẫn',
        description: 'Chuyển động chậm rãi, có dụng cụ hỗ trợ để người cứng cơ nhất vẫn thực hiện được thoải mái.',
      },
      {
        step: '03',
        title: 'Thư giãn sâu & Bài tập tự giãn cơ 5 phút tại bàn làm việc',
        description: 'Chia sẻ các động tác nhỏ bạn có thể tự tập ở nhà hoặc văn phòng mỗi khi ngồi lâu.',
      },
    ],
    specialties: [
      'Giãn cơ giải tỏa đau mỏi cổ vai gáy & lưng dưới',
      'Làm khỏe cơ bụng sâu (Core) không gây đau cổ',
      'Mở biên độ khớp vai cho người bơi lội & chơi Tennis',
      'Phục hồi thể lực nhẹ nhàng sau ngày làm việc căng thẳng',
    ],
    schedulePreview: [
      { day: 'Thứ 2 · Thứ 4 · Thứ 6', time: '09:00 — 09:50', className: 'Reformer Core & Shoulder Mobility', zone: 'Movement studio' },
      { day: 'Thứ 3 · Thứ 5', time: '18:30 — 19:20', className: 'Dynamic Mobility & Hydro-Recovery', zone: 'Movement & Pool' },
      { day: 'Chủ Nhật', time: '10:00 — 10:50', className: 'Giãn cơ cuối tuần & Cân bằng tư thế', zone: 'Movement studio' },
    ],
  },
  {
    slug: 'personal-coach',
    name: 'Personal coach',
    vietnameseName: 'Coach Liam Brooks',
    specialty: 'HUẤN LUYỆN CÁ NHÂN ĐA BỘ MÔN',
    shortRole: 'Huấn luyện viên Kèm 1:1 & Xây dựng thói quen tập luyện',
    image: 'strength-session.jpg',
    actionImage: '/images/fitness/strength-session.jpg',
    meta: 'Huấn luyện 1:1 · Lộ trình linh hoạt theo quỹ thời gian',
    experienceYears: 7,
    studentsCount: 310,
    weeklySessions: 16,
    quote: 'Lịch tập tốt nhất không phải là lịch tập khắc nghiệt nhất trên giấy, mà là lịch tập bạn thực sự hào hứng quay lại vào ngày mai.',
    introSummary:
      'Chuyên kèm 1:1 cho người bận rộn hoặc từng bỏ dở việc tập luyện nhiều lần — kết hợp linh hoạt giữa tập tạ, bơi lội và vận động sân bãi để mỗi tuần đi tập đều mới mẻ.',
    storyParagraphs: [
      'Trong 7 năm làm nghề, Liam Brooks gặp rất nhiều hội viên đăng ký thẻ tập cả năm nhưng chỉ đi được 2 tuần đầu vì cảm thấy lạc lõng, bài tập lặp đi lặp lại nhàm chán hoặc thực đơn ăn kiêng quá khắt khe.',
      'Vì vậy, khi kèm 1:1 tại SÖL, Liam luôn bắt đầu bằng việc lắng nghe lịch sinh hoạt thực tế của bạn: bạn có thể dành 45 phút vào giờ nghỉ trưa hay sau 6 giờ chiều? Hôm nào bạn muốn tập tạ đổ mồ hôi, hôm nào bạn chỉ muốn xuống hồ bơi vận động nhẹ nhàng?',
      'Sự linh hoạt của mô hình đa bộ môn giúp học viên của Liam duy trì thói quen đều đặn suốt nhiều tháng liền mà không cảm thấy bị ép buộc.',
    ],
    milestones: [
      {
        year: 'Thực tế',
        title: 'Đồng hành cùng hơn 300 hội viên bận rộn duy trì thói quen tập',
        detail: 'Thiết kế các buổi tập gói gọn 45–50 phút hiệu quả cao, phù hợp người đi làm và phụ huynh.',
      },
      {
        year: 'Phương pháp',
        title: 'Phối hợp Đa bộ môn (Gym + Bơi + Tennis) chống nhàm chán',
        detail: 'Giúp hội viên đốt mỡ, tăng sức bền đa dạng thay vì chỉ chạy máy bộ đơn điệu mỗi ngày.',
      },
      {
        year: 'Tại SÖL',
        title: 'Đội trưởng Huấn luyện Cá nhân & Tư vấn lộ trình hội viên mới',
        detail: 'Trực tiếp hướng dẫn buổi định hướng đầu tiên cho hội viên mới đăng ký tại câu lạc bộ.',
      },
    ],
    sessionSteps: [
      {
        step: '01',
        title: 'Đo chỉ số cơ thể & Đặt mục tiêu vừa sức theo từng tháng',
        description: 'Không hứa hẹn giảm cân cấp tốc thiếu an toàn; tập trung vào giảm mỡ, săn chắc và ngủ ngon hơn.',
      },
      {
        step: '02',
        title: 'Luân phiên bài tập đa dạng trong tuần',
        description: 'Kết hợp 2 buổi tập sức mạnh với 1–2 buổi bơi hoặc bài tập phản xạ để cơ thể linh hoạt, dẻo dai.',
      },
      {
        step: '03',
        title: 'Đồng hành dinh dưỡng đời thường dễ áp dụng',
        description: 'Gợi ý cách chọn món ăn cân bằng ngay trong bữa ăn hàng ngày mà không cần cân đo phức tạp.',
      },
    ],
    specialties: [
      'Kèm 1:1 cho người mới bắt đầu từ con số 0',
      'Giảm mỡ – Săn chắc bền vững không ăn kiêng cực đoan',
      'Thiết kế lịch tập đa môn 45 phút cho người bận rộn',
      'Phục hồi thể lực tổng quát & Tăng sức bền tim mạch',
    ],
    schedulePreview: [
      { day: 'Thứ 2 — Thứ 6', time: '12:00 — 13:00', className: 'Khung giờ kèm 1:1 buổi trưa (45 phút)', zone: 'Free weights & Pool' },
      { day: 'Thứ 2 — Thứ 6', time: '17:30 — 20:30', className: 'Khung giờ kèm 1:1 sau giờ làm', zone: 'Strength floor' },
      { day: 'Thứ 7', time: '08:00 — 11:00', className: 'Đánh giá chỉ số BMI & Tư vấn lộ trình mới', zone: 'Khu vực tư vấn SÖL' },
    ],
  },
  {
    slug: 'aquatics-coach',
    name: 'Aquatics coach',
    vietnameseName: 'Coach Noah Grant',
    specialty: 'BƠI LỘI 4 KIỂU & XÓA SỢ NƯỚC',
    shortRole: 'Huấn luyện viên Bơi lội cơ bản, Kỹ thuật & Sức bền',
    image: 'trainer-strength.jpg',
    actionImage: '/images/fitness/aquatics-pool.jpg',
    meta: 'Hồ bơi 25m · Dạy bơi người lớn, Chỉnh kỹ thuật & Bơi bền',
    experienceYears: 8,
    studentsCount: 510,
    weeklySessions: 15,
    quote: 'Dưới làn nước ấm, ai cũng có thể nổi nhẹ nhàng khi thả lỏng cơ thể. Đừng gồng sức chống lại nước — hãy học cách thở và lướt cùng nước.',
    introSummary:
      'Tận tâm hướng dẫn từ người lớn chưa biết bơi, còn tâm lý sợ nước cho đến những hội viên muốn chỉnh lại kỹ thuật Bơi sải, Bơi ếch để bơi được dài hơn mà không bị đuối sức.',
    storyParagraphs: [
      'Nhiều người lớn khi đến hồ bơi SÖL thường ngại ngùng chia sẻ với Noah Grant rằng họ đã ngoài 30, 40 tuổi nhưng vẫn sợ úp mặt xuống nước hoặc chỉ bơi được 15 mét là thở dốc. Noah luôn mỉm cười trấn an: học bơi ở tuổi nào cũng hoàn toàn bình thường khi có phương pháp đúng.',
      'Thay vì yêu cầu học viên quạt tay thật mạnh ngay từ đầu, Noah chia nhỏ từng bước rất dễ làm quen ở làn nước nông ấm áp: tập thở bong bóng đều đặn, cảm nhận lực nâng tự nhiên của nước giúp cơ thể nổi ngang, rồi mới ghép nhịp chân và tay.',
      'Với những hội viên đã biết bơi cơ bản, Noah hướng dẫn cách vươn dài sải tay và xoay người nhẹ nhàng để bạn có thể bơi liên tục 10–20 vòng hồ 25m như một cách thư giãn đầu óc tuyệt vời sau giờ làm việc.',
    ],
    milestones: [
      {
        year: 'Cộng đồng',
        title: 'Giúp hơn 500 học viên người lớn và trẻ em tự tin dưới nước',
        detail: 'Chuyên gỡ tâm lý sợ nước vùng sâu và thói quen nín thở gồng cứng người khi bơi.',
      },
      {
        year: 'Kỹ thuật',
        title: 'Chuẩn hóa kỹ thuật Bơi nhẹ sức (Effortless Swimming)',
        detail: 'Giúp học viên giảm một nửa sức lực tiêu hao trên mỗi vòng hồ 25m nhờ tư thế lướt nước đúng.',
      },
      {
        year: 'Tại SÖL',
        title: 'Phụ trách Hồ bơi 4 mùa 25m & Lớp Bơi phục hồi khớp',
        detail: 'Phân luồng làn bơi văn minh, an toàn cho cả người học bơi cơ bản lẫn người bơi rèn sức bền.',
      },
    ],
    sessionSteps: [
      {
        step: '01',
        title: 'Làm quen nước ấm & Nhịp thở thoải mái tại làn nông',
        description: 'Tập thở ra bằng mũi dưới nước và lấy hơi nhẹ nhàng khi nghiêng đầu, hoàn toàn không bị sặc nước.',
      },
      {
        step: '02',
        title: 'Tập nổi ngang & Trượt nước nhẹ nhàng',
        description: 'Dùng phao hỗ trợ để cảm nhận cơ thể tự nổi thẳng hàng trước khi tập đạp chân và quạt tay.',
      },
      {
        step: '03',
        title: 'Ghép nhịp hoàn chỉnh trên làn bơi 25 mét',
        description: 'Chỉnh từng động tác tay cao khuỷu để bạn bơi hết chiều dài hồ 25m một cách êm ái, đều nhịp.',
      },
    ],
    specialties: [
      'Xóa sợ nước & Dạy bơi cơ bản cho người lớn từ đầu',
      'Chỉnh kỹ thuật Bơi ếch, Bơi sải bền sức không hụt hơi',
      'Bơi rèn sức bền tim mạch & Giảm mỡ toàn thân',
      'Vận động dưới nước giảm đau mỏi lưng và khớp gối',
    ],
    schedulePreview: [
      { day: 'Thứ 3 · Thứ 5 · Thứ 7', time: '07:30 — 08:25', className: 'Aquatics Stroke & Endurance Clinic', zone: 'Aquatics pool 25m' },
      { day: 'Thứ 2 · Thứ 4 · Thứ 6', time: '17:00 — 18:00', className: 'Lớp Bơi cơ bản & Xóa sợ nước người lớn', zone: 'Làn 1–2 · Hồ bơi 25m' },
      { day: 'Chủ Nhật', time: '08:30 — 09:30', className: 'Chỉnh kỹ thuật Bơi sải đường dài', zone: 'Aquatics pool 25m' },
    ],
  },
  {
    slug: 'tennis-coach',
    name: 'Tennis coach',
    vietnameseName: 'Coach Julian Reed',
    specialty: 'TENNIS PHONG TRÀO, BỘ CHÂN & PHẢN XẠ',
    shortRole: 'Huấn luyện viên Tennis cơ bản & Giao lưu sân đấu',
    image: 'hero-athlete.png',
    actionImage: '/images/fitness/tennis-court.jpg',
    meta: 'Sân Tennis · Hướng dẫn người mới, Chỉnh bộ chân & Đánh đôi',
    experienceYears: 7,
    studentsCount: 280,
    weeklySessions: 14,
    quote: 'Tennis không hề khó hay kén người chơi như nhiều người nghĩ. Chỉ cần cầm vợt đúng cách và di chuyển nhịp nhàng, bạn sẽ thấy niềm vui trong từng đường bóng qua lưới.',
    introSummary:
      'Mang bộ môn Tennis đến gần hơn với mọi người qua giáo án nhập môn dễ hiểu, không gây mỏi cổ tay, kết hợp rèn phản xạ nhanh nhạy và những giờ giao lưu vui vẻ trên sân.',
    storyParagraphs: [
      'Julian Reed bắt đầu chơi Tennis từ những buổi chiều tập luyện tại câu lạc bộ thể thao cộng đồng. Julian nhận thấy rất nhiều người thích Tennis nhưng ngại bắt đầu vì sợ kỹ thuật khó, sợ đau khuỷu tay (Tennis Elbow) hoặc chưa có nhóm bạn cùng trình độ để ghép sân.',
      'Tại cụm sân Tennis của SÖL, Julian xây dựng các lớp học từ cơ bản nhất: có sẵn vợt tập trọng lượng nhẹ, máy thả bóng tốc độ chậm ổn định để người mới dễ dàng căn điểm chạm bóng ngay trước mặt mà không phải chạy vất vả.',
      'Khi bạn đã quen tay, Julian sẽ hướng dẫn cách bật nhảy bước nhỏ (Split-Step), cách giao bóng nhẹ nhàng qua lưới và kết nối bạn vào các nhóm hội viên cùng trình độ để mỗi tuần đều có những trận đánh đôi sảng khoái.',
    ],
    milestones: [
      {
        year: 'Phong trào',
        title: 'Từ sân tập cộng đồng đến HLV phát triển Tennis đại chúng',
        detail: 'Đơn giản hóa kỹ thuật cầm vợt và mở vợt để người mới đánh bóng qua lưới ngay trong buổi đầu.',
      },
      {
        year: 'An toàn',
        title: 'Ứng dụng kỹ thuật xoay hông – vai bảo vệ cổ tay & khuỷu tay',
        detail: 'Giúp người chơi phong trào phát lực tự nhiên từ chân và thân người thay vì dùng sức gồng cánh tay.',
      },
      {
        year: 'Tại SÖL',
        title: 'Phụ trách Cụm sân Tennis & CLB Giao lưu Đánh đôi cuối tuần',
        detail: 'Tổ chức các buổi tập kỹ thuật kết hợp ghép cặp giao lưu thân thiện cho hội viên mọi trình độ.',
      },
    ],
    sessionSteps: [
      {
        step: '01',
        title: 'Khởi động khớp & Làm quen cảm giác bóng (10 phút)',
        description: 'Tập tâng bóng, lăn bóng và làm quen cách cầm vợt tự nhiên, thoải mái nhất cho cổ tay.',
      },
      {
        step: '02',
        title: 'Tập đánh bóng thuận tay / trái tay với bóng thả chậm',
        description: 'Chỉnh tư thế đứng, nhịp xoay người và điểm tiếp xúc bóng ổn định cùng HLV hoặc máy thả bóng.',
      },
      {
        step: '03',
        title: 'Di chuyển bước chân & Đánh qua lại trên sân (Rally)',
        description: 'Thực hành di chuyển đánh bóng qua lưới và giao lưu đánh đôi vui khỏe cuối buổi tập.',
      },
    ],
    specialties: [
      'Tennis nhập môn dễ hiểu cho người chưa từng cầm vợt',
      'Chỉnh kỹ thuật Forehand / Backhand chống mỏi khuỷu tay',
      'Hướng dẫn giao bóng (Serve) và bộ chân di chuyển linh hoạt',
      'Chiến thuật đánh đôi phong trào & Kết nối bạn tập cùng trình độ',
    ],
    schedulePreview: [
      { day: 'Thứ 2 · Thứ 4 · Thứ 6', time: '19:30 — 20:30', className: 'Tennis Footwork, Spin & Match Play', zone: 'Championship Court' },
      { day: 'Thứ 3 · Thứ 5', time: '18:00 — 19:00', className: 'Lớp Tennis Nhập môn cho người mới', zone: 'Sân Tennis SÖL' },
      { day: 'Thứ 7 · Chủ Nhật', time: '16:30 — 18:30', className: 'CLB Giao lưu Đánh đôi & Chỉnh kỹ thuật', zone: 'Cụm sân Tennis SÖL' },
    ],
  },
];

export function getTrainerBySlug(slug?: string): TrainerProfile {
  return trainerProfiles.find((item) => item.slug === slug) ?? trainerProfiles[0];
}
