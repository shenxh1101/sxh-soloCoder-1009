import {
  createQuestions,
  createExercise,
  generateDiagnosticReport,
  generateClassDiagnosticReport,
  createRemedialPackage,
  trackRemedialProgress,
  createClassStudyPlan,
  createAdaptiveExercise,
  exportTeachingResearch,
  type KnowledgePoint,
  type AnswerRecord
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
  questionCount: number = 10
) {
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

function createMockStudentRecords(count: number) {
  const studentNames = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '王十二'];
  const records = [];

  for (let i = 0; i < count; i++) {
    const accuracy = 0.3 + Math.random() * 0.6;
    const record = createMockExerciseRecord(`S${String(i + 1).padStart(3, '0')}`, accuracy);
    records.push({
      studentId: `S${String(i + 1).padStart(3, '0')}`,
      studentName: studentNames[i % studentNames.length],
      record
    });
  }

  return records;
}

function runTests(): void {
  console.log('========================================');
  console.log('  数学练习题SDK V4功能测试');
  console.log('========================================\n');

  // Test 1: 个人诊断报告不依赖原题列表 - 直接写入题目信息
  console.log('【测试1】个人诊断报告 - 直接写入题目信息生成报告');
  const directRecord = createMockExerciseRecord('S001', 0.7);
  const reportWithoutQuestions = generateDiagnosticReport(directRecord);
  console.log(`✅ 知识点维度统计数量: ${Object.keys(reportWithoutQuestions.knowledgePointDimension.stats).length}个`);
  console.log(`✅ 题型维度统计数量: ${Object.keys(reportWithoutQuestions.typeDimension.stats).length}个`);
  console.log(`✅ 单题详情数量: ${Object.keys(reportWithoutQuestions.questionDimension.details).length}道`);
  console.log(`✅ 薄弱知识点: ${reportWithoutQuestions.knowledgePointDimension.weakPoints.map(kp => kp.name).join('、')}`);
  console.log(`✅ 优势题型: ${reportWithoutQuestions.typeDimension.strongTypes.join('、')}`);
  const test1Passed = Object.keys(reportWithoutQuestions.knowledgePointDimension.stats).length > 0
    && Object.keys(reportWithoutQuestions.typeDimension.stats).length > 0
    && Object.keys(reportWithoutQuestions.questionDimension.details).length > 0;
  console.log(`测试1结果: ${test1Passed ? '✅ 通过' : '❌ 失败'}\n`);

  // Test 2: 个人报告通过addAnswer直接写入题目信息
  console.log('【测试2】个人诊断报告 - 通过addAnswer直接写入题目信息');
  const session = createExercise();
  const testQuestions = createQuestions({ type: 'fraction', difficulty: 'medium', count: 5, knowledgePoints: [KNOWLEDGE_POINTS[0]] });
  
  testQuestions.forEach((q, idx) => {
    const answerRecord: AnswerRecord = {
      questionId: q.id,
      question: q.question,
      questionType: q.type,
      questionDifficulty: q.difficulty,
      questionKnowledgePoint: q.knowledgePoint,
      correctAnswer: q.correctAnswer,
      attempts: [{
        userAnswer: idx < 3 ? q.correctAnswer : '错误答案',
        isCorrect: idx < 3,
        timeSpent: 30000,
        timestamp: Date.now() + idx * 1000
      }],
      finalAnswer: idx < 3 ? q.correctAnswer : '错误答案',
      isCorrect: idx < 3,
      totalTimeSpent: 30000,
      attemptsCount: 1,
      firstAttemptCorrect: idx < 3,
      timestamp: Date.now() + idx * 1000
    };
    session.addAnswer(answerRecord);
  });

  const directAddRecord = session.finish();
  const directAddReport = generateDiagnosticReport(directAddRecord);
  console.log(`✅ 直接写入后知识点统计: ${Object.keys(directAddReport.knowledgePointDimension.stats).length}个`);
  console.log(`✅ 直接写入后题型统计: ${Object.keys(directAddReport.typeDimension.stats).length}个`);
  console.log(`✅ 直接写入后单题详情: ${Object.keys(directAddReport.questionDimension.details).length}道`);
  console.log(`✅ 知识点名称: ${Object.values(directAddReport.knowledgePointDimension.stats)[0]?.knowledgePoint.name}`);
  const test2Passed = Object.keys(directAddReport.knowledgePointDimension.stats).length > 0
    && Object.keys(directAddReport.typeDimension.stats).length > 0
    && Object.values(directAddReport.knowledgePointDimension.stats)[0]?.knowledgePoint.name === '分数的认识';
  console.log(`测试2结果: ${test2Passed ? '✅ 通过' : '❌ 失败'}\n`);

  // Test 3: 班级练习计划双视角 - 同时生成班级和个人计划
  console.log('【测试3】班级练习计划双视角 - 班级+个人计划');
  const studentRecords = createMockStudentRecords(5);
  const classReport = generateClassDiagnosticReport({
    records: studentRecords,
    className: '五年级(1)班'
  });

  const classPlanWithPersonal = createClassStudyPlan({
    classReport,
    totalDays: 7,
    className: '五年级(1)班',
    dailyQuestions: 10,
    includePersonalPlans: true,
    studentRecords
  });

  console.log(`✅ 班级计划总天数: ${classPlanWithPersonal.totalDays}天`);
  console.log(`✅ 班级计划总题数: ${classPlanWithPersonal.totalQuestions}题`);
  console.log(`✅ 生成个人计划数量: ${Object.keys(classPlanWithPersonal.personalPlans || {}).length}个`);
  const firstStudentId = Object.keys(classPlanWithPersonal.personalPlans || {})[0];
  if (firstStudentId && classPlanWithPersonal.personalPlans) {
    const personalPlan = classPlanWithPersonal.personalPlans[firstStudentId];
    console.log(`✅ 个人计划示例 - 学生${firstStudentId}: ${personalPlan.totalDays}天, ${personalPlan.totalQuestions}题`);
    console.log(`✅ 个人计划目标: ${personalPlan.overallGoal.substring(0, 30)}...`);
  }
  const test3Passed = classPlanWithPersonal.totalDays === 7
    && Object.keys(classPlanWithPersonal.personalPlans || {}).length === 5
    && (classPlanWithPersonal.personalPlans?.[firstStudentId]?.totalDays === 7);
  console.log(`测试3结果: ${test3Passed ? '✅ 通过' : '❌ 失败'}\n`);

  // Test 4: 课后补救包跟踪
  console.log('【测试4】课后补救包跟踪 - 完成情况与对比分析');
  const remedialPackage = createRemedialPackage({
    classReport,
    totalQuestions: 30,
    className: '五年级(1)班'
  });

  const beforeRecords = createMockStudentRecords(6);
  const afterRecords = beforeRecords.map((sr, idx) => ({
    ...sr,
    record: createMockExerciseRecord(sr.studentId, 0.5 + Math.random() * 0.4),
    groupName: idx < 2 ? '基础组' as const : idx < 4 ? '巩固组' as const : '挑战组' as const,
    beforeRecord: sr.record
  }));

  const trackingResult = trackRemedialProgress({
    package: remedialPackage,
    studentRecords: afterRecords,
    passThreshold: 0.6,
    upgradeThreshold: 0.8
  });

  console.log(`✅ 跟踪班级: ${trackingResult.className}`);
  console.log(`✅ 基础组完成人数: ${trackingResult.groupProgress[0].completedStudents}/${trackingResult.groupProgress[0].totalStudents}`);
  console.log(`✅ 巩固组完成人数: ${trackingResult.groupProgress[1].completedStudents}/${trackingResult.groupProgress[1].totalStudents}`);
  console.log(`✅ 挑战组完成人数: ${trackingResult.groupProgress[2].completedStudents}/${trackingResult.groupProgress[2].totalStudents}`);
  console.log(`✅ 补救前正确率: ${(trackingResult.comparison.beforeAccuracy * 100).toFixed(1)}%`);
  console.log(`✅ 补救后正确率: ${(trackingResult.comparison.afterAccuracy * 100).toFixed(1)}%`);
  console.log(`✅ 正确率提升: ${(trackingResult.comparison.accuracyImprovement * 100).toFixed(1)}个百分点`);
  console.log(`✅ 进步人数: ${trackingResult.comparison.improvedStudents}人`);
  console.log(`✅ 建议升组人数: ${trackingResult.upgradeRecommendations.length}人`);
  console.log(`✅ 需继续补习人数: ${trackingResult.remediationRecommendations.length}人`);
  console.log(`✅ 跟踪摘要: ${trackingResult.summary.substring(0, 50)}...`);
  const test4Passed = trackingResult.groupProgress.length === 3
    && trackingResult.comparison.totalStudents === 6
    && trackingResult.summary.length > 0;
  console.log(`测试4结果: ${test4Passed ? '✅ 通过' : '❌ 失败'}\n`);

  // Test 5: 教研汇报导出
  console.log('【测试5】教研汇报导出 - 结构化内容+可视化数据');
  const classPlan = createClassStudyPlan({
    classReport,
    totalDays: 7,
    className: '五年级(1)班'
  });

  const exportResult = exportTeachingResearch({
    classReport,
    remedialPackage,
    followUpPlan: classPlan,
    includeVisualization: true,
    className: '五年级(1)班'
  });

  console.log(`✅ 导出ID: ${exportResult.exportId}`);
  console.log(`✅ 班级: ${exportResult.className}`);
  console.log(`✅ 纯文本摘要长度: ${exportResult.textSummary.length}字`);
  console.log(`✅ 薄弱知识点数量: ${exportResult.structuredData.weakKnowledgePoints.length}个`);
  console.log(`✅ 典型错题数量: ${exportResult.structuredData.typicalWrongQuestions.length}道`);
  console.log(`✅ 重点关注学生: ${exportResult.structuredData.focusStudents.length}人`);
  console.log(`✅ 分层补救建议组数: ${exportResult.structuredData.remedialSuggestions.groups.length}组`);
  console.log(`✅ 教学建议数量: ${exportResult.teachingSuggestions.length}条`);
  console.log(`✅ 可视化数据-掌握度分布: ${exportResult.visualizationData.masteryDistribution.labels.length}类`);
  console.log(`✅ 可视化数据-知识点排名: ${exportResult.visualizationData.knowledgePointRanking.labels.length}个`);
  console.log(`✅ 可视化数据-题目通过率: ${exportResult.visualizationData.questionPassRate.labels.length}道`);
  console.log(`✅ 可视化数据-学生排名: ${exportResult.visualizationData.studentRanking.labels.length}人`);
  console.log(`\n纯文本摘要预览:`);
  console.log(exportResult.textSummary.substring(0, 200) + '...');
  const test5Passed = exportResult.textSummary.length > 0
    && exportResult.structuredData.weakKnowledgePoints.length > 0
    && exportResult.visualizationData.masteryDistribution.labels.length > 0;
  console.log(`\n测试5结果: ${test5Passed ? '✅ 通过' : '❌ 失败'}\n`);

  // Test 6: 自适应练习边界控制 - 限定教学范围
  console.log('【测试6】自适应练习边界控制 - 限定教学范围');
  const weakRecord = createMockExerciseRecord('S001', 0.4);
  
  const boundedResult = createAdaptiveExercise({
    previousRecord: weakRecord,
    targetCount: 12,
    boundary: {
      allowedKnowledgePoints: [KNOWLEDGE_POINTS[0], KNOWLEDGE_POINTS[2]],
      excludedTypes: ['equation', 'wordProblem'],
      maxEstimatedTime: 600,
      classFocusPoints: [KNOWLEDGE_POINTS[0]],
      classFocusWeight: 0.4
    }
  });

  console.log(`✅ 总题数: ${boundedResult.questions.length}道`);
  const typesInResult = [...new Set(boundedResult.questions.map(q => q.type))];
  console.log(`✅ 题型范围: ${typesInResult.join(', ')}（已排除方程、应用题）`);
  const hasExcludedType = typesInResult.some(t => t === 'equation' || t === 'wordProblem');
  console.log(`✅ 未出现排除题型: ${!hasExcludedType}`);
  
  const kpsInResult = [...new Set(boundedResult.questions
    .filter(q => q.knowledgePoint)
    .map(q => q.knowledgePoint!.id))];
  console.log(`✅ 知识点范围: ${kpsInResult.join(', ')}`);
  const hasDisallowedKp = kpsInResult.some(kpId => 
    ![KNOWLEDGE_POINTS[0].id, KNOWLEDGE_POINTS[2].id].includes(kpId));
  console.log(`✅ 未出现限定外知识点: ${!hasDisallowedKp}`);

  const classFocusQuestions = boundedResult.questions.filter(q => 
    q.selectionExplanation.includes('班级重点'));
  console.log(`✅ 班级重点题数量: ${classFocusQuestions.length}道`);
  
  console.log(`✅ 推荐理由（含边界说明）:`);
  boundedResult.recommendation.reasons.slice(0, 3).forEach((r, idx) => {
    console.log(`    ${idx + 1}. ${r}`);
  });
  
  const test6Passed = boundedResult.questions.length === 12
    && !hasExcludedType
    && !hasDisallowedKp
    && classFocusQuestions.length >= 2;
  console.log(`\n测试6结果: ${test6Passed ? '✅ 通过' : '❌ 失败'}\n`);

  // Test 7: 自适应练习边界控制 - 排除题型验证
  console.log('【测试7】自适应练习边界控制 - 排除题型验证');
  const noGeometryResult = createAdaptiveExercise({
    previousRecord: weakRecord,
    targetCount: 10,
    boundary: {
      excludedTypes: ['geometry', 'fraction']
    }
  });

  const typesInNoGeo = [...new Set(noGeometryResult.questions.map(q => q.type))];
  console.log(`✅ 生成题型: ${typesInNoGeo.join(', ')}`);
  const hasExcludedGeo = typesInNoGeo.some(t => t === 'geometry' || t === 'fraction');
  console.log(`✅ 未出现几何和分数题: ${!hasExcludedGeo}`);
  
  const hasBoundaryReason = noGeometryResult.recommendation.reasons.some(r => 
    r.includes('暂不涉及'));
  console.log(`✅ 推荐理由含排除说明: ${hasBoundaryReason}`);
  
  const test7Passed = !hasExcludedGeo && hasBoundaryReason;
  console.log(`测试7结果: ${test7Passed ? '✅ 通过' : '❌ 失败'}\n`);

  // Summary
  console.log('========================================');
  console.log('  所有测试完成');
  console.log('========================================');
  const allPassed = test1Passed && test2Passed && test3Passed && test4Passed 
    && test5Passed && test6Passed && test7Passed;
  console.log(`\n总结果: ${allPassed ? '✅ 全部通过' : '❌ 部分失败'}`);
  console.log(`  测试1: ${test1Passed ? '✅' : '❌'} 个人报告不依赖原题列表`);
  console.log(`  测试2: ${test2Passed ? '✅' : '❌'} 直接写入题目信息生成报告`);
  console.log(`  测试3: ${test3Passed ? '✅' : '❌'} 班级计划双视角`);
  console.log(`  测试4: ${test4Passed ? '✅' : '❌'} 补救包跟踪与对比`);
  console.log(`  测试5: ${test5Passed ? '✅' : '❌'} 教研汇报导出`);
  console.log(`  测试6: ${test6Passed ? '✅' : '❌'} 边界控制-限定范围`);
  console.log(`  测试7: ${test7Passed ? '✅' : '❌'} 边界控制-排除题型`);
}

runTests();
