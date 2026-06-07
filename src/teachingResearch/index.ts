import type {
  TeachingResearchExport,
  TeachingResearchExportConfig,
  ClassDiagnosticReport,
  RemedialPackage,
  ClassStudyPlan,
  KnowledgePoint,
  QuestionType,
  ErrorType
} from '../types';

const errorTypeNames: { [key in ErrorType]: string } = {
  calculationError: '计算错误',
  unitError: '单位错误',
  signError: '符号错误',
  fractionNotSimplified: '分数未化简',
  wrongFractionReduction: '分数化简错误',
  wrongOperation: '运算方法错误',
  wrongFormula: '公式使用错误',
  missingStep: '缺少解题步骤',
  misreadQuestion: '读题错误',
  unknownError: '未知错误'
};

const typeNames: { [key in QuestionType]: string } = {
  arithmetic: '口算',
  fraction: '分数',
  equation: '方程',
  geometry: '几何测量',
  wordProblem: '应用题'
};

function generateTextSummary(
  classReport: ClassDiagnosticReport,
  remedialPackage?: RemedialPackage,
  followUpPlan?: ClassStudyPlan
): string {
  const parts: string[] = [];

  parts.push(`【${classReport.className || '班级'}数学练习教研报告】`);
  parts.push(`练习时间：${new Date(classReport.exerciseDate).toLocaleDateString()}`);
  parts.push(`参与人数：${classReport.totalStudents}人，提交人数：${classReport.submittedCount}人`);
  parts.push(``);
  parts.push(`一、整体表现`);
  parts.push(`  班级平均正确率：${(classReport.overall.avgAccuracy * 100).toFixed(1)}%`);
  parts.push(`  班级平均掌握度：${classReport.overall.avgMasteryLevel.toFixed(1)}分`);
  parts.push(`  掌握度分布：优秀${classReport.overall.masteryDistribution.excellent}人，` +
    `良好${classReport.overall.masteryDistribution.good}人，` +
    `中等${classReport.overall.masteryDistribution.medium}人，` +
    `需努力${classReport.overall.masteryDistribution.needsImprovement}人`);
  parts.push(``);

  if (classReport.knowledgePointDimension.classWeakPoints.length > 0) {
    parts.push(`二、薄弱知识点`);
    classReport.knowledgePointDimension.classWeakPoints.slice(0, 5).forEach((kp, idx) => {
      const stat = classReport.knowledgePointDimension.stats[kp.id];
      parts.push(`  ${idx + 1}. ${kp.name}：平均正确率${(stat?.avgAccuracy * 100).toFixed(1)}%，` +
        `${stat?.weakCount || 0}人掌握薄弱，优先级：${stat?.priority === 'high' ? '高' : stat?.priority === 'medium' ? '中' : '低'}`);
    });
    parts.push(``);
  }

  if (classReport.knowledgePointDimension.classStrongPoints.length > 0) {
    parts.push(`三、掌握较好的知识点`);
    classReport.knowledgePointDimension.classStrongPoints.slice(0, 3).forEach((kp, idx) => {
      const stat = classReport.knowledgePointDimension.stats[kp.id];
      parts.push(`  ${idx + 1}. ${kp.name}：平均正确率${(stat?.avgAccuracy * 100).toFixed(1)}%`);
    });
    parts.push(``);
  }

  const hardQuestions = Object.entries(classReport.questionDimension.stats)
    .sort((a, b) => a[1].passRate - b[1].passRate)
    .slice(0, 3);

  if (hardQuestions.length > 0) {
    parts.push(`四、典型错题分析`);
    hardQuestions.forEach(([qId, stat], idx) => {
      const errors = stat.commonErrors.map(e => `${errorTypeNames[e.type]}(${e.count}次)`).join('、');
      parts.push(`  ${idx + 1}. 第${qId}题（${typeNames[stat.type]}，${stat.difficulty === 'easy' ? '简单' : stat.difficulty === 'medium' ? '中等' : '困难'}）`);
      parts.push(`     题目：${stat.question.substring(0, 50)}${stat.question.length > 50 ? '...' : ''}`);
      parts.push(`     全班通过率：${(stat.passRate * 100).toFixed(1)}%`);
      parts.push(`     常见错误：${errors || '无'}`);
    });
    parts.push(``);
  }

  if (classReport.studentDimension.focusStudents.length > 0) {
    parts.push(`五、重点关注学生`);
    classReport.studentDimension.focusStudents.slice(0, 5).forEach((student, idx) => {
      const statusText = student.status === 'needsAttention' ? '需要关注' :
        student.status === 'declining' ? '表现下滑' : '表现优秀';
      parts.push(`  ${idx + 1}. ${student.studentName || student.studentId}：${statusText}，` +
        `正确率${(student.accuracy * 100).toFixed(0)}%，掌握度${student.masteryLevel.toFixed(0)}分`);
      parts.push(`     原因：${student.reason}`);
    });
    parts.push(``);
  }

  if (remedialPackage) {
    parts.push(`六、分层补救建议`);
    remedialPackage.groups.forEach(group => {
      parts.push(`  ${group.groupName}：${group.totalQuestions}题，${group.avgDifficulty === 'easy' ? '简单' : group.avgDifficulty === 'medium' ? '中等' : '困难'}难度`);
      parts.push(`     适合：${group.targetStudents}`);
      parts.push(`     目标：${group.groupGoal}`);
      parts.push(`     预计时间：${Math.round(group.estimatedTime / 60)}分钟`);
    });
    parts.push(``);
  }

  if (followUpPlan) {
    parts.push(`七、后续复习计划`);
    parts.push(`  计划周期：${followUpPlan.totalDays}天`);
    parts.push(`  总题量：${followUpPlan.totalQuestions}题`);
    parts.push(`  预计总耗时：${Math.round(followUpPlan.totalEstimatedTime / 60)}分钟`);
    parts.push(`  总体目标：${followUpPlan.overallGoal}`);
    if (followUpPlan.classWeakPoints.length > 0) {
      parts.push(`  重点关注：${followUpPlan.classWeakPoints.map(kp => kp.name).join('、')}`);
    }
    parts.push(``);
  }

  parts.push(`八、教学建议`);
  classReport.teachingResearch.teachingSuggestions.forEach((suggestion, idx) => {
    parts.push(`  ${idx + 1}. ${suggestion}`);
  });
  parts.push(``);

  parts.push(`九、下一步计划`);
  classReport.teachingResearch.nextSteps.forEach((step, idx) => {
    parts.push(`  ${step}`);
  });

  return parts.join('\n');
}

export function exportTeachingResearch(config: TeachingResearchExportConfig): TeachingResearchExport {
  const { classReport, remedialPackage, followUpPlan, includeVisualization = true, className } = config;

  const textSummary = generateTextSummary(classReport, remedialPackage, followUpPlan);

  const weakKnowledgePoints = Object.entries(classReport.knowledgePointDimension.stats)
    .filter(([, stat]) => stat.avgAccuracy < 0.7)
    .sort((a, b) => a[1].avgAccuracy - b[1].avgAccuracy)
    .map(([kpId, stat]) => ({
      knowledgePoint: stat.knowledgePoint,
      avgAccuracy: stat.avgAccuracy,
      weakStudentCount: stat.weakCount,
      priority: stat.priority,
      suggestion: stat.priority === 'high'
        ? `建议立即安排专项复习，重点关注${stat.weakCount}名薄弱学生`
        : stat.priority === 'medium'
        ? '建议安排巩固练习，逐步提升'
        : '建议定期复习，保持掌握程度'
    }));

  const strongKnowledgePoints = Object.entries(classReport.knowledgePointDimension.stats)
    .filter(([, stat]) => stat.avgAccuracy >= 0.8)
    .sort((a, b) => b[1].avgAccuracy - a[1].avgAccuracy)
    .map(([, stat]) => ({
      knowledgePoint: stat.knowledgePoint,
      avgAccuracy: stat.avgAccuracy,
      suggestion: '掌握较好，可以适当增加难度，拓展提升'
    }));

  const typicalWrongQuestions = Object.entries(classReport.questionDimension.stats)
    .sort((a, b) => a[1].passRate - b[1].passRate)
    .slice(0, 5)
    .filter(([, stat]) => stat.passRate < 0.7)
    .map(([qId, stat]) => ({
      questionId: qId,
      question: stat.question,
      type: stat.type,
      difficulty: stat.difficulty,
      knowledgePoint: stat.knowledgePoint,
      passRate: stat.passRate,
      commonErrors: stat.commonErrors.map(e => errorTypeNames[e.type]),
      analysis: `全班通过率仅${(stat.passRate * 100).toFixed(1)}%，` +
        `主要错误为${stat.commonErrors.map(e => errorTypeNames[e.type]).join('、') || '无'}，` +
        `建议重点讲解解题思路和常见误区`
    }));

  const focusStudents = classReport.studentDimension.focusStudents.map(student => ({
    studentId: student.studentId,
    studentName: student.studentName,
    status: student.status,
    accuracy: student.accuracy,
    mastery: student.masteryLevel,
    reason: student.reason,
    suggestion: student.status === 'needsAttention'
      ? '建议安排一对一辅导，从基础概念开始补习'
      : student.status === 'declining'
      ? '建议关注学习状态，了解原因，及时调整教学方法'
      : '建议提供拓展内容，鼓励帮助其他同学'
  }));

  const remedialSuggestions = remedialPackage ? {
    groups: remedialPackage.groups.map(group => ({
      groupName: group.groupName,
      targetStudents: group.targetStudents,
      totalQuestions: group.totalQuestions,
      avgDifficulty: group.avgDifficulty,
      estimatedTime: group.estimatedTime,
      focusPoints: group.focusAreas
    }))
  } : { groups: [] };

  const followUpPlanData = followUpPlan ? {
    totalDays: followUpPlan.totalDays,
    overallGoal: followUpPlan.overallGoal,
    dailyFocus: followUpPlan.days.slice(0, 3).map(day => day.dailyGoal)
  } : {
    totalDays: 7,
    overallGoal: classReport.teachingResearch.nextSteps[0] || '系统复习薄弱知识点，提升班级整体水平',
    dailyFocus: classReport.teachingResearch.nextSteps.slice(1, 4)
  };

  let visualizationData: TeachingResearchExport['visualizationData'] = {
    masteryDistribution: { labels: [], values: [], colors: [] },
    knowledgePointRanking: { labels: [], accuracies: [], colors: [] },
    questionPassRate: { labels: [], passRates: [] },
    studentRanking: { labels: [], accuracies: [], masteryLevels: [] }
  };

  if (includeVisualization) {
    visualizationData = {
      masteryDistribution: {
        labels: ['优秀(≥85分)', '良好(70-84分)', '中等(50-69分)', '需努力(<50分)'],
        values: [
          classReport.overall.masteryDistribution.excellent,
          classReport.overall.masteryDistribution.good,
          classReport.overall.masteryDistribution.medium,
          classReport.overall.masteryDistribution.needsImprovement
        ],
        colors: ['#52c41a', '#1890ff', '#faad14', '#f5222d']
      },
      knowledgePointRanking: {
        labels: Object.values(classReport.knowledgePointDimension.stats)
          .sort((a, b) => a.avgAccuracy - b.avgAccuracy)
          .map(stat => stat.knowledgePoint.name),
        accuracies: Object.values(classReport.knowledgePointDimension.stats)
          .sort((a, b) => a.avgAccuracy - b.avgAccuracy)
          .map(stat => Math.round(stat.avgAccuracy * 100)),
        colors: Object.values(classReport.knowledgePointDimension.stats)
          .sort((a, b) => a.avgAccuracy - b.avgAccuracy)
          .map(stat => stat.avgAccuracy < 0.5 ? '#f5222d' : stat.avgAccuracy < 0.7 ? '#faad14' : '#52c41a')
      },
      questionPassRate: {
        labels: Object.entries(classReport.questionDimension.stats)
          .sort((a, b) => a[1].passRate - b[1].passRate)
          .map(([, stat], idx) => `第${idx + 1}题`),
        passRates: Object.values(classReport.questionDimension.stats)
          .sort((a, b) => a.passRate - b.passRate)
          .map(stat => Math.round(stat.passRate * 100))
      },
      studentRanking: {
        labels: classReport.studentDimension.ranking
          .slice(0, 10)
          .map(r => r.studentName || r.studentId),
        accuracies: classReport.studentDimension.ranking
          .slice(0, 10)
          .map(r => Math.round(r.accuracy * 100)),
        masteryLevels: classReport.studentDimension.ranking
          .slice(0, 10)
          .map(r => Math.round(r.masteryLevel))
      }
    };
  }

  return {
    exportId: `tr-export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    exportedAt: Date.now(),
    className: className || classReport.className,
    exerciseId: classReport.exerciseId,
    textSummary,
    structuredData: {
      classOverview: {
        totalStudents: classReport.totalStudents,
        submittedCount: classReport.submittedCount,
        avgAccuracy: classReport.overall.avgAccuracy,
        avgMastery: classReport.overall.avgMasteryLevel,
        masteryDistribution: classReport.overall.masteryDistribution
      },
      weakKnowledgePoints,
      strongKnowledgePoints,
      typicalWrongQuestions,
      focusStudents,
      remedialSuggestions,
      followUpPlan: followUpPlanData
    },
    visualizationData,
    teachingSuggestions: classReport.teachingResearch.teachingSuggestions,
    nextSteps: classReport.teachingResearch.nextSteps
  };
}

export const teachingResearchModule = {
  export: exportTeachingResearch
};
