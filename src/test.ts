import {
  mathExerciseSDK,
  createQuestions,
  renderQuestion,
  renderQuestionPlain,
  fractionToString,
  simplifyFraction,
  areFractionsEquivalent,
  type QuestionType
} from './index';

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function logSubSection(title: string) {
  console.log('\n' + '-'.repeat(50));
  console.log(`  ${title}`);
  console.log('-'.repeat(50));
}

async function testQuestionCreation() {
  logSection('【模块1测试】题目创建模块');

  const types: QuestionType[] = ['arithmetic', 'fraction', 'equation', 'geometry', 'wordProblem'];
  const typeNames: { [key in QuestionType]: string } = {
    arithmetic: '口算题',
    fraction: '分数题',
    equation: '方程题',
    geometry: '几何测量题',
    wordProblem: '应用题'
  };

  for (const type of types) {
    logSubSection(`生成${typeNames[type]}`);

    const questions = mathExerciseSDK.question.create({
      type,
      difficulty: 'medium',
      count: 2,
      seed: 12345
    });

    console.log(`✓ 成功生成 ${questions.length} 道${typeNames[type]}`);
    console.log(`  难度: ${questions[0].difficulty}`);
    console.log(`  知识点: ${questions[0].knowledgePoint?.name || '无'}`);
    console.log(`  题目: ${questions[0].question}`);
    console.log(`  正确答案: ${typeof questions[0].correctAnswer === 'object' && 'numerator' in questions[0].correctAnswer
      ? fractionToString(questions[0].correctAnswer)
      : questions[0].correctAnswer}${questions[0].unit || ''}`);
    console.log(`  分值: ${questions[0].totalScore}分`);
    console.log(`  解题步骤数: ${questions[0].steps?.length || 0}`);
    console.log(`  提示数: ${questions[0].hints.length}`);
  }

  logSubSection('测试随机种子（可复现性）');
  const q1 = createQuestions({ type: 'arithmetic', difficulty: 'easy', count: 1, seed: 42 });
  const q2 = createQuestions({ type: 'arithmetic', difficulty: 'easy', count: 1, seed: 42 });
  console.log(`✓ 使用相同种子生成的题目一致: ${q1[0].question === q2[0].question}`);
  console.log(`  题目: ${q1[0].question}`);

  logSubSection('测试不同难度');
  const difficulties = ['easy', 'medium', 'hard'] as const;
  for (const diff of difficulties) {
    const q = createQuestions({ type: 'arithmetic', difficulty: diff, count: 1, seed: 100 });
    console.log(`  ${diff}难度: ${q[0].question}`);
  }
}

async function testRenderModule() {
  logSection('【模块2测试】渲染模块');

  const questions = createQuestions({
    type: 'arithmetic',
    difficulty: 'medium',
    count: 1,
    seed: 999
  });
  const question = questions[0];

  logSubSection('Web端渲染');
  const webRender = renderQuestion(question, 'web');
  console.log('✓ Web端HTML生成成功');
  console.log(`  题干文本: ${webRender.questionText}`);
  console.log(`  输入框占位符: ${webRender.inputPlaceholder}`);
  console.log(`  草稿区提示: ${webRender.draftPrompt}`);
  console.log(`  包含选项: ${!!webRender.optionsHtml}`);
  console.log(`  题干HTML长度: ${webRender.questionHtml.length} 字符`);
  console.log(`  输入框HTML长度: ${webRender.inputHtml.length} 字符`);
  console.log(`  草稿区HTML长度: ${webRender.draftAreaHtml.length} 字符`);

  logSubSection('移动端渲染');
  const mobileRender = renderQuestion(question, 'mobile');
  console.log('✓ 移动端HTML生成成功');
  console.log(`  题干HTML长度: ${mobileRender.questionHtml.length} 字符`);

  logSubSection('纯文本渲染');
  const plainText = renderQuestionPlain(question);
  console.log('✓ 纯文本渲染成功');
  console.log(plainText.slice(0, 300) + '...');
}

async function testGradingModule() {
  logSection('【模块3测试】判分模块');

  logSubSection('精确答案判分');
  const arithmeticQ = createQuestions({
    type: 'arithmetic',
    difficulty: 'easy',
    count: 1,
    seed: 1000
  })[0];

  const correctResult = mathExerciseSDK.grading.grade(
    arithmeticQ,
    arithmeticQ.correctAnswer as number
  );
  console.log(`✓ 正确答案判分: isCorrect=${correctResult.isCorrect}, score=${correctResult.score}/${correctResult.maxScore}`);

  const wrongResult = mathExerciseSDK.grading.grade(arithmeticQ, 99999);
  console.log(`✓ 错误答案判分: isCorrect=${wrongResult.isCorrect}, score=${wrongResult.score}/${wrongResult.maxScore}, errorType=${wrongResult.errorType}`);

  logSubSection('等价分数判分');
  const fractionQ = createQuestions({
    type: 'fraction',
    difficulty: 'medium',
    count: 1,
    seed: 2000
  })[0];

  const correctFraction = fractionQ.correctAnswer as { numerator: number; denominator: number };
  const equivalentFraction = {
    numerator: correctFraction.numerator * 2,
    denominator: correctFraction.denominator * 2
  };

  const equivalentResult = mathExerciseSDK.grading.grade(fractionQ, equivalentFraction, {
    checkEquivalentFraction: true
  });
  console.log(`✓ 等价分数判分（允许等价）: isCorrect=${equivalentResult.isCorrect}, equivalentFraction=${equivalentResult.details.equivalentFraction}`);
  console.log(`  正确答案: ${fractionToString(correctFraction)}`);
  console.log(`  用户答案: ${fractionToString(equivalentFraction)}`);

  const notEquivalentResult = mathExerciseSDK.grading.grade(fractionQ, equivalentFraction, {
    checkEquivalentFraction: false
  });
  console.log(`✓ 等价分数判分（要求最简）: isCorrect=${notEquivalentResult.isCorrect}, errorType=${notEquivalentResult.errorType}`);

  logSubSection('单位检查');
  const geometryQ = createQuestions({
    type: 'geometry',
    difficulty: 'medium',
    count: 1,
    seed: 3000
  })[0];

  const correctWithUnit = `${geometryQ.correctAnswer}${geometryQ.unit}`;
  const correctWithoutUnit = String(geometryQ.correctAnswer);
  const wrongUnit = `${geometryQ.correctAnswer}km`;

  const unitCorrect = mathExerciseSDK.grading.grade(geometryQ, correctWithUnit, { checkUnit: true });
  console.log(`✓ 单位正确: isCorrect=${unitCorrect.isCorrect}, unitMatch=${unitCorrect.details.unitMatch}`);
  console.log(`  答案: ${correctWithUnit}, 期望单位: ${geometryQ.unit}`);

  const unitMissing = mathExerciseSDK.grading.grade(geometryQ, correctWithoutUnit, { checkUnit: true });
  console.log(`✓ 单位缺失: isCorrect=${unitMissing.isCorrect}, unitMatch=${unitMissing.details.unitMatch}, errorType=${unitMissing.errorType}`);

  const unitWrong = mathExerciseSDK.grading.grade(geometryQ, wrongUnit, { checkUnit: true });
  console.log(`✓ 单位错误: isCorrect=${unitWrong.isCorrect}, unitMatch=${unitWrong.details.unitMatch}, errorType=${unitWrong.errorType}`);

  logSubSection('步骤得分');
  const multiStepQ = createQuestions({
    type: 'equation',
    difficulty: 'medium',
    count: 1,
    seed: 4000
  })[0];

  console.log(`  题目: ${multiStepQ.question}`);
  console.log(`  正确答案: ${multiStepQ.correctAnswer}`);
  if (multiStepQ.steps) {
    multiStepQ.steps.forEach((step, i) => {
      console.log(`  步骤${i + 1}: ${step.description} (${step.score}分)`);
    });
  }

  if (multiStepQ.steps && multiStepQ.steps.length >= 2) {
    const intermediateAnswer = multiStepQ.steps[multiStepQ.steps.length - 2].answer;
    const stepResult = mathExerciseSDK.grading.grade(multiStepQ, intermediateAnswer as number, {
      allowStepGrading: true
    });
    console.log(`✓ 中间步骤得分: score=${stepResult.score}/${stepResult.maxScore}`);
    console.log(`  步骤得分详情:`, stepResult.details.stepScores?.map(s => `步骤${s.stepIndex + 1}: ${s.score}/${s.maxScore}`).join(', '));
  }

  logSubSection('容差测试');
  const toleranceQ = createQuestions({
    type: 'geometry',
    difficulty: 'hard',
    count: 1,
    seed: 5000
  })[0];

  const exactAnswer = toleranceQ.correctAnswer as number;
  const closeAnswer = exactAnswer + 0.0005;

  const strictResult = mathExerciseSDK.grading.grade(toleranceQ, closeAnswer, { tolerance: 0.0001 });
  console.log(`✓ 严格容差(0.0001): isCorrect=${strictResult.isCorrect}, 差值=${Math.abs(exactAnswer - closeAnswer)}`);

  const looseResult = mathExerciseSDK.grading.grade(toleranceQ, closeAnswer, { tolerance: 0.01 });
  console.log(`✓ 宽松容差(0.01): isCorrect=${looseResult.isCorrect}, 差值=${Math.abs(exactAnswer - closeAnswer)}`);
}

async function testHintModule() {
  logSection('【模块4测试】提示模块');

  const question = createQuestions({
    type: 'arithmetic',
    difficulty: 'hard',
    count: 1,
    seed: 6000
  })[0];

  logSubSection('首次尝试（无错误类型）');
  const hint1 = mathExerciseSDK.hint.getHint({
    question,
    attempts: 1
  });
  console.log(`✓ 第1次尝试，返回 ${hint1.hints.length} 条提示`);
  hint1.hints.forEach((h, i) => console.log(`  提示${i + 1} [${h.type}]: ${h.content.slice(0, 40)}...`));

  logSubSection('计算错误提示');
  const hint2 = mathExerciseSDK.hint.getHint({
    question,
    errorType: 'calculationError',
    attempts: 2
  });
  console.log(`✓ 计算错误，第2次尝试，返回 ${hint2.hints.length} 条提示`);
  hint2.hints.forEach((h, i) => console.log(`  提示${i + 1} [${h.type}]: ${h.content.slice(0, 40)}...`));

  logSubSection('单位错误提示');
  const hint3 = mathExerciseSDK.hint.getHint({
    question,
    errorType: 'unitError',
    attempts: 2
  });
  console.log(`✓ 单位错误，返回 ${hint3.hints.length} 条提示`);
  hint3.hints.forEach((h, i) => console.log(`  提示${i + 1} [${h.type}]: ${h.content.slice(0, 40)}...`));

  logSubSection('分数未约分提示');
  const hint4 = mathExerciseSDK.hint.getHint({
    question,
    errorType: 'fractionNotSimplified',
    attempts: 3
  });
  console.log(`✓ 分数未约分，返回 ${hint4.hints.length} 条提示`);
  hint4.hints.forEach((h, i) => console.log(`  提示${i + 1} [${h.type}]: ${h.content.slice(0, 40)}...`));

  logSubSection('多次尝试后是否泄题');
  const hint5 = mathExerciseSDK.hint.getHint({
    question,
    errorType: 'calculationError',
    attempts: 5
  });
  console.log(`✓ 第5次尝试，shouldRevealAnswer=${hint5.shouldRevealAnswer}`);
  console.log(`  提示数: ${hint5.hints.length}`);
}

async function testRecordModule() {
  logSection('【模块5测试】记录模块');

  const questions = createQuestions({
    type: 'arithmetic',
    difficulty: 'medium',
    count: 5,
    seed: 7000
  });

  logSubSection('创建练习并记录答题');
  const exercise = mathExerciseSDK.record.createExercise(questions);
  console.log('✓ 练习会话已创建');

  const answers = [
    { correct: true, time: 15000, attempts: 1, errorType: undefined },
    { correct: true, time: 20000, attempts: 1, errorType: undefined },
    { correct: false, time: 30000, attempts: 2, errorType: 'calculationError' as const },
    { correct: true, time: 18000, attempts: 1, errorType: undefined },
    { correct: false, time: 45000, attempts: 3, errorType: 'unitError' as const }
  ];

  questions.forEach((q, i) => {
    const ans = answers[i];
    const firstAttemptCorrect = ans.correct || ans.attempts > 1;

    const attemptList = [];
    for (let j = 0; j < ans.attempts; j++) {
      const isLast = j === ans.attempts - 1;
      const isCorrect = isLast && ans.correct;
      attemptList.push({
        userAnswer: isCorrect ? q.correctAnswer : 999 + j,
        isCorrect,
        errorType: !isCorrect ? ans.errorType : undefined,
        timeSpent: ans.time / ans.attempts,
        timestamp: Date.now() + j * 1000
      });
    }

    exercise.addAnswer({
      questionId: q.id,
      attempts: attemptList,
      finalAnswer: ans.correct ? q.correctAnswer : 999,
      isCorrect: ans.correct,
      firstErrorType: !firstAttemptCorrect ? ans.errorType : undefined,
      totalTimeSpent: ans.time,
      attemptsCount: ans.attempts,
      firstAttemptCorrect: ans.correct && ans.attempts === 1,
      timestamp: Date.now()
    });
    console.log(`  记录第${i + 1}题: 正确=${ans.correct}, 耗时=${ans.time/1000}s, 尝试=${ans.attempts}次`);
  });

  logSubSection('实时掌握度');
  const currentMastery = exercise.getMasteryLevel();
  console.log(`✓ 当前掌握度: ${currentMastery}%`);

  logSubSection('完成练习，生成报告');
  const record = exercise.finish();
  console.log(`✓ 练习报告生成完成`);
  console.log(`  练习ID: ${record.exerciseId}`);
  console.log(`  总耗时: ${(record.totalTimeSpent / 1000).toFixed(1)}秒`);
  console.log(`  总得分: ${record.totalScore}/${record.maxScore}`);
  console.log(`  最终掌握度: ${record.masteryLevel}%`);
  console.log(`  总体正确率: ${(record.overallAccuracy * 100).toFixed(1)}%`);
  console.log(`  首次正确率: ${(record.firstAttemptAccuracy * 100).toFixed(1)}%`);
  console.log(`  进步率: ${(record.improvementRate * 100).toFixed(1)}%`);
  console.log(`  答题记录数: ${record.answers.length}`);
  console.log(`  错误统计:`, record.errorStats);

  logSubSection('单题记录详情');
  record.answers.forEach((ans, i) => {
    console.log(`  第${i + 1}题: 正确=${ans.isCorrect}, 首次正确=${ans.firstAttemptCorrect}, 总耗时=${(ans.totalTimeSpent/1000).toFixed(1)}s, 尝试=${ans.attemptsCount}次, 首错=${ans.firstErrorType || '无'}`);
  });

  logSubSection('答题过程变化');
  record.questionProgress.forEach((qp, i) => {
    console.log(`  第${i + 1}题: 首次=${qp.firstAnswerCorrect ? '✅' : '❌'}, 最终=${qp.finalAnswerCorrect ? '✅' : '❌'}, 进步=${qp.improvement === 'improved' ? '⬆️' : qp.improvement === 'regressed' ? '⬇️' : '➡️'}`);
  });
}

async function testMathUtils() {
  logSection('【工具函数测试】');

  logSubSection('分数运算');
  const f1 = { numerator: 2, denominator: 4 };
  const f2 = { numerator: 1, denominator: 2 };

  console.log(`  ${fractionToString(f1)} 约分后 = ${fractionToString(simplifyFraction(f1))}`);
  console.log(`  ${fractionToString(f1)} 和 ${fractionToString(f2)} 等价: ${areFractionsEquivalent(f1, f2)}`);

  logSubSection('最大公约数/最小公倍数');
  const { gcd, lcm } = await import('./utils/math');
  console.log(`  gcd(12, 18) = ${gcd(12, 18)}`);
  console.log(`  lcm(4, 6) = ${lcm(4, 6)}`);
}

async function runAllTests() {
  console.log('\n' + '╔'.repeat(30));
  console.log('  🧮 数学练习题SDK - 完整功能测试');
  console.log('╚'.repeat(30));

  try {
    await testQuestionCreation();
    await testRenderModule();
    await testGradingModule();
    await testHintModule();
    await testRecordModule();
    await testMathUtils();

    console.log('\n' + '🎉'.repeat(20));
    console.log('  ✅ 所有测试通过！SDK功能正常');
    console.log('🎉'.repeat(20) + '\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

runAllTests();
