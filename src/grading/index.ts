import type {
  Question,
  GradingConfig,
  GradingResult,
  ErrorType,
  Fraction
} from '../types';
import {
  answersEqual,
  areFractionsEquivalent,
  parseAnswer,
  parseFraction,
  extractUnit,
  simplifyFraction,
  fractionToNumber,
  unitsEqual
} from '../utils/math';

function isFractionAnswer(answer: number | Fraction | string): answer is Fraction {
  return typeof answer === 'object' && answer !== null && 'numerator' in answer && 'denominator' in answer;
}

function detectErrorType(
  question: Question,
  userAnswer: number | Fraction | string,
  details: GradingResult['details']
): ErrorType {
  if (details.unitMatch === false) {
    return 'unitError';
  }

  const correctAnswer = question.correctAnswer;

  if (isFractionAnswer(userAnswer) && isFractionAnswer(correctAnswer)) {
    if (areFractionsEquivalent(userAnswer, correctAnswer)) {
      const simplified = simplifyFraction(userAnswer);
      if (simplified.numerator !== userAnswer.numerator || simplified.denominator !== userAnswer.denominator) {
        return 'fractionNotSimplified';
      }
    }
  }

  if (typeof userAnswer === 'number' && typeof correctAnswer === 'number') {
    if (Math.abs(userAnswer + correctAnswer) < 0.001 && Math.abs(userAnswer) > 0.001) {
      return 'signError';
    }
  }

  if (typeof userAnswer === 'string') {
    const parsed = parseFraction(userAnswer);
    if (parsed && isFractionAnswer(correctAnswer)) {
      if (areFractionsEquivalent(parsed, correctAnswer)) {
        const simplified = simplifyFraction(parsed);
        if (simplified.numerator !== parsed.numerator || simplified.denominator !== parsed.denominator) {
          return 'fractionNotSimplified';
        }
      }
    }
  }

  if (question.steps && question.steps.length > 0 && details.stepScores) {
    const correctSteps = details.stepScores.filter(s => s.score === s.maxScore).length;
    const totalSteps = details.stepScores.length;
    if (correctSteps > 0 && correctSteps < totalSteps) {
      return 'missingStep';
    }
  }

  if (details.answerMatch === false) {
    return 'calculationError';
  }

  return 'unknownError';
}

function calculateStepScores(
  question: Question,
  userAnswer: number | Fraction | string,
  config: GradingConfig
): GradingResult['details']['stepScores'] {
  if (!config.allowStepGrading || !question.steps || question.steps.length === 0) {
    return undefined;
  }

  const stepScores: { stepIndex: number; score: number; maxScore: number }[] = [];
  let userAnswerValue: number;

  if (isFractionAnswer(userAnswer)) {
    userAnswerValue = fractionToNumber(userAnswer);
  } else if (typeof userAnswer === 'number') {
    userAnswerValue = userAnswer;
  } else {
    const parsed = parseFraction(userAnswer);
    userAnswerValue = parsed ? fractionToNumber(parsed) : parseFloat(userAnswer);
  }

  for (let i = question.steps.length - 1; i >= 0; i--) {
    const step = question.steps[i];
    let stepAnswerValue: number;

    if (isFractionAnswer(step.answer)) {
      stepAnswerValue = fractionToNumber(step.answer);
    } else if (typeof step.answer === 'number') {
      stepAnswerValue = step.answer;
    } else {
      const parsed = parseFraction(String(step.answer));
      stepAnswerValue = parsed ? fractionToNumber(parsed) : parseFloat(String(step.answer));
    }

    const tolerance = config.tolerance ?? 0.001;
    const isStepCorrect = Math.abs(userAnswerValue - stepAnswerValue) < tolerance;

    if (isStepCorrect) {
      for (let j = 0; j <= i; j++) {
        stepScores.push({
          stepIndex: j,
          score: question.steps[j].score,
          maxScore: question.steps[j].score
        });
      }
      break;
    } else {
      stepScores.unshift({
        stepIndex: i,
        score: 0,
        maxScore: step.score
      });
    }
  }

  return stepScores;
}

function gradeAnswer(
  question: Question,
  rawUserAnswer: number | Fraction | string,
  config: GradingConfig = {}
): GradingResult {
  const {
    checkEquivalentFraction = true,
    checkUnit = true,
    allowStepGrading = true,
    tolerance = 0.001
  } = config;

  let userAnswer: number | Fraction | string = rawUserAnswer;
  let userUnit: string | undefined;

  if (typeof rawUserAnswer === 'string') {
    const extracted = extractUnit(rawUserAnswer);
    if (extracted) {
      userAnswer = parseAnswer(extracted.value);
      userUnit = extracted.unit || undefined;
    } else {
      userAnswer = parseAnswer(rawUserAnswer);
    }
  }

  let correctAnswer = question.correctAnswer;
  let correctUnit = question.unit;

  let answerMatch = false;
  let unitMatch: boolean | undefined = undefined;
  let equivalentFraction: boolean | undefined = undefined;

  if (checkUnit && correctUnit) {
    if (userUnit === undefined) {
      unitMatch = false;
    } else {
      unitMatch = unitsEqual(userUnit, correctUnit);
    }
  }

  if (isFractionAnswer(userAnswer) && isFractionAnswer(correctAnswer)) {
    if (checkEquivalentFraction) {
      equivalentFraction = areFractionsEquivalent(userAnswer, correctAnswer);
      answerMatch = equivalentFraction;
    } else {
      const simplifiedUser = simplifyFraction(userAnswer);
      const simplifiedCorrect = simplifyFraction(correctAnswer);
      answerMatch = simplifiedUser.numerator === simplifiedCorrect.numerator &&
                    simplifiedUser.denominator === simplifiedCorrect.denominator;
    }
  } else {
    answerMatch = answersEqual(userAnswer, correctAnswer, tolerance);
  }

  const stepScores = calculateStepScores(question, userAnswer, { allowStepGrading, tolerance });

  let score = 0;
  const maxScore = question.totalScore;

  const allDetailsCorrect = answerMatch && (unitMatch !== false);

  if (allDetailsCorrect) {
    score = maxScore;
  } else if (stepScores && stepScores.length > 0) {
    score = stepScores.reduce((sum, s) => sum + s.score, 0);
  } else if (equivalentFraction && config.checkEquivalentFraction === false) {
    score = Math.floor(maxScore * 0.8);
  }

  const details: GradingResult['details'] = {
    answerMatch,
    unitMatch,
    equivalentFraction,
    stepScores
  };

  const errorType = allDetailsCorrect ? undefined : detectErrorType(question, userAnswer, details);

  return {
    isCorrect: allDetailsCorrect,
    score,
    maxScore,
    errorType,
    details
  };
}

export const gradingModule = {
  grade: gradeAnswer
};
