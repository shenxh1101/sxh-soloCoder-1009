import type {
  AnswerRecord,
  ExerciseRecord,
  ErrorType,
  AnswerAttempt,
  KnowledgePointStat,
  QuestionProgress,
  Question,
  KnowledgePoint,
  AdaptiveRecommendation,
  AdaptiveConfig
} from '../types';
import { getAdaptiveRecommendation } from '../adaptive';

function generateId(): string {
  return `exercise-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

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

function calculateMasteryLevel(
  correctCount: number,
  totalCount: number,
  avgTimePerQuestion: number,
  avgAttempts: number
): number {
  if (totalCount === 0) return 0;

  const accuracy = correctCount / totalCount;
  const timeScore = Math.max(0, 1 - avgTimePerQuestion / 120);
  const attemptScore = Math.max(0, 1 - (avgAttempts - 1) / 4);
  const mastery = (accuracy * 0.6 + timeScore * 0.2 + attemptScore * 0.2) * 100;

  return Math.round(Math.max(0, Math.min(100, mastery)));
}

function generateReviewSuggestions(
  accuracy: number,
  commonErrors: { [key in ErrorType]?: number }
): string[] {
  const suggestions: string[] = [];

  if (accuracy < 0.6) {
    suggestions.push('需要重点复习基础概念，建议做更多基础练习');
  } else if (accuracy < 0.8) {
    suggestions.push('掌握情况良好，继续练习巩固提高');
  } else {
    suggestions.push('掌握优秀，可以尝试更高难度的题目');
  }

  const topErrors = Object.entries(commonErrors)
    .filter(([, count]) => count && count > 0)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, 2);

  topErrors.forEach(([error]) => {
    suggestions.push(errorTypeReviewSuggestions[error as ErrorType]);
  });

  return suggestions;
}

function analyzeQuestionProgress(
  questionId: string,
  attempts: AnswerAttempt[],
  questionMap: Map<string, Question>
): QuestionProgress {
  const question = questionMap.get(questionId);
  const firstAttempt = attempts[0];
  const lastAttempt = attempts[attempts.length - 1];

  const firstAnswerCorrect = firstAttempt?.isCorrect || false;
  const finalAnswerCorrect = lastAttempt?.isCorrect || false;

  let improvement: 'improved' | 'noChange' | 'regressed' = 'noChange';
  if (!firstAnswerCorrect && finalAnswerCorrect) {
    improvement = 'improved';
  } else if (firstAnswerCorrect && !finalAnswerCorrect) {
    improvement = 'regressed';
  }

  const timeToFirstAnswer = firstAttempt?.timeSpent || 0;
  const totalTimeSpent = attempts.reduce((sum, a) => sum + a.timeSpent, 0);

  return {
    questionId,
    type: question?.type || 'arithmetic',
    difficulty: question?.difficulty || 'medium',
    knowledgePoint: question?.knowledgePoint,
    attempts: [...attempts],
    firstAnswerCorrect,
    finalAnswerCorrect,
    timeToFirstAnswer,
    totalTimeSpent,
    improvement
  };
}

function calculateKnowledgePointStats(
  answers: AnswerRecord[],
  questionMap: Map<string, Question>
): { [kpId: string]: KnowledgePointStat } {
  const kpData: {
    [kpId: string]: {
      knowledgePoint: KnowledgePoint;
      correct: number;
      total: number;
      totalTime: number;
      totalAttempts: number;
      errors: { [key in ErrorType]?: number };
    };
  } = {};

  answers.forEach(answer => {
    const question = questionMap.get(answer.questionId);
    if (!question?.knowledgePoint) return;

    const kp = question.knowledgePoint;
    if (!kpData[kp.id]) {
      kpData[kp.id] = {
        knowledgePoint: kp,
        correct: 0,
        total: 0,
        totalTime: 0,
        totalAttempts: 0,
        errors: {}
      };
    }

    kpData[kp.id].total++;
    kpData[kp.id].totalTime += answer.totalTimeSpent;
    kpData[kp.id].totalAttempts += answer.attemptsCount;
    if (answer.isCorrect) {
      kpData[kp.id].correct++;
    }
    if (answer.firstErrorType) {
      kpData[kp.id].errors[answer.firstErrorType] = (kpData[kp.id].errors[answer.firstErrorType] || 0) + 1;
    }
  });

  const stats: { [kpId: string]: KnowledgePointStat } = {};
  for (const [kpId, data] of Object.entries(kpData)) {
    const accuracy = data.total > 0 ? data.correct / data.total : 0;
    stats[kpId] = {
      knowledgePoint: data.knowledgePoint,
      correct: data.correct,
      total: data.total,
      accuracy,
      avgTimeSpent: data.total > 0 ? data.totalTime / data.total : 0,
      avgAttempts: data.total > 0 ? data.totalAttempts / data.total : 0,
      commonErrors: { ...data.errors },
      mastery: calculateMasteryLevel(
        data.correct,
        data.total,
        data.total > 0 ? data.totalTime / data.total / 1000 : 0,
        data.total > 0 ? data.totalAttempts / data.total : 0
      ),
      reviewSuggestions: generateReviewSuggestions(accuracy, data.errors)
    };
  }

  return stats;
}

function calculateTypeStats(
  answers: AnswerRecord[],
  questionMap: Map<string, Question>
): ExerciseRecord['typeStats'] {
  const typeData: {
    [type: string]: { correct: number; total: number; totalTime: number; totalAttempts: number };
  } = {};

  answers.forEach(answer => {
    const question = questionMap.get(answer.questionId);
    if (!question) return;

    const type = question.type;
    if (!typeData[type]) {
      typeData[type] = { correct: 0, total: 0, totalTime: 0, totalAttempts: 0 };
    }

    typeData[type].total++;
    typeData[type].totalTime += answer.totalTimeSpent;
    typeData[type].totalAttempts += answer.attemptsCount;
    if (answer.isCorrect) {
      typeData[type].correct++;
    }
  });

  const stats: ExerciseRecord['typeStats'] = {};
  for (const [type, data] of Object.entries(typeData)) {
    const accuracy = data.total > 0 ? data.correct / data.total : 0;
    stats[type as keyof typeof stats] = {
      correct: data.correct,
      total: data.total,
      accuracy,
      mastery: calculateMasteryLevel(
        data.correct,
        data.total,
        data.total > 0 ? data.totalTime / data.total / 1000 : 0,
        data.total > 0 ? data.totalAttempts / data.total : 0
      )
    };
  }

  return stats;
}

export function createExercise(questions?: Question[]) {
  const exerciseId = generateId();
  const startTime = Date.now();
  const answers: AnswerRecord[] = [];
  const attemptMap: Map<string, AnswerAttempt[]> = new Map();
  const questionMap: Map<string, Question> = new Map();

  if (questions) {
    questions.forEach(q => questionMap.set(q.id, q));
  }

  function addQuestion(question: Question): void {
    questionMap.set(question.id, question);
  }

  function addAttempt(questionId: string, attempt: AnswerAttempt): void {
    if (!attemptMap.has(questionId)) {
      attemptMap.set(questionId, []);
    }
    attemptMap.get(questionId)!.push(attempt);
  }

  function addAnswer(record: AnswerRecord): void {
    answers.push(record);
    if (record.attempts && record.attempts.length > 0) {
      attemptMap.set(record.questionId, record.attempts);
    }
  }

  function getMasteryLevel(): number {
    if (answers.length === 0) return 0;

    const correctCount = answers.filter(a => a.isCorrect).length;
    const totalTimeSpent = answers.reduce((sum, a) => sum + a.totalTimeSpent, 0);
    const totalAttempts = answers.reduce((sum, a) => sum + a.attemptsCount, 0);

    return calculateMasteryLevel(
      correctCount,
      answers.length,
      totalTimeSpent / answers.length / 1000,
      totalAttempts / answers.length
    );
  }

  function finish(): ExerciseRecord {
    const endTime = Date.now();
    const totalTimeSpent = endTime - startTime;

    const finalAnswers: AnswerRecord[] = answers.length > 0 ? answers : [];

    if (answers.length === 0 && attemptMap.size > 0) {
      attemptMap.forEach((attempts, questionId) => {
        const lastAttempt = attempts[attempts.length - 1];
        const firstAttempt = attempts[0];

        finalAnswers.push({
          questionId,
          attempts,
          finalAnswer: lastAttempt?.userAnswer || null,
          isCorrect: lastAttempt?.isCorrect || false,
          firstErrorType: !firstAttempt?.isCorrect ? firstAttempt?.errorType : undefined,
          totalTimeSpent: attempts.reduce((sum, a) => sum + a.timeSpent, 0),
          attemptsCount: attempts.length,
          firstAttemptCorrect: firstAttempt?.isCorrect || false,
          timestamp: lastAttempt?.timestamp || Date.now()
        });
      });
    }

    const totalScore = finalAnswers.reduce((sum, a) => {
      if (a.isCorrect) {
        return sum + 10;
      }
      return sum;
    }, 0);

    const maxScore = finalAnswers.length * 10;
    const correctCount = finalAnswers.filter(a => a.isCorrect).length;
    const overallAccuracy = finalAnswers.length > 0 ? correctCount / finalAnswers.length : 0;

    const avgTimePerQuestion = finalAnswers.length > 0
      ? finalAnswers.reduce((sum, a) => sum + a.totalTimeSpent, 0) / finalAnswers.length
      : 0;

    const avgAttemptsPerQuestion = finalAnswers.length > 0
      ? finalAnswers.reduce((sum, a) => sum + a.attemptsCount, 0) / finalAnswers.length
      : 0;

    const firstAttemptCorrectCount = finalAnswers.filter(a => a.firstAttemptCorrect).length;
    const firstAttemptAccuracy = finalAnswers.length > 0
      ? firstAttemptCorrectCount / finalAnswers.length
      : 0;

    const improvedCount = finalAnswers.filter(a => !a.firstAttemptCorrect && a.isCorrect).length;
    const improvementRate = finalAnswers.length > 0
      ? improvedCount / finalAnswers.length
      : 0;

    const errorStats: { [key in ErrorType]?: number } = {};
    finalAnswers.forEach(answer => {
      if (answer.firstErrorType) {
        errorStats[answer.firstErrorType] = (errorStats[answer.firstErrorType] || 0) + 1;
      }
    });

    const questionProgress: QuestionProgress[] = [];
    finalAnswers.forEach(answer => {
      const attempts = answer.attempts || [];
      questionProgress.push(analyzeQuestionProgress(answer.questionId, attempts, questionMap));
    });

    const knowledgePointStats = calculateKnowledgePointStats(finalAnswers, questionMap);
    const typeStats = calculateTypeStats(finalAnswers, questionMap);
    const masteryLevel = getMasteryLevel();

    return {
      exerciseId,
      startTime,
      endTime,
      totalTimeSpent,
      answers: finalAnswers,
      questionProgress,
      totalScore,
      maxScore,
      masteryLevel,
      overallAccuracy,
      avgTimePerQuestion,
      avgAttemptsPerQuestion,
      firstAttemptAccuracy,
      improvementRate,
      errorStats,
      knowledgePointStats,
      typeStats
    };
  }

  return {
    addQuestion,
    addAttempt,
    addAnswer,
    finish,
    getMasteryLevel
  };
}

export function getRecommendation(previousRecord: ExerciseRecord): AdaptiveRecommendation {
  return getAdaptiveRecommendation({ previousRecord });
}

export interface ExerciseSession {
  addQuestion: (question: Question) => void;
  addAttempt: (questionId: string, attempt: AnswerAttempt) => void;
  addAnswer: (record: AnswerRecord) => void;
  finish: () => ExerciseRecord;
  getMasteryLevel: () => number;
}

export const recordModule = {
  createExercise,
  getRecommendation
};
