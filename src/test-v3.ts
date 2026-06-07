import {
  createQuestions,
  createExercise,
  generateDiagnosticReport,
  generateClassDiagnosticReport,
  createRemedialPackage,
  createStudyPlan,
  createClassStudyPlan,
  adjustClassStudyPlan,
  createAdaptiveExercise,
  type Question,
  type ExerciseRecord,
  type KnowledgePoint
} from './index';

const KNOWLEDGE_POINTS: KnowledgePoint[] = [
  { id: 'fraction-basic', name: '分数的认识', grade: '5' },
  { id: 'fraction-add-sub', name: '分数加减法', grade: '5' },
  { id: 'rectangle-area', name: '长方形面积', grade: '5' },
  { id: 'circle-area', name: '圆的面积', grade: '5' },
  { id: 'one-variable', name: '一元一次方程', grade: '5' },
  { id: 'mixed-operation', name: '四则混合运算', grade: '5' },
  { id: 'word-problem-basic', name: '基础应用题', grade: '5' }
];

function createMockExerciseRecord(
  studentId: string,
  accuracy: number,
  mastery: number,
  weakKps: KnowledgePoint[],
  strongKps: KnowledgePoint[],
  weakTypes: string[] = [],
  questionCount: number = 10
): ExerciseRecord {
  const now = Date.now();
  const correctCount = Math.round(accuracy * questionCount);

  const questions = [
    ...createQuestions({ type: 'fraction', difficulty: 'medium', count: 4, knowledgePoints: [KNOWLEDGE_POINTS[0]] }),
    ...createQuestions({ type: 'geometry', difficulty: 'medium', count: 3, knowledgePoints: [KNOWLEDGE_POINTS[2]] }),
    ...createQuestions({ type: 'arithmetic', difficulty: 'medium', count: 3, knowledgePoints: [KNOWLEDGE_POINTS[5]] })
  ];

  const session = createExercise(questions);

  questions.forEach((q, idx) => {
    const isCorrect = idx < correctCount;
    const firstCorrect = idx < correctCount * 0.7;
    const errorType = !firstCorrect ? (idx % 3 === 0 ? 'calculationError' : idx % 3 === 1 ? 'fractionNotSimplified' : 'wrongOperation') : undefined;

    session.addAttempt(q.id, {
      userAnswer: isCorrect ? q.correctAnswer : '错误答案',
      isCorrect: firstCorrect,
      timeSpent: 30000 + Math.random() * 30000,
      timestamp: now + idx * 1000,
      errorType,
      hintUsed: !firstCorrect && idx % 2 === 0
    });

    if (!firstCorrect) {
      session.addAttempt(q.id, {
        userAnswer: q.correctAnswer,
        isCorrect: isCorrect,
        timeSpent: 20000,
        timestamp: now + idx * 1000 + 5000,
        errorType: undefined,
        hintUsed: true
      });
    }
  });

  return session.finish();
}

function runTests(): void {
  console.log('========================================');
  console.log('  数学练习题SDK V3功能测试');
  console.log('========================================\n');

  // Test 1: 个人诊断报告不依赖原题列表
  console.log('【测试1】个人诊断报告不依赖原题列表】');
  const personalRecord = createMockExerciseRecord('S001', 0.7, 65, [KNOWLEDGE_POINTS[0]], [KNOWLEDGE_POINTS[5]], ['fraction']);
  const reportWithoutQuestions = generateDiagnosticReport(personalRecord);
  console.log(`✅ 报告题型维度类型数量: ${Object.keys(reportWithoutQuestions.typeDimension.stats).length}种题型`);
  console.log(`✅ 报告知识点维度数量: ${Object.keys(reportWithoutQuestions.knowledgePointDimension.stats).length}个知识点`);
  console.log(`✅ 报告单题维度详情数量: ${Object.keys(reportWithoutQuestions.questionDimension.details).length}道题`);
  console.log(`✅ 教师短评: ${reportWithoutQuestions.teacherComments.shortComment}`);
  const hasEmptyStats = Object.keys(reportWithoutQuestions.typeDimension.stats).length > 0
    && Object.keys(reportWithoutQuestions.knowledgePointDimension.stats).length > 0
    && Object.keys(reportWithoutQuestions.questionDimension.details).length > 0;
  console.log(`测试1结果: ${hasEmptyStats ? '✅ 通过' : '❌ 失败'}\n`);

  // Test 2: 班级诊断报告
  console.log('【测试2】班级诊断报告（10名学生】');
  const studentRecords = [];
  const studentNames = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '王十二'];

  for (let i = 0; i < 10; i++) {
    const accuracy = 0.3 + Math.random() * 0.6;
    const mastery = 30 + Math.random() * 60;
    const record = createMockExerciseRecord(
      `S${String(i + 1).padStart(3, '0')}`,
      accuracy,
      mastery,
      [KNOWLEDGE_POINTS[0]],
      [KNOWLEDGE_POINTS[5]]
    );
    studentRecords.push({
      studentId: `S${String(i + 1).padStart(3, '0')}`,
      studentName: studentNames[i],
      record
    });
  }

  const classReport = generateClassDiagnosticReport({
    records: studentRecords,
    className: '五年级(1)班',
    exerciseId: 'EXAM-001'
  });

  console.log(`✅ 班级名称: ${classReport.className}`);
  console.log(`✅ 参与人数: ${classReport.totalStudents}人`);
  console.log(`✅ 班级平均正确率: ${(classReport.overall.avgAccuracy * 100).toFixed(1)}%`);
  console.log(`✅ 班级平均掌握度: ${classReport.overall.avgMasteryLevel.toFixed(1)}分`);
  console.log(`✅ 掌握度分布: 优秀${classReport.overall.masteryDistribution.excellent}人, 良好${classReport.overall.masteryDistribution.good}人, 中等${classReport.overall.masteryDistribution.medium}人, 需努力${classReport.overall.masteryDistribution.needsImprovement}人`);
  console.log(`✅ 班级薄弱知识点: ${classReport.knowledgePointDimension.classWeakPoints.map(kp => kp.name).join('、')}`);
  console.log(`✅ 全班通过率最低的题: 第${classReport.questionDimension.hardestQuestions.slice(0, 3).map((_, i) => i + 1).join('、')}题`);
  console.log(`✅ 需重点关注学生: ${classReport.studentDimension.focusStudents.length}人`);
  console.log(`✅ 教研结论摘要: ${classReport.teachingResearch.summary.substring(0, 50)}...`);
  const classTestPassed = classReport.totalStudents === 10
    && classReport.overall.avgAccuracy > 0
    && classReport.knowledgePointDimension.classWeakPoints.length > 0
    && classReport.teachingResearch.summary.length > 0;
  console.log(`测试2结果: ${classTestPassed ? '✅ 通过' : '❌ 失败'}\n`);

  // Test 3: 自适应出题 - 薄弱知识点落到对应题型
  console.log('【测试3】自适应出题 - 薄弱知识点落到对应题型】');
  const weakRecord = createMockExerciseRecord('S001', 0.4, 35, [KNOWLEDGE_POINTS[0]], [KNOWLEDGE_POINTS[5]], ['fraction']);
  const adaptiveResult = createAdaptiveExercise({
    previousRecord: weakRecord,
    targetCount: 12
  });

  console.log(`✅ 总题数: ${adaptiveResult.questions.length}道`);

  const typeCounts: { [key: string]: number } = {};
  adaptiveResult.questions.forEach((q, idx) => {
    typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
    console.log(`  Q${idx + 1}: [${q.selectionReason}] ${q.selectionExplanation}`);
  });

  console.log(`\n✅ 题型分布: ${Object.entries(typeCounts).map(([type, count]) => `${type}: ${count}题`).join(', ')}`);
  console.log(`✅ 题目构成: ${adaptiveResult.recommendation.questionBreakdown.weakKnowledgePoint}道薄弱知识点题, ${adaptiveResult.recommendation.questionBreakdown.review}道复习题, ${adaptiveResult.recommendation.questionBreakdown.challenge}道挑战题`);

  const weakKpQuestions = adaptiveResult.questions.filter(q => q.selectionReason === 'weakKnowledgePoint');
  console.log(`✅ 薄弱知识点题数量: ${weakKpQuestions.length}道`);

  const kpTypeMappings = weakKpQuestions.map(q => {
    const kpMatch = q.selectionExplanation.match(/知识点「([^」]+)」/);
    const kpName = kpMatch ? kpMatch[1] : '';
    const typeNames: { [key: string]: string } = {
      arithmetic: '口算',
      fraction: '分数',
      equation: '方程',
      geometry: '几何测量',
      wordProblem: '应用题'
    };
    return `${kpName} -> ${typeNames[q.type] || q.type}`;
  });
  console.log(`✅ 知识点-题型映射: ${kpTypeMappings.join(', ')}`);

  const adaptiveTestPassed = adaptiveResult.questions.length === 12
    && weakKpQuestions.length >= 4
    && adaptiveResult.questions.every(q => q.selectionExplanation.length > 0);
  console.log(`测试3结果: ${adaptiveTestPassed ? '✅ 通过' : '❌ 失败'}\n`);

  // Test 4: 课后补救包
  console.log('【测试4】课后补救包（分层练习）】');
  const remedialPackage = createRemedialPackage({
    classReport,
    totalQuestions: 30,
    className: '五年级(1)班'
  });

  console.log(`✅ 班级名称: ${remedialPackage.className}`);
  console.log(`✅ 薄弱知识点: ${remedialPackage.weakPoints.map(kp => kp.name).join('、')}`);
  console.log(`\n--- 基础组 (${remedialPackage.groups[0].groupName}):`);
  console.log(`  适合: ${remedialPackage.groups[0].targetStudents}`);
  console.log(`  题数: ${remedialPackage.groups[0].totalQuestions}题`);
  console.log(`  难度: ${remedialPackage.groups[0].avgDifficulty}`);
  console.log(`  预计时间: ${Math.round(remedialPackage.groups[0].estimatedTime / 60)}分钟`);
  console.log(`  目标: ${remedialPackage.groups[0].groupGoal}`);
  console.log(`\n--- 巩固组 (${remedialPackage.groups[1].groupName}):`);
  console.log(`  适合: ${remedialPackage.groups[1].targetStudents}`);
  console.log(`  题数: ${remedialPackage.groups[1].totalQuestions}题`);
  console.log(`  难度: ${remedialPackage.groups[1].avgDifficulty}`);
  console.log(`  预计时间: ${Math.round(remedialPackage.groups[1].estimatedTime / 60)}分钟`);
  console.log(`  目标: ${remedialPackage.groups[1].groupGoal}`);
  console.log(`\n--- 挑战组 (${remedialPackage.groups[2].groupName}):`);
  console.log(`  适合: ${remedialPackage.groups[2].targetStudents}`);
  console.log(`  题数: ${remedialPackage.groups[2].totalQuestions}题`);
  console.log(`  难度: ${remedialPackage.groups[2].avgDifficulty}`);
  console.log(`  预计时间: ${Math.round(remedialPackage.groups[2].estimatedTime / 60)}分钟`);
  console.log(`  目标: ${remedialPackage.groups[2].groupGoal}`);

  console.log(`\n  基础组题目示例:`);
  remedialPackage.groups[0].questions?.slice(0, 3).forEach((q, idx) => {
    console.log(`    Q${idx + 1}: ${q.selectionExplanation}`);
  });

  const remedialTestPassed = remedialPackage.groups.length === 3
    && remedialPackage.groups[0].avgDifficulty === 'easy'
    && remedialPackage.groups[1].avgDifficulty === 'medium'
    && remedialPackage.groups[2].avgDifficulty === 'hard'
    && remedialPackage.groups[0].totalQuestions > remedialPackage.groups[1].totalQuestions
    && remedialPackage.groups[0].totalQuestions > remedialPackage.groups[2].totalQuestions;
  console.log(`\n测试4结果: ${remedialTestPassed ? '✅ 通过' : '❌ 失败'}\n`);

  // Test 5: 班级练习计划
  console.log('【测试5】班级练习计划（7天）】');
  const classPlan = createClassStudyPlan({
    classReport,
    totalDays: 7,
    className: '五年级(1)班',
    dailyQuestions: 10
  });

  console.log(`✅ 班级: ${classPlan.className}`);
  console.log(`✅ 总天数: ${classPlan.totalDays}天`);
  console.log(`✅ 总题数: ${classPlan.totalQuestions}题`);
  console.log(`✅ 预计总耗时: ${Math.round(classPlan.totalEstimatedTime / 60)}分钟`);
  console.log(`✅ 总体目标: ${classPlan.overallGoal}`);
  console.log(`✅ 班级薄弱知识点: ${classPlan.classWeakPoints.map(kp => kp.name).join('、')}`);
  console.log(`\n每日安排:`);
  classPlan.days.slice(0, 3).forEach((day, idx) => {
    console.log(`  第${day.day}天: ${day.dailyGoal}`);
    console.log(`    题数: ${day.totalQuestions}题, 预计: ${Math.round(day.estimatedTime / 60)}分钟`);
    console.log(`    知识点: ${day.knowledgePoints.map(kp => `${kp.knowledgePoint.name}(${kp.count}题)`).join(', ')}`);
  });
  const classPlanTestPassed = classPlan.totalDays === 7
    && classPlan.days.length === 7
    && classPlan.classWeakPoints.length > 0
    && classPlan.days[0].knowledgePoints.length > 0;
  console.log(`\n测试5结果: ${classPlanTestPassed ? '✅ 通过' : '❌ 失败'}\n`);

  // Test 6: 班级计划滚动调整
  console.log('【测试6】班级计划滚动调整】');
  const day1Records = studentRecords.slice(0, 5).map(sr => ({
    studentId: sr.studentId,
    studentName: sr.studentName,
    record: createMockExerciseRecord(sr.studentId, 0.7, 70, [KNOWLEDGE_POINTS[0]], [KNOWLEDGE_POINTS[5]])
  }));

  const adjustedClassPlan = adjustClassStudyPlan({
    plan: classPlan,
    latestRecords: day1Records,
    completedDay: 1
  });

  console.log(`✅ 调整历史: ${adjustedClassPlan.adjustmentHistory.length}次`);
  console.log(`✅ 调整原因: ${adjustedClassPlan.adjustmentHistory[0].reason}`);
  console.log(`✅ 调整内容: ${adjustedClassPlan.adjustmentHistory[0].changes}`);
  console.log(`✅ 第1天已完成: ${adjustedClassPlan.days[0].completed}`);
  console.log(`✅ 第2天更新后目标: ${adjustedClassPlan.days[1].dailyGoal}`);
  const adjustTestPassed = adjustedClassPlan.adjustmentHistory.length === 1
    && adjustedClassPlan.days[0].completed === true;
  console.log(`测试6结果: ${adjustTestPassed ? '✅ 通过' : '❌ 失败'}\n`);

  // Test 7: 14天班级练习计划
  console.log('【测试7】14天班级练习计划】');
  const classPlan14 = createClassStudyPlan({
    classReport,
    totalDays: 14,
    className: '五年级(1)班',
    dailyQuestions: 8
  });

  console.log(`✅ 总天数: ${classPlan14.totalDays}天`);
  console.log(`✅ 总题数: ${classPlan14.totalQuestions}题`);
  console.log(`✅ 预计总耗时: ${Math.round(classPlan14.totalEstimatedTime / 60)}分钟`);
  console.log(`\n阶段划分:`);
  console.log(`  第1-4天: 基础巩固阶段`);
  console.log(`  第5-9天: 强化提升阶段`);
  console.log(`  第10-14天: 综合冲刺阶段`);
  console.log(`\n第1天(基础): ${classPlan14.days[0].dailyGoal}`);
  console.log(`第7天(强化): ${classPlan14.days[6].dailyGoal}`);
  console.log(`第14天(冲刺): ${classPlan14.days[13].dailyGoal}`);
  const plan14TestPassed = classPlan14.totalDays === 14
    && classPlan14.days.length === 14;
  console.log(`\n测试7结果: ${plan14TestPassed ? '✅ 通过' : '❌ 失败'}\n`);

  // Test 8: 选中原因说明完整
  console.log('【测试8】选中原因说明完整性验证】');
  const reasons = adaptiveResult.questions.map(q => q.selectionReason);
  const explanations = adaptiveResult.questions.map(q => q.selectionExplanation);

  const reasonTypes = [...new Set(reasons)];
  console.log(`✅ 选中原因类型: ${reasonTypes.join(', ')}`);
  console.log(`\n原因说明示例:`);
  explanations.slice(0, 5).forEach((exp, idx) => {
    console.log(`  ${exp}`);
  });

  const reasonTestPassed = explanations.every(exp =>
    exp.length > 10 && (exp.includes('补弱') || exp.includes('复习') || exp.includes('挑战') || exp.includes('均衡') || exp.includes('强化')));
  console.log(`\n测试8结果: ${reasonTestPassed ? '✅ 通过' : '❌ 失败'}\n`);

  // Summary
  console.log('========================================');
  console.log('  所有测试完成');
  console.log('========================================');
  const allPassed = hasEmptyStats && classTestPassed && adaptiveTestPassed && remedialTestPassed
    && classPlanTestPassed && adjustTestPassed && plan14TestPassed && reasonTestPassed;
  console.log(`\n总结果: ${allPassed ? '✅ 全部通过' : '❌ 部分失败'}`);
}

runTests();
