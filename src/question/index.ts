import type { Question, QuestionConfig, KnowledgePoint } from '../types';
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

export const questionModule = {
  create: createQuestions
};
