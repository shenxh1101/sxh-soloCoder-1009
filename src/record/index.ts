import type {
  AnswerRecord,
  ExerciseRecord,
  ErrorType
} from '../types';

function generateId(): string {
  return `exercise-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function calculateMasteryLevel(
  correctCount: number,
  totalCount: number,
  avgTimePerQuestion: number,
  avgAttempts: number
): number {
  if (totalCount === 0) return 0;

  const accuracy = correctCount / totalCount;

  const timeScore = Math.max(0, 1 - avgTimePerQuestion / 120);
  const attemptScore = Math.max(0, 1 - (avgAttempts - 1) / 4);

  const mastery = (accuracy * 0.6 + timeScore * 0.2 + attemptScore * 0.2) * 100;

  return Math.round(Math.max(0, Math.min(100, mastery)));
}

export function createExercise() {
  const exerciseId = generateId();
  const startTime = Date.now();
  const answers: AnswerRecord[] = [];

  function addAnswer(record: AnswerRecord): void {
    answers.push(record);
  }

  function getMasteryLevel(): number {
    if (answers.length === 0) return 0;

    const correctCount = answers.filter(a => a.isCorrect).length;
    const totalTimeSpent = answers.reduce((sum, a) => sum + a.timeSpent, 0);
    const totalAttempts = answers.reduce((sum, a) => sum + a.attempts, 0);

    return calculateMasteryLevel(
      correctCount,
      answers.length,
      totalTimeSpent / answers.length / 1000,
      totalAttempts / answers.length
    );
  }

  function finish(): ExerciseRecord {
    const endTime = Date.now();
    const totalTimeSpent = endTime - startTime;

    const totalScore = answers.reduce((sum, a) => {
      if (a.isCorrect) {
        return sum + 10;
      }
      return sum;
    }, 0);

    const maxScore = answers.length * 10;

    const errorStats: { [key in ErrorType]?: number } = {};
    answers.forEach(answer => {
      if (answer.errorType) {
        errorStats[answer.errorType] = (errorStats[answer.errorType] || 0) + 1;
      }
    });

    const knowledgePointStats: ExerciseRecord['knowledgePointStats'] = {};

    const correctCount = answers.filter(a => a.isCorrect).length;
    const masteryLevel = getMasteryLevel();

    return {
      exerciseId,
      startTime,
      endTime,
      totalTimeSpent,
      answers,
      totalScore,
      maxScore,
      masteryLevel,
      errorStats,
      knowledgePointStats
    };
  }

  return {
    addAnswer,
    finish,
    getMasteryLevel
  };
}

export interface ExerciseSession {
  addAnswer: (record: AnswerRecord) => void;
  finish: () => ExerciseRecord;
  getMasteryLevel: () => number;
}

export const recordModule = {
  createExercise
};
