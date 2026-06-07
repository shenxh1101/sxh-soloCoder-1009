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
  | 'wrongFractionReduction'
  | 'wrongOperation'
  | 'wrongFormula'
  | 'missingStep'
  | 'misreadQuestion'
  | 'unknownError';

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

export interface AnswerAttempt {
  userAnswer: number | Fraction | string | null;
  isCorrect: boolean;
  errorType?: ErrorType;
  timeSpent: number;
  timestamp: number;
  hintUsed?: boolean;
}

export interface AnswerRecord {
  questionId: string;
  attempts: AnswerAttempt[];
  finalAnswer: number | Fraction | string | null;
  isCorrect: boolean;
  firstErrorType?: ErrorType;
  totalTimeSpent: number;
  attemptsCount: number;
  firstAttemptCorrect: boolean;
  timestamp: number;
}

export interface KnowledgePointStat {
  knowledgePoint: KnowledgePoint;
  correct: number;
  total: number;
  accuracy: number;
  avgTimeSpent: number;
  avgAttempts: number;
  commonErrors: { [key in ErrorType]?: number };
  mastery: number;
  reviewSuggestions: string[];
}

export interface QuestionProgress {
  questionId: string;
  type: QuestionType;
  difficulty: Difficulty;
  knowledgePoint?: KnowledgePoint;
  attempts: AnswerAttempt[];
  firstAnswerCorrect: boolean;
  finalAnswerCorrect: boolean;
  timeToFirstAnswer: number;
  totalTimeSpent: number;
  improvement: 'improved' | 'noChange' | 'regressed';
}

export interface ExerciseRecord {
  exerciseId: string;
  startTime: number;
  endTime?: number;
  totalTimeSpent: number;
  answers: AnswerRecord[];
  questionProgress: QuestionProgress[];
  totalScore: number;
  maxScore: number;
  masteryLevel: number;
  overallAccuracy: number;
  avgTimePerQuestion: number;
  avgAttemptsPerQuestion: number;
  firstAttemptAccuracy: number;
  improvementRate: number;
  errorStats: {
    [key in ErrorType]?: number;
  };
  knowledgePointStats: KnowledgePointStat[];
  typeStats: {
    [type in QuestionType]?: {
      correct: number;
      total: number;
      accuracy: number;
      mastery: number;
      avgTime: number;
      avgAttempts: number;
    };
  };
}

export interface MixedExerciseConfig {
  totalCount: number;
  typeRatio?: { [key in QuestionType]?: number };
  difficultyRange?: Difficulty[];
  knowledgePoints?: KnowledgePoint[];
  knowledgePointIds?: string[];
  seed?: number;
  shuffle?: boolean;
}

export interface AdaptiveRecommendation {
  config: MixedExerciseConfig;
  reasons: string[];
  difficultyAdjustment: 'increase' | 'decrease' | 'maintain';
  focusAreas: {
    knowledgePoint?: KnowledgePoint;
    type?: QuestionType;
    reason: string;
    suggestedCount: number;
  }[];
  nextMasteryGoal: number;
  expectedDifficulty: Difficulty;
}

export interface AdaptiveConfig {
  previousRecord: ExerciseRecord;
  targetCount?: number;
  preferredTypes?: QuestionType[];
  maxDifficulty?: Difficulty;
  minDifficulty?: Difficulty;
  seed?: number;
}

export interface MathExerciseSDK {
  question: {
    create(config: QuestionConfig): Question[];
    createMixed(config: MixedExerciseConfig): Question[];
    createAdaptive(config: AdaptiveConfig): AdaptiveQuestionWithReason;
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
    createExercise(questions?: Question[]): {
      addQuestion(question: Question): void;
      addAttempt(questionId: string, attempt: AnswerAttempt): void;
      addAnswer(record: AnswerRecord): void;
      finish(): ExerciseRecord;
      getMasteryLevel(): number;
    };
    getRecommendation(previousRecord: ExerciseRecord): AdaptiveRecommendation;
    generateDiagnosticReport(record: ExerciseRecord, questions?: Question[]): DiagnosticReport;
  };
  plan: {
    create(config: StudyPlanConfig): StudyPlan;
    adjust(config: PlanAdjustmentConfig): StudyPlan;
  };
}

export type AnswerCategory =
  | 'firstTimeCorrect'
  | 'improvedAfterHint'
  | 'correctAfterAttempts'
  | 'stillWrong';

export type QuestionSelectionReason =
  | 'weakKnowledgePoint'
  | 'weakQuestionType'
  | 'commonMistake'
  | 'review'
  | 'challenge'
  | 'balanced';

export interface QuestionWithReason extends Question {
  selectionReason: QuestionSelectionReason;
  selectionExplanation: string;
}

export interface DiagnosticReport {
  exerciseId: string;
  exerciseDate: number;
  overall: {
    totalQuestions: number;
    correctCount: number;
    accuracy: number;
    masteryLevel: number;
    firstAttemptAccuracy: number;
    improvementRate: number;
    avgTimePerQuestion: number;
    avgAttemptsPerQuestion: number;
  };
  personalDimension: {
    categoryStats: {
      [key in AnswerCategory]: {
        count: number;
        percentage: number;
        questions: string[];
      };
    };
    performanceTrend: 'improving' | 'stable' | 'declining';
  };
  typeDimension: {
    stats: {
      [type in QuestionType]?: {
        total: number;
        correct: number;
        accuracy: number;
        mastery: number;
        avgTime: number;
        avgAttempts: number;
      };
    };
    strongTypes: QuestionType[];
    weakTypes: QuestionType[];
  };
  knowledgePointDimension: {
    stats: {
      [kpId: string]: KnowledgePointStat & {
        categoryBreakdown: { [key in AnswerCategory]: number };
      };
    };
    strongPoints: KnowledgePoint[];
    weakPoints: KnowledgePoint[];
    priorityReview: KnowledgePoint[];
  };
  questionDimension: {
    details: {
      [questionId: string]: {
        question: string;
        type: QuestionType;
        difficulty: Difficulty;
        knowledgePoint?: KnowledgePoint;
        isCorrect: boolean;
        firstAttemptCorrect: boolean;
        attempts: number;
        totalTime: number;
        errorType?: ErrorType;
        improvement: 'improved' | 'noChange' | 'regressed';
        category: AnswerCategory;
      };
    };
    hardestQuestions: string[];
    mostTimeConsuming: string[];
  };
  teacherComments: {
    shortComment: string;
    detailedComment: string;
    highlights: string[];
    concerns: string[];
    suggestions: string[];
    encouragement: string;
  };
}

export interface AdaptiveQuestionWithReason {
  questions: QuestionWithReason[];
  recommendation: AdaptiveRecommendation & {
    questionBreakdown: {
      weakKnowledgePoint: number;
      weakType: number;
      commonMistake: number;
      review: number;
      challenge: number;
    };
  };
}

export interface StudyPlanDay {
  day: number;
  date?: number;
  totalQuestions: number;
  estimatedTime: number;
  typeRatio: { [key in QuestionType]?: number };
  knowledgePoints: {
    knowledgePoint: KnowledgePoint;
    count: number;
    difficulty: Difficulty;
    purpose: 'review' | 'strengthen' | 'preview';
  }[];
  dailyGoal: string;
  focusAreas: string[];
  completed: boolean;
  actualRecord?: ExerciseRecord;
}

export interface StudyPlan {
  planId: string;
  createdAt: number;
  totalDays: number;
  startDate: number;
  studentName?: string;
  totalQuestions: number;
  totalEstimatedTime: number;
  overallGoal: string;
  days: StudyPlanDay[];
  baseRecords: ExerciseRecord[];
  adjustmentHistory: {
    date: number;
    day: number;
    reason: string;
    changes: string;
  }[];
}

export interface StudyPlanConfig {
  baseRecords: ExerciseRecord[];
  totalDays: 7 | 14;
  startDate?: number;
  dailyQuestions?: number;
  preferredTypes?: QuestionType[];
  maxDifficulty?: Difficulty;
  minDifficulty?: Difficulty;
  studentName?: string;
  focusKnowledgePoints?: KnowledgePoint[];
}

export interface PlanAdjustmentConfig {
  plan: StudyPlan;
  latestRecord: ExerciseRecord;
  completedDay: number;
}
