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
  AdaptiveConfig,
  QuestionType,
  Difficulty,
  DiagnosticReport,
  AnswerCategory,
  ClassDiagnosticConfig,
  ClassDiagnosticReport
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
  wrongFormula: '回顾相关公式，确保公式使用正确',
  wrongFractionReduction: '注意分数化简规则，检查分子分母的最大公约数',
  missingStep: '养成完整解题的习惯，不要跳步',
  misreadQuestion: '培养认真读题的习惯，圈出关键词',
  unknownError: '需要更多练习巩固知识点'
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
  questionMap: { [id: string]: Question }
): QuestionProgress {
  const question = questionMap[questionId];
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
  questionMap: { [id: string]: Question }
): KnowledgePointStat[] {
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
    const question = questionMap[answer.questionId];
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

  const stats: KnowledgePointStat[] = [];
  for (const [kpId, data] of Object.entries(kpData)) {
    const accuracy = data.total > 0 ? data.correct / data.total : 0;
    stats.push({
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
    });
  }

  return stats;
}

function calculateTypeStats(
  answers: AnswerRecord[],
  questionMap: { [id: string]: Question }
): ExerciseRecord['typeStats'] {
  const typeData: {
    [type: string]: { correct: number; total: number; totalTime: number; totalAttempts: number };
  } = {};

  answers.forEach(answer => {
    const question = questionMap[answer.questionId];
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
    stats[type as QuestionType] = {
      correct: data.correct,
      total: data.total,
      accuracy,
      avgTime: data.total > 0 ? data.totalTime / data.total : 0,
      avgAttempts: data.total > 0 ? data.totalAttempts / data.total : 0,
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
  const questionMap: { [id: string]: Question } = {};

  if (questions) {
    questions.forEach(q => {
      questionMap[q.id] = q;
    });
  }

  function addQuestion(question: Question): void {
    questionMap[question.id] = question;
  }

  function addAttempt(questionId: string, attempt: AnswerAttempt): void {
    if (!attemptMap.has(questionId)) {
      attemptMap.set(questionId, []);
    }
    attemptMap.get(questionId)!.push(attempt);
  }

  function addAnswer(record: AnswerRecord): void {
    const question = questionMap[record.questionId];
    const enrichedRecord: AnswerRecord = {
      ...record,
      question: record.question || question?.question,
      questionType: record.questionType || question?.type,
      questionDifficulty: record.questionDifficulty || question?.difficulty,
      questionKnowledgePoint: record.questionKnowledgePoint || question?.knowledgePoint,
      correctAnswer: record.correctAnswer || question?.correctAnswer
    };
    answers.push(enrichedRecord);
    if (record.attempts && record.attempts.length > 0) {
      attemptMap.set(record.questionId, record.attempts);
    }
  }

  function getEffectiveAnswers(): AnswerRecord[] {
    if (answers.length > 0) return answers;

    const effective: AnswerRecord[] = [];
    if (attemptMap.size > 0) {
      attemptMap.forEach((attempts, questionId) => {
        const lastAttempt = attempts[attempts.length - 1];
        const firstAttempt = attempts[0];
        const question = questionMap[questionId];

        effective.push({
          questionId,
          question: question?.question,
          questionType: question?.type,
          questionDifficulty: question?.difficulty,
          questionKnowledgePoint: question?.knowledgePoint,
          correctAnswer: question?.correctAnswer,
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
    return effective;
  }

  function getMasteryLevel(): number {
    const effectiveAnswers = getEffectiveAnswers();
    if (effectiveAnswers.length === 0) return 0;

    const correctCount = effectiveAnswers.filter(a => a.isCorrect).length;
    const totalTimeSpent = effectiveAnswers.reduce((sum, a) => sum + a.totalTimeSpent, 0);
    const totalAttempts = effectiveAnswers.reduce((sum, a) => sum + a.attemptsCount, 0);

    return calculateMasteryLevel(
      correctCount,
      effectiveAnswers.length,
      totalTimeSpent / effectiveAnswers.length / 1000,
      totalAttempts / effectiveAnswers.length
    );
  }

  function finish(): ExerciseRecord {
    const endTime = Date.now();
    const totalTimeSpent = endTime - startTime;

    const finalAnswers = getEffectiveAnswers();

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

function classifyAnswer(answer: AnswerRecord, attempts: AnswerAttempt[]): AnswerCategory {
  if (answer.firstAttemptCorrect) {
    return 'firstTimeCorrect';
  }

  if (!answer.isCorrect) {
    return 'stillWrong';
  }

  const usedHint = attempts.some(a => a.hintUsed);
  if (usedHint) {
    return 'improvedAfterHint';
  }

  return 'correctAfterAttempts';
}

function generateTeacherShortComment(mastery: number, accuracy: number, improvementRate: number): string {
  if (mastery >= 85 && accuracy >= 0.85) {
    return '本次练习表现优秀，知识点掌握扎实，继续保持！';
  } else if (mastery >= 70 && accuracy >= 0.7) {
    if (improvementRate > 0.3) {
      return '整体掌握良好，遇到困难时能主动调整，进步明显！';
    }
    return '整体掌握良好，部分知识点需要加强练习。';
  } else if (mastery >= 50 && accuracy >= 0.5) {
    return '本次练习有一定基础，但仍有较多知识点需要巩固。';
  } else {
    return '本次练习需要多加努力，建议从基础知识点开始系统复习。';
  }
}

function generateTeacherDetailedComment(
  record: ExerciseRecord,
  strongTypes: QuestionType[],
  weakTypes: QuestionType[],
  strongPoints: KnowledgePoint[],
  weakPoints: KnowledgePoint[],
  categoryStats: { [key in AnswerCategory]: { count: number; percentage: number; questions: string[] } }
): string {
  const parts: string[] = [];

  parts.push(`本次练习共完成${record.answers.length}道题，正确率${(record.overallAccuracy * 100).toFixed(0)}%，掌握度${record.masteryLevel.toFixed(0)}分。`);

  if (strongTypes.length > 0) {
    const typeNames = strongTypes.map(t => {
      const names: { [key in QuestionType]: string } = {
        arithmetic: '口算',
        fraction: '分数',
        equation: '方程',
        geometry: '几何测量',
        wordProblem: '应用题'
      };
      return names[t];
    }).join('、');
    parts.push(`在${typeNames}方面表现出色，这是你的优势领域。`);
  }

  if (weakTypes.length > 0) {
    const typeNames = weakTypes.map(t => {
      const names: { [key in QuestionType]: string } = {
        arithmetic: '口算',
        fraction: '分数',
        equation: '方程',
        geometry: '几何测量',
        wordProblem: '应用题'
      };
      return names[t];
    }).join('、');
    parts.push(`${typeNames}方面需要加强练习，建议多做同类题目巩固。`);
  }

  if (strongPoints.length > 0) {
    const kpNames = strongPoints.map(kp => kp.name).join('、');
    parts.push(`知识点「${kpNames}」掌握较好，可以尝试更高难度的题目。`);
  }

  if (weakPoints.length > 0) {
    const kpNames = weakPoints.map(kp => kp.name).join('、');
    parts.push(`重点关注「${kpNames}」，这些知识点是当前的主要薄弱点。`);
  }

  if (categoryStats.improvedAfterHint.count > 0) {
    parts.push(`有${categoryStats.improvedAfterHint.count}道题在提示后答对，说明你善于学习和调整。`);
  }

  if (categoryStats.correctAfterAttempts.count > 0) {
    parts.push(`有${categoryStats.correctAfterAttempts.count}道题经过多次尝试后答对，表现出了良好的毅力。`);
  }

  if (categoryStats.stillWrong.count > 0) {
    parts.push(`还有${categoryStats.stillWrong.count}道题未能答对，建议回顾相关知识点并寻求帮助。`);
  }

  return parts.join(' ');
}

function generateHighlights(record: ExerciseRecord, strongTypes: QuestionType[], strongPoints: KnowledgePoint[]): string[] {
  const highlights: string[] = [];

  if (record.overallAccuracy >= 0.8) {
    highlights.push(`整体正确率达到${(record.overallAccuracy * 100).toFixed(0)}%，表现优秀`);
  }
  if (record.improvementRate >= 0.3) {
    highlights.push(`进步率达到${(record.improvementRate * 100).toFixed(0)}%，学习能力强`);
  }
  if (record.firstAttemptAccuracy >= 0.7) {
    highlights.push(`首次答题正确率${(record.firstAttemptAccuracy * 100).toFixed(0)}%，基础扎实`);
  }
  if (strongTypes.length > 0) {
    const names = strongTypes.map(t => {
      const n: { [key in QuestionType]: string } = {
        arithmetic: '口算',
        fraction: '分数',
        equation: '方程',
        geometry: '几何测量',
        wordProblem: '应用题'
      };
      return n[t];
    }).join('、');
    highlights.push(`优势题型：${names}`);
  }
  if (strongPoints.length > 0) {
    highlights.push(`掌握较好的知识点：${strongPoints.map(kp => kp.name).join('、')}`);
  }

  return highlights;
}

function generateConcerns(record: ExerciseRecord, weakTypes: QuestionType[], weakPoints: KnowledgePoint[]): string[] {
  const concerns: string[] = [];

  if (record.overallAccuracy < 0.6) {
    concerns.push(`整体正确率偏低（${(record.overallAccuracy * 100).toFixed(0)}%），需要加强基础练习`);
  }
  if (record.firstAttemptAccuracy < 0.5) {
    concerns.push(`首次答题正确率较低（${(record.firstAttemptAccuracy * 100).toFixed(0)}%），建议仔细审题`);
  }
  if (record.avgAttemptsPerQuestion > 2.5) {
    concerns.push(`平均尝试次数较多（${record.avgAttemptsPerQuestion.toFixed(1)}次），需要提高熟练度`);
  }
  if (record.avgTimePerQuestion > 90000) {
    concerns.push(`平均耗时较长（${(record.avgTimePerQuestion / 1000).toFixed(0)}秒/题），建议提高解题速度`);
  }
  if (weakTypes.length > 0) {
    const names = weakTypes.map(t => {
      const n: { [key in QuestionType]: string } = {
        arithmetic: '口算',
        fraction: '分数',
        equation: '方程',
        geometry: '几何测量',
        wordProblem: '应用题'
      };
      return n[t];
    }).join('、');
    concerns.push(`薄弱题型：${names}`);
  }
  if (weakPoints.length > 0) {
    concerns.push(`薄弱知识点：${weakPoints.map(kp => kp.name).join('、')}`);
  }

  return concerns;
}

function generateSuggestions(weakPoints: KnowledgePoint[], weakTypes: QuestionType[], errorStats: { [key in ErrorType]?: number }): string[] {
  const suggestions: string[] = [];

  if (weakPoints.length > 0) {
    suggestions.push(`建议优先复习：${weakPoints.map(kp => kp.name).join('、')}`);
  }

  const commonErrors = Object.entries(errorStats)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, 3);

  commonErrors.forEach(([errorType, count]) => {
    const errorMessages: { [key in ErrorType]: string } = {
      calculationError: `有${count}道题出现计算错误，建议加强计算练习`,
      wrongOperation: `有${count}道题选错了运算方法，建议仔细审题`,
      unitError: `有${count}道题单位使用错误，注意检查单位`,
      fractionNotSimplified: `有${count}道题分数未化简，记得最后结果要约分`,
      wrongFractionReduction: `有${count}道题分数化简错误，注意约分规则`,
      wrongFormula: `有${count}道题公式使用错误，回顾相关公式`,
      signError: `有${count}道题符号错误，注意正负号运算`,
      missingStep: `有${count}道题缺少解题步骤，养成完整解题习惯`,
      misreadQuestion: `有${count}道题读题错误，培养认真读题习惯`,
      unknownError: '部分题目错误原因不明，建议寻求老师帮助'
    };
    suggestions.push(errorMessages[errorType as ErrorType]);
  });

  if (weakTypes.includes('wordProblem')) {
    suggestions.push('应用题建议多读几遍题目，理清数量关系再列式');
  }
  if (weakTypes.includes('geometry')) {
    suggestions.push('几何题建议画图辅助理解，记清各种图形的计算公式');
  }
  if (weakTypes.includes('fraction')) {
    suggestions.push('分数运算注意通分和约分，结果要化为最简分数');
  }

  return suggestions;
}

function generateEncouragement(mastery: number, improvementRate: number): string {
  if (mastery >= 85) {
    return '太棒了！继续保持这种学习状态，你会越来越优秀的！';
  } else if (mastery >= 70) {
    if (improvementRate > 0.3) {
      return '进步很大！你展现了很强的学习能力，继续加油！';
    }
    return '做得不错！再加把劲，你一定能更上一层楼！';
  } else if (mastery >= 50) {
    return '不要灰心，每次练习都是进步的机会。坚持下去，你会看到自己的成长！';
  } else {
    return '学习是一个循序渐进的过程，从基础开始，一步一个脚印，你一定可以的！';
  }
}

export function generateDiagnosticReport(record: ExerciseRecord, questions?: Question[]): DiagnosticReport {
  const questionMap: { [id: string]: Question } = {};
  if (questions) {
    questions.forEach(q => {
      questionMap[q.id] = q;
    });
  }

  const answers = record.answers;
  const correctCount = answers.filter(a => a.isCorrect).length;
  const totalQuestions = answers.length;

  const categoryStats: {
    [key in AnswerCategory]: {
      count: number;
      percentage: number;
      questions: string[];
    };
  } = {
    firstTimeCorrect: { count: 0, percentage: 0, questions: [] },
    improvedAfterHint: { count: 0, percentage: 0, questions: [] },
    correctAfterAttempts: { count: 0, percentage: 0, questions: [] },
    stillWrong: { count: 0, percentage: 0, questions: [] }
  };

  const answerCategories: { [questionId: string]: AnswerCategory } = {};
  answers.forEach(answer => {
    const attempts = answer.attempts || [];
    const category = classifyAnswer(answer, attempts);
    answerCategories[answer.questionId] = category;
    categoryStats[category].count++;
    categoryStats[category].questions.push(answer.questionId);
  });

  (Object.keys(categoryStats) as AnswerCategory[]).forEach(key => {
    categoryStats[key].percentage = totalQuestions > 0
      ? categoryStats[key].count / totalQuestions
      : 0;
  });

  let performanceTrend: 'improving' | 'stable' | 'declining' = 'stable';
  if (record.improvementRate > 0.3) {
    performanceTrend = 'improving';
  } else if (record.improvementRate < 0.1 && record.overallAccuracy < 0.6) {
    performanceTrend = 'declining';
  }

  const typeStats: DiagnosticReport['typeDimension']['stats'] = {};
  const typeCorrect: { [key in QuestionType]?: number } = {};
  const typeTotal: { [key in QuestionType]?: number } = {};
  const typeTime: { [key in QuestionType]?: number } = {};
  const typeAttempts: { [key in QuestionType]?: number } = {};

  answers.forEach(answer => {
    const q = questionMap[answer.questionId];
    const type = answer.questionType || q?.type;
    if (!type) return;
    typeTotal[type] = (typeTotal[type] || 0) + 1;
    if (answer.isCorrect) {
      typeCorrect[type] = (typeCorrect[type] || 0) + 1;
    }
    typeTime[type] = (typeTime[type] || 0) + answer.totalTimeSpent;
    typeAttempts[type] = (typeAttempts[type] || 0) + answer.attemptsCount;
  });

  const strongTypes: QuestionType[] = [];
  const weakTypes: QuestionType[] = [];
  const allTypes: QuestionType[] = ['arithmetic', 'fraction', 'equation', 'geometry', 'wordProblem'];

  allTypes.forEach(type => {
    const total = typeTotal[type] || 0;
    if (total === 0) return;

    const correct = typeCorrect[type] || 0;
    const accuracy = correct / total;
    const avgTime = typeTime[type]! / total;
    const avgAttempts = typeAttempts[type]! / total;
    const mastery = calculateMasteryLevel(correct, total, avgTime / 1000, avgAttempts);

    typeStats[type] = {
      total,
      correct,
      accuracy,
      mastery,
      avgTime,
      avgAttempts
    };

    if (accuracy >= 0.8) {
      strongTypes.push(type);
    } else if (accuracy < 0.5) {
      weakTypes.push(type);
    }
  });

  const kpStats: DiagnosticReport['knowledgePointDimension']['stats'] = {};
  const kpMap: { [id: string]: KnowledgePoint } = {};
  const weakPoints: KnowledgePoint[] = [];
  const strongPoints: KnowledgePoint[] = [];
  const priorityReview: KnowledgePoint[] = [];

  record.knowledgePointStats.forEach(stat => {
    const kp = stat.knowledgePoint;
    kpMap[kp.id] = kp;

    const categoryBreakdown: { [key in AnswerCategory]: number } = {
      firstTimeCorrect: 0,
      improvedAfterHint: 0,
      correctAfterAttempts: 0,
      stillWrong: 0
    };

    answers.forEach(answer => {
      const q = questionMap[answer.questionId];
      const answerKp = answer.questionKnowledgePoint || q?.knowledgePoint;
      if (answerKp?.id === kp.id) {
        const category = answerCategories[answer.questionId];
        categoryBreakdown[category]++;
      }
    });

    kpStats[kp.id] = {
      ...stat,
      categoryBreakdown
    };

    if (stat.accuracy >= 0.8) {
      strongPoints.push(kp);
    } else if (stat.accuracy < 0.5) {
      weakPoints.push(kp);
    }

    if (stat.accuracy < 0.7 || categoryBreakdown.stillWrong > 0) {
      priorityReview.push(kp);
    }
  });

  priorityReview.sort((a, b) => {
    const statA = kpStats[a.id];
    const statB = kpStats[b.id];
    return statA.accuracy - statB.accuracy;
  });

  const questionDetails: DiagnosticReport['questionDimension']['details'] = {};
  const questionTimes: { [id: string]: number } = {};
  const questionAttempts: { [id: string]: number } = {};

  answers.forEach(answer => {
    const q = questionMap[answer.questionId];
    const questionText = answer.question || q?.question;
    const type = answer.questionType || q?.type;
    const difficulty = answer.questionDifficulty || q?.difficulty;
    const knowledgePoint = answer.questionKnowledgePoint || q?.knowledgePoint;

    if (!questionText || !type) return;

    questionTimes[answer.questionId] = answer.totalTimeSpent;
    questionAttempts[answer.questionId] = answer.attemptsCount;

    const progress = record.questionProgress?.find(p => p.questionId === answer.questionId);

    questionDetails[answer.questionId] = {
      question: questionText,
      type: type,
      difficulty: difficulty || 'medium',
      knowledgePoint: knowledgePoint,
      isCorrect: answer.isCorrect,
      firstAttemptCorrect: answer.firstAttemptCorrect,
      attempts: answer.attemptsCount,
      totalTime: answer.totalTimeSpent,
      errorType: answer.firstErrorType,
      improvement: progress?.improvement || 'noChange',
      category: answerCategories[answer.questionId]
    };
  });

  const hardestQuestions = Object.entries(questionAttempts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  const mostTimeConsuming = Object.entries(questionTimes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  const shortComment = generateTeacherShortComment(record.masteryLevel, record.overallAccuracy, record.improvementRate);
  const highlights = generateHighlights(record, strongTypes, strongPoints);
  const concerns = generateConcerns(record, weakTypes, weakPoints);
  const suggestions = generateSuggestions(weakPoints, weakTypes, record.errorStats || {});
  const detailedComment = generateTeacherDetailedComment(record, strongTypes, weakTypes, strongPoints, weakPoints, categoryStats);
  const encouragement = generateEncouragement(record.masteryLevel, record.improvementRate);

  return {
    exerciseId: record.exerciseId,
    exerciseDate: record.endTime || Date.now(),
    overall: {
      totalQuestions,
      correctCount,
      accuracy: record.overallAccuracy,
      masteryLevel: record.masteryLevel,
      firstAttemptAccuracy: record.firstAttemptAccuracy,
      improvementRate: record.improvementRate,
      avgTimePerQuestion: record.avgTimePerQuestion,
      avgAttemptsPerQuestion: record.avgAttemptsPerQuestion
    },
    personalDimension: {
      categoryStats,
      performanceTrend
    },
    typeDimension: {
      stats: typeStats,
      strongTypes,
      weakTypes
    },
    knowledgePointDimension: {
      stats: kpStats,
      strongPoints,
      weakPoints,
      priorityReview: priorityReview.slice(0, 5)
    },
    questionDimension: {
      details: questionDetails,
      hardestQuestions,
      mostTimeConsuming
    },
    teacherComments: {
      shortComment,
      detailedComment,
      highlights,
      concerns,
      suggestions,
      encouragement
    }
  };
}

export interface ExerciseSession {
  addQuestion: (question: Question) => void;
  addAttempt: (questionId: string, attempt: AnswerAttempt) => void;
  addAnswer: (record: AnswerRecord) => void;
  finish: () => ExerciseRecord;
  getMasteryLevel: () => number;
}

export function generateClassDiagnosticReport(config: ClassDiagnosticConfig): ClassDiagnosticReport {
  const { records, exerciseId, className, questions } = config;
  const totalStudents = records.length;
  const submittedCount = records.filter(r => r.record.answers.length > 0).length;

  const questionMap: { [id: string]: Question } = {};
  if (questions) {
    questions.forEach(q => {
      questionMap[q.id] = q;
    });
  }

  let totalAccuracy = 0;
  let totalMastery = 0;
  let totalFirstAccuracy = 0;
  let totalTime = 0;
  const masteryDistribution = { excellent: 0, good: 0, medium: 0, needsImprovement: 0 };

  records.forEach(r => {
    totalAccuracy += r.record.overallAccuracy;
    totalMastery += r.record.masteryLevel;
    totalFirstAccuracy += r.record.firstAttemptAccuracy;
    totalTime += r.record.avgTimePerQuestion;

    const mastery = r.record.masteryLevel;
    if (mastery >= 85) masteryDistribution.excellent++;
    else if (mastery >= 70) masteryDistribution.good++;
    else if (mastery >= 50) masteryDistribution.medium++;
    else masteryDistribution.needsImprovement++;
  });

  const avgAccuracy = submittedCount > 0 ? totalAccuracy / submittedCount : 0;
  const avgMasteryLevel = submittedCount > 0 ? totalMastery / submittedCount : 0;
  const avgFirstAttemptAccuracy = submittedCount > 0 ? totalFirstAccuracy / submittedCount : 0;
  const avgTimePerQuestion = submittedCount > 0 ? totalTime / submittedCount : 0;

  const kpStatsMap: { [kpId: string]: { totalAccuracy: number; count: number; weakCount: number; totalPass: number; knowledgePoint: KnowledgePoint } } = {};

  records.forEach(r => {
    r.record.knowledgePointStats.forEach(stat => {
      const kpId = stat.knowledgePoint.id;
      if (!kpStatsMap[kpId]) {
        kpStatsMap[kpId] = {
          totalAccuracy: 0,
          count: 0,
          weakCount: 0,
          totalPass: 0,
          knowledgePoint: stat.knowledgePoint
        };
      }
      kpStatsMap[kpId].totalAccuracy += stat.accuracy;
      kpStatsMap[kpId].count++;
      if (stat.accuracy < 0.5) kpStatsMap[kpId].weakCount++;
      if (stat.accuracy >= 0.6) kpStatsMap[kpId].totalPass++;
    });
  });

  const kpStats: ClassDiagnosticReport['knowledgePointDimension']['stats'] = {};
  const classWeakPoints: KnowledgePoint[] = [];
  const classStrongPoints: KnowledgePoint[] = [];

  Object.entries(kpStatsMap).forEach(([kpId, data]) => {
    const avgAcc = data.totalAccuracy / data.count;
    const passRate = data.totalPass / data.count;
    const classMastery = Math.round(avgAcc * 100);

    let priority: 'high' | 'medium' | 'low' = 'medium';
    if (avgAcc < 0.5 || data.weakCount > totalStudents * 0.4) priority = 'high';
    else if (avgAcc >= 0.8) priority = 'low';

    kpStats[kpId] = {
      knowledgePoint: data.knowledgePoint,
      avgAccuracy: avgAcc,
      classMasteryLevel: classMastery,
      weakCount: data.weakCount,
      passRate,
      priority
    };

    if (avgAcc < 0.5) classWeakPoints.push(data.knowledgePoint);
    if (avgAcc >= 0.8) classStrongPoints.push(data.knowledgePoint);
  });

  classWeakPoints.sort((a, b) => kpStats[a.id].avgAccuracy - kpStats[b.id].avgAccuracy);

  const questionStatsMap: { [qId: string]: { correctCount: number; totalAttempts: number; totalTime: number; errorMap: { [type: string]: number }; question?: string; type?: QuestionType; difficulty?: Difficulty; knowledgePoint?: KnowledgePoint } } = {};

  records.forEach(r => {
    r.record.answers.forEach(answer => {
      const qId = answer.questionId;
      const q = questionMap[qId];
      const questionText = answer.question || q?.question;
      const type = answer.questionType || q?.type;
      const difficulty = answer.questionDifficulty || q?.difficulty;
      const knowledgePoint = answer.questionKnowledgePoint || q?.knowledgePoint;

      if (!questionStatsMap[qId]) {
        questionStatsMap[qId] = {
          correctCount: 0,
          totalAttempts: 0,
          totalTime: 0,
          errorMap: {},
          question: questionText,
          type,
          difficulty,
          knowledgePoint
        };
      }

      if (answer.isCorrect) questionStatsMap[qId].correctCount++;
      questionStatsMap[qId].totalAttempts += answer.attemptsCount;
      questionStatsMap[qId].totalTime += answer.totalTimeSpent;

      if (answer.firstErrorType) {
        const errType = answer.firstErrorType;
        questionStatsMap[qId].errorMap[errType] = (questionStatsMap[qId].errorMap[errType] || 0) + 1;
      }
    });
  });

  const questionStats: ClassDiagnosticReport['questionDimension']['stats'] = {};

  Object.entries(questionStatsMap).forEach(([qId, data]) => {
    const passRate = data.correctCount / submittedCount;
    const avgAttempts = data.totalAttempts / submittedCount;
    const avgTime = data.totalTime / submittedCount;

    const commonErrors = Object.entries(data.errorMap)
      .map(([type, count]) => ({ type: type as ErrorType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    questionStats[qId] = {
      question: data.question || '题目',
      type: data.type || 'arithmetic',
      difficulty: data.difficulty || 'medium',
      knowledgePoint: data.knowledgePoint,
      correctCount: data.correctCount,
      passRate,
      avgAttempts,
      avgTime,
      commonErrors
    };
  });

  const hardestQuestions = Object.entries(questionStats)
    .sort((a, b) => a[1].passRate - b[1].passRate)
    .slice(0, 5)
    .map(([id]) => id);

  const easiestQuestions = Object.entries(questionStats)
    .sort((a, b) => b[1].passRate - a[1].passRate)
    .slice(0, 3)
    .map(([id]) => id);

  const sortedStudents = [...records].sort((a, b) => b.record.masteryLevel - a.record.masteryLevel);

  const focusStudents: ClassDiagnosticReport['studentDimension']['focusStudents'] = [];

  sortedStudents.forEach(r => {
    const mastery = r.record.masteryLevel;
    const accuracy = r.record.overallAccuracy;

    if (mastery < 50) {
      focusStudents.push({
        studentId: r.studentId,
        studentName: r.studentName,
        masteryLevel: mastery,
        accuracy,
        status: 'needsAttention',
        reason: '掌握度低于50%，需要重点关注和个别辅导'
      });
    } else if (r.record.improvementRate < 0 && accuracy < 0.6) {
      focusStudents.push({
        studentId: r.studentId,
        studentName: r.studentName,
        masteryLevel: mastery,
        accuracy,
        status: 'declining',
        reason: '表现呈下滑趋势，需要关注学习状态'
      });
    } else if (mastery >= 90 && accuracy >= 0.9) {
      focusStudents.push({
        studentId: r.studentId,
        studentName: r.studentName,
        masteryLevel: mastery,
        accuracy,
        status: 'excellent',
        reason: '表现非常优秀，可以考虑提供拓展内容'
      });
    }
  });

  const ranking = sortedStudents.map(r => ({
    studentId: r.studentId,
    studentName: r.studentName,
    masteryLevel: r.record.masteryLevel,
    accuracy: r.record.overallAccuracy
  }));

  const keyFindings: string[] = [];
  const teachingSuggestions: string[] = [];

  if (avgAccuracy < 0.6) {
    keyFindings.push(`班级整体正确率偏低（${(avgAccuracy * 100).toFixed(1)}%），需要加强基础训练`);
  } else if (avgAccuracy >= 0.85) {
    keyFindings.push(`班级整体表现优秀（正确率${(avgAccuracy * 100).toFixed(1)}%），基础扎实`);
  }

  if (masteryDistribution.needsImprovement > totalStudents * 0.3) {
    keyFindings.push(`超过30%的学生（${masteryDistribution.needsImprovement}人）掌握度低于50%，两极分化较明显`);
  }

  if (classWeakPoints.length > 0) {
    keyFindings.push(`班级薄弱知识点：${classWeakPoints.map(k => k.name).join('、')}`);
    teachingSuggestions.push(`建议重点复习：${classWeakPoints.map(k => k.name).join('、')}`);
  }

  if (hardestQuestions.length > 0) {
    keyFindings.push(`难题集中在第${hardestQuestions.map((_, i) => i + 1).join('、')}题，全班通过率较低`);
    teachingSuggestions.push('建议针对难题进行集体讲解，帮助学生理解解题思路');
  }

  teachingSuggestions.push('建议分层教学，对不同掌握程度的学生提供针对性辅导');

  if (focusStudents.filter(s => s.status === 'needsAttention').length > 0) {
    teachingSuggestions.push(`对${focusStudents.filter(s => s.status === 'needsAttention').length}名重点关注学生进行个别辅导`);
  }

  const summary = `本次练习共${totalStudents}人参与，班级平均正确率${(avgAccuracy * 100).toFixed(1)}%，平均掌握度${avgMasteryLevel.toFixed(1)}分。` +
    `${classWeakPoints.length > 0 ? `主要薄弱点：${classWeakPoints.map(k => k.name).join('、')}。` : ''}` +
    `整体表现${avgAccuracy >= 0.7 ? '良好' : avgAccuracy >= 0.5 ? '一般' : '需要加强'}。`;

  const nextSteps: string[] = [];
  if (classWeakPoints.length > 0) {
    nextSteps.push(`1. 针对${classWeakPoints.map(k => k.name).join('、')}进行专项复习`);
  }
  nextSteps.push('2. 发放分层补救练习包，因材施教');
  nextSteps.push('3. 对重点关注学生进行一对一辅导');
  nextSteps.push('4. 一周后进行复测，检验学习效果');

  return {
    exerciseId: exerciseId || records[0]?.record.exerciseId || 'class-exercise',
    exerciseDate: records[0]?.record.endTime || Date.now(),
    className,
    totalStudents,
    submittedCount,
    overall: {
      avgAccuracy,
      avgMasteryLevel,
      avgFirstAttemptAccuracy,
      avgTimePerQuestion,
      masteryDistribution
    },
    knowledgePointDimension: {
      stats: kpStats,
      classWeakPoints,
      classStrongPoints
    },
    questionDimension: {
      stats: questionStats,
      hardestQuestions,
      easiestQuestions
    },
    studentDimension: {
      focusStudents: focusStudents.slice(0, 10),
      ranking: ranking.slice(0, 20)
    },
    teachingResearch: {
      summary,
      keyFindings,
      teachingSuggestions,
      nextSteps
    }
  };
}

export const recordModule = {
  createExercise,
  getRecommendation,
  generateDiagnosticReport,
  generateClassDiagnosticReport
};
