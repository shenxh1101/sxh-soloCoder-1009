import type {
  ExerciseRecord,
  AdaptiveRecommendation,
  AdaptiveConfig,
  MixedExerciseConfig,
  QuestionType,
  Difficulty,
  KnowledgePoint,
  ErrorType
} from '../types';
import { createMixedQuestions } from '../question';

const difficultyOrder: Difficulty[] = ['easy', 'medium', 'hard'];

const errorTypeReviewSuggestions: { [key in ErrorType]: string } = {
  calculationError: '需要加强计算练习，注意进位、借位和小数点',
  unitError: '注意单位的正确使用和换算',
  signError: '注意正负号的运算规则',
  fractionNotSimplified: '练习分数约分，记得结果要化成最简分数',
  wrongOperation: '仔细审题，确定正确的运算方法',
  missingStep: '养成完整解题的习惯，不要跳步',
  misreadQuestion: '培养认真读题的习惯，圈出关键词',
  unknown: '需要更多练习巩固知识点'
};

function analyzePerformance(record: ExerciseRecord): {
  weakTypes: { type: QuestionType; accuracy: number; mastery: number }[];
  weakKnowledgePoints: { kp: KnowledgePoint; accuracy: number; mastery: number }[];
  topErrors: { error: ErrorType; count: number }[];
  shouldIncreaseDifficulty: boolean;
  shouldDecreaseDifficulty: boolean;
  currentDifficulty: Difficulty;
} {
  const weakTypes: { type: QuestionType; accuracy: number; mastery: number }[] = [];
  const weakKnowledgePoints: { kp: KnowledgePoint; accuracy: number; mastery: number }[] = [];

  if (record.typeStats) {
    for (const [type, stat] of Object.entries(record.typeStats)) {
      if (stat && stat.accuracy < 0.7) {
        weakTypes.push({
          type: type as QuestionType,
          accuracy: stat.accuracy,
          mastery: stat.mastery
        });
      }
    }
  }

  if (record.knowledgePointStats) {
    for (const [kpId, stat] of Object.entries(record.knowledgePointStats)) {
      if (stat && stat.accuracy < 0.7) {
        weakKnowledgePoints.push({
          kp: stat.knowledgePoint,
          accuracy: stat.accuracy,
          mastery: stat.mastery
        });
      }
    }
  }

  const topErrors: { error: ErrorType; count: number }[] = Object.entries(record.errorStats)
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
    weakKnowledgePoints,
    topErrors,
    shouldIncreaseDifficulty,
    shouldDecreaseDifficulty,
    currentDifficulty
  };
}

function generateRecommendation(
  analysis: ReturnType<typeof analyzePerformance>,
  targetCount: number = 10,
  preferredTypes?: QuestionType[],
  maxDifficulty?: Difficulty,
  minDifficulty?: Difficulty
): AdaptiveRecommendation {
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

  return {
    config,
    reasons,
    difficultyAdjustment,
    focusAreas,
    nextMasteryGoal,
    expectedDifficulty
  };
}

export function getAdaptiveRecommendation(config: AdaptiveConfig): AdaptiveRecommendation {
  const { previousRecord, targetCount = 10, preferredTypes, maxDifficulty, minDifficulty } = config;
  const analysis = analyzePerformance(previousRecord);
  return generateRecommendation(analysis, targetCount, preferredTypes, maxDifficulty, minDifficulty);
}

export function createAdaptiveExercise(config: AdaptiveConfig): {
  questions: ReturnType<typeof createMixedQuestions>;
  recommendation: AdaptiveRecommendation;
} {
  const recommendation = getAdaptiveRecommendation(config);
  const questions = createMixedQuestions(recommendation.config);
  return { questions, recommendation };
}

export const adaptiveModule = {
  getRecommendation: getAdaptiveRecommendation,
  createExercise: createAdaptiveExercise
};
