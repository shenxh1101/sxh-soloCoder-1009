export type QuestionType =
  | 'arithmetic'
  | 'fraction'
  | 'equation'
  | 'geometry'
  | 'wordProblem';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type InputType = 'number' | 'fraction' | 'text' | 'select';

export interface KnowledgePoint {
  id: string;
  name: string;
  grade: string;
}

export interface QuestionConfig {
  type: QuestionType;
  difficulty: Difficulty;
  count: number;
  knowledgePoints?: KnowledgePoint[];
  seed?: number;
}

export interface Fraction {
  numerator: number;
  denominator: number;
}

export interface GeometryData {
  shape: 'rectangle' | 'triangle' | 'circle' | 'square';
  unit: string;
  measurements: {
    [key: string]: number;
  };
  calculate: 'area' | 'perimeter' | 'volume' | 'angle';
}

export interface QuestionStep {
  description: string;
  answer: number | Fraction | string;
  score: number;
}

export interface Question {
  id: string;
  type: QuestionType;
  difficulty: Difficulty;
  knowledgePoint?: KnowledgePoint;
  question: string;
  options?: string[];
  correctAnswer: number | Fraction | string;
  unit?: string;
  inputType: InputType;
  steps?: QuestionStep[];
  hints: Hint[];
  geometryData?: GeometryData;
  totalScore: number;
}

export interface Hint {
  level: number;
  type: 'general' | 'concept' | 'step' | 'commonMistake';
  content: string;
}

export interface RenderResult {
  questionHtml: string;
  optionsHtml?: string;
  inputHtml: string;
  draftAreaHtml: string;
  questionText: string;
  inputPlaceholder: string;
  draftPrompt: string;
}

export interface GradingConfig {
  checkEquivalentFraction?: boolean;
  checkUnit?: boolean;
  allowStepGrading?: boolean;
  tolerance?: number;
}

export interface GradingResult {
  isCorrect: boolean;
  score: number;
  maxScore: number;
  errorType?: ErrorType;
  details: {
    answerMatch: boolean;
    unitMatch?: boolean;
    equivalentFraction?: boolean;
    stepScores?: { stepIndex: number; score: number; maxScore: number }[];
  };
}

export type ErrorType =
  | 'calculationError'
  | 'unitError'
  | 'signError'
  | 'fractionNotSimplified'
  | 'wrongOperation'
  | 'missingStep'
  | 'misreadQuestion'
  | 'unknown';

export interface HintRequest {
  question: Question;
  userAnswer?: number | Fraction | string;
  errorType?: ErrorType;
  attempts: number;
}

export interface HintResult {
  hints: Hint[];
  shouldRevealAnswer: boolean;
}

export interface AnswerRecord {
  questionId: string;
  userAnswer: number | Fraction | string | null;
  isCorrect: boolean;
  errorType?: ErrorType;
  timeSpent: number;
  attempts: number;
  timestamp: number;
}

export interface ExerciseRecord {
  exerciseId: string;
  startTime: number;
  endTime?: number;
  totalTimeSpent: number;
  answers: AnswerRecord[];
  totalScore: number;
  maxScore: number;
  masteryLevel: number;
  errorStats: {
    [key in ErrorType]?: number;
  };
  knowledgePointStats: {
    [knowledgePointId: string]: {
      correct: number;
      total: number;
      mastery: number;
    };
  };
}

export interface MathExerciseSDK {
  question: {
    create(config: QuestionConfig): Question[];
  };
  render: {
    render(question: Question, platform?: 'web' | 'mobile'): RenderResult;
  };
  grading: {
    grade(
      question: Question,
      userAnswer: number | Fraction | string,
      config?: GradingConfig
    ): GradingResult;
  };
  hint: {
    getHint(request: HintRequest): HintResult;
  };
  record: {
    createExercise(): {
      addAnswer(record: AnswerRecord): void;
      finish(): ExerciseRecord;
      getMasteryLevel(): number;
    };
  };
}
