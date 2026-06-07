import type { HintRequest, HintResult, Hint, ErrorType } from '../types';

const errorTypeHints: { [key in ErrorType]?: Hint[] } = {
  calculationError: [
    {
      level: 1,
      type: 'commonMistake',
      content: '你的答案似乎有误，请检查一下计算过程。'
    },
    {
      level: 2,
      type: 'step',
      content: '建议你再重新算一遍，注意进位、借位和小数点的位置。'
    },
    {
      level: 3,
      type: 'concept',
      content: '可以尝试用另一种方法验证，比如用逆运算检查结果是否正确。'
    }
  ],
  unitError: [
    {
      level: 1,
      type: 'commonMistake',
      content: '注意答案的单位是否正确？'
    },
    {
      level: 2,
      type: 'concept',
      content: '请检查题目要求的单位，确保你的答案使用了正确的单位。'
    },
    {
      level: 3,
      type: 'step',
      content: '回忆一下：面积单位是平方单位，周长单位是长度单位，不要混淆哦。'
    }
  ],
  signError: [
    {
      level: 1,
      type: 'commonMistake',
      content: '检查一下正负号是否正确？'
    },
    {
      level: 2,
      type: 'step',
      content: '移项时要注意变号，减去一个负数等于加上一个正数。'
    },
    {
      level: 3,
      type: 'concept',
      content: '记住：负负得正，正负得负，先定符号再算绝对值。'
    }
  ],
  fractionNotSimplified: [
    {
      level: 1,
      type: 'commonMistake',
      content: '分数需要约分成最简形式哦。'
    },
    {
      level: 2,
      type: 'step',
      content: '找出分子和分母的最大公约数，然后同时除以这个数。'
    },
    {
      level: 3,
      type: 'concept',
      content: '最简分数是指分子和分母的最大公约数是1的分数。'
    }
  ],
  wrongOperation: [
    {
      level: 1,
      type: 'commonMistake',
      content: '你是不是用错了运算方法？'
    },
    {
      level: 2,
      type: 'concept',
      content: '再读一遍题目，看看应该用加法、减法、乘法还是除法？'
    },
    {
      level: 3,
      type: 'step',
      content: '可以先画个图或者列出已知条件，理清数量关系再列式。'
    }
  ],
  missingStep: [
    {
      level: 1,
      type: 'step',
      content: '解题过程不完整，再检查一下还有什么步骤没做？'
    },
    {
      level: 2,
      type: 'concept',
      content: '数学题需要完整的解题过程，每一步都很重要。'
    },
    {
      level: 3,
      type: 'step',
      content: '对照一下解题步骤，看看哪一步漏掉了？可以从第一步开始重新梳理。'
    }
  ],
  misreadQuestion: [
    {
      level: 1,
      type: 'general',
      content: '再仔细读一遍题目，看看有没有漏掉什么信息？'
    },
    {
      level: 2,
      type: 'step',
      content: '把题目中的关键词和数字圈出来，确保理解了题目要求。'
    },
    {
      level: 3,
      type: 'concept',
      content: '审题是解题的第一步，多读两遍题目总是有帮助的。'
    }
  ],
  unknown: [
    {
      level: 1,
      type: 'general',
      content: '别着急，再想想看，你一定可以的！'
    },
    {
      level: 2,
      type: 'concept',
      content: '回忆一下相关的知识点和公式。'
    },
    {
      level: 3,
      type: 'step',
      content: '可以看看这道题的解题提示，或者向老师和同学请教。'
    }
  ]
};

export function getHint(request: HintRequest): HintResult {
  const { question, errorType, attempts } = request;
  const hints: Hint[] = [];

  const maxHints = Math.min(attempts, 3);

  if (errorType && errorTypeHints[errorType]) {
    const errorHints = errorTypeHints[errorType]!;
    hints.push(...errorHints.slice(0, maxHints));
  }

  if (hints.length === 0 && question.hints && question.hints.length > 0) {
    hints.push(...question.hints.slice(0, maxHints));
  }

  if (attempts >= 2 && errorType === 'calculationError' && question.steps) {
    const relevantStep = question.steps[Math.min(attempts - 2, question.steps.length - 1)];
    if (relevantStep) {
      hints.push({
        level: hints.length + 1,
        type: 'step',
        content: `提示：${relevantStep.description.split('=')[0].trim()}`
      });
    }
  }

  const shouldRevealAnswer = attempts >= 5;

  if (shouldRevealAnswer) {
    hints.push({
      level: hints.length + 1,
      type: 'step',
      content: '尝试了这么多次都没答对，别灰心！可以查看答案解析，理解解题过程。'
    });
  }

  return {
    hints,
    shouldRevealAnswer
  };
}

export const hintModule = {
  getHint
};
