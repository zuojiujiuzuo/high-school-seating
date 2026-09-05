import type { AssignmentMap, GenerationStrategy, SeatDefinition, Student } from "../types";
import { createPresetSeats } from "../domain/layoutPresets";

const names = [
  "许嘉宁", "李想", "赵一航", "孙若溪", "徐子墨", "唐心怡", "陆景行", "钱可欣",
  "林晓", "周然", "周子涵", "陈思远", "刘宇航", "沈语嫣", "丁雨晴", "曹宇航",
  "王子墨", "郑昊然", "高铭阳", "蒋依依", "杨诗雨", "顾文轩", "黎明远", "宋佳宁",
  "秦子墨", "顾子涵", "苏沐阳", "吕欣怡", "张奕辰", "白宇飞", "傅子墨", "江晚晴",
  "谢安然", "段星宇", "许嘉树", "朱晨熙", "温若曦", "冯乐乐", "谭欣然", "金浩然",
  "方祺安", "韩文博", "何思齐", "黄子涵", "叶梓豪", "吴雨彤", "袁知夏", "邵清和",
];

export const EXAMPLE_CLASS_NAME = "示例班级";

export const students: Student[] = names.map((name, index) => ({
  id: `student-${index + 1}`,
  name,
  gender: index % 2 === 0 ? "男" : "女",
  className: EXAMPLE_CLASS_NAME,
  studentNo: `2026${String(index + 1).padStart(3, "0")}`,
  score: index % 12 === 11 ? undefined : (["B", "A", "C", "A", "B", "C", "A", "D"] as const)[index % 8],
  height: index % 8 === 7 ? undefined : [168, 160, 174, 158, 172, 162, 178, 165][index % 8],
  appearance: (index % 10) + 1,
  tags: index % 7 === 0 ? ["组长候选"] : index % 6 === 0 ? ["视力关注"] : [],
}));

export const seats: SeatDefinition[] = createPresetSeats("48-seat");

const deliberatelyEmptySeats = new Set(["seat-1-4-0", "seat-1-4-1", "seat-2-5-1", "seat-3-3-1", "seat-3-5-1"]);

export const initialAssignments: AssignmentMap = seats.reduce<AssignmentMap>((result, seat, index) => {
  if (!deliberatelyEmptySeats.has(seat.id) && index < 44) {
    result[seat.id] = students[index].id;
  }
  return result;
}, {});

export const initiallySelectedStudentIds = ["student-9", "student-10", "student-11", "student-12"];

export const algorithmOptions = [
  { id: "random", name: "随机排座", note: "单独使用，让每次换位都有新鲜感" },
  { id: "score_spread", name: "成绩均匀", note: "各区域成绩结构更平衡" },
  { id: "group_balanced", name: "小组均衡", note: "综合平衡成绩与身高数据" },
  { id: "height", name: "身高模式", note: "低个靠前，高个靠后" },
  { id: "tag_balanced", name: "标签策略", note: "自动应用系统标签对应的排座规则" },
  { id: "gender_separated", name: "男女分坐", note: "优先安排同性同桌，人数不均时最少混排" },
  { id: "romance_guard", name: "防早恋模式", note: "分散高关注的异性组合" },
] as const satisfies readonly { id: GenerationStrategy; name: string; note: string }[];
