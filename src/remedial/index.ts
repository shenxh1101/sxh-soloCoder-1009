import type {
  ClassDiagnosticReport,
  RemedialPackage,
  RemedialPackageConfig,
  QuestionType,
  Difficulty,
  KnowledgePoint,
  QuestionWithReason
} from '../types';
import { createQuestions } from '../question';
import { getTypeForKnowledgePoint } from '../adaptive';

function generateId(): string {
  return `remedial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const typeNames: { [key in QuestionType]: string } = {
  arithmetic: '口算',
  fraction: '分数',
  equation: '方程',
  geometry: '几何测量',
  wordProblem: '应用题'
};

function createGroupQuestions(
  weakPoints: KnowledgePoint[],
  totalQuestions: number,
  difficulty: Difficulty,
  groupName: '基础组' | '巩固组' | '挑战组'
): {
  questions: QuestionWithReason[];
  typeRatio: { [key in QuestionType]?: number };
  knowledgePoints: {
    knowledgePoint: KnowledgePoint;
    count: number;
    difficulty: Difficulty;
    purpose: 'review' | 'strengthen' | 'challenge';
  }[];
} {
  const typeCount: { [key in QuestionType]?: number } = {};
  const kpCount: { [kpId: string]: number } = {};
  const questions: QuestionWithReason[] = [];

  let remaining = totalQuestions;

  const weakKpCount = weakPoints.length;
  if (weakKpCount > 0) {
    const weakKpTotal = Math.min(Math.ceil(totalQuestions * 0.7), remaining);
    const perKp = Math.max(1, Math.ceil(weakKpTotal / weakKpCount));

    weakPoints.forEach((kp, idx) => {
      const count = Math.min(perKp, remaining);
      if (count > 0) {
        const mappedType = getTypeForKnowledgePoint(kp);
        typeCount[mappedType] = (typeCount[mappedType] || 0) + count;
        kpCount[kp.id] = (kpCount[kp.id] || 0) + count;

        const kpQuestions = createQuestions({
          type: mappedType,
          difficulty,
          count,
          knowledgePoints: [kp]
        });
        kpQuestions.forEach((q, qIdx) => {
          let purpose: 'review' | 'strengthen' | 'challenge' = 'strengthen';
          if (groupName === '基础组') purpose = 'strengthen';
          else if (groupName === '巩固组') purpose = idx < weakKpCount / 2 ? 'strengthen' : 'review';
          else purpose = 'challenge';

          const purposeText = purpose === 'strengthen' ? '强化' : purpose === 'review' ? '复习' : '挑战';
          questions.push({
            ...q,
            selectionReason: groupName === '基础组' ? 'weakKnowledgePoint' : groupName === '巩固组' ? 'weakKnowledgePoint' : 'challenge',
            selectionExplanation: `[${purposeText}] ${groupName}练习：针对薄弱知识点「${kp.name}」进行${typeNames[mappedType]}训练`
          });
        });

        remaining -= count;
      }
    });
  }

  if (remaining > 0) {
    const allTypes: QuestionType[] = ['arithmetic', 'fraction', 'equation', 'geometry', 'wordProblem'];
    const existingTypes = Object.keys(typeCount) as QuestionType[];
    const otherTypes = allTypes.filter(t => !existingTypes.includes(t));
    const fillType = otherTypes.length > 0 ? otherTypes[0] : 'arithmetic';

    typeCount[fillType] = (typeCount[fillType] || 0) + remaining;

    const fillQuestions = createQuestions({
      type: fillType,
      difficulty,
      count: remaining
    });
    fillQuestions.forEach(q => {
      questions.push({
        ...q,
        selectionReason: 'balanced',
        selectionExplanation: `[均衡] ${groupName}练习：补充${typeNames[fillType]}训练，保持全面发展`
      });
    });
  }

  const typeRatio: { [key in QuestionType]?: number } = {};
  Object.entries(typeCount).forEach(([type, count]) => {
    typeRatio[type as QuestionType] = count! / totalQuestions;
  });

  const knowledgePoints = Object.entries(kpCount).map(([kpId, count]) => {
    const kp = weakPoints.find(k => k.id === kpId)!;
    let purpose: 'review' | 'strengthen' | 'challenge' = 'strengthen';
    if (groupName === '基础组') purpose = 'strengthen';
    else if (groupName === '巩固组') purpose = 'strengthen';
    else purpose = 'challenge';

    return {
      knowledgePoint: kp,
      count,
      difficulty,
      purpose
    };
  });

  return { questions, typeRatio, knowledgePoints };
}

export function createRemedialPackage(config: RemedialPackageConfig): RemedialPackage {
  const { classReport, totalQuestions = 30, questions, baseExerciseId, className } = config;
  const weakPoints = classReport.knowledgePointDimension.classWeakPoints;

  const basicQuestions = createGroupQuestions(weakPoints, Math.floor(totalQuestions * 0.4), 'easy', '基础组');
  const consolidateQuestions = createGroupQuestions(weakPoints, Math.floor(totalQuestions * 0.35), 'medium', '巩固组');
  const challengeQuestions = createGroupQuestions(weakPoints, Math.floor(totalQuestions * 0.25), 'hard', '挑战组');

  const groups: RemedialPackage['groups'] = [
    {
      groupName: '基础组',
      targetStudents: '掌握度低于50%的学生',
      suitableFor: {
        minMastery: 0,
        maxMastery: 50,
        description: '基础薄弱，需要从最基础的知识点开始补习'
      },
      totalQuestions: basicQuestions.questions.length,
      estimatedTime: basicQuestions.questions.length * 5 * 60,
      avgDifficulty: 'easy',
      typeRatio: basicQuestions.typeRatio,
      knowledgePoints: basicQuestions.knowledgePoints,
      questions: basicQuestions.questions,
      groupGoal: '补齐基础，掌握核心概念，正确率达到60%以上',
      focusAreas: [
        `重点突破：${weakPoints.slice(0, 3).map(k => k.name).join('、')}`,
        '从基础概念入手，确保理解透彻',
        '每道题做完后对照答案，理解错误原因',
        '建议每天练习15-20分钟，循序渐进'
      ]
    },
    {
      groupName: '巩固组',
      targetStudents: '掌握度在50%-80%之间的学生',
      suitableFor: {
        minMastery: 50,
        maxMastery: 80,
        description: '有一定基础，但部分知识点掌握不牢，需要巩固提升'
      },
      totalQuestions: consolidateQuestions.questions.length,
      estimatedTime: consolidateQuestions.questions.length * 6 * 60,
      avgDifficulty: 'medium',
      typeRatio: consolidateQuestions.typeRatio,
      knowledgePoints: consolidateQuestions.knowledgePoints,
      questions: consolidateQuestions.questions,
      groupGoal: '巩固基础，突破难点，正确率达到80%以上',
      focusAreas: [
        `强化练习：${weakPoints.slice(0, 3).map(k => k.name).join('、')}`,
        '注意总结解题方法和规律',
        '适当增加难度，提升解题能力',
        '建立错题本，定期复习错题'
      ]
    },
    {
      groupName: '挑战组',
      targetStudents: '掌握度高于80%的学生',
      suitableFor: {
        minMastery: 80,
        maxMastery: 100,
        description: '基础扎实，可以挑战更高难度，拓展思维'
      },
      totalQuestions: challengeQuestions.questions.length,
      estimatedTime: challengeQuestions.questions.length * 8 * 60,
      avgDifficulty: 'hard',
      typeRatio: challengeQuestions.typeRatio,
      knowledgePoints: challengeQuestions.knowledgePoints,
      questions: challengeQuestions.questions,
      groupGoal: '拓展提升，挑战难题，培养数学思维',
      focusAreas: [
        `挑战拔高：${weakPoints.slice(0, 2).map(k => k.name).join('、')}的综合应用`,
        '尝试一题多解，拓展解题思路',
        '培养数学思维和逻辑推理能力',
        '可以尝试帮助其他同学讲解题目'
      ]
    }
  ];

  return {
    packageId: generateId(),
    createdAt: Date.now(),
    baseExerciseId: baseExerciseId || classReport.exerciseId,
    className: className || classReport.className,
    totalGroups: 3,
    groups,
    weakPoints
  };
}

export const remedialModule = {
  createRemedialPackage
};
