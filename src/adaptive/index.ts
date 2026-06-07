import type {
  ExerciseRecord,
  AdaptiveRecommendation,
  AdaptiveConfig,
  MixedExerciseConfig,
  QuestionType,
  Difficulty,
  KnowledgePoint,
  ErrorType,
  Question,
  QuestionWithReason,
  QuestionSelectionReason,
  AdaptiveQuestionWithReason
} from '../types';
import { createQuestions } from '../question';

const difficultyOrder: Difficulty[] = ['easy', 'medium', 'hard'];

const knowledgePointToTypeMap: { [kpId: string]: QuestionType } = {
  'addition-subtraction': 'arithmetic',
  'multiplication-division': 'arithmetic',
  'mixed-operation': 'arithmetic',
  'decimal-calculation': 'arithmetic',
  'fraction-basic': 'fraction',
  'fraction-add-sub': 'fraction',
  'fraction-mul-div': 'fraction',
  'fraction-mixed': 'fraction',
  'one-variable': 'equation',
  'two-variable': 'equation',
  'word-problem-eq': 'equation',
  'rectangle-area': 'geometry',
  'rectangle-perimeter': 'geometry',
  'circle-area': 'geometry',
  'circle-circumference': 'geometry',
  'triangle-area': 'geometry',
  'area-combined': 'geometry',
  'word-problem-basic': 'wordProblem',
  'word-problem-distance': 'wordProblem',
  'word-problem-work': 'wordProblem',
  'word-problem-fraction': 'wordProblem',
  'word-problem-percentage': 'wordProblem'
};

export function getTypeForKnowledgePoint(kp: KnowledgePoint): QuestionType {
  return knowledgePointToTypeMap[kp.id] || 'arithmetic';
}

const errorTypeReviewSuggestions: { [key in ErrorType]: string } = {
  calculationError: '需要加强计算练习，注意进位、借位和小数点',
  unitError: '注意单位的正确使用和换算',
  signError: '注意正负号的运算规则',
  fractionNotSimplified: '练习分数约分，记得结果要化成最简分数',
  wrongFractionReduction: '注意分数化简规则，检查分子分母的最大公约数',
  wrongOperation: '仔细审题，确定正确的运算方法',
  wrongFormula: '回顾相关公式，确保公式使用正确',
  missingStep: '养成完整解题的习惯，不要跳步',
  misreadQuestion: '培养认真读题的习惯，圈出关键词',
  unknownError: '需要更多练习巩固知识点'
};

function analyzePerformance(record: ExerciseRecord): {
  weakTypes: { type: QuestionType; accuracy: number; mastery: number }[];
  strongTypes: { type: QuestionType; accuracy: number; mastery: number }[];
  weakKnowledgePoints: { kp: KnowledgePoint; accuracy: number; mastery: number }[];
  strongKnowledgePoints: { kp: KnowledgePoint; accuracy: number; mastery: number }[];
  topErrors: { error: ErrorType; count: number }[];
  shouldIncreaseDifficulty: boolean;
  shouldDecreaseDifficulty: boolean;
  currentDifficulty: Difficulty;
} {
  const weakTypes: { type: QuestionType; accuracy: number; mastery: number }[] = [];
  const strongTypes: { type: QuestionType; accuracy: number; mastery: number }[] = [];
  const weakKnowledgePoints: { kp: KnowledgePoint; accuracy: number; mastery: number }[] = [];
  const strongKnowledgePoints: { kp: KnowledgePoint; accuracy: number; mastery: number }[] = [];

  if (record.typeStats) {
    for (const [type, stat] of Object.entries(record.typeStats)) {
      if (stat) {
        if (stat.accuracy < 0.7) {
          weakTypes.push({
            type: type as QuestionType,
            accuracy: stat.accuracy,
            mastery: stat.mastery
          });
        } else if (stat.accuracy >= 0.85) {
          strongTypes.push({
            type: type as QuestionType,
            accuracy: stat.accuracy,
            mastery: stat.mastery
          });
        }
      }
    }
  }

  if (record.knowledgePointStats) {
    for (const stat of record.knowledgePointStats) {
      if (stat) {
        if (stat.accuracy < 0.7) {
          weakKnowledgePoints.push({
            kp: stat.knowledgePoint,
            accuracy: stat.accuracy,
            mastery: stat.mastery
          });
        } else if (stat.accuracy >= 0.85) {
          strongKnowledgePoints.push({
            kp: stat.knowledgePoint,
            accuracy: stat.accuracy,
            mastery: stat.mastery
          });
        }
      }
    }
  }

  const topErrors: { error: ErrorType; count: number }[] = Object.entries(record.errorStats || {})
    .filter(([, count]) => count && count > 0)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, 3)
    .map(([error, count]) => ({ error: error as ErrorType, count: count || 0 }));

  const overallAccuracy = record.overallAccuracy;
  const avgAttempts = record.avgAttemptsPerQuestion;
  const avgTime = record.avgTimePerQuestion / 1000;

  let currentDifficulty: Difficulty = 'medium';
  if (record.masteryLevel >= 80) currentDifficulty = 'hard';
  else if (record.masteryLevel >= 50) currentDifficulty = 'medium';
  else currentDifficulty = 'easy';

  const shouldIncreaseDifficulty =
    overallAccuracy >= 0.85 &&
    avgAttempts <= 1.5 &&
    avgTime <= 60 &&
    currentDifficulty !== 'hard';

  const shouldDecreaseDifficulty =
    overallAccuracy < 0.5 ||
    avgAttempts > 3 ||
    avgTime > 120;

  return {
    weakTypes,
    strongTypes,
    weakKnowledgePoints,
    strongKnowledgePoints,
    topErrors,
    shouldIncreaseDifficulty,
    shouldDecreaseDifficulty,
    currentDifficulty
  };
}

function generateQuestionPlan(
  analysis: ReturnType<typeof analyzePerformance>,
  targetCount: number,
  expectedDifficulty: Difficulty
): Array<{
  type: QuestionType;
  difficulty: Difficulty;
  knowledgePoints?: KnowledgePoint[];
  reason: QuestionSelectionReason;
  explanation: string;
  count: number;
}> {
  const plan: Array<{
    type: QuestionType;
    difficulty: Difficulty;
    knowledgePoints?: KnowledgePoint[];
    reason: QuestionSelectionReason;
    explanation: string;
    count: number;
  }> = [];

  let remaining = targetCount;

  const weakKpCount = analysis.weakKnowledgePoints.length;
  if (weakKpCount > 0) {
    const weakKpTotal = Math.min(Math.ceil(targetCount * 0.5), remaining);
    const perKp = Math.max(2, Math.ceil(weakKpTotal / weakKpCount));

    analysis.weakKnowledgePoints.forEach(weak => {
      const count = Math.min(perKp, remaining);
      if (count > 0) {
        const mappedType = getTypeForKnowledgePoint(weak.kp);
        const typeNames: { [key in QuestionType]: string } = {
          arithmetic: '口算',
          fraction: '分数',
          equation: '方程',
          geometry: '几何测量',
          wordProblem: '应用题'
        };
        plan.push({
          type: mappedType,
          difficulty: expectedDifficulty === 'hard' ? 'medium' : 'easy',
          knowledgePoints: [weak.kp],
          reason: 'weakKnowledgePoint',
          explanation: `[补弱] 知识点「${weak.kp.name}」正确率仅${(weak.accuracy * 100).toFixed(0)}%，通过${typeNames[mappedType]}题重点加强`,
          count
        });
        remaining -= count;
      }
    });
  }

  const weakTypeCount = analysis.weakTypes.length;
  if (weakTypeCount > 0 && remaining > 0) {
    const weakTypeTotal = Math.min(Math.ceil(targetCount * 0.25), remaining);
    const perType = Math.max(1, Math.ceil(weakTypeTotal / weakTypeCount));

    analysis.weakTypes.forEach(weak => {
      const count = Math.min(perType, remaining);
      if (count > 0) {
        const typeNames: { [key in QuestionType]: string } = {
          arithmetic: '口算',
          fraction: '分数',
          equation: '方程',
          geometry: '几何测量',
          wordProblem: '应用题'
        };
        plan.push({
          type: weak.type,
          difficulty: expectedDifficulty === 'hard' ? 'medium' : 'easy',
          reason: 'weakQuestionType',
          explanation: `[补弱] ${typeNames[weak.type]}正确率仅${(weak.accuracy * 100).toFixed(0)}%，需要加强练习`,
          count
        });
        remaining -= count;
      }
    });
  }

  if (analysis.topErrors.length > 0 && remaining > 0) {
    const errorTotal = Math.min(Math.ceil(targetCount * 0.15), remaining);
    const perError = Math.max(1, Math.ceil(errorTotal / analysis.topErrors.length));

    analysis.topErrors.forEach(({ error, count }) => {
      const qCount = Math.min(perError, remaining);
      if (qCount > 0) {
        let type: QuestionType = 'arithmetic';
        if (error === 'unitError') type = 'geometry';
        else if (error === 'fractionNotSimplified') type = 'fraction';
        else if (error === 'wrongOperation') type = 'wordProblem';

        plan.push({
          type,
          difficulty: expectedDifficulty === 'hard' ? 'medium' : 'easy',
          reason: 'commonMistake',
          explanation: `[强化] ${errorTypeReviewSuggestions[error]}（共${count}次）`,
          count: qCount
        });
        remaining -= qCount;
      }
    });
  }

  if (analysis.strongKnowledgePoints.length > 0 && remaining > 0) {
    const reviewCount = Math.min(Math.ceil(targetCount * 0.1), remaining);
    const strongKp = analysis.strongKnowledgePoints[0];
    const mappedType = getTypeForKnowledgePoint(strongKp.kp);
    const typeNames: { [key in QuestionType]: string } = {
      arithmetic: '口算',
      fraction: '分数',
      equation: '方程',
      geometry: '几何测量',
      wordProblem: '应用题'
    };
    plan.push({
      type: mappedType,
      difficulty: analysis.currentDifficulty,
      knowledgePoints: [strongKp.kp],
      reason: 'review',
      explanation: `[复习] 复习已掌握的知识点「${strongKp.kp.name}」，通过${typeNames[mappedType]}题保持记忆`,
      count: reviewCount
    });
    remaining -= reviewCount;
  } else if (analysis.strongTypes.length > 0 && remaining > 0) {
    const reviewCount = Math.min(Math.ceil(targetCount * 0.1), remaining);
    const strongType = analysis.strongTypes[0];
    const typeNames: { [key in QuestionType]: string } = {
      arithmetic: '口算',
      fraction: '分数',
      equation: '方程',
      geometry: '几何测量',
      wordProblem: '应用题'
    };
    plan.push({
      type: strongType.type,
      difficulty: analysis.currentDifficulty,
      reason: 'review',
      explanation: `[复习] 复习${typeNames[strongType.type]}，巩固已掌握的知识`,
      count: reviewCount
    });
    remaining -= reviewCount;
  }

  if (analysis.shouldIncreaseDifficulty && remaining > 0) {
    const challengeCount = Math.min(Math.ceil(targetCount * 0.1), remaining);
    if (analysis.strongKnowledgePoints.length > 0) {
      const strongKp = analysis.strongKnowledgePoints[0];
      const mappedType = getTypeForKnowledgePoint(strongKp.kp);
      const typeNames: { [key in QuestionType]: string } = {
        arithmetic: '口算',
        fraction: '分数',
        equation: '方程',
        geometry: '几何测量',
        wordProblem: '应用题'
      };
      plan.push({
        type: mappedType,
        difficulty: 'hard',
        knowledgePoints: [strongKp.kp],
        reason: 'challenge',
        explanation: `[挑战] 在已掌握的知识点「${strongKp.kp.name}」上挑战更高难度的${typeNames[mappedType]}题，拓展能力边界`,
        count: challengeCount
      });
    } else {
      const challengeType = analysis.strongTypes.length > 0 ? analysis.strongTypes[0].type : 'arithmetic';
      plan.push({
        type: challengeType,
        difficulty: 'hard',
        reason: 'challenge',
        explanation: '[挑战] 挑战更高难度，拓展能力边界',
        count: challengeCount
      });
    }
    remaining -= challengeCount;
  }

  if (remaining > 0) {
    const allTypes: QuestionType[] = ['arithmetic', 'fraction', 'equation', 'geometry', 'wordProblem'];
    const existingTypes = plan.map(p => p.type);
    const otherTypes = allTypes.filter(t => !existingTypes.includes(t));
    const fillType = otherTypes.length > 0 ? otherTypes[0] : 'arithmetic';
    const typeNames: { [key in QuestionType]: string } = {
      arithmetic: '口算',
      fraction: '分数',
      equation: '方程',
      geometry: '几何测量',
      wordProblem: '应用题'
    };

    plan.push({
      type: fillType,
      difficulty: expectedDifficulty,
      reason: 'balanced',
      explanation: `[均衡] 补充${typeNames[fillType]}练习，保持全面发展`,
      count: remaining
    });
    remaining = 0;
  }

  return plan;
}

function generateRecommendation(
  analysis: ReturnType<typeof analyzePerformance>,
  targetCount: number = 10,
  preferredTypes?: QuestionType[],
  maxDifficulty?: Difficulty,
  minDifficulty?: Difficulty
): {
  recommendation: AdaptiveRecommendation;
  questionPlan: ReturnType<typeof generateQuestionPlan>;
} {
  const reasons: string[] = [];
  const focusAreas: AdaptiveRecommendation['focusAreas'] = [];

  let difficultyAdjustment: 'increase' | 'decrease' | 'maintain' = 'maintain';
  let expectedDifficulty: Difficulty = analysis.currentDifficulty;

  if (analysis.shouldIncreaseDifficulty) {
    difficultyAdjustment = 'increase';
    const currentIndex = difficultyOrder.indexOf(analysis.currentDifficulty);
    if (currentIndex < difficultyOrder.length - 1) {
      expectedDifficulty = difficultyOrder[currentIndex + 1];
    }
    reasons.push(`正确率较高，建议提升难度到${expectedDifficulty === 'hard' ? '困难' : '中等'}`);
  } else if (analysis.shouldDecreaseDifficulty) {
    difficultyAdjustment = 'decrease';
    const currentIndex = difficultyOrder.indexOf(analysis.currentDifficulty);
    if (currentIndex > 0) {
      expectedDifficulty = difficultyOrder[currentIndex - 1];
    }
    reasons.push(`需要加强基础，建议降低难度到${expectedDifficulty === 'easy' ? '简单' : '中等'}`);
  } else {
    reasons.push('表现稳定，保持当前难度继续练习');
  }

  if (maxDifficulty) {
    const maxIndex = difficultyOrder.indexOf(maxDifficulty);
    const expectedIndex = difficultyOrder.indexOf(expectedDifficulty);
    if (expectedIndex > maxIndex) {
      expectedDifficulty = maxDifficulty;
      reasons.push(`根据设置，难度不超过${maxDifficulty === 'hard' ? '困难' : maxDifficulty === 'medium' ? '中等' : '简单'}`);
    }
  }
  if (minDifficulty) {
    const minIndex = difficultyOrder.indexOf(minDifficulty);
    const expectedIndex = difficultyOrder.indexOf(expectedDifficulty);
    if (expectedIndex < minIndex) {
      expectedDifficulty = minDifficulty;
      reasons.push(`根据设置，难度不低于${minDifficulty === 'easy' ? '简单' : minDifficulty === 'medium' ? '中等' : '困难'}`);
    }
  }

  const typeRatio: { [key in QuestionType]?: number } = {};
  let remainingCount = targetCount;

  analysis.weakTypes.forEach(weak => {
    const suggestedCount = Math.max(2, Math.ceil(targetCount * 0.2));
    focusAreas.push({
      type: weak.type,
      reason: `正确率仅${(weak.accuracy * 100).toFixed(0)}%，需要加强练习`,
      suggestedCount
    });
    typeRatio[weak.type] = suggestedCount;
    remainingCount -= suggestedCount;
  });

  analysis.weakKnowledgePoints.forEach(weak => {
    const suggestedCount = Math.max(2, Math.ceil(targetCount * 0.15));
    focusAreas.push({
      knowledgePoint: weak.kp,
      reason: `知识点「${weak.kp.name}」正确率仅${(weak.accuracy * 100).toFixed(0)}%`,
      suggestedCount
    });
    remainingCount -= suggestedCount;
  });

  if (preferredTypes && preferredTypes.length > 0) {
    const perType = Math.max(1, Math.floor(remainingCount / preferredTypes.length));
    preferredTypes.forEach(type => {
      typeRatio[type] = (typeRatio[type] || 0) + perType;
    });
  } else if (remainingCount > 0) {
    const allTypes: QuestionType[] = ['arithmetic', 'fraction', 'equation', 'geometry', 'wordProblem'];
    const otherTypes = allTypes.filter(t => !(t in typeRatio) || typeRatio[t] === 0);
    if (otherTypes.length > 0) {
      const perType = Math.max(1, Math.floor(remainingCount / otherTypes.length));
      otherTypes.forEach(type => {
        typeRatio[type] = perType;
      });
    }
  }

  analysis.topErrors.forEach(({ error, count }) => {
    reasons.push(`常见错误「${errorTypeReviewSuggestions[error]}」（出现${count}次）`);
  });

  const nextMasteryGoal = Math.min(100, analysis.currentDifficulty === 'hard' ? 90 : 80);

  const config: MixedExerciseConfig = {
    totalCount: targetCount,
    typeRatio,
    difficultyRange: [expectedDifficulty],
    seed: Date.now()
  };

  const questionPlan = generateQuestionPlan(analysis, targetCount, expectedDifficulty);

  return {
    recommendation: {
      config,
      reasons,
      difficultyAdjustment,
      focusAreas,
      nextMasteryGoal,
      expectedDifficulty
    },
    questionPlan
  };
}

export function getAdaptiveRecommendation(config: AdaptiveConfig): AdaptiveRecommendation {
  const { previousRecord, targetCount = 10, preferredTypes, maxDifficulty, minDifficulty } = config;
  const analysis = analyzePerformance(previousRecord);
  const { recommendation } = generateRecommendation(analysis, targetCount, preferredTypes, maxDifficulty, minDifficulty);
  return recommendation;
}

export function createAdaptiveExercise(config: AdaptiveConfig): AdaptiveQuestionWithReason {
  const { previousRecord, targetCount = 10, preferredTypes, maxDifficulty, minDifficulty, seed } = config;
  const analysis = analyzePerformance(previousRecord);
  const { recommendation, questionPlan } = generateRecommendation(
    analysis,
    targetCount,
    preferredTypes,
    maxDifficulty,
    minDifficulty
  );

  const questionsWithReason: QuestionWithReason[] = [];
  const seedValue = seed || Date.now();

  questionPlan.forEach((planItem, planIndex) => {
    const questions = createQuestions({
      type: planItem.type,
      difficulty: planItem.difficulty,
      count: planItem.count,
      knowledgePoints: planItem.knowledgePoints,
      seed: seedValue + planIndex
    });

    questions.forEach(q => {
      questionsWithReason.push({
        ...q,
        selectionReason: planItem.reason,
        selectionExplanation: planItem.explanation
      });
    });
  });

  const questionBreakdown: AdaptiveQuestionWithReason['recommendation']['questionBreakdown'] = {
    weakKnowledgePoint: 0,
    weakType: 0,
    commonMistake: 0,
    review: 0,
    challenge: 0
  };

  questionsWithReason.forEach(q => {
    if (q.selectionReason === 'weakKnowledgePoint') questionBreakdown.weakKnowledgePoint++;
    else if (q.selectionReason === 'weakQuestionType') questionBreakdown.weakType++;
    else if (q.selectionReason === 'commonMistake') questionBreakdown.commonMistake++;
    else if (q.selectionReason === 'review') questionBreakdown.review++;
    else if (q.selectionReason === 'challenge') questionBreakdown.challenge++;
  });

  return {
    questions: questionsWithReason,
    recommendation: {
      ...recommendation,
      questionBreakdown
    }
  };
}

export const adaptiveModule = {
  getRecommendation: getAdaptiveRecommendation,
  createExercise: createAdaptiveExercise
};
