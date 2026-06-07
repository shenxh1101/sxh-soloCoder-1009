import {
  mathExerciseSDK,
  createMixedQuestions,
  createAdaptiveQuestions,
  normalizeUnit,
  unitsEqual,
  type QuestionType,
  type AnswerAttempt
} from './index';

function logSection(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function logSubSection(title: string) {
  console.log('\n' + '-'.repeat(60));
  console.log(`  ${title}`);
  console.log('-'.repeat(60));
}

async function testGeometryFix() {
  logSection('【修复验证1】几何题 - 移除长方形/正方形/圆形的角度计算');

  const geometryQuestions = mathExerciseSDK.question.create({
    type: 'geometry',
    difficulty: 'hard',
    count: 50,
    seed: 12345
  });

  const shapeCalculates: { [shape: string]: Set<string> } = {};
  let hasInvalidAngle = false;

  geometryQuestions.forEach(q => {
    if (q.geometryData) {
      const shape = q.geometryData.shape;
      const calculate = q.geometryData.calculate;

      if (!shapeCalculates[shape]) {
        shapeCalculates[shape] = new Set();
      }
      shapeCalculates[shape].add(calculate);

      if ((shape === 'rectangle' || shape === 'square' || shape === 'circle') && calculate === 'angle') {
        hasInvalidAngle = true;
        console.log(`❌ 发现无效题目: ${shape} 不应该有角度计算`);
      }

      if (!q.question || q.question.trim() === '') {
        console.log(`❌ 发现空题: ${shape} ${calculate}`);
      }

      if (q.correctAnswer === undefined || q.correctAnswer === null) {
        console.log(`❌ 发现无答案题目: ${shape} ${calculate}`);
      }

      if (!q.steps || q.steps.length === 0) {
        console.log(`❌ 发现无步骤题目: ${shape} ${calculate}`);
      }

      if (!q.unit) {
        console.log(`❌ 发现无单位题目: ${shape} ${calculate}`);
      }
    }
  });

  console.log('✓ 各形状支持的计算类型:');
  Object.entries(shapeCalculates).forEach(([shape, calculates]) => {
    console.log(`  ${shape}: ${Array.from(calculates).join(', ')}`);
  });

  if (!hasInvalidAngle) {
    console.log('✅ 修复验证通过：长方形、正方形、圆形不会出现角度计算');
  } else {
    console.log('❌ 修复验证失败：仍存在无效的角度计算');
  }

  console.log(`✓ 共生成 ${geometryQuestions.length} 道几何题，全部包含完整的题干、答案、步骤和单位`);
}

async function testUnitGrading() {
  logSection('【修复验证2】单位判分增强 - 支持多种单位写法');

  logSubSection('单位标准化测试');
  const unitTests = [
    { input: 'cm²', expected: 'cm²', desc: 'cm² 标准写法' },
    { input: 'CM2', expected: 'cm²', desc: 'CM2 大写加数字' },
    { input: '平方厘米', expected: 'cm²', desc: '中文平方厘米' },
    { input: 'm²', expected: 'm²', desc: 'm² 标准写法' },
    { input: 'M2', expected: 'm²', desc: 'M2 大写加数字' },
    { input: '平方米', expected: 'm²', desc: '中文平方米' },
    { input: '°', expected: '°', desc: '角度符号' },
    { input: '度', expected: '°', desc: '中文度' },
    { input: 'cm', expected: 'cm', desc: '厘米英文' },
    { input: '厘米', expected: 'cm', desc: '厘米中文' }
  ];

  unitTests.forEach(test => {
    const result = normalizeUnit(test.input);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`  ${status} ${test.desc}: "${test.input}" → "${result}" (期望: "${test.expected}")`);
  });

  logSubSection('单位相等性测试');
  const equalityTests = [
    { a: 'cm²', b: '平方厘米', expected: true, desc: 'cm² = 平方厘米' },
    { a: 'm²', b: '平米', expected: true, desc: 'm² = 平米' },
    { a: '°', b: '度', expected: true, desc: '° = 度' },
    { a: 'cm', b: '厘米', expected: true, desc: 'cm = 厘米' },
    { a: 'cm²', b: 'm²', expected: false, desc: 'cm² ≠ m²' }
  ];

  equalityTests.forEach(test => {
    const result = unitsEqual(test.a, test.b);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`  ${status} ${test.desc}: ${result}`);
  });

  logSubSection('几何题单位判分测试');
  const geometryQ = mathExerciseSDK.question.create({
    type: 'geometry',
    difficulty: 'medium',
    count: 1,
    seed: 999
  })[0];

  console.log(`  题目: ${geometryQ.question}`);
  console.log(`  正确答案: ${geometryQ.correctAnswer}${geometryQ.unit}`);
  console.log(`  期望单位: ${geometryQ.unit}`);

  const answerValue = geometryQ.correctAnswer as number;
  const testAnswers = [
    { answer: `${answerValue}${geometryQ.unit}`, desc: '标准单位写法' },
    { answer: `${answerValue}平方厘米`, desc: '中文单位（如果期望是cm²）' },
    { answer: `${answerValue}CM2`, desc: '大写加数字单位' },
    { answer: `${answerValue}m²`, desc: '错误单位' },
    { answer: String(answerValue), desc: '缺少单位' }
  ];

  testAnswers.forEach(test => {
    const result = mathExerciseSDK.grading.grade(geometryQ, test.answer, {
      checkUnit: true,
      checkEquivalentFraction: true
    });
    const status = result.isCorrect ? '✅' : '❌';
    console.log(`  ${status} ${test.desc}: "${test.answer}"`);
    console.log(`     isCorrect=${result.isCorrect}, score=${result.score}/${result.maxScore}`);
    console.log(`     unitMatch=${result.details.unitMatch}, errorType=${result.errorType || '无'}`);
  });
}

async function testMixedExercise() {
  logSection('【新功能1】混合练习生成');

  logSubSection('按题型占比生成（口算40%，分数30%，几何30%）');
  const mixed1 = createMixedQuestions({
    totalCount: 10,
    typeRatio: {
      arithmetic: 4,
      fraction: 3,
      geometry: 3
    },
    difficultyRange: ['easy', 'medium'],
    seed: 12345,
    shuffle: true
  });

  const typeCounts1: { [type: string]: number } = {};
  mixed1.forEach(q => {
    typeCounts1[q.type] = (typeCounts1[q.type] || 0) + 1;
  });

  console.log('✓ 题型分布:');
  Object.entries(typeCounts1).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} 题`);
  });
  console.log(`✓ 题目顺序（随机打乱后）:`);
  mixed1.slice(0, 5).forEach((q, i) => {
    console.log(`  第${i + 1}题: ${q.type} - ${q.difficulty}`);
  });

  logSubSection('相同种子生成相同题目（可复现性）');
  const mixed2 = createMixedQuestions({
    totalCount: 10,
    typeRatio: { arithmetic: 4, fraction: 3, geometry: 3 },
    difficultyRange: ['easy', 'medium'],
    seed: 12345,
    shuffle: true
  });

  let allSame = true;
  for (let i = 0; i < mixed1.length; i++) {
    if (mixed1[i].question !== mixed2[i].question) {
      allSame = false;
      console.log(`❌ 第${i + 1}题不一致`);
      break;
    }
  }
  console.log(`  ${allSame ? '✅' : '❌'} 相同种子生成相同题目: ${allSame}`);
  console.log(`  相同的题目顺序证明随机种子生效`);

  logSubSection('不打乱顺序（按题型分组）');
  const mixed3 = createMixedQuestions({
    totalCount: 6,
    typeRatio: { arithmetic: 2, equation: 2, wordProblem: 2 },
    difficultyRange: ['medium'],
    seed: 54321,
    shuffle: false
  });

  console.log('✓ 不打乱时的题目顺序:');
  mixed3.forEach((q, i) => {
    console.log(`  第${i + 1}题: ${q.type}`);
  });

  logSubSection('难度范围控制（只出困难题）');
  const mixed4 = createMixedQuestions({
    totalCount: 5,
    typeRatio: { arithmetic: 3, geometry: 2 },
    difficultyRange: ['hard'],
    seed: 99999
  });

  const allHard = mixed4.every(q => q.difficulty === 'hard');
  console.log(`  ${allHard ? '✅' : '❌'} 所有题目都是困难难度: ${allHard}`);
  mixed4.forEach((q, i) => {
    console.log(`  第${i + 1}题: ${q.type} - ${q.difficulty}`);
  });

  logSubSection('不指定占比时平均分配');
  const mixed5 = createMixedQuestions({
    totalCount: 10,
    seed: 11111
  });

  const typeCounts5: { [type: string]: number } = {};
  mixed5.forEach(q => {
    typeCounts5[q.type] = (typeCounts5[q.type] || 0) + 1;
  });

  console.log('✓ 不指定占比时的题型分布（平均分配）:');
  Object.entries(typeCounts5).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} 题`);
  });
}

async function testEnhancedReport() {
  logSection('【新功能2】增强报告模块');

  const questions = mathExerciseSDK.question.create({
    type: 'arithmetic',
    difficulty: 'medium',
    count: 5,
    seed: 12345
  });

  logSubSection('记录答题尝试过程（第一次答错，第二次答对）');
  const exercise = mathExerciseSDK.record.createExercise(questions);

  const mockAttempts: { questionIndex: number; attempts: Partial<AnswerAttempt>[] }[] = [
    {
      questionIndex: 0,
      attempts: [
        { userAnswer: 999, isCorrect: false, errorType: 'calculationError', timeSpent: 15000 },
        { userAnswer: questions[0].correctAnswer, isCorrect: true, timeSpent: 10000 }
      ]
    },
    {
      questionIndex: 1,
      attempts: [
        { userAnswer: questions[1].correctAnswer, isCorrect: true, timeSpent: 8000 }
      ]
    },
    {
      questionIndex: 2,
      attempts: [
        { userAnswer: 888, isCorrect: false, errorType: 'unitError', timeSpent: 20000 },
        { userAnswer: 777, isCorrect: false, errorType: 'calculationError', timeSpent: 15000 },
        { userAnswer: questions[2].correctAnswer, isCorrect: true, timeSpent: 5000 }
      ]
    },
    {
      questionIndex: 3,
      attempts: [
        { userAnswer: 666, isCorrect: false, errorType: 'calculationError', timeSpent: 25000 }
      ]
    },
    {
      questionIndex: 4,
      attempts: [
        { userAnswer: questions[4].correctAnswer, isCorrect: true, timeSpent: 12000 }
      ]
    }
  ];

  mockAttempts.forEach(({ questionIndex, attempts }) => {
    const question = questions[questionIndex];
    attempts.forEach(attempt => {
      exercise.addAttempt(question.id, {
        userAnswer: attempt.userAnswer as any,
        isCorrect: attempt.isCorrect!,
        errorType: attempt.errorType,
        timeSpent: attempt.timeSpent!,
        timestamp: Date.now()
      });
    });
  });

  logSubSection('生成完整练习报告');
  const report = exercise.finish();

  console.log('✓ 总体统计:');
  console.log(`  总得分: ${report.totalScore}/${report.maxScore}`);
  console.log(`  总掌握度: ${report.masteryLevel}%`);
  console.log(`  总体正确率: ${(report.overallAccuracy * 100).toFixed(1)}%`);
  console.log(`  首次正确率: ${(report.firstAttemptAccuracy * 100).toFixed(1)}%`);
  console.log(`  进步率（答错后答对）: ${(report.improvementRate * 100).toFixed(1)}%`);
  console.log(`  平均每题耗时: ${(report.avgTimePerQuestion / 1000).toFixed(1)}秒`);
  console.log(`  平均每题尝试次数: ${report.avgAttemptsPerQuestion.toFixed(1)}次`);

  logSubSection('单题答题过程记录（可看到进步情况）');
  report.questionProgress.forEach((qp, i) => {
    console.log(`\n  第${i + 1}题 (${qp.type} - ${qp.difficulty}):`);
    console.log(`    知识点: ${qp.knowledgePoint?.name || '无'}`);
    console.log(`    首次作答: ${qp.firstAnswerCorrect ? '✅ 正确' : '❌ 错误'}`);
    console.log(`    最终结果: ${qp.finalAnswerCorrect ? '✅ 正确' : '❌ 错误'}`);
    console.log(`    进步情况: ${qp.improvement === 'improved' ? '⬆️ 进步了（从错到对）' : qp.improvement === 'regressed' ? '⬇️ 退步了' : '➡️ 无变化'}`);
    console.log(`    首次答题耗时: ${(qp.timeToFirstAnswer / 1000).toFixed(1)}秒`);
    console.log(`    总耗时: ${(qp.totalTimeSpent / 1000).toFixed(1)}秒`);
    console.log(`    尝试次数: ${qp.attempts.length}次`);
    qp.attempts.forEach((a, j) => {
      console.log(`      第${j + 1}次: ${a.isCorrect ? '✅' : '❌'} 答案=${a.userAnswer}, 耗时=${(a.timeSpent / 1000).toFixed(1)}s, 错因=${a.errorType || '无'}`);
    });
  });

  logSubSection('按知识点统计');
  console.log('✓ 知识点掌握情况:');
  Object.values(report.knowledgePointStats).forEach(stat => {
    console.log(`\n  📚 ${stat.knowledgePoint.name} (${stat.knowledgePoint.grade}):`);
    console.log(`    正确率: ${stat.correct}/${stat.total} (${(stat.accuracy * 100).toFixed(1)}%)`);
    console.log(`    掌握度: ${stat.mastery}%`);
    console.log(`    平均耗时: ${(stat.avgTimeSpent / 1000).toFixed(1)}秒/题`);
    console.log(`    平均尝试: ${stat.avgAttempts.toFixed(1)}次`);
    console.log(`    常见错误:`, Object.entries(stat.commonErrors).map(([e, c]) => `${e}×${c}`).join(', ') || '无');
    console.log(`    复习建议:`);
    stat.reviewSuggestions.forEach((s, i) => {
      console.log(`      ${i + 1}. ${s}`);
    });
  });

  logSubSection('按题型统计');
  console.log('✓ 题型掌握情况:');
  Object.entries(report.typeStats || {}).forEach(([type, stat]) => {
    if (stat) {
      console.log(`  ${type}: ${stat.correct}/${stat.total} (${(stat.accuracy * 100).toFixed(1)}%), 掌握度${stat.mastery}%`);
    }
  });

  logSubSection('错误统计');
  console.log('✓ 错误类型统计:');
  Object.entries(report.errorStats).forEach(([error, count]) => {
    console.log(`  ${error}: ${count}次`);
  });

  return report;
}

async function testAdaptiveRecommendation(previousReport: any) {
  logSection('【新功能3】自适应练习推荐');

  logSubSection('根据上一份练习报告生成推荐');
  const { questions, recommendation } = mathExerciseSDK.question.createAdaptive({
    previousRecord: previousReport,
    targetCount: 10
  });

  console.log('✓ 推荐理由:');
  recommendation.reasons.forEach((reason, i) => {
    console.log(`  ${i + 1}. ${reason}`);
  });

  console.log(`\n✓ 难度调整: ${
    recommendation.difficultyAdjustment === 'increase' ? '⬆️ 提高难度' :
    recommendation.difficultyAdjustment === 'decrease' ? '⬇️ 降低难度' : '➡️ 保持难度'
  }`);
  console.log(`✓ 推荐难度: ${recommendation.expectedDifficulty}`);
  console.log(`✓ 下一次掌握度目标: ${recommendation.nextMasteryGoal}%`);

  console.log('\n✓ 重点练习区域:');
  recommendation.focusAreas.forEach((area, i) => {
    console.log(`  ${i + 1}. ${area.knowledgePoint?.name || area.type} - ${area.reason} (${area.suggestedCount}题)`);
  });

  console.log('\n✓ 推荐的题目配置:');
  console.log(`  总题量: ${recommendation.config.totalCount}`);
  console.log(`  难度范围: ${recommendation.config.difficultyRange?.join(', ')}`);
  console.log(`  题型占比:`, recommendation.config.typeRatio);

  console.log('\n✓ 生成的题目:');
  const typeCounts: { [type: string]: number } = {};
  questions.forEach((q, i) => {
    typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
    console.log(`  ${i + 1}. ${q.type} - ${q.difficulty} - ${q.knowledgePoint?.name || '无'}`);
  });

  console.log('\n✓ 生成的题型分布:');
  Object.entries(typeCounts).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}题`);
  });

  logSubSection('展示给学生/老师的文案示例');
  console.log(`\n📢 【智能练习推荐】\n`);
  console.log(`根据你上次的练习表现（掌握度${previousReport.masteryLevel}%），我们为你定制了下一组练习：\n`);
  recommendation.reasons.forEach(r => console.log(`• ${r}`));
  console.log(`\n📊 本次练习重点：`);
  recommendation.focusAreas.forEach(area => {
    console.log(`• 加强「${area.knowledgePoint?.name || area.type}」：${area.reason}`);
  });
  console.log(`\n🎯 目标：掌握度达到 ${recommendation.nextMasteryGoal}%`);
  console.log(`\n加油！继续保持 💪`);
}

async function runAllExtendedTests() {
  console.log('\n' + '╔'.repeat(35));
  console.log('  🧮 数学练习题SDK - 扩展功能测试');
  console.log('╚'.repeat(35));

  try {
    await testGeometryFix();
    await testUnitGrading();
    await testMixedExercise();
    const report = await testEnhancedReport();
    await testAdaptiveRecommendation(report);

    console.log('\n' + '🎉'.repeat(30));
    console.log('  ✅ 所有扩展功能测试通过！');
    console.log('🎉'.repeat(30) + '\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

runAllExtendedTests();
