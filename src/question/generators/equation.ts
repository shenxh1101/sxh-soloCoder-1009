import type { Question, Difficulty, QuestionStep, Hint } from '../../types';
import { createSeededRandom } from '../../utils/random';

interface EquationConfig {
  difficulty: Difficulty;
  seed?: number;
}

function getCoefficientRange(difficulty: Difficulty): [number, number] {
  switch (difficulty) {
    case 'easy':
      return [1, 10];
    case 'medium':
      return [-10, 20];
    case 'hard':
      return [-20, 30];
  }
}

function generateEquation(
  rng: ReturnType<typeof createSeededRandom>,
  difficulty: Difficulty
): { question: string; answer: number; steps: QuestionStep[] } {
  const [minC, maxC] = getCoefficientRange(difficulty);
  const steps: QuestionStep[] = [];

  if (difficulty === 'easy') {
    const a = rng.nextInt(1, maxC);
    const b = rng.nextInt(minC, maxC);
    const c = rng.nextInt(Math.max(1, b + 1), b + 20);

    const answer = (c - b) / a;

    steps.push({
      description: `将常数项移到等式右边：${a}x = ${c} - ${b}`,
      answer: c - b,
      score: 1
    });
    steps.push({
      description: `计算右边：${c} - ${b} = ${c - b}`,
      answer: c - b,
      score: 1
    });
    steps.push({
      description: `两边同时除以${a}：x = ${c - b} ÷ ${a}`,
      answer: answer,
      score: 1
    });

    return {
      question: `解方程：${a}x + ${b} = ${c}`,
      answer,
      steps
    };
  } else if (difficulty === 'medium') {
    const a = rng.nextInt(2, maxC);
    const b = rng.nextInt(minC, maxC);
    const c = rng.nextInt(1, maxC);
    const d = rng.nextInt(minC, maxC);

    const leftCoef = a - c;
    const rightConst = d - b;
    const answer = rightConst / leftCoef;

    steps.push({
      description: `移项，将含x的项移到左边，常数项移到右边：${a}x - ${c}x = ${d} - ${b}`,
      answer: `${leftCoef}x = ${rightConst}`,
      score: 1
    });
    steps.push({
      description: `合并同类项：${leftCoef}x = ${rightConst}`,
      answer: rightConst,
      score: 1
    });
    steps.push({
      description: `两边同时除以${leftCoef}：x = ${rightConst} ÷ ${leftCoef}`,
      answer: answer,
      score: 2
    });

    const bSign = b >= 0 ? '+' : '-';
    const cSign = c >= 0 ? '+' : '-';
    return {
      question: `解方程：${a}x ${bSign} ${Math.abs(b)} = ${c}x ${cSign} ${Math.abs(d)}`,
      answer,
      steps
    };
  } else {
    const a = rng.nextInt(2, 10);
    const b = rng.nextInt(1, 10);
    const c = rng.nextInt(2, 10);
    const d = rng.nextInt(1, 20);

    const commonDenom = a * c;
    const newA = b * c;
    const newB = d * a;
    const answer = newB / newA;

    steps.push({
      description: `去分母，两边同时乘以${commonDenom}：${commonDenom / a}×${b}x = ${commonDenom / c}×${d}`,
      answer: `${newA}x = ${newB}`,
      score: 2
    });
    steps.push({
      description: `化简：${newA}x = ${newB}`,
      answer: newB,
      score: 1
    });
    steps.push({
      description: `两边同时除以${newA}：x = ${newB} ÷ ${newA}`,
      answer: answer,
      score: 2
    });

    return {
      question: `解方程：\\(${b}\\over${a}\\)x = \\(${d}\\over${c}\\)`,
      answer,
      steps
    };
  }
}

function generateHints(difficulty: Difficulty): Hint[] {
  const baseHints: Hint[] = [
    {
      level: 1,
      type: 'general',
      content: '解方程的目标是求出未知数x的值，记得等式两边要保持相等。'
    },
    {
      level: 2,
      type: 'concept',
      content: '移项要变号：把一个数从等式一边移到另一边，正负号要改变。'
    },
    {
      level: 3,
      type: 'step',
      content: '步骤：1. 去分母（如果有）2. 去括号（如果有）3. 移项 4. 合并同类项 5. 系数化为1'
    }
  ];

  if (difficulty !== 'easy') {
    baseHints.push({
      level: 4,
      type: 'commonMistake',
      content: '常见错误：移项忘记变号，或者去分母时漏乘没有分母的项。'
    });
  }

  return baseHints;
}

export function generateEquationQuestion(
  config: EquationConfig,
  index: number
): Question {
  const rng = createSeededRandom(config.seed ? config.seed + index : undefined);
  const { question, answer, steps } = generateEquation(rng, config.difficulty);

  const totalScore = steps.reduce((sum, s) => sum + s.score, 0);

  return {
    id: `equation-${Date.now()}-${index}`,
    type: 'equation',
    difficulty: config.difficulty,
    question,
    correctAnswer: answer,
    inputType: 'number',
    steps,
    hints: generateHints(config.difficulty),
    totalScore
  };
}
