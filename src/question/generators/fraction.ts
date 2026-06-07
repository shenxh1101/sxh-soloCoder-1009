import type { Question, Difficulty, QuestionStep, Hint, Fraction } from '../../types';
import { createSeededRandom } from '../../utils/random';
import { gcd, lcm, simplifyFraction, fractionToString } from '../../utils/math';

interface FractionConfig {
  difficulty: Difficulty;
  seed?: number;
}

function getDenominatorRange(difficulty: Difficulty): [number, number] {
  switch (difficulty) {
    case 'easy':
      return [2, 10];
    case 'medium':
      return [2, 20];
    case 'hard':
      return [5, 30];
  }
}

function generateFraction(
  rng: ReturnType<typeof createSeededRandom>,
  difficulty: Difficulty,
  allowImproper: boolean = true
): Fraction {
  const [minD, maxD] = getDenominatorRange(difficulty);
  const denominator = rng.nextInt(minD, maxD);
  let numerator = rng.nextInt(1, allowImproper ? denominator * 2 : denominator - 1);
  return simplifyFraction({ numerator, denominator });
}

function generateFractionProblem(
  rng: ReturnType<typeof createSeededRandom>,
  difficulty: Difficulty
): { question: string; answer: Fraction; steps: QuestionStep[] } {
  const operations = ['+', '-', '×', '÷'];
  let op = rng.pick(operations);

  let f1 = generateFraction(rng, difficulty, difficulty !== 'easy');
  let f2 = generateFraction(rng, difficulty, difficulty !== 'easy');

  const steps: QuestionStep[] = [];
  let answer: Fraction;

  if (op === '÷') {
    const temp = f2;
    f2 = { numerator: temp.denominator, denominator: temp.numerator };
    op = '×';
  }

  if (op === '+' || op === '-') {
    const commonDenominator = lcm(f1.denominator, f2.denominator);
    let num1 = f1.numerator * (commonDenominator / f1.denominator);
    let num2 = f2.numerator * (commonDenominator / f2.denominator);

    steps.push({
      description: `通分：${fractionToString(f1)} = ${num1}/${commonDenominator}，${fractionToString(f2)} = ${num2}/${commonDenominator}`,
      answer: commonDenominator,
      score: 1
    });

    let resultNum: number;
    if (op === '+') {
      resultNum = num1 + num2;
      steps.push({
        description: `分子相加：${num1} + ${num2} = ${resultNum}`,
        answer: resultNum,
        score: 1
      });
    } else {
      if (num1 < num2) {
        [num1, num2] = [num2, num1];
        [f1, f2] = [f2, f1];
      }
      resultNum = num1 - num2;
      steps.push({
        description: `分子相减：${num1} - ${num2} = ${resultNum}`,
        answer: resultNum,
        score: 1
      });
    }

    answer = simplifyFraction({ numerator: resultNum, denominator: commonDenominator });
    steps.push({
      description: `约分：${resultNum}/${commonDenominator} = ${fractionToString(answer)}`,
      answer: answer,
      score: 1
    });
  } else if (op === '×') {
    steps.push({
      description: `分子相乘：${f1.numerator} × ${f2.numerator} = ${f1.numerator * f2.numerator}`,
      answer: f1.numerator * f2.numerator,
      score: 1
    });
    steps.push({
      description: `分母相乘：${f1.denominator} × ${f2.denominator} = ${f1.denominator * f2.denominator}`,
      answer: f1.denominator * f2.denominator,
      score: 1
    });
    const rawAnswer = {
      numerator: f1.numerator * f2.numerator,
      denominator: f1.denominator * f2.denominator
    };
    answer = simplifyFraction(rawAnswer);
    steps.push({
      description: `约分：${fractionToString(rawAnswer)} = ${fractionToString(answer)}`,
      answer: answer,
      score: 1
    });
  } else {
    const reciprocal = { numerator: f2.denominator, denominator: f2.numerator };
    steps.push({
      description: `除以一个分数等于乘以它的倒数：${fractionToString(f2)} 的倒数是 ${fractionToString(reciprocal)}`,
      answer: reciprocal,
      score: 1
    });
    const rawAnswer = {
      numerator: f1.numerator * reciprocal.numerator,
      denominator: f1.denominator * reciprocal.denominator
    };
    answer = simplifyFraction(rawAnswer);
    steps.push({
      description: `约分得到最终结果：${fractionToString(answer)}`,
      answer: answer,
      score: 2
    });
  }

  let questionOp = op;
  if (op === '÷') {
    questionOp = '÷';
  }
  const question = `请计算：${fractionToString(f1)} ${questionOp} ${fractionToString(f2)} = ?（结果请用最简分数表示）`;

  return { question, answer, steps };
}

function generateHints(difficulty: Difficulty): Hint[] {
  const baseHints: Hint[] = [
    {
      level: 1,
      type: 'general',
      content: '分数运算时，先看清是哪种运算，加减需要通分，乘除可以先约分。'
    },
    {
      level: 2,
      type: 'concept',
      content: '同分母分数相加减，分母不变，分子相加减；异分母分数相加减，先通分再计算。'
    },
    {
      level: 3,
      type: 'concept',
      content: '分数乘法：分子乘分子，分母乘分母；分数除法：除以一个数等于乘以它的倒数。'
    },
    {
      level: 4,
      type: 'step',
      content: '最后结果一定要约分成最简分数，也就是分子和分母的最大公约数是1。'
    }
  ];

  if (difficulty === 'hard') {
    baseHints.push({
      level: 5,
      type: 'commonMistake',
      content: '常见错误：通分时只改变分母忘记改变分子，或者除法时忘记变成倒数。'
    });
  }

  return baseHints;
}

export function generateFractionQuestion(
  config: FractionConfig,
  index: number
): Question {
  const rng = createSeededRandom(config.seed ? config.seed + index : undefined);
  const { question, answer, steps } = generateFractionProblem(rng, config.difficulty);

  const totalScore = steps.reduce((sum, s) => sum + s.score, 0);

  return {
    id: `fraction-${Date.now()}-${index}`,
    type: 'fraction',
    difficulty: config.difficulty,
    question,
    correctAnswer: answer,
    inputType: 'fraction',
    steps,
    hints: generateHints(config.difficulty),
    totalScore
  };
}
