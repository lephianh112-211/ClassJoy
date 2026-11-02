const AVAILABLE_CARD_FRAMES = [
  "Card/1.jpg",
  "Card/2.jpg",
  "Card/3.jpg",
  "Card/4.jpg",
  "Card/5.jpg",
  "Card/6.jpg",
  "Card/7.jpg",
  "Card/8.jpg",
  "Card/9.jpg",
  "Card/10.jpg",
  "Card/11.jpg",
  "Card/12.jpg",
  "Card/13.jpg",
  "Card/14.jpg",
  "Card/15.jpg",
  "Card/16.jpg",
  "Card/17.jpg",
  "Card/18.jpg",
  "Card/19.jpg",
  "Card/20.jpg",
  "Card/21.jpg",
  "Card/22.jpg",
  "Card/23.jpg",
  "Card/24.jpg"
];

// ============================================================================
// DỮ LIỆU MẶC ĐỊNH & KHUNG CẤU TRÚC THẺ (POWER CARD, CHALLENGE CARD, GROUPS & RANKING)
// ============================================================================

const DEFAULT_DATA = {
  teacherAccount: {
    username: "giaovien",
    password: "123",
    name: "Cô Nguyễn Minh Anh",
    school: "THPT Chu Văn An"
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

  // Bộ 3 thẻ Power Card mẫu (Nhận khi đạt mốc trên trục Point Line)
  powerCards: [
    {
      id: "pc-1",
      cardFrame: "Card/1.jpg",
      code: "PWR-01",
      title: "Hoãn kiểm tra miệng",
      rarity: "SSR",
      icon: "🛡️",
      gradient: "from-amber-400 via-orange-500 to-red-500",
      description: "Được phép hoãn kiểm tra miệng 1 lần sang tiết học kế tiếp mà không bị trừ điểm.",
      usageRule: "Chỉ dùng 1 lần duy nhất trước khi giáo viên đọc câu hỏi.",
      pdfUrl: "",
      pdfPage: 1
    },
    {
      id: "pc-2",
      cardFrame: "Card/2.jpg",
      code: "PWR-02",
      title: "Hoãn bài tập về nhà hôm nay",
      rarity: "SR",
      icon: "🏖️",
      gradient: "from-cyan-400 via-blue-500 to-indigo-600",
      description: "Miễn hoặc lùi hạn nộp 1 bài tập về nhà trong ngày hôm nay.",
      usageRule: "Báo với giáo viên đầu giờ khi kiểm tra bài tập.",
      pdfUrl: "",
      pdfPage: 2
    },
    {
      id: "pc-3",
      cardFrame: "Card/3.jpg",
      code: "PWR-03",
      title: "Triệu hồi đồng đội & Quà KitKat",
      rarity: "UR",
      icon: "🍫",
      gradient: "from-fuchsia-500 via-purple-600 to-pink-600",
      description: "Được gọi 1 bạn bất kỳ lên trả lời bài cũ thay mình HOẶC đổi ngay 1 thanh KitKat / Móc khóa từ giáo viên.",
      usageRule: "Nộp lại thẻ cho giáo viên sau khi kích hoạt.",
      pdfUrl: "",
      pdfPage: 3
    }
  ],

  // Bộ 3 THẺ THỬ THÁCH (CHALLENGE CARDS)
  penaltyCards: [
    {
      id: "pen-1",
      cardFrame: "Card/4.jpg",
      code: "CHL-01",
      title: "Thử thách Truth or Dare",
      icon: "🎭",
      gradient: "from-violet-500 via-purple-600 to-indigo-600",
      description: "Chọn trả lời thật lòng 1 câu hỏi vui của lớp HOẶC biểu diễn 1 tài lẻ nhỏ tại bục giảng.",
      usageRule: "Hoàn thành trong 3 phút cuối giờ học để mở khóa thẻ.",
      pdfUrl: "",
      pdfPage: 1
    },
    {
      id: "pen-2",
      cardFrame: "Card/5.jpg",
      code: "CHL-02",
      title: "Thử thách Tập trung: Trừ 3 điểm nhắc nhở",
      icon: "🎯",
      gradient: "from-slate-700 via-zinc-800 to-neutral-900",
      description: "Trừ 3 điểm thi đua để nhắc nhở tập trung hơn trong tiết học tiếp theo.",
      usageRule: "Tự động hoàn thành hoặc giáo viên xác nhận khi học sinh tiến bộ.",
      pdfUrl: "",
      pdfPage: 2
    },
    {
      id: "pen-3",
      cardFrame: "Card/6.jpg",
      code: "CHL-03",
      title: "Thử thách Đồng đội: Biệt đội Sạch Đẹp",
      icon: "🧹",
      gradient: "from-amber-500 via-orange-600 to-yellow-600",
      description: "Cả nhóm/tổ cùng ở lại 5 phút cuối giờ lau bảng, xếp lại bàn ghế ngay ngắn cho lớp học.",
      usageRule: "Tổ trưởng hoặc giáo viên xác nhận sau khi hoàn thành thử thách.",
      pdfUrl: "",
      pdfPage: 3
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
          code: "HS01",
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
          code: "HS02",
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
          code: "HS03",
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
          code: "HS04",
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
          code: "HS05",
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
          code: "HS06",
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
          code: "HS07",
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
          code: "HS08",
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
          code: "HS09",
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
          code: "HS10",
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
          code: "11B01",
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
          code: "11B02",
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
