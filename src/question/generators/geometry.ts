import type { Question, Difficulty, QuestionStep, Hint, GeometryData } from '../../types';
import { createSeededRandom } from '../../utils/random';

interface GeometryConfig {
  difficulty: Difficulty;
  seed?: number;
}

const shapeNames: { [key: string]: string } = {
  rectangle: '长方形',
  triangle: '三角形',
  circle: '圆形',
  square: '正方形'
};

const unitNames = ['cm', 'm', 'dm', 'mm'];
const calculateNames: { [key: string]: string } = {
  area: '面积',
  perimeter: '周长',
  volume: '体积',
  angle: '角度'
};

function getMeasurementRange(difficulty: Difficulty): [number, number] {
  switch (difficulty) {
    case 'easy':
      return [2, 15];
    case 'medium':
      return [5, 30];
    case 'hard':
      return [10, 50];
  }
}

function generateGeometryProblem(
  rng: ReturnType<typeof createSeededRandom>,
  difficulty: Difficulty
): {
  question: string;
  answer: number;
  steps: QuestionStep[];
  geometryData: GeometryData;
  unit: string;
} {
  const shapes: GeometryData['shape'][] = ['rectangle', 'triangle', 'circle', 'square'];
  const calculateTypes: GeometryData['calculate'][] = difficulty === 'easy'
    ? ['area', 'perimeter']
    : ['area', 'perimeter', 'angle'];

  const shape = rng.pick(shapes);
  const calculate = rng.pick(calculateTypes);
  const unit = rng.pick(unitNames);
  const [min, max] = getMeasurementRange(difficulty);

  const steps: QuestionStep[] = [];
  let answer = 0;
  const measurements: { [key: string]: number } = {};
  let questionText = '';

  if (shape === 'rectangle') {
    const length = rng.nextInt(min, max);
    const width = rng.nextInt(min, max);
    measurements.length = length;
    measurements.width = width;

    if (calculate === 'area') {
      answer = length * width;
      questionText = `一个长方形，长 ${length}${unit}，宽 ${width}${unit}，求它的面积。`;
      steps.push({
        description: `长方形面积公式：面积 = 长 × 宽`,
        answer: '长 × 宽',
        score: 1
      });
      steps.push({
        description: `代入数值：${length} × ${width} = ${answer}`,
        answer: answer,
        score: 2
      });
    } else if (calculate === 'perimeter') {
      answer = 2 * (length + width);
      questionText = `一个长方形，长 ${length}${unit}，宽 ${width}${unit}，求它的周长。`;
      steps.push({
        description: `长方形周长公式：周长 = 2 × (长 + 宽)`,
        answer: '2 × (长 + 宽)',
        score: 1
      });
      steps.push({
        description: `代入数值：2 × (${length} + ${width}) = 2 × ${length + width} = ${answer}`,
        answer: answer,
        score: 2
      });
    }
  } else if (shape === 'square') {
    const side = rng.nextInt(min, max);
    measurements.side = side;

    if (calculate === 'area') {
      answer = side * side;
      questionText = `一个正方形，边长 ${side}${unit}，求它的面积。`;
      steps.push({
        description: `正方形面积公式：面积 = 边长 × 边长`,
        answer: '边长 × 边长',
        score: 1
      });
      steps.push({
        description: `代入数值：${side} × ${side} = ${answer}`,
        answer: answer,
        score: 2
      });
    } else if (calculate === 'perimeter') {
      answer = 4 * side;
      questionText = `一个正方形，边长 ${side}${unit}，求它的周长。`;
      steps.push({
        description: `正方形周长公式：周长 = 4 × 边长`,
        answer: '4 × 边长',
        score: 1
      });
      steps.push({
        description: `代入数值：4 × ${side} = ${answer}`,
        answer: answer,
        score: 2
      });
    }
  } else if (shape === 'triangle') {
    if (calculate === 'area') {
      const base = rng.nextInt(min, max);
      const height = rng.nextInt(min, max);
      measurements.base = base;
      measurements.height = height;
      answer = (base * height) / 2;
      questionText = `一个三角形，底边长 ${base}${unit}，高 ${height}${unit}，求它的面积。`;
      steps.push({
        description: `三角形面积公式：面积 = 底 × 高 ÷ 2`,
        answer: '底 × 高 ÷ 2',
        score: 1
      });
      steps.push({
        description: `代入数值：${base} × ${height} ÷ 2 = ${base * height} ÷ 2 = ${answer}`,
        answer: answer,
        score: 2
      });
    } else if (calculate === 'perimeter') {
      const a = rng.nextInt(min, max);
      const b = rng.nextInt(min, max);
      const c = rng.nextInt(Math.max(min, Math.abs(a - b) + 1), Math.min(max, a + b - 1));
      measurements.a = a;
      measurements.b = b;
      measurements.c = c;
      answer = a + b + c;
      questionText = `一个三角形，三条边分别为 ${a}${unit}、${b}${unit}、${c}${unit}，求它的周长。`;
      steps.push({
        description: `三角形周长公式：周长 = 三条边之和`,
        answer: 'a + b + c',
        score: 1
      });
      steps.push({
        description: `代入数值：${a} + ${b} + ${c} = ${answer}`,
        answer: answer,
        score: 2
      });
    } else if (calculate === 'angle') {
      const angle1 = rng.nextInt(20, 80);
      const angle2 = rng.nextInt(20, 180 - angle1 - 20);
      answer = 180 - angle1 - angle2;
      measurements.angle1 = angle1;
      measurements.angle2 = angle2;
      questionText = `一个三角形，其中两个角分别是 ${angle1}° 和 ${angle2}°，求第三个角的度数。`;
      steps.push({
        description: `三角形内角和定理：三角形三个内角之和等于180°`,
        answer: '180°',
        score: 1
      });
      steps.push({
        description: `计算：180° - ${angle1}° - ${angle2}° = ${answer}°`,
        answer: answer,
        score: 2
      });
    }
  } else if (shape === 'circle') {
    const radius = rng.nextInt(min, max);
    measurements.radius = radius;
    const PI = difficulty === 'easy' ? 3 : 3.14;

    if (calculate === 'area') {
      answer = PI * radius * radius;
      questionText = `一个圆形，半径 ${radius}${unit}，求它的面积。（π取${PI}）`;
      steps.push({
        description: `圆的面积公式：面积 = π × 半径²`,
        answer: 'πr²',
        score: 1
      });
      steps.push({
        description: `代入数值：${PI} × ${radius}² = ${PI} × ${radius * radius} = ${answer}`,
        answer: answer,
        score: 2
      });
    } else if (calculate === 'perimeter') {
      answer = 2 * PI * radius;
      questionText = `一个圆形，半径 ${radius}${unit}，求它的周长。（π取${PI}）`;
      steps.push({
        description: `圆的周长公式：周长 = 2 × π × 半径`,
        answer: '2πr',
        score: 1
      });
      steps.push({
        description: `代入数值：2 × ${PI} × ${radius} = ${answer}`,
        answer: answer,
        score: 2
      });
    }
  }

  return {
    question: questionText,
    answer,
    steps,
    geometryData: {
      shape,
      unit,
      measurements,
      calculate
    },
    unit: calculate === 'angle' ? '°' : (calculate === 'area' ? `${unit}²` : unit)
  };
}

function generateHints(difficulty: Difficulty): Hint[] {
  const baseHints: Hint[] = [
    {
      level: 1,
      type: 'general',
      content: '先看清题目要求计算的是什么（面积/周长/角度），然后回忆对应的公式。'
    },
    {
      level: 2,
      type: 'concept',
      content: '周长是图形所有边的长度之和，面积是图形所占平面的大小。'
    },
    {
      level: 3,
      type: 'step',
      content: '步骤：1. 确定公式 2. 找到对应的数据 3. 代入计算 4. 注意单位'
    }
  ];

  if (difficulty !== 'easy') {
    baseHints.push({
      level: 4,
      type: 'commonMistake',
      content: '常见错误：混淆周长和面积公式，忘记平方单位，或者π取值错误。'
    });
  }

  return baseHints;
}

export function generateGeometryQuestion(
  config: GeometryConfig,
  index: number
): Question {
  const rng = createSeededRandom(config.seed ? config.seed + index : undefined);
  const { question, answer, steps, geometryData, unit } = generateGeometryProblem(rng, config.difficulty);

  const totalScore = steps.reduce((sum, s) => sum + s.score, 0);

  return {
    id: `geometry-${Date.now()}-${index}`,
    type: 'geometry',
    difficulty: config.difficulty,
    question,
    correctAnswer: answer,
    unit,
    inputType: 'number',
    steps,
    hints: generateHints(config.difficulty),
    geometryData,
    totalScore
  };
}
