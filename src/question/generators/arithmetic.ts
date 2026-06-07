import type { Question, Difficulty, QuestionStep, Hint } from '../../types';
import type { SeededRandom } from '../../utils/random';
import { createSeededRandom } from '../../utils/random';

interface ArithmeticConfig {
  difficulty: Difficulty;
  seed?: number;
}

const operations = ['+', '-', '×', '÷'];

function getNumberRange(difficulty: Difficulty): [number, number] {
  switch (difficulty) {
    case 'easy':
      return [1, 20];
    case 'medium':
      return [10, 100];
    case 'hard':
      return [50, 500];
  }
}

function getOperationCount(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy':
      return 2;
    case 'medium':
      return 2;
    case 'hard':
      return 3;
  }
}

function generateExpression(
  rng: SeededRandom,
  difficulty: Difficulty
): { expression: string; answer: number; steps: QuestionStep[] } {
  const [min, max] = getNumberRange(difficulty);
  const opCount = getOperationCount(difficulty);
  const numbers: number[] = [];
  const ops: string[] = [];

  for (let i = 0; i <= opCount; i++) {
    numbers.push(rng.nextInt(min, max));
  }
  for (let i = 0; i < opCount; i++) {
    ops.push(rng.pick(operations));
  }

  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '÷') {
      const divisor = numbers[i + 1];
      numbers[i] = divisor * rng.nextInt(1, Math.floor(max / divisor) || 1);
    }
    if (ops[i] === '-' && numbers[i] < numbers[i + 1]) {
      [numbers[i], numbers[i + 1]] = [numbers[i + 1], numbers[i]];
    }
  }

  let expression = '';
  for (let i = 0; i < numbers.length; i++) {
    if (i > 0) {
      expression += ` ${ops[i - 1]} `;
    }
    expression += numbers[i];
  }

  const steps: QuestionStep[] = [];
  let workingNumbers = [...numbers];
  let workingOps = [...ops];

  while (workingOps.length > 0) {
    let mulDivIndex = workingOps.findIndex(op => op === '×' || op === '÷');
    let index = mulDivIndex !== -1 ? mulDivIndex : 0;
    const op = workingOps[index];
    const a = workingNumbers[index];
    const b = workingNumbers[index + 1];
    let result: number;
    let stepDesc = '';

    switch (op) {
      case '+':
        result = a + b;
        stepDesc = `计算 ${a} + ${b} = ${result}`;
        break;
      case '-':
        result = a - b;
        stepDesc = `计算 ${a} - ${b} = ${result}`;
        break;
      case '×':
        result = a * b;
        stepDesc = `计算 ${a} × ${b} = ${result}`;
        break;
      case '÷':
        result = a / b;
        stepDesc = `计算 ${a} ÷ ${b} = ${result}`;
        break;
      default:
        result = 0;
    }

    steps.push({
      description: stepDesc,
      answer: result,
      score: 1
    });

    workingNumbers.splice(index, 2, result);
    workingOps.splice(index, 1);
  }

  return {
    expression,
    answer: workingNumbers[0],
    steps
  };
}

function generateHints(difficulty: Difficulty): Hint[] {
  const baseHints: Hint[] = [
    {
      level: 1,
      type: 'general',
      content: '先看清题目中的运算符号，按照从左到右的顺序进行计算。'
    },
    {
      level: 2,
      type: 'concept',
      content: '记住运算顺序：先乘除，后加减。如果有括号，先算括号里的。'
    },
    {
      level: 3,
      type: 'step',
      content: '先找出所有的乘法和除法，先计算它们，再计算加法和减法。'
    }
  ];

  if (difficulty === 'hard') {
    baseHints.push({
      level: 4,
      type: 'commonMistake',
      content: '常见错误：忘记进位或借位，或者在多步计算时抄错中间结果。'
    });
  }

  return baseHints;
}

export function generateArithmeticQuestion(
  config: ArithmeticConfig,
  index: number
): Question {
  const rng = createSeededRandom(config.seed ? config.seed + index : undefined);
  const { expression, answer, steps } = generateExpression(rng, config.difficulty);

  const totalScore = steps.length > 0 ? steps.reduce((sum, s) => sum + s.score, 0) : 5;

  return {
    id: `arithmetic-${Date.now()}-${index}`,
    type: 'arithmetic',
    difficulty: config.difficulty,
    question: `请计算：${expression} = ?`,
    correctAnswer: answer,
    inputType: 'number',
    steps,
    hints: generateHints(config.difficulty),
    totalScore
  };
}
