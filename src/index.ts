import type { MathExerciseSDK } from './types';
import { questionModule } from './question';
import { renderModule } from './render';
import { gradingModule } from './grading';
import { hintModule } from './hint';
import { recordModule } from './record';

export * from './types';
export { createQuestions } from './question';
export { renderQuestion, renderQuestionPlain } from './render';
export { gradingModule } from './grading';
export { hintModule } from './hint';
export { recordModule, createExercise } from './record';
export { createSeededRandom } from './utils/random';
export {
  gcd,
  lcm,
  simplifyFraction,
  areFractionsEquivalent,
  fractionToNumber,
  numberToFraction,
  fractionToString,
  parseFraction,
  parseAnswer,
  answersEqual,
  extractUnit
} from './utils/math';

export const mathExerciseSDK: MathExerciseSDK = {
  question: questionModule,
  render: renderModule,
  grading: gradingModule,
  hint: hintModule,
  record: recordModule
};

export default mathExerciseSDK;
