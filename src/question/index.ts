import type { Question, QuestionConfig, KnowledgePoint, MixedExerciseConfig, QuestionType, Difficulty, AdaptiveConfig } from '../types';
import { createSeededRandom } from '../utils/random';
import { createAdaptiveExercise } from '../adaptive';
import { generateArithmeticQuestion } from './generators/arithmetic';
import { generateFractionQuestion } from './generators/fraction';
import { generateEquationQuestion } from './generators/equation';
import { generateGeometryQuestion } from './generators/geometry';
import { generateWordProblemQuestion } from './generators/wordProblem';

const defaultKnowledgePoints: { [key: string]: KnowledgePoint[] } = {
  arithmetic: [
    { id: 'arithmetic-1', name: '整数加减法', grade: '三年级' },
    { id: 'arithmetic-2', name: '整数乘除法', grade: '三年级' },
    { id: 'arithmetic-3', name: '四则混合运算', grade: '四年级' }
  ],
  fraction: [
    { id: 'fraction-1', name: '分数的认识', grade: '五年级' },
    { id: 'fraction-2', name: '分数的加减法', grade: '五年级' },
    { id: 'fraction-3', name: '分数的乘除法', grade: '六年级' }
  ],
  equation: [
    { id: 'equation-1', name: '简易方程', grade: '五年级' },
    { id: 'equation-2', name: '一元一次方程', grade: '七年级' },
    { id: 'equation-3', name: '分数系数方程', grade: '七年级' }
  ],
  geometry: [
    { id: 'geometry-1', name: '长方形和正方形', grade: '三年级' },
    { id: 'geometry-2', name: '三角形', grade: '四年级' },
    { id: 'geometry-3', name: '圆', grade: '六年级' }
  ],
  wordProblem: [
    { id: 'wp-1', name: '加减应用题', grade: '三年级' },
    { id: 'wp-2', name: '乘除应用题', grade: '四年级' },
    { id: 'wp-3', name: '分数应用题', grade: '六年级' }
  ]
};

export function createQuestions(config: QuestionConfig): Question[] {
  const questions: Question[] = [];
  const generatorConfig = {
    difficulty: config.difficulty,
    seed: config.seed
  };

  const knowledgePoints = config.knowledgePoints || defaultKnowledgePoints[config.type] || [];

  for (let i = 0; i < config.count; i++) {
    let question: Question;

    switch (config.type) {
      case 'arithmetic':
        question = generateArithmeticQuestion(generatorConfig, i);
        break;
      case 'fraction':
        question = generateFractionQuestion(generatorConfig, i);
        break;
      case 'equation':
        question = generateEquationQuestion(generatorConfig, i);
        break;
      case 'geometry':
        question = generateGeometryQuestion(generatorConfig, i);
        break;
      case 'wordProblem':
        question = generateWordProblemQuestion(generatorConfig, i);
        break;
      default:
        throw new Error(`Unsupported question type: ${config.type}`);
    }

    if (knowledgePoints.length > 0) {
      question.knowledgePoint = knowledgePoints[i % knowledgePoints.length];
    }

    questions.push(question);
  }

  return questions;
}

function generateQuestionByType(
  type: QuestionType,
  difficulty: Difficulty,
  seed: number,
  index: number,
  knowledgePoints?: KnowledgePoint[]
): Question {
  const generatorConfig = { difficulty, seed };
  let question: Question;

  switch (type) {
    case 'arithmetic':
      question = generateArithmeticQuestion(generatorConfig, index);
      break;
    case 'fraction':
      question = generateFractionQuestion(generatorConfig, index);
      break;
    case 'equation':
      question = generateEquationQuestion(generatorConfig, index);
      break;
    case 'geometry':
      question = generateGeometryQuestion(generatorConfig, index);
      break;
    case 'wordProblem':
      question = generateWordProblemQuestion(generatorConfig, index);
      break;
    default:
      throw new Error(`Unsupported question type: ${type}`);
  }

  if (knowledgePoints && knowledgePoints.length > 0) {
    question.knowledgePoint = knowledgePoints[index % knowledgePoints.length];
  }

  return question;
}

function normalizeTypeRatio(
  typeRatio: { [key in QuestionType]?: number },
  totalCount: number
): { type: QuestionType; count: number }[] {
  const allTypes: QuestionType[] = ['arithmetic', 'fraction', 'equation', 'geometry', 'wordProblem'];
  const result: { type: QuestionType; count: number }[] = [];

  const totalRatio = Object.values(typeRatio).reduce((sum, r) => sum + (r || 0), 0);

  if (totalRatio === 0) {
    const perType = Math.floor(totalCount / allTypes.length);
    const remainder = totalCount % allTypes.length;
    allTypes.forEach((type, i) => {
      result.push({
        type,
        count: perType + (i < remainder ? 1 : 0)
      });
    });
  } else {
    let assignedCount = 0;
    allTypes.forEach((type) => {
      const ratio = typeRatio[type] || 0;
      if (ratio > 0) {
        const count = Math.round((ratio / totalRatio) * totalCount);
        result.push({ type, count });
        assignedCount += count;
      }
    });

    const diff = totalCount - assignedCount;
    if (diff !== 0 && result.length > 0) {
      result[0].count += diff;
    }
  }

  return result.filter(r => r.count > 0);
}

export function createMixedQuestions(config: MixedExerciseConfig): Question[] {
  const {
    totalCount,
    typeRatio = {},
    difficultyRange = ['easy', 'medium', 'hard'],
    knowledgePoints,
    seed,
    shuffle = true
  } = config;

  const rng = createSeededRandom(seed);
  const typeDistribution = normalizeTypeRatio(typeRatio, totalCount);

  const allQuestions: Question[] = [];
  let questionIndex = 0;

  for (const { type, count } of typeDistribution) {
    const typeKnowledgePoints = knowledgePoints?.filter(kp =>
      defaultKnowledgePoints[type]?.some(dkp => dkp.id === kp.id)
    ) || defaultKnowledgePoints[type];

    for (let i = 0; i < count; i++) {
      const difficulty = difficultyRange.length > 0
        ? rng.pick(difficultyRange)
        : 'medium';

      const questionSeed = seed ? seed + questionIndex * 1000 : undefined;
      const question = generateQuestionByType(
        type,
        difficulty,
        questionSeed || Date.now(),
        questionIndex,
        typeKnowledgePoints
      );

      allQuestions.push(question);
      questionIndex++;
    }
  }

  if (shuffle) {
    const shuffleRng = createSeededRandom(seed ? seed + 99999 : undefined);
    return shuffleRng.shuffle(allQuestions);
  }

  return allQuestions;
}

export function createAdaptiveQuestions(config: AdaptiveConfig) {
  return createAdaptiveExercise(config);
}

export const questionModule = {
  create: createQuestions,
  createMixed: createMixedQuestions,
  createAdaptive: createAdaptiveQuestions
};
