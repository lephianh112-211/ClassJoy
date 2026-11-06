const AVAILABLE_CARD_FRAMES = [
  "1.jpg",
  "2.jpg",
  "3.jpg",
  "4.jpg",
  "5.jpg",
  "6.jpg",
  "7.jpg",
  "8.jpg",
  "9.jpg",
  "10.jpg",
  "11.jpg",
  "12.jpg",
  "13.jpg",
  "14.jpg",
  "15.jpg",
  "16.jpg",
  "17.jpg",
  "18.jpg",
  "19.jpg",
  "20.jpg",
  "21.jpg",
  "22.jpg",
  "23.jpg",
  "24.jpg"
];

const STUDENT_AVATAR_POOL = [
  "🦖", "🦄", "🦊", "🐼", "🦁", "🐰", "🦉", "🐯", "🐲", "🦋",
  "🦅", "🐱", "🐬", "🐨", "🐶", "🐧", "🦒", "🦔", "🐝", "🐙",
  "🐢", "🦩", "🦚", "🦭", "🦘", "🐹", "🦦", "🐿️", "🐳", "🦌",
  "🚀", "🌟", "🎨", "⚽", "🎸", "👑", "🧙‍♂️", "🦸‍♀️", "🤖", "🌈"
];

const CARD_ICON_POOL = [
  "⚡", "🤝", "🎯", "⭐", "📈", "🎁", "✨", "🎨", "🎧", "💌",
  "🏆", "📚", "🧹", "📝", "💡", "🎤", "💬", "🧘", "🛡️", "👑",
  "🍫", "🏖️", "🎭", "🌈", "🔥", "🚀", "💎", "🎲", "🔔", "⏳"
];

const CARD_CATEGORIES = {
  power: [
    "Nhóm Trợ giúp học tập",
    "Nhóm Chiến lược",
    "Nhóm Tương tác"
  ],
  penalty: [
    "Nhóm Hỗ trợ giáo viên",
    "Nhóm Phát triển Bản thân",
    "Nhóm Kỹ năng Xã hội"
  ]
};

// ============================================================================
// DỮ LIỆU MẶC ĐỊNH & KHUNG CẤU TRÚC THẺ (POWER CARD, CHALLENGE CARD, GROUPS & RANKING)
// ============================================================================

const DEFAULT_DATA = {
  teacherAccount: {
    username: "giaovien",
    password: "123",
    name: "Cô Nguyễn Minh Anh",
    school: "THPT Chu Văn An",
    subject: "Toán - Tin"
  },

  isPointsHidden: false,

  // Bảng đối chiếu mốc điểm Point Line (Dùng để đối chiếu mốc nhận Power Card)
  pointLineMilestones: [
    { id: "ms-10", threshold: 10, rewardTitle: "Rút 1 Thẻ Power Card", icon: "⚡" },
    { id: "ms-20", threshold: 20, rewardTitle: "Rút 1 Thẻ Power Card", icon: "⚡" },
    { id: "ms-30", threshold: 30, rewardTitle: "Rút 1 Thẻ Power Card + Quà KitKat", icon: "🍫" },
    { id: "ms-40", threshold: 40, rewardTitle: "Rút 1 Thẻ Power Card VIP", icon: "🌟" },
    { id: "ms-50", threshold: 50, rewardTitle: "Đặc quyền Miễn kiểm tra tuần", icon: "👑" },
    { id: "ms-60", threshold: 60, rewardTitle: "Rút 1 Thẻ Power Card", icon: "⚡" },
    { id: "ms-70", threshold: 70, rewardTitle: "Rút 1 Thẻ Power Card", icon: "⚡" },
    { id: "ms-80", threshold: 80, rewardTitle: "Rút 1 Thẻ Power Card VIP", icon: "🌟" },
    { id: "ms-90", threshold: 90, rewardTitle: "Rút 1 Thẻ Power Card VIP", icon: "🌟" },
    { id: "ms-100", threshold: 100, rewardTitle: "Danh hiệu Đại Bàng Lớp Học", icon: "🏆" }
  ],

  // Tiêu chí cộng / trừ điểm nhanh kiểu ClassDojo
  pointBehaviors: {
    positive: [
      { id: "pos-1", title: "Hăng hái phát biểu", points: 2, icon: "🙋‍♂️", color: "emerald" },
      { id: "pos-2", title: "Làm bài tập xuất sắc", points: 3, icon: "🌟", color: "amber" },
      { id: "pos-3", title: "Hỗ trợ bạn học", points: 2, icon: "🤝", color: "blue" },
      { id: "pos-4", title: "Hoạt động nhóm tốt", points: 2, icon: "🚀", color: "indigo" },
      { id: "pos-5", title: "Sáng tạo trong giờ", points: 5, icon: "💡", color: "purple" }
    ],
    negative: [
      { id: "neg-1", title: "Nói chuyện riêng", points: -1, icon: "🤫", color: "rose" },
      { id: "neg-2", title: "Thiếu bài tập về nhà", points: -2, icon: "📓", color: "red" },
      { id: "neg-3", title: "Đi học muộn", points: -1, icon: "⏰", color: "orange" },
      { id: "neg-4", title: "Mất tập trung", points: -1, icon: "😴", color: "slate" }
    ]
  },

  // Bộ 13 thẻ Power Card mẫu từ Mau_The_PowerCard_ClassJoy-2.xlsx
  powerCards: [
        {
            "id": "pc-1",
            "cardFrame": "1.jpg",
            "code": "PWR-01",
            "title": "Priority Speaking Card",
            "category": "Nhóm Trợ giúp học tập",
            "rarity": "SR",
            "icon": "🙋",
            "gradient": "from-amber-400 via-orange-500 to-red-500",
            "description": "Ưu tiên được trả lời câu hỏi khi có nhiều bạn cùng cạnh tranh",
            "usageRule": "Sử dụng trước khi giáo viên chọn người trả lời câu hỏi.",
            "pdfUrl": "",
            "pdfPage": 1
        },
        {
            "id": "pc-2",
            "cardFrame": "2.jpg",
            "code": "PWR-02",
            "title": "Teamwork Booster",
            "category": "Nhóm Trợ giúp học tập",
            "rarity": "SSR",
            "icon": "🤝",
            "gradient": "from-cyan-400 via-blue-500 to-indigo-600",
            "description": "Có quyền gọi một bạn lên hỗ trợ, gợi ý cho nhiệm vụ cá nhân (nếu bạn đó đồng ý)",
            "usageRule": "Gọi trợ giúp khi gặp câu hỏi khó, nộp thẻ sau khi dùng.",
            "pdfUrl": "",
            "pdfPage": 2
        },
        {
            "id": "pc-3",
            "cardFrame": "3.jpg",
            "code": "PWR-03",
            "title": "Drop 1",
            "category": "Nhóm Trợ giúp học tập",
            "rarity": "SR",
            "icon": "🎯",
            "gradient": "from-emerald-400 via-teal-500 to-cyan-600",
            "description": "Được loại bỏ 1 đáp án sai trong một câu hỏi trắc nghiệm.",
            "usageRule": "Dùng khi làm bài tập hoặc kiểm tra trắc nghiệm trên lớp.",
            "pdfUrl": "",
            "pdfPage": 3
        },
        {
            "id": "pc-4",
            "cardFrame": "4.jpg",
            "code": "PWR-04",
            "title": "Star of Hope",
            "category": "Nhóm Chiến lược",
            "rarity": "UR",
            "icon": "⭐",
            "gradient": "from-yellow-400 via-amber-500 to-orange-600",
            "description": "Được tặng 4 điểm nếu trả lời đúng một câu hỏi khó, thẻ mất hiệu lực nếu trả lời sai",
            "usageRule": "Kích hoạt Ngôi Sao Hy Vọng trước khi trả lời câu hỏi khó.",
            "pdfUrl": "",
            "pdfPage": 4
        },
        {
            "id": "pc-5",
            "cardFrame": "5.jpg",
            "code": "PWR-05",
            "title": "Long-term Investment",
            "category": "Nhóm Chiến lược",
            "rarity": "SSR",
            "icon": "📈",
            "gradient": "from-blue-500 via-indigo-600 to-purple-700",
            "description": "Bí mật dự đoán một bạn sẽ được cộng điểm nhiều hơn trong tuần tới so với tuần trước. Nếu đúng sẽ được cộng 5 điểm. Nếu sai thì thẻ mất hiệu lực",
            "usageRule": "Ghi tên bạn dự đoán gửi giáo viên đầu tuần.",
            "pdfUrl": "",
            "pdfPage": 5
        },
        {
            "id": "pc-6",
            "cardFrame": "6.jpg",
            "code": "PWR-06",
            "title": "Peer Bonus",
            "category": "Nhóm Tương tác",
            "rarity": "SR",
            "icon": "🎁",
            "gradient": "from-pink-500 via-rose-500 to-red-600",
            "description": "Tặng 2 điểm cộng cho hai bạn đã giúp đỡ/có ý kiến nhận xét hay với mình.",
            "usageRule": "Báo với giáo viên tên hai người nhận điểm sau giờ học.",
            "pdfUrl": "",
            "pdfPage": 6
        },
        {
            "id": "pc-7",
            "cardFrame": "7.jpg",
            "code": "PWR-07",
            "title": "Power Shutdown",
            "category": "Nhóm Chiến lược",
            "rarity": "UR",
            "icon": "⚡",
            "gradient": "from-slate-700 via-zinc-800 to-neutral-900",
            "description": "Được lựa chọn 1 ngày để vô hiệu hóa tất cả các thẻ Power cards khác",
            "usageRule": "Nộp thẻ bí mật cho giáo viên trước khi buổi học bắt đầu.",
            "pdfUrl": "",
            "pdfPage": 7
        },
        {
            "id": "pc-8",
            "cardFrame": "8.jpg",
            "code": "PWR-08",
            "title": "Power Boost",
            "category": "Nhóm Chiến lược",
            "rarity": "UR",
            "icon": "✨",
            "gradient": "from-violet-500 via-purple-600 to-fuchsia-600",
            "description": "Nhân đôi hiệu lực của một thẻ Power Card khác mà học sinh đang sở hữu.",
            "usageRule": "Kích hoạt cùng lúc với thẻ Power Card muốn nhân đôi.",
            "pdfUrl": "",
            "pdfPage": 8
        },
        {
            "id": "pc-9",
            "cardFrame": "9.jpg",
            "code": "PWR-09",
            "title": "Game Designer",
            "category": "Nhóm Chiến lược",
            "rarity": "UR",
            "icon": "🎨",
            "gradient": "from-fuchsia-500 via-purple-600 to-pink-600",
            "description": "Được quyền tự thiết kế 1 thẻ mới (Power hoặc Challenge) với sự đồng ý của giáo viên.",
            "usageRule": "Đề xuất nội dung thẻ mới cho giáo viên duyệt đưa vào hệ thống.",
            "pdfUrl": "",
            "pdfPage": 9
        },
        {
            "id": "pc-10",
            "cardFrame": "10.jpg",
            "code": "PWR-10",
            "title": "Classroom DJ",
            "category": "Nhóm Tương tác",
            "rarity": "SSR",
            "icon": "🎧",
            "gradient": "from-teal-400 via-emerald-500 to-green-600",
            "description": "Được quyền bật 1 bài hát nhẹ nhàng đã qua duyệt cho cả lớp nghe trong giờ giải lao hoặc tự học.",
            "usageRule": "Gửi link bài hát cho giáo viên duyệt trước giờ giải lao/tự học.",
            "pdfUrl": "",
            "pdfPage": 10
        },
        {
            "id": "pc-11",
            "cardFrame": "11.jpg",
            "code": "PWR-11",
            "title": "Secret Whisper",
            "category": "Nhóm Tương tác",
            "rarity": "SR",
            "icon": "💌",
            "gradient": "from-rose-400 via-pink-500 to-purple-500",
            "description": "Gửi một tâm tư, lời nhắn qua giáo viên đến một bạn trong lớp.",
            "usageRule": "Viết thư hoặc lời nhắn nhờ giáo viên gửi ẩn danh hoặc công khai.",
            "pdfUrl": "",
            "pdfPage": 11
        },
        {
            "id": "pc-12",
            "cardFrame": "12.jpg",
            "code": "PWR-12",
            "title": "Priority Choice",
            "category": "Nhóm Chiến lược",
            "rarity": "SR",
            "icon": "🏆",
            "gradient": "from-amber-400 via-yellow-500 to-orange-500",
            "description": "Ưu tiên chọn vị trí hoặc thứ tự trong hoạt động nhóm.",
            "usageRule": "Dùng trước khi giáo viên bốc thăm hoặc chia thứ tự nhóm.",
            "pdfUrl": "",
            "pdfPage": 12
        },
        {
            "id": "pc-13",
            "cardFrame": "13.jpg",
            "code": "PWR-13",
            "title": "Seat Selection",
            "category": "Nhóm Tương tác",
            "rarity": "SSR",
            "icon": "🪑",
            "gradient": "from-indigo-400 via-sky-500 to-teal-500",
            "description": "Được chọn một chỗ ngồi còn trống bất kỳ hoặc đổi chỗ với một bạn khác nếu bạn đó đồng ý",
            "usageRule": "Thông báo với giáo viên vào đầu buổi học để đổi chỗ ngồi.",
            "pdfUrl": "",
            "pdfPage": 13
        },
        {
            "id": "pc-14",
            "cardFrame": "6.jpg",
            "code": "PWR-14",
            "title": "Sweet Surprise",
            "category": "Nhóm Tương tác",
            "rarity": "SR",
            "icon": "🎁",
            "gradient": "from-pink-400 via-rose-500 to-amber-500",
            "description": "Được chọn một món quà nhỏ từ giáo viên (một thanh KitKat, một móc khóa,...)",
            "usageRule": "Đến gặp giáo viên sau tiết học để nhận món quà nhỏ em yêu thích.",
            "pdfUrl": "",
            "pdfPage": 14
        },
        {
            "id": "pc-15",
            "cardFrame": "14.jpg",
            "code": "PWR-15",
            "title": "Pick Your Battle",
            "category": "Nhóm Trợ giúp học tập",
            "rarity": "SR",
            "icon": "🎯",
            "gradient": "from-sky-400 via-blue-500 to-indigo-600",
            "description": "Khi lên bảng chữa bài (không tính kiểm tra bài cũ hay kiểm tra), được tự chọn 1 câu mình thích nhất trong danh sách câu hỏi của giáo viên.",
            "usageRule": "Sử dụng khi được giáo viên gọi lên bảng chữa bài tập.",
            "pdfUrl": "",
            "pdfPage": 15
        },
        {
            "id": "pc-16",
            "cardFrame": "15.jpg",
            "code": "PWR-16",
            "title": "Penalty Shield",
            "category": "Nhóm Chiến lược",
            "rarity": "SSR",
            "icon": "🛡️",
            "gradient": "from-emerald-400 via-teal-500 to-cyan-600",
            "description": "Khi đội chơi thua trong một hoạt động học tập nào đó thì có thể không bị trừ điểm hay chịu hình phạt chung với đội.",
            "usageRule": "Kích hoạt ngay sau khi có kết quả hoạt động nhóm để miễn phạt cho bản thân.",
            "pdfUrl": "",
            "pdfPage": 16
        },
        {
            "id": "pc-17",
            "cardFrame": "16.jpg",
            "code": "PWR-17",
            "title": "Mystery Box",
            "category": "Nhóm Chiến lược",
            "rarity": "SSR",
            "icon": "🎲",
            "gradient": "from-amber-400 via-orange-500 to-rose-500",
            "description": "Đổi thẻ này để bốc ngẫu nhiên 2 thẻ mới trong bộ bài, sau đó được chọn giữ lại 1 thẻ mình thích.",
            "usageRule": "Báo giáo viên để quay 2 thẻ ngẫu nhiên và chọn lấy 1 thẻ.",
            "pdfUrl": "",
            "pdfPage": 17
        },
        {
            "id": "pc-18",
            "cardFrame": "17.jpg",
            "code": "PWR-18",
            "title": "Lucky Link",
            "category": "Nhóm Chiến lược",
            "rarity": "SSR",
            "icon": "🍀",
            "gradient": "from-lime-400 via-emerald-500 to-green-600",
            "description": "Đầu tiết học chọn ghép cặp với 1 bạn; nếu trong tiết đó bạn ấy được cộng điểm thì mình cũng được cộng 1 điểm (tối đa được cộng 2 điểm).",
            "usageRule": "Báo tên bạn ghép cặp với giáo viên vào đầu tiết học.",
            "pdfUrl": "",
            "pdfPage": 18
        },
        {
            "id": "pc-19",
            "cardFrame": "18.jpg",
            "code": "PWR-19",
            "title": "Freeze Name",
            "category": "Nhóm Chiến lược",
            "rarity": "SR",
            "icon": "❄️",
            "gradient": "from-cyan-400 via-sky-500 to-blue-600",
            "description": "Được quyền tạm ẩn tên mình khỏi Vòng Quay Gọi Tên Ngẫu Nhiên trong suốt 1 lượt.",
            "usageRule": "Sử dụng trước khi giáo viên bấm Vòng Quay Gọi Tên Ngẫu Nhiên.",
            "pdfUrl": "",
            "pdfPage": 19
        },
        {
            "id": "pc-20",
            "cardFrame": "19.jpg",
            "code": "PWR-20",
            "title": "Mirror Card",
            "category": "Nhóm Chiến lược",
            "rarity": "UR",
            "icon": "🪞",
            "gradient": "from-violet-500 via-purple-600 to-indigo-700",
            "description": "Được sao chép và dùng lại đúng công dụng của 1 thẻ Power Card mà một bạn khác vừa sử dụng trong tiết học đó.",
            "usageRule": "Kích hoạt ngay trong tiết học khi có một bạn khác vừa dùng thẻ Power Card.",
            "pdfUrl": "",
            "pdfPage": 20
        },
        {
            "id": "pc-21",
            "cardFrame": "20.jpg",
            "code": "PWR-21",
            "title": "Custom Title",
            "category": "Nhóm Tương tác",
            "rarity": "SSR",
            "icon": "👑",
            "gradient": "from-yellow-400 via-amber-500 to-orange-600",
            "description": "Được gắn thêm một biệt danh ngầu (VD: Chiến Thần Toán Học, Trùm Phát Biểu...) bên cạnh tên mình trên màn hình ClassJoy trong 1 tuần.",
            "usageRule": "Đề xuất biệt danh với giáo viên để cập nhật lên màn hình lớp học trong 1 tuần.",
            "pdfUrl": "",
            "pdfPage": 21
        }
    ],

  // Bộ 8 THẺ THỬ THÁCH (CHALLENGE CARDS) mẫu từ Mau_The_ChallengeCard_ClassJoy.xlsx
  penaltyCards: [
        {
            "id": "pen-1",
            "cardFrame": "14.jpg",
            "code": "CHL-01",
            "title": "Homework Collector",
            "category": "Nhóm Hỗ trợ giáo viên",
            "icon": "📚",
            "gradient": "from-amber-500 via-orange-600 to-yellow-600",
            "description": "Giúp thầy cô thu gom bài tập hoặc vở.",
            "usageRule": "Thu và kiểm đếm đủ vở/bài tập của các bạn nộp cho giáo viên.",
            "pdfUrl": "",
            "pdfPage": 1
        },
        {
            "id": "pen-2",
            "cardFrame": "15.jpg",
            "code": "CHL-02",
            "title": "Board Cleaner",
            "category": "Nhóm Hỗ trợ giáo viên",
            "icon": "🧹",
            "gradient": "from-emerald-500 via-teal-600 to-cyan-600",
            "description": "Giúp thầy cô xóa bảng trong tiết này (trừ đầu giờ và cuối giờ).",
            "usageRule": "Chủ động lau sạch bảng khi thầy cô viết hết bảng giữa tiết.",
            "pdfUrl": "",
            "pdfPage": 2
        },
        {
            "id": "pen-3",
            "cardFrame": "16.jpg",
            "code": "CHL-03",
            "title": "Homework Challenger",
            "category": "Nhóm Phát triển Bản thân",
            "icon": "📝",
            "gradient": "from-blue-500 via-indigo-600 to-violet-700",
            "description": "Em sẽ làm thêm bài tập về nhà để trở nên giỏi hơn.",
            "usageRule": "Nhận thêm 1 bài tập rèn luyện từ giáo viên và hoàn thành vào buổi sau.",
            "pdfUrl": "",
            "pdfPage": 3
        },
        {
            "id": "pen-4",
            "cardFrame": "17.jpg",
            "code": "CHL-04",
            "title": "Knowledge Connector",
            "category": "Nhóm Phát triển Bản thân",
            "icon": "💡",
            "gradient": "from-amber-400 via-yellow-500 to-emerald-500",
            "description": "Trình bày một kiến thức hoặc một ví dụ thú vị để cả lớp có thể hiểu",
            "usageRule": "Chuẩn bị ví dụ ngắn 1 phút chia sẻ trước lớp vào cuối tiết hoặc tiết sau.",
            "pdfUrl": "",
            "pdfPage": 4
        },
        {
            "id": "pen-5",
            "cardFrame": "18.jpg",
            "code": "CHL-05",
            "title": "The Summary Speaker",
            "category": "Nhóm Phát triển Bản thân",
            "icon": "🎤",
            "gradient": "from-violet-500 via-purple-600 to-indigo-600",
            "description": "Lắng nghe và tổng hợp lại ý chính phần trình bày của nhóm bạn.",
            "usageRule": "Tóm tắt lại 2-3 ý nổi bật của nhóm bạn sau phần thuyết trình.",
            "pdfUrl": "",
            "pdfPage": 5
        },
        {
            "id": "pen-6",
            "cardFrame": "19.jpg",
            "code": "CHL-06",
            "title": "Hey My Friend",
            "category": "Nhóm Kỹ năng Xã hội",
            "icon": "💬",
            "gradient": "from-rose-500 via-pink-600 to-fuchsia-600",
            "description": "Nói/viết thư để gửi lời khen ngợi chân thành đến một bạn trong lớp.",
            "usageRule": "Nói trực tiếp hoặc gửi mảnh giấy khen ngợi bạn trước lớp.",
            "pdfUrl": "",
            "pdfPage": 6
        },
        {
            "id": "pen-7",
            "cardFrame": "20.jpg",
            "code": "CHL-07",
            "title": "Quick Drawing",
            "category": "Nhóm Kỹ năng Xã hội",
            "icon": "🎨",
            "gradient": "from-cyan-500 via-sky-600 to-blue-700",
            "description": "Vẽ đồ vật chuyên dùng của một nghề nghiệp trong 5 giây để lớp đoán.",
            "usageRule": "Lên bảng vẽ phác thảo đồ vật nhanh trong 5 giây cho cả lớp đoán tên nghề.",
            "pdfUrl": "",
            "pdfPage": 7
        },
        {
            "id": "pen-8",
            "cardFrame": "21.jpg",
            "code": "CHL-08",
            "title": "The Reset Routine",
            "category": "Nhóm Kỹ năng Xã hội",
            "icon": "🧘",
            "gradient": "from-emerald-400 via-teal-500 to-green-600",
            "description": "Dẫn dắt cả lớp vươn vai, hít thở hoặc thả lỏng cơ thể 60 giây giữa giờ.",
            "usageRule": "Đứng trước lớp hô nhịp vươn vai thư giãn 60 giây giữa tiết học.",
            "pdfUrl": "",
            "pdfPage": 8
        },
        {
            "id": "pen-9",
            "cardFrame": "22.jpg",
            "code": "CHL-09",
            "title": "Home Helper",
            "category": "Nhóm Phát triển Bản thân",
            "icon": "🏠",
            "gradient": "from-blue-400 via-indigo-500 to-teal-500",
            "description": "Quay lại một video 3-5 phút mình làm việc nhà (có sự xác nhận của phụ huynh) để gửi cho giáo viên.",
            "usageRule": "Quay video làm việc nhà 3-5 phút và gửi link/video cho giáo viên trước buổi học tiếp theo.",
            "pdfUrl": "",
            "pdfPage": 9
        },
        {
            "id": "pen-10",
            "cardFrame": "23.jpg",
            "code": "CHL-10",
            "title": "Tidy Corner",
            "category": "Nhóm Phát triển Bản thân",
            "icon": "🧹",
            "gradient": "from-emerald-400 via-teal-500 to-cyan-600",
            "description": "Dọn dẹp lại bàn học của mình ở nhà thật gọn gàng, chụp ảnh sau khi dọn gửi cho giáo viên (có sự xác nhận của phụ huynh).",
            "usageRule": "Chụp ảnh góc học tập sau khi dọn gọn gàng kèm xác nhận của phụ huynh gửi giáo viên.",
            "pdfUrl": "",
            "pdfPage": 10
        },
        {
            "id": "pen-11",
            "cardFrame": "24.jpg",
            "code": "CHL-11",
            "title": "Bookworm Share",
            "category": "Nhóm Phát triển Bản thân",
            "icon": "📖",
            "gradient": "from-amber-400 via-orange-500 to-rose-500",
            "description": "Đọc 5 trang của một cuốn sách bất kỳ ngoài sách giáo khoa và kể lại 1 điều tâm đắc nhất trong 1 phút trước lớp.",
            "usageRule": "Chia sẻ ngắn gọn điều tâm đắc từ 5 trang sách đã đọc trong 1 phút trước lớp.",
            "pdfUrl": "",
            "pdfPage": 11
        },
        {
            "id": "pen-12",
            "cardFrame": "1.jpg",
            "code": "CHL-12",
            "title": "Weekly Goal",
            "category": "Nhóm Phát triển Bản thân",
            "icon": "🎯",
            "gradient": "from-violet-500 via-purple-600 to-fuchsia-600",
            "description": "Viết ra giấy 1 mục tiêu học tập cụ thể trong tuần này, gửi cho giáo viên và báo cáo kết quả cho giáo viên vào cuối tuần.",
            "usageRule": "Nộp mục tiêu đầu tuần và báo cáo kết quả thực hiện cho giáo viên vào cuối tuần.",
            "pdfUrl": "",
            "pdfPage": 12
        }
    ],

  // Danh sách các lớp học và học sinh giả lập (Kèm lịch sử điểm Tuần/Tháng để xem Ranking)
  classes: [
    {
      id: "class-10a1",
      name: "Lớp 10A1 - Chuyên Toán Tin",
      grade: "Khối 10",
      room: "Phòng 302 - Nhà A",
      groupsList: ["Nhóm 1", "Nhóm 2", "Nhóm 3", "Nhóm 4"],
      students: [
        {
          id: "st-1",
          code: "10A1-01",
          username: "10a1-01",
          password: "123456",
          name: "Nguyễn Hoàng Bách",
          group: "Nhóm 1",
          avatar: "🦖",
          avatarBg: "bg-emerald-100",
          points: 24,
          speechCount: 5,
          ownedCards: [
            {
              instanceId: "inst-101",
              cardId: "pc-1",
              type: "power",
              status: "unused",
              acquiredAt: "28/10/2026 09:15",
              usedAt: null,
              note: "Đạt mốc 10 điểm thưởng"
            },
            {
              instanceId: "inst-102",
              cardId: "pc-3",
              type: "power",
              status: "used",
              acquiredAt: "20/10/2026 10:00",
              usedAt: "25/10/2026 08:30",
              note: "Đã đổi 1 thanh KitKat trên lớp"
            }
          ],
          history: [
            { time: "01/11 08:15", daysAgo: 0, text: "+2đ: Hăng hái phát biểu", delta: 2 },
            { time: "30/10 09:20", daysAgo: 2, text: "+5đ: Sáng tạo trong giờ", delta: 5 },
            { time: "28/10 09:15", daysAgo: 4, text: "+3đ: Làm bài tập xuất sắc", delta: 3 },
            { time: "18/10 10:00", daysAgo: 14, text: "+6đ: Điểm thưởng giữa tháng", delta: 6 }
          ]
        },
        {
          id: "st-2",
          code: "10A1-02",
          username: "10a1-02",
          password: "123456",
          name: "Trần Lê Bảo Ngọc",
          group: "Nhóm 1",
          avatar: "🦄",
          avatarBg: "bg-fuchsia-100",
          points: 32,
          speechCount: 8,
          ownedCards: [
            {
              instanceId: "inst-103",
              cardId: "pc-2",
              type: "power",
              status: "unused",
              acquiredAt: "30/10/2026 14:20",
              usedAt: null,
              note: "Đạt mốc 30 điểm thưởng"
            },
            {
              instanceId: "inst-104",
              cardId: "pc-1",
              type: "power",
              status: "unused",
              acquiredAt: "31/10/2026 10:05",
              usedAt: null,
              note: "Đạt mốc 20 điểm thưởng"
            }
          ],
          history: [
            { time: "01/11 08:20", daysAgo: 0, text: "+3đ: Làm bài tập xuất sắc", delta: 3 },
            { time: "31/10 10:05", daysAgo: 1, text: "+5đ: Giải bài toán khó", delta: 5 },
            { time: "29/10 08:40", daysAgo: 3, text: "+4đ: Hỗ trợ bạn học", delta: 4 },
            { time: "15/10 09:10", daysAgo: 17, text: "+8đ: Thi đua đầu tháng", delta: 8 }
          ]
        },
        {
          id: "st-3",
          code: "10A1-03",
          username: "10a1-03",
          password: "123456",
          name: "Lê Minh Khôi",
          group: "Nhóm 1",
          avatar: "🦊",
          avatarBg: "bg-orange-100",
          points: 9,
          speechCount: 2,
          ownedCards: [
            {
              instanceId: "inst-105",
              cardId: "pen-1",
              type: "penalty",
              status: "unused",
              acquiredAt: "31/10/2026 09:40",
              usedAt: null,
              note: "Nhận Challenge Card: Thử thách Truth or Dare"
            },
            {
              instanceId: "inst-106",
              cardId: "pc-2",
              type: "power",
              status: "used",
              acquiredAt: "15/10/2026 08:00",
              usedAt: "18/10/2026 07:45",
              note: "Đã dùng để hoãn bài tập Đại số"
            }
          ],
          history: [
            { time: "31/10 09:40", daysAgo: 1, text: "-1đ: Nói chuyện riêng", delta: -1 },
            { time: "29/10 10:15", daysAgo: 3, text: "+3đ: Phát biểu xây dựng bài", delta: 3 },
            { time: "18/10 07:45", daysAgo: 14, text: "+4đ: Hoàn thành bài tập", delta: 4 }
          ]
        },
        {
          id: "st-4",
          code: "10A1-04",
          username: "10a1-04",
          password: "123456",
          name: "Phạm Gia Hân",
          group: "Nhóm 2",
          avatar: "🐼",
          avatarBg: "bg-sky-100",
          points: 18,
          speechCount: 4,
          ownedCards: [
            {
              instanceId: "inst-107",
              cardId: "pc-3",
              type: "power",
              status: "unused",
              acquiredAt: "29/10/2026 11:10",
              usedAt: null,
              note: "Đạt mốc 10 điểm thưởng"
            }
          ],
          history: [
            { time: "31/10 11:10", daysAgo: 1, text: "+4đ: Hoạt động nhóm tốt", delta: 4 },
            { time: "28/10 10:20", daysAgo: 4, text: "+2đ: Hăng hái phát biểu", delta: 2 },
            { time: "14/10 08:30", daysAgo: 18, text: "+5đ: Điểm thưởng tháng", delta: 5 }
          ]
        },
        {
          id: "st-5",
          code: "10A1-05",
          username: "10a1-05",
          password: "123456",
          name: "Vũ Đức Duy",
          group: "Nhóm 2",
          avatar: "🦁",
          avatarBg: "bg-amber-100",
          points: 14,
          speechCount: 3,
          ownedCards: [
            {
              instanceId: "inst-108",
              cardId: "pen-3",
              type: "penalty",
              status: "used",
              acquiredAt: "22/10/2026 10:30",
              usedAt: "22/10/2026 11:35",
              note: "Đã hoàn thành Challenge Card Biệt đội Sạch Đẹp"
            }
          ],
          history: [
            { time: "30/10 09:00", daysAgo: 2, text: "+3đ: Làm bài tập xuất sắc", delta: 3 },
            { time: "22/10 11:35", daysAgo: 10, text: "+4đ: Hoàn thành thử thách nhóm", delta: 4 }
          ]
        },
        {
          id: "st-6",
          code: "10A1-06",
          username: "10a1-06",
          password: "123456",
          name: "Đỗ Phương Linh",
          group: "Nhóm 2",
          avatar: "🐰",
          avatarBg: "bg-pink-100",
          points: 27,
          speechCount: 6,
          ownedCards: [
            {
              instanceId: "inst-109",
              cardId: "pc-1",
              type: "power",
              status: "used",
              acquiredAt: "12/10/2026 08:15",
              usedAt: "19/10/2026 08:05",
              note: "Đã dùng hoãn kiểm tra miệng bài Hàm số"
            },
            {
              instanceId: "inst-110",
              cardId: "pc-2",
              type: "power",
              status: "unused",
              acquiredAt: "30/10/2026 09:00",
              usedAt: null,
              note: "Đạt mốc 20 điểm thưởng"
            }
          ],
          history: [
            { time: "01/11 09:00", daysAgo: 0, text: "+5đ: Giải nhất mini-game", delta: 5 },
            { time: "29/10 08:15", daysAgo: 3, text: "+4đ: Phát biểu xuất sắc", delta: 4 },
            { time: "16/10 10:00", daysAgo: 16, text: "+7đ: Điểm thưởng giữa tháng", delta: 7 }
          ]
        },
        {
          id: "st-7",
          code: "10A1-07",
          username: "10a1-07",
          password: "123456",
          name: "Hoàng Tuấn Kiệt",
          group: "Nhóm 3",
          avatar: "🐲",
          avatarBg: "bg-teal-100",
          points: 11,
          speechCount: 2,
          ownedCards: [],
          history: [
            { time: "28/10 08:00", daysAgo: 4, text: "+2đ: Hỗ trợ bạn học", delta: 2 },
            { time: "19/10 09:30", daysAgo: 13, text: "+3đ: Hăng hái phát biểu", delta: 3 }
          ]
        },
        {
          id: "st-8",
          code: "10A1-08",
          username: "10a1-08",
          password: "123456",
          name: "Ngô Khánh Vy",
          group: "Nhóm 3",
          avatar: "🦋",
          avatarBg: "bg-purple-100",
          points: 21,
          speechCount: 5,
          ownedCards: [
            {
              instanceId: "inst-111",
              cardId: "pc-3",
              type: "power",
              status: "unused",
              acquiredAt: "27/10/2026 15:00",
              usedAt: null,
              note: "Đạt mốc 20 điểm thưởng"
            }
          ],
          history: [
            { time: "31/10 14:00", daysAgo: 1, text: "+5đ: Sáng tạo trong giờ", delta: 5 },
            { time: "27/10 15:00", daysAgo: 5, text: "+3đ: Làm bài tập xuất sắc", delta: 3 },
            { time: "12/10 08:00", daysAgo: 20, text: "+5đ: Điểm thưởng tháng", delta: 5 }
          ]
        },
        {
          id: "st-9",
          code: "10A1-09",
          username: "10a1-09",
          password: "123456",
          name: "Bùi Quang Minh",
          group: "Nhóm 3",
          avatar: "🐯",
          avatarBg: "bg-yellow-100",
          points: 7,
          speechCount: 1,
          ownedCards: [
            {
              instanceId: "inst-112",
              cardId: "pen-2",
              type: "penalty",
              status: "unused",
              acquiredAt: "01/11/2026 07:50",
              usedAt: null,
              note: "Nhận Challenge Card: Thử thách Tập trung"
            }
          ],
          history: [
            { time: "30/10 08:10", daysAgo: 2, text: "+2đ: Phát biểu bài mới", delta: 2 },
            { time: "20/10 09:00", daysAgo: 12, text: "+2đ: Hỗ trợ bạn học", delta: 2 }
          ]
        },
        {
          id: "st-10",
          code: "10A1-10",
          username: "10a1-10",
          password: "123456",
          name: "Đặng Thảo Tiên",
          group: "Nhóm 4",
          avatar: "🦉",
          avatarBg: "bg-indigo-100",
          points: 19,
          speechCount: 4,
          ownedCards: [],
          history: [
            { time: "31/10 09:30", daysAgo: 1, text: "+4đ: Làm bài tập xuất sắc", delta: 4 },
            { time: "28/10 11:00", daysAgo: 4, text: "+3đ: Hoạt động nhóm tốt", delta: 3 },
            { time: "15/10 10:20", daysAgo: 17, text: "+5đ: Điểm thưởng giữa tháng", delta: 5 }
          ]
        }
      ]
    },
    {
      id: "class-11b2",
      name: "Lớp 11B2 - Khoa Học Tự Nhiên",
      grade: "Khối 11",
      room: "Phòng 205 - Nhà B",
      groupsList: ["Nhóm 1", "Nhóm 2"],
      students: [
        {
          id: "st-201",
          code: "11B2-01",
          username: "11b2-01",
          password: "123456",
          name: "Trịnh Nam Phong",
          group: "Nhóm 1",
          avatar: "🦅",
          avatarBg: "bg-blue-100",
          points: 16,
          speechCount: 3,
          ownedCards: [
            {
              instanceId: "inst-201",
              cardId: "pc-1",
              type: "power",
              status: "unused",
              acquiredAt: "29/10/2026 10:00",
              usedAt: null,
              note: "Đạt mốc 10 điểm"
            }
          ],
          history: [
            { time: "30/10 10:00", daysAgo: 2, text: "+4đ: Phát biểu tốt", delta: 4 }
          ]
        },
        {
          id: "st-202",
          code: "11B2-02",
          username: "11b2-02",
          password: "123456",
          name: "Lương Mai Anh",
          group: "Nhóm 2",
          avatar: "🐱",
          avatarBg: "bg-rose-100",
          points: 25,
          speechCount: 6,
          ownedCards: [
            {
              instanceId: "inst-202",
              cardId: "pc-3",
              type: "power",
              status: "used",
              acquiredAt: "20/10/2026 09:00",
              usedAt: "24/10/2026 09:15",
              note: "Đã đổi móc khóa lớp học"
            }
          ],
          history: [
            { time: "31/10 09:15", daysAgo: 1, text: "+6đ: Điểm thưởng tuần", delta: 6 }
          ]
        }
      ]
    }
  ],

  speechQueue: [
    {
      id: "sq-1",
      studentId: "st-1",
      studentName: "Nguyễn Hoàng Bách",
      studentAvatar: "🦖",
      topic: "Giải bài tập phương trình bậc 2 câu a",
      addedAt: "13:45",
      done: false
    },
    {
      id: "sq-2",
      studentId: "st-2",
      studentName: "Trần Lê Bảo Ngọc",
      studentAvatar: "🦄",
      topic: "Nhận xét cách giải của bạn Bách",
      addedAt: "13:46",
      done: false
    }
  ]
};
