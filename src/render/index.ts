import type { Question, RenderResult } from '../types';
import { fractionToString } from '../utils/math';

function escapeHtml(text: string): string {
  const htmlEscapes: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

function getInputPlaceholder(inputType: string, unit?: string): string {
  const unitSuffix = unit ? `（${unit}）` : '';
  switch (inputType) {
    case 'number':
      return `请输入答案${unitSuffix}`;
    case 'fraction':
      return '请输入分数，如 3/4';
    case 'text':
      return '请输入答案';
    case 'select':
      return '请选择答案';
    default:
      return '请输入答案';
  }
}

function getDraftPrompt(questionType: string): string {
  switch (questionType) {
    case 'arithmetic':
      return '草稿区：请在这里写下你的计算过程，可以分步计算。';
    case 'fraction':
      return '草稿区：请在这里写下通分、约分的过程。';
    case 'equation':
      return '草稿区：请在这里写下解方程的步骤，注意移项要变号。';
    case 'geometry':
      return '草稿区：请在这里写下公式和计算过程，注意单位。';
    case 'wordProblem':
      return '草稿区：请在这里分析题目中的数量关系，列出算式。';
    default:
      return '草稿区：请在这里写下你的思考过程。';
  }
}

function renderQuestionHtml(question: Question, platform: 'web' | 'mobile'): string {
  const textClass = platform === 'mobile' ? 'text-xl' : 'text-lg';
  const paddingClass = platform === 'mobile' ? 'p-4' : 'p-6';
  return `<div class="question-container ${paddingClass} bg-white rounded-lg shadow-md">
    <p class="question-text ${textClass} font-medium text-gray-800 leading-relaxed">
      ${question.question}
    </p>
    ${question.knowledgePoint ? `<span class="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">${question.knowledgePoint.name}</span>` : ''}
  </div>`;
}

function renderOptionsHtml(question: Question, platform: 'web' | 'mobile'): string | undefined {
  if (!question.options || question.options.length === 0) return undefined;

  const optionSize = platform === 'mobile' ? 'py-3 px-4' : 'py-2 px-4';
  const optionsHtml = question.options.map((option, index) => `
    <label class="option-item block cursor-pointer ${optionSize} border border-gray-200 rounded-lg mb-2 hover:bg-blue-50 transition-colors">
      <input type="radio" name="answer" value="${index}" class="mr-3" />
      <span class="inline-block w-6 h-6 leading-6 text-center bg-gray-100 rounded-full text-sm font-medium mr-2">${String.fromCharCode(65 + index)}</span>
      <span class="text-gray-700">${option}</span>
    </label>
  `).join('');

  return `<div class="options-container mt-4">${optionsHtml}</div>`;
}

function renderInputHtml(question: Question, platform: 'web' | 'mobile'): string {
  const inputSize = platform === 'mobile' ? 'py-4 px-4 text-xl' : 'py-3 px-4 text-base';
  const placeholder = getInputPlaceholder(question.inputType, question.unit);

  if (question.inputType === 'fraction') {
    return `<div class="input-container mt-4">
      <div class="fraction-input flex items-center gap-2">
        <div class="flex flex-col items-center">
          <input type="number" name="numerator" placeholder="分子" class="${inputSize} w-24 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          <div class="w-full h-0.5 bg-gray-800 my-1"></div>
          <input type="number" name="denominator" placeholder="分母" class="${inputSize} w-24 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
        </div>
        ${question.unit ? `<span class="unit text-gray-600 text-lg ml-2">${question.unit}</span>` : ''}
      </div>
      <p class="text-sm text-gray-500 mt-2">${placeholder}</p>
    </div>`;
  }

  if (question.inputType === 'select' && question.options) {
    return renderOptionsHtml(question, platform) || '';
  }

  return `<div class="input-container mt-4">
    <div class="flex items-center gap-2">
      <input 
        type="${question.inputType === 'number' ? 'number' : 'text'}" 
        name="answer" 
        placeholder="${placeholder}"
        class="${inputSize} flex-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        ${question.unit ? '' : ''}
      />
      ${question.unit ? `<span class="unit text-gray-600 text-lg">${question.unit}</span>` : ''}
    </div>
  </div>`;
}

function renderDraftAreaHtml(question: Question, platform: 'web' | 'mobile'): string {
  const placeholder = getDraftPrompt(question.type);
  const textareaSize = platform === 'mobile' ? 'min-h-[120px]' : 'min-h-[100px]';

  return `<div class="draft-area-container mt-4">
    <label class="block text-sm font-medium text-gray-700 mb-2">草稿区</label>
    <textarea 
      name="draft" 
      placeholder="${placeholder}"
      class="${textareaSize} w-full p-3 border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-700"
    ></textarea>
    <div class="draft-tools mt-2 flex gap-2">
      <button type="button" class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded text-gray-700">清除</button>
      <button type="button" class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded text-gray-700">插入符号</button>
    </div>
  </div>`;
}

export function renderQuestion(
  question: Question,
  platform: 'web' | 'mobile' = 'web'
): RenderResult {
  let displayQuestion = question.question;
  if (question.type === 'geometry' && question.geometryData) {
    const shapeMap: { [key: string]: string } = {
      rectangle: '▭',
      square: '□',
      triangle: '△',
      circle: '○'
    };
    const shapeSymbol = shapeMap[question.geometryData.shape] || '';
    displayQuestion = `${shapeSymbol} ${displayQuestion}`;
  }

  return {
    questionHtml: renderQuestionHtml(question, platform),
    optionsHtml: renderOptionsHtml(question, platform),
    inputHtml: renderInputHtml(question, platform),
    draftAreaHtml: renderDraftAreaHtml(question, platform),
    questionText: displayQuestion,
    inputPlaceholder: getInputPlaceholder(question.inputType, question.unit),
    draftPrompt: getDraftPrompt(question.type)
  };
}

export function renderQuestionPlain(question: Question): string {
  let answerText: string;
  if (typeof question.correctAnswer === 'object' && 'numerator' in question.correctAnswer) {
    answerText = fractionToString(question.correctAnswer);
  } else {
    answerText = String(question.correctAnswer);
  }

  const unitText = question.unit ? ` ${question.unit}` : '';

  return `【题目】${question.question}

【类型】${question.type} 【难度】${question.difficulty}
【知识点】${question.knowledgePoint?.name || '无'}
【正确答案】${answerText}${unitText}
【分值】${question.totalScore}分

【解题步骤】
${question.steps?.map((step, index) => `${index + 1}. ${step.description}`).join('\n') || '无'}

【提示】
${question.hints.map((hint, index) => `提示${index + 1}（${hint.type}）：${hint.content}`).join('\n')}
`;
}

export const renderModule = {
  render: renderQuestion
};
