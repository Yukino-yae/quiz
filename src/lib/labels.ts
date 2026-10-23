import type {
  Difficulty,
  PracticeMode,
  QuestionType,
} from '@/types/quiz'

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选',
  multiple: '多选',
  judge: '判断',
  fill: '填空',
  short: '简答',
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: '易',
  2: '中',
  3: '难',
}

export const PRACTICE_MODE_LABELS: Record<PracticeMode, string> = {
  sequence: '顺序练习',
  random: '随机练习',
  wrong: '错题重练',
  favorite: '收藏练习',
  exam: '模拟考试',
  review: '复习',
}
