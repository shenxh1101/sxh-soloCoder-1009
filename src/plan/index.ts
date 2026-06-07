import type {
  StudyPlan,
  StudyPlanConfig,
  StudyPlanDay,
  PlanAdjustmentConfig,
  ExerciseRecord,
  KnowledgePoint,
  QuestionType,
  Difficulty,
  KnowledgePointStat,
  ClassDiagnosticReport,
  ClassStudyPlan,
  ClassStudyPlanConfig,
  ClassPlanAdjustmentConfig,
  ClassDiagnosticConfig
} from '../types';
import { generateDiagnosticReport, generateClassDiagnosticReport } from '../record';

const typeNames: { [key in QuestionType]: string } = {
  arithmetic: '口算',
  fraction: '分数',
  equation: '方程',
  geometry: '几何测量',
  wordProblem: '应用题'
};

function analyzeRecords(records: ExerciseRecord[]): {
  allKnowledgePoints: Map<string, { kp: KnowledgePoint; avgAccuracy: number; totalQuestions: number }>;
  allTypes: Map<QuestionType, { total: number; correct: number; avgTime: number }>;
  avgMastery: number;
  overallAccuracy: number;
  weakPoints: Array<{ kp: KnowledgePoint; accuracy: number }>;
  strongPoints: Array<{ kp: KnowledgePoint; accuracy: number }>;
} {
  const allKnowledgePoints = new Map<string, { kp: KnowledgePoint; avgAccuracy: number; totalQuestions: number }>();
  const allTypes = new Map<QuestionType, { total: number; correct: number; avgTime: number }>();
  let totalMastery = 0;
  let totalAccuracy = 0;
  let recordCount = 0;

  records.forEach(record => {
    totalMastery += record.masteryLevel;
    totalAccuracy += record.overallAccuracy;
    recordCount++;

    if (record.knowledgePointStats) {
      record.knowledgePointStats.forEach((stat: KnowledgePointStat) => {
        const existing = allKnowledgePoints.get(stat.knowledgePoint.id);
        if (existing) {
          existing.avgAccuracy = (existing.avgAccuracy * existing.totalQuestions + stat.accuracy * stat.total) /
            (existing.totalQuestions + stat.total);
          existing.totalQuestions += stat.total;
        } else {
          allKnowledgePoints.set(stat.knowledgePoint.id, {
            kp: stat.knowledgePoint,
            avgAccuracy: stat.accuracy,
            totalQuestions: stat.total
          });
        }
      });
    }

    if (record.typeStats) {
      Object.entries(record.typeStats).forEach(([type, stat]) => {
        if (stat) {
          const existing = allTypes.get(type as QuestionType);
          if (existing) {
            existing.total += stat.total;
            existing.correct += stat.correct;
            existing.avgTime = (existing.avgTime * (existing.total - stat.total) + stat.avgTime * stat.total) / existing.total;
          } else {
            allTypes.set(type as QuestionType, {
              total: stat.total,
              correct: stat.correct,
              avgTime: stat.avgTime
            });
          }
        }
      });
    }
  });

  const weakPoints: Array<{ kp: KnowledgePoint; accuracy: number }> = [];
  const strongPoints: Array<{ kp: KnowledgePoint; accuracy: number }> = [];

  allKnowledgePoints.forEach((value) => {
    if (value.avgAccuracy < 0.7) {
      weakPoints.push({ kp: value.kp, accuracy: value.avgAccuracy });
    } else if (value.avgAccuracy >= 0.85) {
      strongPoints.push({ kp: value.kp, accuracy: value.avgAccuracy });
    }
  });

  weakPoints.sort((a, b) => a.accuracy - b.accuracy);
  strongPoints.sort((a, b) => b.accuracy - a.accuracy);

  return {
    allKnowledgePoints,
    allTypes,
    avgMastery: recordCount > 0 ? totalMastery / recordCount : 50,
    overallAccuracy: recordCount > 0 ? totalAccuracy / recordCount : 0.5,
    weakPoints,
    strongPoints
  };
}

function generateDailyPlan(
  day: number,
  analysis: ReturnType<typeof analyzeRecords>,
  totalDays: number,
  dailyQuestions: number,
  startDate: number,
  config: StudyPlanConfig
): StudyPlanDay {
  const weakPoints = analysis.weakPoints;
  const strongPoints = analysis.strongPoints;
  const allTypes = analysis.allTypes;

  const typeRatio: { [key in QuestionType]?: number } = {};
  const knowledgePoints: StudyPlanDay['knowledgePoints'] = [];
  const focusAreas: string[] = [];

  let remainingQuestions = dailyQuestions;

  const stage = day / totalDays;

  if (stage <= 0.3) {
    focusAreas.push('基础巩固阶段：重点复习薄弱知识点');
  } else if (stage <= 0.7) {
    focusAreas.push('强化提升阶段：巩固基础，适当增加难度');
  } else {
    focusAreas.push('综合冲刺阶段：查漏补缺，全面提升');
  }

  if (weakPoints.length > 0) {
    const weakPointCount = Math.min(weakPoints.length, Math.ceil(totalDays / 3));
    const startIndex = Math.floor((day - 1) / Math.ceil(totalDays / weakPointCount)) % weakPoints.length;

    for (let i = 0; i < Math.min(weakPointCount, remainingQuestions); i++) {
      const weak = weakPoints[(startIndex + i) % weakPoints.length];
      const count = Math.max(2, Math.min(Math.ceil(remainingQuestions * 0.4 / weakPointCount), remainingQuestions));

      let difficulty: Difficulty = 'easy';
      if (stage > 0.3 && weak.accuracy >= 0.5) difficulty = 'medium';
      if (stage > 0.7 && weak.accuracy >= 0.7) difficulty = 'hard';

      knowledgePoints.push({
        knowledgePoint: weak.kp,
        count,
        difficulty,
        purpose: stage < 0.5 ? 'strengthen' : 'review'
      });

      remainingQuestions -= count;
      focusAreas.push(`重点复习「${weak.kp.name}」（正确率${(weak.accuracy * 100).toFixed(0)}%）`);
    }
  }

  if (strongPoints.length > 0 && remainingQuestions > 0) {
    const strong = strongPoints[day % strongPoints.length];
    const count = Math.min(Math.ceil(dailyQuestions * 0.2), remainingQuestions);

    let difficulty: Difficulty = 'medium';
    if (stage > 0.3) difficulty = 'hard';

    knowledgePoints.push({
      knowledgePoint: strong.kp,
      count,
      difficulty,
      purpose: 'preview'
    });

    remainingQuestions -= count;
    focusAreas.push(`进阶练习「${strong.kp.name}」`);
  }

  const weakTypes: Array<{ type: QuestionType; accuracy: number }> = [];
  allTypes.forEach((value, type) => {
    const accuracy = value.total > 0 ? value.correct / value.total : 0;
    if (accuracy < 0.7) {
      weakTypes.push({ type, accuracy });
    }
  });

  weakTypes.sort((a, b) => a.accuracy - b.accuracy);

  if (weakTypes.length > 0 && remainingQuestions > 0) {
    const perType = Math.max(1, Math.ceil(remainingQuestions / Math.min(weakTypes.length, 3)));
    weakTypes.slice(0, 3).forEach(weak => {
      const count = Math.min(perType, remainingQuestions);
      typeRatio[weak.type] = (typeRatio[weak.type] || 0) + count;
      remainingQuestions -= count;
      focusAreas.push(`加强${typeNames[weak.type]}练习`);
    });
  }

  if (remainingQuestions > 0) {
    const allTypeArray: QuestionType[] = ['arithmetic', 'fraction', 'equation', 'geometry', 'wordProblem'];
    const existingTypes = new Set([...Object.keys(typeRatio) as QuestionType[], ...knowledgePoints.map(kp => {
      if (kp.knowledgePoint.id.includes('fraction')) return 'fraction';
      if (kp.knowledgePoint.id.includes('geometry')) return 'geometry';
      if (kp.knowledgePoint.id.includes('equation')) return 'equation';
      if (kp.knowledgePoint.id.includes('word')) return 'wordProblem';
      return 'arithmetic';
    })]);

    const otherTypes = allTypeArray.filter(t => !existingTypes.has(t));
    const fillType = otherTypes.length > 0 ? otherTypes[day % otherTypes.length] : 'arithmetic';

    typeRatio[fillType] = (typeRatio[fillType] || 0) + remainingQuestions;
    remainingQuestions = 0;
  }

  const totalKpCount = knowledgePoints.reduce((sum, kp) => sum + kp.count, 0);
  const totalTypeCount = Object.values(typeRatio).reduce((sum, c) => sum + (c || 0), 0);
  const totalCount = totalKpCount + totalTypeCount;

  const estimatedTimePerQuestion = 60;
  const estimatedTime = totalCount * estimatedTimePerQuestion;

  let dailyGoal = '';
  if (stage <= 0.3) {
    dailyGoal = `巩固薄弱知识点，正确率目标达到70%以上`;
  } else if (stage <= 0.7) {
    dailyGoal = `强化练习，正确率目标达到80%以上`;
  } else {
    dailyGoal = `综合提升，正确率目标达到85%以上`;
  }

  if (config.focusKnowledgePoints && config.focusKnowledgePoints.length > 0) {
    const focusKp = config.focusKnowledgePoints[day % config.focusKnowledgePoints.length];
    dailyGoal += `，重点关注「${focusKp.name}」`;
  }

  return {
    day,
    date: startDate + (day - 1) * 24 * 60 * 60 * 1000,
    totalQuestions: totalCount,
    estimatedTime,
    typeRatio,
    knowledgePoints,
    dailyGoal,
    focusAreas: focusAreas.slice(0, 5),
    completed: false
  };
}

export function createStudyPlan(config: StudyPlanConfig): StudyPlan {
  const {
    baseRecords,
    totalDays,
    startDate = Date.now(),
    dailyQuestions = 10,
    preferredTypes,
    maxDifficulty = 'hard',
    minDifficulty = 'easy',
    studentName,
    focusKnowledgePoints
  } = config;

  const analysis = analyzeRecords(baseRecords);

  const days: StudyPlanDay[] = [];
  for (let day = 1; day <= totalDays; day++) {
    days.push(generateDailyPlan(
      day,
      analysis,
      totalDays,
      dailyQuestions,
      startDate,
      config
    ));
  }

  const totalQuestions = days.reduce((sum, day) => sum + day.totalQuestions, 0);
  const totalEstimatedTime = days.reduce((sum, day) => sum + day.estimatedTime, 0);

  let overallGoal = '';
  if (analysis.avgMastery >= 80) {
    overallGoal = `保持优秀表现，向满分冲刺，目标掌握度达到95%`;
  } else if (analysis.avgMastery >= 60) {
    overallGoal = `巩固提升，重点突破薄弱环节，目标掌握度达到85%`;
  } else {
    overallGoal = `夯实基础，系统复习知识点，目标掌握度达到75%`;
  }

  if (analysis.weakPoints.length > 0) {
    const weakNames = analysis.weakPoints.slice(0, 3).map(w => w.kp.name).join('、');
    overallGoal += `，重点关注「${weakNames}」`;
  }

  return {
    planId: `plan-${Date.now()}`,
    createdAt: Date.now(),
    totalDays,
    startDate,
    studentName,
    totalQuestions,
    totalEstimatedTime,
    overallGoal,
    days,
    baseRecords: [...baseRecords],
    adjustmentHistory: []
  };
}

export function adjustStudyPlan(config: PlanAdjustmentConfig): StudyPlan {
  const { plan, latestRecord, completedDay } = config;

  const diagnosticReport = generateDiagnosticReport(latestRecord);

  const newBaseRecords = [...plan.baseRecords, latestRecord];
  const analysis = analyzeRecords(newBaseRecords);

  const remainingDays = plan.totalDays - completedDay;
  const adjustedDays = [...plan.days];

  for (let i = completedDay; i < plan.totalDays; i++) {
    const originalDay = adjustedDays[i];
    const newDayNumber = i - completedDay + 1;
    const newDay = generateDailyPlan(
      newDayNumber,
      analysis,
      remainingDays,
      originalDay.totalQuestions,
      originalDay.date || Date.now(),
      {
        baseRecords: newBaseRecords,
        totalDays: remainingDays as 7 | 14,
        startDate: originalDay.date,
        dailyQuestions: originalDay.totalQuestions
      }
    );

    adjustedDays[i] = {
      ...originalDay,
      knowledgePoints: newDay.knowledgePoints,
      typeRatio: newDay.typeRatio,
      dailyGoal: newDay.dailyGoal,
      focusAreas: newDay.focusAreas,
      estimatedTime: newDay.estimatedTime
    };
  }

  adjustedDays[completedDay - 1] = {
    ...adjustedDays[completedDay - 1],
    completed: true,
    actualRecord: latestRecord
  };

  const adjustmentReason = `完成第${completedDay}天练习后，根据最新表现调整后续计划。`;
  let changes = '';

  if (latestRecord.overallAccuracy >= 0.85) {
    changes = '表现优秀，提升后续练习难度';
  } else if (latestRecord.overallAccuracy < 0.6) {
    changes = '需要加强基础，降低后续练习难度，增加薄弱知识点练习量';
  } else {
    changes = '表现稳定，保持当前进度，继续巩固薄弱点';
  }

  if (diagnosticReport.knowledgePointDimension.weakPoints.length > 0) {
    const weakNames = diagnosticReport.knowledgePointDimension.weakPoints
      .slice(0, 2)
      .map((w: KnowledgePoint) => w.name)
      .join('、');
    changes += `，重点加强「${weakNames}」`;
  }

  return {
    ...plan,
    days: adjustedDays,
    baseRecords: newBaseRecords,
    adjustmentHistory: [
      ...plan.adjustmentHistory,
      {
        date: Date.now(),
        day: completedDay,
        reason: adjustmentReason,
        changes
      }
    ]
  };
}

function generateId(): string {
  return `class-plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function analyzeClassRecords(
  records: { studentId: string; studentName?: string; record: ExerciseRecord }[]
): {
  allKnowledgePoints: Map<string, { kp: KnowledgePoint; avgAccuracy: number; totalQuestions: number; weakStudentCount: number }>;
  allTypes: Map<QuestionType, { total: number; correct: number; avgTime: number }>;
  classWeakPoints: Array<{ kp: KnowledgePoint; accuracy: number }>;
  classStrongPoints: Array<{ kp: KnowledgePoint; accuracy: number }>;
  avgMastery: number;
  overallAccuracy: number;
} {
  const allKnowledgePoints = new Map<string, { kp: KnowledgePoint; avgAccuracy: number; totalQuestions: number; weakStudentCount: number }>();
  const allTypes = new Map<QuestionType, { total: number; correct: number; avgTime: number }>();
  let totalMastery = 0;
  let totalAccuracy = 0;
  let recordCount = 0;

  records.forEach(({ record }) => {
    totalMastery += record.masteryLevel;
    totalAccuracy += record.overallAccuracy;
    recordCount++;

    if (record.knowledgePointStats) {
      record.knowledgePointStats.forEach((stat: KnowledgePointStat) => {
        const existing = allKnowledgePoints.get(stat.knowledgePoint.id);
        if (existing) {
          existing.avgAccuracy = (existing.avgAccuracy * existing.totalQuestions + stat.accuracy * stat.total) /
            (existing.totalQuestions + stat.total);
          existing.totalQuestions += stat.total;
          if (stat.accuracy < 0.5) existing.weakStudentCount++;
        } else {
          allKnowledgePoints.set(stat.knowledgePoint.id, {
            kp: stat.knowledgePoint,
            avgAccuracy: stat.accuracy,
            totalQuestions: stat.total,
            weakStudentCount: stat.accuracy < 0.5 ? 1 : 0
          });
        }
      });
    }

    if (record.typeStats) {
      Object.entries(record.typeStats).forEach(([type, stat]) => {
        if (stat) {
          const existing = allTypes.get(type as QuestionType);
          if (existing) {
            existing.total += stat.total;
            existing.correct += stat.correct;
            existing.avgTime = (existing.avgTime * (existing.total - stat.total) + stat.avgTime * stat.total) / existing.total;
          } else {
            allTypes.set(type as QuestionType, {
              total: stat.total,
              correct: stat.correct,
              avgTime: stat.avgTime
            });
          }
        }
      });
    }
  });

  const classWeakPoints: Array<{ kp: KnowledgePoint; accuracy: number }> = [];
  const classStrongPoints: Array<{ kp: KnowledgePoint; accuracy: number }> = [];

  allKnowledgePoints.forEach((value) => {
    if (value.avgAccuracy < 0.6 || value.weakStudentCount > records.length * 0.3) {
      classWeakPoints.push({ kp: value.kp, accuracy: value.avgAccuracy });
    } else if (value.avgAccuracy >= 0.8) {
      classStrongPoints.push({ kp: value.kp, accuracy: value.avgAccuracy });
    }
  });

  classWeakPoints.sort((a, b) => a.accuracy - b.accuracy);
  classStrongPoints.sort((a, b) => b.accuracy - a.accuracy);

  return {
    allKnowledgePoints,
    allTypes,
    classWeakPoints,
    classStrongPoints,
    avgMastery: recordCount > 0 ? totalMastery / recordCount : 50,
    overallAccuracy: recordCount > 0 ? totalAccuracy / recordCount : 0.5
  };
}

function generateClassDailyPlan(
  day: number,
  analysis: ReturnType<typeof analyzeClassRecords>,
  totalDays: number,
  dailyQuestions: number,
  date?: number
): StudyPlanDay {
  const stage = day / totalDays;

  let stageName: string;
  let stageDescription: string;
  let difficulty: Difficulty;
  let weakRatio: number;

  if (stage <= 0.3) {
    stageName = '基础巩固阶段';
    stageDescription = '重点突破班级薄弱知识点，夯实基础';
    difficulty = 'easy';
    weakRatio = 0.7;
  } else if (stage <= 0.7) {
    stageName = '强化提升阶段';
    stageDescription = '巩固基础，适当提升难度，加强综合应用';
    difficulty = 'medium';
    weakRatio = 0.5;
  } else {
    stageName = '综合冲刺阶段';
    stageDescription = '查漏补缺，综合提升，备战检测';
    difficulty = 'medium';
    weakRatio = 0.4;
  }

  const weakKpCount = analysis.classWeakPoints.length;
  const strongKpCount = analysis.classStrongPoints.length;

  const knowledgePoints: StudyPlanDay['knowledgePoints'] = [];
  const typeRatio: StudyPlanDay['typeRatio'] = {};

  let remaining = dailyQuestions;

  if (weakKpCount > 0) {
    const weakCount = Math.ceil(dailyQuestions * weakRatio);
    const perKp = Math.max(2, Math.ceil(weakCount / Math.min(weakKpCount, 3)));

    analysis.classWeakPoints.slice(0, 3).forEach(({ kp }) => {
      const count = Math.min(perKp, remaining);
      if (count > 0) {
        const kpType = getTypeForKnowledgePoint(kp);
        typeRatio[kpType] = (typeRatio[kpType] || 0) + count / dailyQuestions;

        knowledgePoints.push({
          knowledgePoint: kp,
          count,
          difficulty,
          purpose: 'strengthen'
        });
        remaining -= count;
      }
    });
  }

  if (strongKpCount > 0 && remaining > 0) {
    const reviewCount = Math.min(Math.ceil(dailyQuestions * 0.2), remaining);
    const perKp = Math.max(1, Math.ceil(reviewCount / Math.min(strongKpCount, 2)));

    analysis.classStrongPoints.slice(0, 2).forEach(({ kp }) => {
      const count = Math.min(perKp, remaining);
      if (count > 0) {
        const kpType = getTypeForKnowledgePoint(kp);
        typeRatio[kpType] = (typeRatio[kpType] || 0) + count / dailyQuestions;

        knowledgePoints.push({
          knowledgePoint: kp,
          count,
          difficulty: difficulty as Difficulty,
          purpose: 'review'
        });
        remaining -= count;
      }
    });
  }

  if (remaining > 0 && stage > 0.5) {
    const previewCount = Math.min(Math.ceil(dailyQuestions * 0.1), remaining);
    const previewKp = analysis.classStrongPoints[0];
    if (previewKp) {
      const kpType = getTypeForKnowledgePoint(previewKp.kp);
      typeRatio[kpType] = (typeRatio[kpType] || 0) + previewCount / dailyQuestions;

      knowledgePoints.push({
        knowledgePoint: previewKp.kp,
        count: previewCount,
        difficulty: 'hard',
        purpose: 'preview'
      });
      remaining -= previewCount;
    }
  }

  if (remaining > 0) {
    const allTypes: QuestionType[] = ['arithmetic', 'fraction', 'equation', 'geometry', 'wordProblem'];
    const existingTypes = Object.keys(typeRatio) as QuestionType[];
    const otherTypes = allTypes.filter(t => !existingTypes.includes(t));
    const fillType = otherTypes.length > 0 ? otherTypes[0] : 'arithmetic';

    typeRatio[fillType] = (typeRatio[fillType] || 0) + remaining / dailyQuestions;

    if (analysis.classWeakPoints.length > 0) {
      const kp = analysis.classWeakPoints[0].kp;
      knowledgePoints.push({
        knowledgePoint: kp,
        count: remaining,
        difficulty,
        purpose: 'strengthen'
      });
    }
  }

  const totalTime = dailyQuestions * 6 * 60;

  let dailyGoal = `第${day}天（${stageName}）：`;
  const focusAreas: string[] = [];

  if (analysis.classWeakPoints.length > 0) {
    const weakNames = analysis.classWeakPoints.slice(0, 2).map(w => w.kp.name).join('、');
    dailyGoal += `重点突破「${weakNames}」`;
    focusAreas.push(`班级重点薄弱知识点：${weakNames}`);
  }

  if (stage <= 0.3) {
    focusAreas.push('从基础概念入手，确保全班同学理解透彻');
    focusAreas.push('建议课堂上重点讲解薄弱知识点');
  } else if (stage <= 0.7) {
    focusAreas.push('适当增加难度，提升综合解题能力');
    focusAreas.push('鼓励学生互助，共同进步');
  } else {
    focusAreas.push('综合练习，查漏补缺');
    focusAreas.push('准备进行班级小测，检验复习效果');
  }

  return {
    day,
    date,
    totalQuestions: dailyQuestions,
    estimatedTime: totalTime,
    typeRatio,
    knowledgePoints,
    dailyGoal,
    focusAreas,
    completed: false
  };
}

function getTypeForKnowledgePoint(kp: KnowledgePoint): QuestionType {
  const typeMap: { [kpId: string]: QuestionType } = {
    'addition-subtraction': 'arithmetic',
    'multiplication-division': 'arithmetic',
    'mixed-operation': 'arithmetic',
    'decimal-calculation': 'arithmetic',
    'fraction-basic': 'fraction',
    'fraction-add-sub': 'fraction',
    'fraction-mul-div': 'fraction',
    'fraction-mixed': 'fraction',
    'one-variable': 'equation',
    'two-variable': 'equation',
    'word-problem-eq': 'equation',
    'rectangle-area': 'geometry',
    'rectangle-perimeter': 'geometry',
    'circle-area': 'geometry',
    'circle-circumference': 'geometry',
    'triangle-area': 'geometry',
    'area-combined': 'geometry',
    'word-problem-basic': 'wordProblem',
    'word-problem-distance': 'wordProblem',
    'word-problem-work': 'wordProblem',
    'word-problem-fraction': 'wordProblem',
    'word-problem-percentage': 'wordProblem'
  };
  return typeMap[kp.id] || 'arithmetic';
}

export function createClassStudyPlan(config: ClassStudyPlanConfig): ClassStudyPlan {
  const { classReport, totalDays, startDate = Date.now(), dailyQuestions = 10, className, includePersonalPlans = false, studentRecords } = config;

  let baseRecords = studentRecords || [];
  
  if (baseRecords.length === 0) {
    baseRecords = classReport.studentDimension.ranking
      .map(r => ({
        studentId: r.studentId,
        studentName: r.studentName,
        record: (r as unknown as { record?: ExerciseRecord }).record || {} as ExerciseRecord
      }))
      .filter(r => r.record && r.record.knowledgePointStats);
  }

  const analysis = analyzeClassRecords(baseRecords);

  const classAnalysis = {
    ...analysis,
    classWeakPoints: classReport.knowledgePointDimension.classWeakPoints.map(kp => ({ kp, accuracy: classReport.knowledgePointDimension.stats[kp.id]?.avgAccuracy || 0 })),
    classStrongPoints: classReport.knowledgePointDimension.classStrongPoints.map(kp => ({ kp, accuracy: classReport.knowledgePointDimension.stats[kp.id]?.avgAccuracy || 0 })),
    avgMastery: classReport.overall.avgMasteryLevel,
    overallAccuracy: classReport.overall.avgAccuracy
  };

  const days: StudyPlanDay[] = [];
  let totalQuestions = 0;
  let totalEstimatedTime = 0;

  for (let i = 1; i <= totalDays; i++) {
    const dayDate = startDate + (i - 1) * 24 * 60 * 60 * 1000;
    const dayPlan = generateClassDailyPlan(i, classAnalysis, totalDays, dailyQuestions, dayDate);
    days.push(dayPlan);
    totalQuestions += dayPlan.totalQuestions;
    totalEstimatedTime += dayPlan.estimatedTime;
  }

  const overallGoal = `班级${totalDays}天复习计划：针对班级薄弱知识点进行系统复习，` +
    `整体目标是班级平均正确率从${(classReport.overall.avgAccuracy * 100).toFixed(0)}%提升到80%以上。`;

  const plan: ClassStudyPlan = {
    planId: generateId(),
    createdAt: Date.now(),
    className: className || classReport.className,
    totalDays,
    startDate,
    totalQuestions,
    totalEstimatedTime,
    overallGoal,
    classWeakPoints: classReport.knowledgePointDimension.classWeakPoints,
    classStrongPoints: classReport.knowledgePointDimension.classStrongPoints,
    days,
    baseRecords,
    adjustmentHistory: []
  };

  if (includePersonalPlans) {
    const personalPlans: { [studentId: string]: StudyPlan } = {};
    baseRecords.forEach(student => {
      if (student.record && student.record.knowledgePointStats) {
        personalPlans[student.studentId] = createStudyPlan({
          baseRecords: [student.record],
          totalDays,
          startDate,
          dailyQuestions,
          studentName: student.studentName
        });
      }
    });
    plan.personalPlans = personalPlans;
  }

  return plan;
}

export function adjustClassStudyPlan(config: ClassPlanAdjustmentConfig): ClassStudyPlan {
  const { plan, latestRecords, completedDay } = config;

  const newBaseRecords = [...plan.baseRecords];
  latestRecords.forEach(latest => {
    const existingIdx = newBaseRecords.findIndex(r => r.studentId === latest.studentId);
    if (existingIdx >= 0) {
      newBaseRecords[existingIdx] = latest;
    } else {
      newBaseRecords.push(latest);
    }
  });

  const classConfig: ClassDiagnosticConfig = {
    records: newBaseRecords,
    className: plan.className
  };

  const updatedClassReport = generateClassDiagnosticReport(classConfig);
  const newAnalysis = analyzeClassRecords(newBaseRecords);

  const classAnalysis = {
    ...newAnalysis,
    classWeakPoints: updatedClassReport.knowledgePointDimension.classWeakPoints.map(kp => ({ kp, accuracy: updatedClassReport.knowledgePointDimension.stats[kp.id]?.avgAccuracy || 0 })),
    classStrongPoints: updatedClassReport.knowledgePointDimension.classStrongPoints.map(kp => ({ kp, accuracy: updatedClassReport.knowledgePointDimension.stats[kp.id]?.avgAccuracy || 0 })),
    avgMastery: updatedClassReport.overall.avgMasteryLevel,
    overallAccuracy: updatedClassReport.overall.avgAccuracy
  };

  const remainingDays = plan.totalDays - completedDay;
  const adjustedDays = [...plan.days];

  for (let i = completedDay; i < plan.totalDays; i++) {
    const originalDay = adjustedDays[i];
    const newDayNumber = i - completedDay + 1;
    const newDay = generateClassDailyPlan(
      newDayNumber,
      classAnalysis,
      remainingDays,
      originalDay.totalQuestions,
      originalDay.date
    );

    adjustedDays[i] = {
      ...originalDay,
      knowledgePoints: newDay.knowledgePoints,
      typeRatio: newDay.typeRatio,
      dailyGoal: newDay.dailyGoal,
      focusAreas: newDay.focusAreas,
      estimatedTime: newDay.estimatedTime
    };
  }

  adjustedDays[completedDay - 1] = {
    ...adjustedDays[completedDay - 1],
    completed: true
  };

  const adjustmentReason = `完成第${completedDay}天班级练习后，结合${latestRecords.length}位学生的最新表现调整后续计划。`;
  let changes = '';

  if (updatedClassReport.overall.avgAccuracy >= 0.8) {
    changes = '班级整体表现优秀，提升后续练习难度';
  } else if (updatedClassReport.overall.avgAccuracy < 0.6) {
    changes = '班级整体需要加强基础，降低后续练习难度，增加薄弱知识点练习量';
  } else {
    changes = '班级表现稳定，保持当前进度，继续巩固薄弱点';
  }

  if (updatedClassReport.knowledgePointDimension.classWeakPoints.length > 0) {
    const weakNames = updatedClassReport.knowledgePointDimension.classWeakPoints
      .slice(0, 2)
      .map(w => w.name)
      .join('、');
    changes += `，全班重点加强「${weakNames}」`;
  }

  const updatedPersonalPlans = plan.personalPlans ? { ...plan.personalPlans } : undefined;
  if (updatedPersonalPlans) {
    latestRecords.forEach(latest => {
      if (updatedPersonalPlans[latest.studentId]) {
        updatedPersonalPlans[latest.studentId] = adjustStudyPlan({
          plan: updatedPersonalPlans[latest.studentId],
          latestRecord: latest.record,
          completedDay
        });
      }
    });
  }

  return {
    ...plan,
    classWeakPoints: updatedClassReport.knowledgePointDimension.classWeakPoints,
    classStrongPoints: updatedClassReport.knowledgePointDimension.classStrongPoints,
    days: adjustedDays,
    baseRecords: newBaseRecords,
    personalPlans: updatedPersonalPlans,
    adjustmentHistory: [
      ...plan.adjustmentHistory,
      {
        date: Date.now(),
        day: completedDay,
        reason: adjustmentReason,
        changes
      }
    ]
  };
}

export const planModule = {
  create: createStudyPlan,
  adjust: adjustStudyPlan,
  createClass: createClassStudyPlan,
  adjustClass: adjustClassStudyPlan
};
