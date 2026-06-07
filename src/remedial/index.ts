import type {
  ClassDiagnosticReport,
  RemedialPackage,
  RemedialPackageConfig,
  QuestionType,
  Difficulty,
  KnowledgePoint,
  QuestionWithReason,
  RemedialTrackingConfig,
  RemedialTrackingResult,
  RemedialGroupProgress,
  RemedialComparison,
  ExerciseRecord
} from '../types';
import { createQuestions } from '../question';
import { getTypeForKnowledgePoint } from '../adaptive';

function generateId(): string {
  return `remedial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const typeNames: { [key in QuestionType]: string } = {
  arithmetic: '口算',
  fraction: '分数',
  equation: '方程',
  geometry: '几何测量',
  wordProblem: '应用题'
};

function createGroupQuestions(
  weakPoints: KnowledgePoint[],
  totalQuestions: number,
  difficulty: Difficulty,
  groupName: '基础组' | '巩固组' | '挑战组'
): {
  questions: QuestionWithReason[];
  typeRatio: { [key in QuestionType]?: number };
  knowledgePoints: {
    knowledgePoint: KnowledgePoint;
    count: number;
    difficulty: Difficulty;
    purpose: 'review' | 'strengthen' | 'challenge';
  }[];
} {
  const typeCount: { [key in QuestionType]?: number } = {};
  const kpCount: { [kpId: string]: number } = {};
  const questions: QuestionWithReason[] = [];

  let remaining = totalQuestions;

  const weakKpCount = weakPoints.length;
  if (weakKpCount > 0) {
    const weakKpTotal = Math.min(Math.ceil(totalQuestions * 0.7), remaining);
    const perKp = Math.max(1, Math.ceil(weakKpTotal / weakKpCount));

    weakPoints.forEach((kp, idx) => {
      const count = Math.min(perKp, remaining);
      if (count > 0) {
        const mappedType = getTypeForKnowledgePoint(kp);
        typeCount[mappedType] = (typeCount[mappedType] || 0) + count;
        kpCount[kp.id] = (kpCount[kp.id] || 0) + count;

        const kpQuestions = createQuestions({
          type: mappedType,
          difficulty,
          count,
          knowledgePoints: [kp]
        });
        kpQuestions.forEach((q, qIdx) => {
          let purpose: 'review' | 'strengthen' | 'challenge' = 'strengthen';
          if (groupName === '基础组') purpose = 'strengthen';
          else if (groupName === '巩固组') purpose = idx < weakKpCount / 2 ? 'strengthen' : 'review';
          else purpose = 'challenge';

          const purposeText = purpose === 'strengthen' ? '强化' : purpose === 'review' ? '复习' : '挑战';
          questions.push({
            ...q,
            selectionReason: groupName === '基础组' ? 'weakKnowledgePoint' : groupName === '巩固组' ? 'weakKnowledgePoint' : 'challenge',
            selectionExplanation: `[${purposeText}] ${groupName}练习：针对薄弱知识点「${kp.name}」进行${typeNames[mappedType]}训练`
          });
        });

        remaining -= count;
      }
    });
  }

  if (remaining > 0) {
    const allTypes: QuestionType[] = ['arithmetic', 'fraction', 'equation', 'geometry', 'wordProblem'];
    const existingTypes = Object.keys(typeCount) as QuestionType[];
    const otherTypes = allTypes.filter(t => !existingTypes.includes(t));
    const fillType = otherTypes.length > 0 ? otherTypes[0] : 'arithmetic';

    typeCount[fillType] = (typeCount[fillType] || 0) + remaining;

    const fillQuestions = createQuestions({
      type: fillType,
      difficulty,
      count: remaining
    });
    fillQuestions.forEach(q => {
      questions.push({
        ...q,
        selectionReason: 'balanced',
        selectionExplanation: `[均衡] ${groupName}练习：补充${typeNames[fillType]}训练，保持全面发展`
      });
    });
  }

  const typeRatio: { [key in QuestionType]?: number } = {};
  Object.entries(typeCount).forEach(([type, count]) => {
    typeRatio[type as QuestionType] = count! / totalQuestions;
  });

  const knowledgePoints = Object.entries(kpCount).map(([kpId, count]) => {
    const kp = weakPoints.find(k => k.id === kpId)!;
    let purpose: 'review' | 'strengthen' | 'challenge' = 'strengthen';
    if (groupName === '基础组') purpose = 'strengthen';
    else if (groupName === '巩固组') purpose = 'strengthen';
    else purpose = 'challenge';

    return {
      knowledgePoint: kp,
      count,
      difficulty,
      purpose
    };
  });

  return { questions, typeRatio, knowledgePoints };
}

export function createRemedialPackage(config: RemedialPackageConfig): RemedialPackage {
  const { classReport, totalQuestions = 30, questions, baseExerciseId, className } = config;
  const weakPoints = classReport.knowledgePointDimension.classWeakPoints;

  const basicQuestions = createGroupQuestions(weakPoints, Math.floor(totalQuestions * 0.4), 'easy', '基础组');
  const consolidateQuestions = createGroupQuestions(weakPoints, Math.floor(totalQuestions * 0.35), 'medium', '巩固组');
  const challengeQuestions = createGroupQuestions(weakPoints, Math.floor(totalQuestions * 0.25), 'hard', '挑战组');

  const groups: RemedialPackage['groups'] = [
    {
      groupName: '基础组',
      targetStudents: '掌握度低于50%的学生',
      suitableFor: {
        minMastery: 0,
        maxMastery: 50,
        description: '基础薄弱，需要从最基础的知识点开始补习'
      },
      totalQuestions: basicQuestions.questions.length,
      estimatedTime: basicQuestions.questions.length * 5 * 60,
      avgDifficulty: 'easy',
      typeRatio: basicQuestions.typeRatio,
      knowledgePoints: basicQuestions.knowledgePoints,
      questions: basicQuestions.questions,
      groupGoal: '补齐基础，掌握核心概念，正确率达到60%以上',
      focusAreas: [
        `重点突破：${weakPoints.slice(0, 3).map(k => k.name).join('、')}`,
        '从基础概念入手，确保理解透彻',
        '每道题做完后对照答案，理解错误原因',
        '建议每天练习15-20分钟，循序渐进'
      ]
    },
    {
      groupName: '巩固组',
      targetStudents: '掌握度在50%-80%之间的学生',
      suitableFor: {
        minMastery: 50,
        maxMastery: 80,
        description: '有一定基础，但部分知识点掌握不牢，需要巩固提升'
      },
      totalQuestions: consolidateQuestions.questions.length,
      estimatedTime: consolidateQuestions.questions.length * 6 * 60,
      avgDifficulty: 'medium',
      typeRatio: consolidateQuestions.typeRatio,
      knowledgePoints: consolidateQuestions.knowledgePoints,
      questions: consolidateQuestions.questions,
      groupGoal: '巩固基础，突破难点，正确率达到80%以上',
      focusAreas: [
        `强化练习：${weakPoints.slice(0, 3).map(k => k.name).join('、')}`,
        '注意总结解题方法和规律',
        '适当增加难度，提升解题能力',
        '建立错题本，定期复习错题'
      ]
    },
    {
      groupName: '挑战组',
      targetStudents: '掌握度高于80%的学生',
      suitableFor: {
        minMastery: 80,
        maxMastery: 100,
        description: '基础扎实，可以挑战更高难度，拓展思维'
      },
      totalQuestions: challengeQuestions.questions.length,
      estimatedTime: challengeQuestions.questions.length * 8 * 60,
      avgDifficulty: 'hard',
      typeRatio: challengeQuestions.typeRatio,
      knowledgePoints: challengeQuestions.knowledgePoints,
      questions: challengeQuestions.questions,
      groupGoal: '拓展提升，挑战难题，培养数学思维',
      focusAreas: [
        `挑战拔高：${weakPoints.slice(0, 2).map(k => k.name).join('、')}的综合应用`,
        '尝试一题多解，拓展解题思路',
        '培养数学思维和逻辑推理能力',
        '可以尝试帮助其他同学讲解题目'
      ]
    }
  ];

  return {
    packageId: generateId(),
    createdAt: Date.now(),
    baseExerciseId: baseExerciseId || classReport.exerciseId,
    className: className || classReport.className,
    totalGroups: 3,
    groups,
    weakPoints
  };
}

function calculateGroupProgress(
  groupName: '基础组' | '巩固组' | '挑战组',
  groupStudents: RemedialTrackingConfig['studentRecords'],
  passThreshold: number,
  upgradeThreshold: number
): RemedialGroupProgress {
  const totalStudents = groupStudents.length;
  const completedStudents = groupStudents.filter(s => s.record.answers.length > 0).length;

  let totalAccuracy = 0;
  let totalMastery = 0;
  let totalTime = 0;
  let passedCount = 0;

  const studentProgress: RemedialGroupProgress['studentProgress'] = groupStudents.map(student => {
    const accuracy = student.record.overallAccuracy;
    const mastery = student.record.masteryLevel;
    const isPassed = accuracy >= passThreshold;
    const canUpgrade = groupName !== '挑战组' && accuracy >= upgradeThreshold;
    const needsRemediation = accuracy < passThreshold * 0.8;

    totalAccuracy += accuracy;
    totalMastery += mastery;
    totalTime += student.record.totalTimeSpent;
    if (isPassed) passedCount++;

    return {
      studentId: student.studentId,
      studentName: student.studentName,
      record: student.record,
      accuracy,
      mastery,
      isPassed,
      canUpgrade,
      needsRemediation
    };
  });

  const targetAccuracy = groupName === '基础组' ? 0.6 : groupName === '巩固组' ? 0.7 : 0.8;
  const avgAccuracy = completedStudents > 0 ? totalAccuracy / completedStudents : 0;
  const avgMastery = completedStudents > 0 ? totalMastery / completedStudents : 0;
  const avgTimeSpent = completedStudents > 0 ? totalTime / completedStudents : 0;
  const passRate = completedStudents > 0 ? passedCount / completedStudents : 0;
  const isTargetReached = avgAccuracy >= targetAccuracy;

  return {
    groupName,
    totalStudents,
    completedStudents,
    avgAccuracy,
    avgMastery,
    avgTimeSpent,
    passRate,
    targetAccuracy,
    isTargetReached,
    studentProgress
  };
}

function calculateComparison(
  studentRecords: RemedialTrackingConfig['studentRecords']
): RemedialComparison {
  let beforeTotalAccuracy = 0;
  let afterTotalAccuracy = 0;
  let beforeTotalMastery = 0;
  let afterTotalMastery = 0;
  let improvedCount = 0;
  let stableCount = 0;
  let declinedCount = 0;
  let validCount = 0;

  studentRecords.forEach(student => {
    if (student.beforeRecord && student.record.answers.length > 0) {
      validCount++;
      const beforeAcc = student.beforeRecord.overallAccuracy;
      const afterAcc = student.record.overallAccuracy;
      const beforeMastery = student.beforeRecord.masteryLevel;
      const afterMastery = student.record.masteryLevel;

      beforeTotalAccuracy += beforeAcc;
      afterTotalAccuracy += afterAcc;
      beforeTotalMastery += beforeMastery;
      afterTotalMastery += afterMastery;

      if (afterAcc > beforeAcc + 0.05) {
        improvedCount++;
      } else if (afterAcc < beforeAcc - 0.05) {
        declinedCount++;
      } else {
        stableCount++;
      }
    }
  });

  const totalStudents = validCount;
  const beforeAccuracy = validCount > 0 ? beforeTotalAccuracy / validCount : 0;
  const afterAccuracy = validCount > 0 ? afterTotalAccuracy / validCount : 0;
  const beforeMastery = validCount > 0 ? beforeTotalMastery / validCount : 0;
  const afterMastery = validCount > 0 ? afterTotalMastery / validCount : 0;

  return {
    beforeAccuracy,
    afterAccuracy,
    accuracyImprovement: afterAccuracy - beforeAccuracy,
    beforeMastery,
    afterMastery,
    masteryImprovement: afterMastery - beforeMastery,
    improvedStudents: improvedCount,
    stableStudents: stableCount,
    declinedStudents: declinedCount,
    totalStudents
  };
}

export function trackRemedialProgress(config: RemedialTrackingConfig): RemedialTrackingResult {
  const { package: remedialPackage, studentRecords, passThreshold = 0.6, upgradeThreshold = 0.8 } = config;

  const groupMap: { [key in '基础组' | '巩固组' | '挑战组']: typeof studentRecords } = {
    '基础组': [],
    '巩固组': [],
    '挑战组': []
  };

  studentRecords.forEach(sr => {
    if (groupMap[sr.groupName]) {
      groupMap[sr.groupName].push(sr);
    }
  });

  const groupProgress: RemedialGroupProgress[] = [
    calculateGroupProgress('基础组', groupMap['基础组'], passThreshold, upgradeThreshold),
    calculateGroupProgress('巩固组', groupMap['巩固组'], passThreshold, upgradeThreshold),
    calculateGroupProgress('挑战组', groupMap['挑战组'], passThreshold, upgradeThreshold)
  ];

  const comparison = calculateComparison(studentRecords);

  const upgradeRecommendations: RemedialTrackingResult['upgradeRecommendations'] = [];
  const remediationRecommendations: RemedialTrackingResult['remediationRecommendations'] = [];

  groupProgress.forEach(group => {
    group.studentProgress.forEach(sp => {
      if (sp.canUpgrade && group.groupName !== '挑战组') {
        const toGroup = group.groupName === '基础组' ? '巩固组' : '挑战组';
        upgradeRecommendations.push({
          studentId: sp.studentId,
          studentName: sp.studentName,
          fromGroup: group.groupName,
          toGroup,
          reason: `正确率达到${(sp.accuracy * 100).toFixed(0)}%，超过升组门槛${(upgradeThreshold * 100).toFixed(0)}%，建议升入${toGroup}`
        });
      }

      if (sp.needsRemediation) {
        remediationRecommendations.push({
          studentId: sp.studentId,
          studentName: sp.studentName,
          currentGroup: group.groupName,
          reason: `正确率仅${(sp.accuracy * 100).toFixed(0)}%，低于达标线${(passThreshold * 100).toFixed(0)}%，需要加强补习`,
          suggestedAction: group.groupName === '基础组'
            ? '建议继续在基础组补习，重点关注基础概念，每天增加10-15分钟练习时间'
            : group.groupName === '巩固组'
            ? '建议降回基础组重新夯实基础，或安排一对一辅导'
            : '建议降回巩固组，巩固基础知识点'
        });
      }
    });
  });

  const totalStudents = studentRecords.length;
  const totalCompleted = groupProgress.reduce((sum, g) => sum + g.completedStudents, 0);
  const totalPassed = groupProgress.reduce((sum, g) => sum + g.studentProgress.filter(sp => sp.isPassed).length, 0);

  let summary = `本次补救练习共${totalStudents}人参与，${totalCompleted}人完成，${totalPassed}人达标（正确率≥${(passThreshold * 100).toFixed(0)}%）。`;
  
  if (comparison.totalStudents > 0) {
    summary += `与补救前相比，班级平均正确率从${(comparison.beforeAccuracy * 100).toFixed(1)}%提升到${(comparison.afterAccuracy * 100).toFixed(1)}%，`;
    summary += `提升了${(comparison.accuracyImprovement * 100).toFixed(1)}个百分点。`;
    summary += `${comparison.improvedStudents}人明显进步，${comparison.stableStudents}人保持稳定，${comparison.declinedStudents}人有所下滑。`;
  }

  if (upgradeRecommendations.length > 0) {
    summary += `${upgradeRecommendations.length}名学生建议升组。`;
  }
  if (remediationRecommendations.length > 0) {
    summary += `${remediationRecommendations.length}名学生需要继续加强补习。`;
  }

  return {
    packageId: remedialPackage.packageId,
    trackedAt: Date.now(),
    className: remedialPackage.className,
    groupProgress,
    comparison,
    upgradeRecommendations,
    remediationRecommendations,
    summary
  };
}

export const remedialModule = {
  createRemedialPackage,
  trackProgress: trackRemedialProgress
};
