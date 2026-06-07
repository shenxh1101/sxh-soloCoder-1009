import type { Question, Difficulty, QuestionStep, Hint } from '../../types';
import { createSeededRandom } from '../../utils/random';

interface WordProblemConfig {
  difficulty: Difficulty;
  seed?: number;
}

interface ProblemTemplate {
  template: (data: any) => string;
  generateData: (rng: ReturnType<typeof createSeededRandom>, difficulty: Difficulty) => any;
  calculateAnswer: (data: any) => number;
  generateSteps: (data: any, answer: number) => QuestionStep[];
}

const templates: ProblemTemplate[] = [
  {
    template: (data) => `小明有 ${data.apples} 个苹果，送给小红 ${data.given} 个，又买了 ${data.bought} 个，请问小明现在有多少个苹果？`,
    generateData: (rng, difficulty) => {
      const [min, max] = difficulty === 'easy' ? [5, 20] : [20, 100];
      const apples = rng.nextInt(min, max);
      const given = rng.nextInt(1, apples - 1);
      const bought = rng.nextInt(min, max);
      return { apples, given, bought };
    },
    calculateAnswer: (data) => data.apples - data.given + data.bought,
    generateSteps: (data, answer) => [
      {
        description: `先算送出后剩下的：${data.apples} - ${data.given} = ${data.apples - data.given}`,
        answer: data.apples - data.given,
        score: 1
      },
      {
        description: `再算买来后的总数：${data.apples - data.given} + ${data.bought} = ${answer}`,
        answer: answer,
        score: 2
      }
    ]
  },
  {
    template: (data) => `学校组织春游，一共有 ${data.classes} 个班，每个班有 ${data.students} 名学生，如果每辆大巴车可以坐 ${data.capacity} 人，请问需要多少辆大巴车？`,
    generateData: (rng, difficulty) => {
      const classes = difficulty === 'easy' ? rng.nextInt(2, 5) : rng.nextInt(3, 8);
      const students = difficulty === 'easy' ? rng.nextInt(20, 40) : rng.nextInt(30, 50);
      const capacity = difficulty === 'easy' ? rng.nextInt(30, 50) : rng.nextInt(40, 60);
      return { classes, students, capacity };
    },
    calculateAnswer: (data) => Math.ceil((data.classes * data.students) / data.capacity),
    generateSteps: (data, answer) => [
      {
        description: `先算总人数：${data.classes} × ${data.students} = ${data.classes * data.students} 人`,
        answer: data.classes * data.students,
        score: 1
      },
      {
        description: `再算需要的车辆数：${data.classes * data.students} ÷ ${data.capacity} ≈ ${answer} 辆（向上取整）`,
        answer: answer,
        score: 2
      }
    ]
  },
  {
    template: (data) => `商店里一支笔卖 ${data.price} 元，笔记本的价格是笔的 ${data.notebookMultiple} 倍，书包的价格是笔记本的 ${data.bagMultiple} 倍，请问书包多少钱？`,
    generateData: (rng, difficulty) => {
      const price = difficulty === 'easy' ? rng.nextInt(2, 10) : rng.nextInt(5, 20);
      const notebookMultiple = difficulty === 'easy' ? rng.nextInt(2, 4) : rng.nextInt(2, 6);
      const bagMultiple = difficulty === 'easy' ? rng.nextInt(3, 6) : rng.nextInt(4, 10);
      return { price, notebookMultiple, bagMultiple };
    },
    calculateAnswer: (data) => data.price * data.notebookMultiple * data.bagMultiple,
    generateSteps: (data, answer) => [
      {
        description: `先算笔记本价格：${data.price} × ${data.notebookMultiple} = ${data.price * data.notebookMultiple} 元`,
        answer: data.price * data.notebookMultiple,
        score: 1
      },
      {
        description: `再算书包价格：${data.price * data.notebookMultiple} × ${data.bagMultiple} = ${answer} 元`,
        answer: answer,
        score: 2
      }
    ]
  },
  {
    template: (data) => `一个工程队要修一条长 ${data.length} 米的公路，前 ${data.days} 天每天修 ${data.perDay} 米，剩下的要在 ${data.remainingDays} 天内完成，请问剩下的平均每天要修多少米？`,
    generateData: (rng, difficulty) => {
      const length = difficulty === 'easy' ? rng.nextInt(200, 500) : rng.nextInt(500, 2000);
      const days = rng.nextInt(2, 5);
      const perDay = difficulty === 'easy' ? rng.nextInt(20, 40) : rng.nextInt(30, 80);
      const remainingDays = rng.nextInt(3, 7);
      return { length, days, perDay, remainingDays };
    },
    calculateAnswer: (data) => {
      const completed = data.days * data.perDay;
      const remaining = data.length - completed;
      return remaining / data.remainingDays;
    },
    generateSteps: (data, answer) => {
      const completed = data.days * data.perDay;
      const remaining = data.length - completed;
      return [
        {
          description: `先算已经修了的：${data.days} × ${data.perDay} = ${completed} 米`,
          answer: completed,
          score: 1
        },
        {
          description: `再算剩下的：${data.length} - ${completed} = ${remaining} 米`,
          answer: remaining,
          score: 1
        },
        {
          description: `最后算每天需要修：${remaining} ÷ ${data.remainingDays} = ${answer} 米`,
          answer: answer,
          score: 1
        }
      ];
    }
  },
  {
    template: (data) => `小明看一本 ${data.pages} 页的故事书，第一天看了全书的 \\(${data.firstDayRatio.numerator}\\over${data.firstDayRatio.denominator}\\)，第二天看了全书的 \\(${data.secondDayRatio.numerator}\\over${data.secondDayRatio.denominator}\\)，请问还剩多少页没看？`,
    generateData: (rng, difficulty) => {
      const pages = difficulty === 'easy'
        ? rng.nextInt(4, 10) * 12
        : rng.nextInt(10, 30) * 12;
      const firstDayRatio = { numerator: 1, denominator: rng.nextInt(3, 6) };
      const secondDayRatio = { numerator: 1, denominator: rng.nextInt(4, 8) };
      return { pages, firstDayRatio, secondDayRatio };
    },
    calculateAnswer: (data) => {
      const firstDay = data.pages / data.firstDayRatio.denominator * data.firstDayRatio.numerator;
      const secondDay = data.pages / data.secondDayRatio.denominator * data.secondDayRatio.numerator;
      return data.pages - firstDay - secondDay;
    },
    generateSteps: (data, answer) => {
      const firstDay = data.pages / data.firstDayRatio.denominator * data.firstDayRatio.numerator;
      const secondDay = data.pages / data.secondDayRatio.denominator * data.secondDayRatio.numerator;
      return [
        {
          description: `第一天看了：${data.pages} × ${data.firstDayRatio.numerator}/${data.firstDayRatio.denominator} = ${firstDay} 页`,
          answer: firstDay,
          score: 1
        },
        {
          description: `第二天看了：${data.pages} × ${data.secondDayRatio.numerator}/${data.secondDayRatio.denominator} = ${secondDay} 页`,
          answer: secondDay,
          score: 1
        },
        {
          description: `还剩：${data.pages} - ${firstDay} - ${secondDay} = ${answer} 页`,
          answer: answer,
          score: 2
        }
      ];
    }
  }
];

function generateHints(difficulty: Difficulty): Hint[] {
  const baseHints: Hint[] = [
    {
      level: 1,
      type: 'general',
      content: '认真读题，找出题目中的已知条件和要求的问题。'
    },
    {
      level: 2,
      type: 'concept',
      content: '应用题解题步骤：1. 审题 2. 分析数量关系 3. 列式计算 4. 检验作答'
    },
    {
      level: 3,
      type: 'step',
      content: '可以先画图或者列出表格来帮助理解题意，弄清先算什么，再算什么。'
    }
  ];

  if (difficulty !== 'easy') {
    baseHints.push({
      level: 4,
      type: 'commonMistake',
      content: '常见错误：没有看清单位，或者在多步计算中漏掉某一步。'
    });
  }

  return baseHints;
}

export function generateWordProblemQuestion(
  config: WordProblemConfig,
  index: number
): Question {
  const rng = createSeededRandom(config.seed ? config.seed + index : undefined);

  const availableTemplates = config.difficulty === 'easy'
    ? templates.slice(0, 3)
    : templates;

  const templateIndex = rng.nextInt(0, availableTemplates.length - 1);
  const template = availableTemplates[templateIndex];

  const data = template.generateData(rng, config.difficulty);
  const question = template.template(data);
  const answer = template.calculateAnswer(data);
  const steps = template.generateSteps(data, answer);

  const totalScore = steps.reduce((sum, s) => sum + s.score, 0);

  return {
    id: `wordProblem-${Date.now()}-${index}`,
    type: 'wordProblem',
    difficulty: config.difficulty,
    question,
    correctAnswer: answer,
    inputType: 'number',
    steps,
    hints: generateHints(config.difficulty),
    totalScore
  };
}
