// UI smoke test + screenshots. Requires `npm run dev` on port 5173.
// Usage: node scripts/verify-ui.mjs
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { createFixtures } from './fixtures.mjs'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173'
const OUT_DIR =
  process.env.SHOT_DIR || path.join(process.env.TEMP || '.', 'quiz-shots')
const FIXTURE_DIR = path.join(
  process.env.TEMP || '.',
  'quiz-fixtures',
)

const executablePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => candidate && existsSync(candidate))

if (!executablePath) {
  throw new Error('未找到 Chrome/Edge，请通过 CHROME_PATH 指定浏览器路径')
}

mkdirSync(OUT_DIR, { recursive: true })
const fixtures = await createFixtures(FIXTURE_DIR)

const browser = await chromium.launch({ executablePath, headless: true })
const errors = []
const checks = []

function watch(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`[${label}] console: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    errors.push(`[${label}] pageerror: ${error.message}`)
  })
}

async function check(label, fn) {
  try {
    const detail = await fn()
    checks.push({ label, pass: true, detail: detail ?? '' })
  } catch (error) {
    checks.push({
      label,
      pass: false,
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

async function screenshot(page, name) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) })
}

async function expectNoOverflow(page, label) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  checks.push({ label, pass: !overflow, detail: overflow ? '横向溢出' : 'ok' })
}

async function expectVisible(locator, message) {
  await locator.first().waitFor({ state: 'visible', timeout: 10000 })
  if (!(await locator.first().isVisible())) throw new Error(message)
}

async function importFile(page, filePath, expectedRows, expectedImport) {
  await page.locator('input[type=file]').setInputFiles(filePath)
  await expectVisible(
    page.getByText(`识别 ${expectedRows} 题`),
    `未显示识别 ${expectedRows} 题`,
  )
  const button = page.getByRole('button', {
    name: `确认导入 ${expectedImport} 题`,
  })
  await button.waitFor({ state: 'visible', timeout: 10000 })
  if (await button.isDisabled()) {
    throw new Error('确认导入按钮处于禁用状态')
  }
}

async function desktopFlow() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  const page = await context.newPage()
  watch(page, 'desktop')
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)

  await check('首页显示空题库状态', async () => {
    await expectVisible(page.getByText('还没有题库'), '首页空状态不可见')
  })
  await screenshot(page, 'desktop-home')
  await expectNoOverflow(page, '桌面首页')

  await page.goto(`${BASE_URL}/banks`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await screenshot(page, 'desktop-banks-empty')

  await page.getByRole('button', { name: '新建题库' }).first().click()
  await page.locator('#bank-name').fill('演示题库 · 公共基础')
  await page.locator('#bank-description').fill('用于验证界面和本地存储。')
  await page.getByRole('button', { name: '创建题库' }).click()
  await page.waitForURL(/\/banks\/[^/]+$/)
  await page.waitForTimeout(500)

  await check('创建题库后进入详情页', async () => {
    await expectVisible(
      page.getByRole('heading', { name: '演示题库 · 公共基础' }),
      '题库标题不可见',
    )
  })
  await screenshot(page, 'desktop-bank-detail')

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await check('刷新后题库仍在', async () => {
    await expectVisible(
      page.getByRole('heading', { name: '演示题库 · 公共基础' }),
      '刷新后题库丢失',
    )
  })

  await page.goto(`${BASE_URL}/banks`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await check('题库卡片显示题量', async () => {
    if ((await page.getByText('0道题').count()) === 0) {
      throw new Error('未找到 0 道题统计')
    }
  })
  await screenshot(page, 'desktop-banks')

  // TXT import into a new bank.
  await page.goto(`${BASE_URL}/import`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await screenshot(page, 'desktop-import')
  await expectNoOverflow(page, '桌面导入页')

  await page.getByRole('button', { name: '新建题库并导入' }).click()
  await page.getByPlaceholder('例如：计算机二级真题').fill('阶段二导入题库')
  await page.getByPlaceholder('例如：2025 年 3 月真题').fill('TXT / CSV / Excel / Word 验收。')

  const [templateDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Excel 模板' }).click(),
  ])
  await check('下载 Excel 导入模板', async () => {
    if (!templateDownload.suggestedFilename().endsWith('.xlsx')) {
      throw new Error(templateDownload.suggestedFilename())
    }
  })

  await importFile(page, fixtures.errorTxtPath, 2, 1)
  await check('错误行被拦截', async () => {
    await expectVisible(page.getByText('缺少答案'), '未显示缺少答案的错误')
    await expectVisible(page.getByText('出错', { exact: true }), '未显示错误统计')
  })
  await screenshot(page, 'desktop-import-errors')

  await importFile(page, fixtures.txtPath, 5, 5)
  await screenshot(page, 'desktop-import-preview')
  await expectNoOverflow(page, '桌面导入预览')

  const [parsedDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出 Excel' }).click(),
  ])
  await check('解析结果导出 Excel', async () => {
    if (!parsedDownload.suggestedFilename().endsWith('.xlsx')) {
      throw new Error(parsedDownload.suggestedFilename())
    }
  })

  await page.getByRole('button', { name: '确认导入 5 题' }).click()
  await check('TXT 导入成功', async () => {
    await expectVisible(page.getByText('已成功导入 5 道题'), '未显示导入成功')
  })
  await page.getByRole('link', { name: '查看题库' }).click()
  await page.waitForURL(/\/banks\/[^/]+$/)
  const importedBankUrl = page.url()
  await page.waitForTimeout(600)

  await check('导入后题目列表显示 5 道题', async () => {
    await expectVisible(page.getByText(/共 5 道题/), '题目总数不是 5')
  })
  await screenshot(page, 'desktop-question-list')

  // Manual add + edit + delete.
  await page.getByRole('button', { name: '添加题目' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('输入题目内容').fill('手动添加的单选题？')
  for (const [key, value] of [
    ['A', '甲'],
    ['B', '乙'],
    ['C', '丙'],
    ['D', '丁'],
  ]) {
    await dialog.getByPlaceholder(`选项 ${key}`).fill(value)
  }
  await dialog.locator('input[type=radio]').first().check()
  await dialog.getByRole('button', { name: '添加题目' }).click()
  await page.waitForTimeout(600)

  await check('手动添加单选题', async () => {
    await expectVisible(
      page.getByText('手动添加的单选题？'),
      '新增题目未出现',
    )
    await expectVisible(page.getByText(/共 6 道题/), '题目数不是 6')
  })

  const addedRow = page.locator('li').filter({ hasText: '手动添加的单选题？' })
  await addedRow.getByRole('button', { name: '编辑题目' }).click()
  await page.getByRole('dialog').getByPlaceholder('输入题目内容').fill(
    '手动添加的单选题？（已编辑）',
  )
  await page.getByRole('dialog').getByRole('button', { name: '保存修改' }).click()
  await page.waitForTimeout(600)

  await check('编辑题目生效', async () => {
    await expectVisible(
      page.getByText('手动添加的单选题？（已编辑）'),
      '编辑结果未出现',
    )
  })

  const editedRow = page
    .locator('li')
    .filter({ hasText: '手动添加的单选题？（已编辑）' })
  await editedRow.getByRole('button', { name: '删除题目' }).click()
  await editedRow.getByRole('button', { name: '确认删除' }).click()
  await page.waitForTimeout(600)

  await check('删除题目后恢复 5 道题', async () => {
    await expectVisible(page.getByText(/共 5 道题/), '删除后题目数不为 5')
  })

  await page.getByLabel('搜索题目').fill('光合作用')
  await page.waitForTimeout(300)
  await check('题目搜索与筛选', async () => {
    await expectVisible(page.getByText(/筛选出 1 道/), '搜索结果数量不为 1')
  })
  await page.getByRole('button', { name: '清除筛选' }).click()

  // CSV import with a duplicate row.
  await page.goto(`${BASE_URL}/import`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.getByLabel('目标题库').selectOption({ label: '阶段二导入题库' })
  await importFile(page, fixtures.csvPath, 2, 1)
  await check('CSV 重复题被跳过', async () => {
    await expectVisible(page.getByText('重复', { exact: true }), '未标记重复题')
  })
  await page.getByRole('button', { name: '确认导入 1 题' }).click()
  await check('CSV 导入成功', async () => {
    await expectVisible(page.getByText('已成功导入 1 道题'), 'CSV 导入未成功')
  })

  // XLSX import.
  await page.getByRole('button', { name: '继续导入' }).click()
  await expectVisible(page.getByText('选择题目文件'), '未返回导入表单')
  await importFile(page, fixtures.xlsxPath, 2, 2)
  await page.getByRole('button', { name: '确认导入 2 题' }).click()
  await check('Excel 导入成功', async () => {
    await expectVisible(page.getByText('已成功导入 2 道题'), 'Excel 导入未成功')
  })

  // DOCX import.
  await page.getByRole('button', { name: '继续导入' }).click()
  await expectVisible(page.getByText('选择题目文件'), '未返回导入表单')
  await importFile(page, fixtures.docxPath, 2, 2)
  await page.getByRole('button', { name: '确认导入 2 题' }).click()
  await check('Word 导入成功', async () => {
    await expectVisible(page.getByText('已成功导入 2 道题'), 'Word 导入未成功')
  })

  // DOCX containing a table.
  await page.getByRole('button', { name: '继续导入' }).click()
  await expectVisible(page.getByText('选择题目文件'), '未返回导入表单')
  await importFile(page, fixtures.tableDocxPath, 1, 1)
  await page.getByRole('button', { name: '确认导入 1 题' }).click()
  await check('Word 表格导入成功', async () => {
    await expectVisible(page.getByText('已成功导入 1 道题'), 'Word 表格导入未成功')
  })
  await page.getByRole('link', { name: '查看题库' }).click()
  await page.waitForTimeout(700)

  await check('四种格式累计导入 11 道题', async () => {
    await expectVisible(page.getByText(/共 11 道题/), '题目总数不是 11')
  })
  await check('题目列表展示五种题型', async () => {
    for (const label of ['单选', '多选', '判断', '填空', '简答']) {
      if ((await page.getByText(label, { exact: true }).count()) === 0) {
        throw new Error(`未找到 ${label} 题型`)
      }
    }
  })
  await screenshot(page, 'desktop-question-list-full')
  await expectNoOverflow(page, '桌面题目列表')

  await page.getByRole('button', { name: '收藏题目' }).first().click()
  await check('题目列表可以收藏题目', async () => {
    const button = page
      .getByRole('button', { name: '取消收藏' })
      .first()
    await expectVisible(button, '收藏后星标状态未更新')
    if ((await button.getAttribute('aria-pressed')) !== 'true') {
      throw new Error('收藏按钮未处于按下状态')
    }
  })

  // Practice flow: setup, all five question types, resume, result.
  await page.getByRole('link', { name: '开始练习', exact: true }).click()
  await page.waitForURL(/\/banks\/[^/]+\/practice$/)
  await page.waitForTimeout(500)
  await check('练习设置页显示可用题量', async () => {
    await expectVisible(page.getByText('可用 11 道'), '可用题量不是 11')
  })
  await screenshot(page, 'desktop-practice-setup')
  await expectNoOverflow(page, '桌面练习设置')

  await page.getByRole('button', { name: /错题重练/ }).click()
  await check('没有错题时给出提示', async () => {
    await expectVisible(
      page.getByText('还没有错题记录。先做顺序或随机练习', { exact: false }),
      '未显示错题重练空状态提示',
    )
    await expectVisible(page.getByText('可用 0 道'), '错题数量不为 0')
  })
  await page.getByRole('button', { name: /顺序练习/ }).click()

  await page.getByLabel('题量').selectOption('5')
  await page.getByRole('button', { name: '开始练习（5 题）' }).click()
  await page.waitForURL(/\/practice\/[^/]+$/)
  await expectVisible(page.getByText('中国的首都是哪座城市？'), '练习第一题未出现')

  await check('顺序练习从第一题开始', async () => {
    await expectVisible(page.getByText('第 1 / 5 题'), '练习进度不正确')
  })
  await check('练习页同步收藏状态', async () => {
    const button = page.getByRole('button', { name: '取消收藏' })
    await expectVisible(button, '练习页未显示已收藏状态')
    if ((await button.getAttribute('aria-pressed')) !== 'true') {
      throw new Error('练习页收藏按钮未处于按下状态')
    }
  })
  await screenshot(page, 'desktop-practice-single')
  await expectNoOverflow(page, '桌面练习页')

  await page.getByRole('radio', { name: /北京/ }).click()
  await page.getByRole('button', { name: '提交答案' }).click()
  await check('单选题即时判分', async () => {
    await expectVisible(page.getByText('回答正确'), '单选题未判为正确')
    await expectVisible(page.getByText('北京是中华人民共和国的首都。'), '解析未显示')
  })
  await screenshot(page, 'desktop-practice-feedback')
  await expectNoOverflow(page, '桌面练习反馈')
  await page.getByRole('button', { name: '下一题' }).click()

  await expectVisible(page.getByText('以下哪些属于编程语言？'), '未进入多选题')
  await page.getByRole('checkbox', { name: /JavaScript/ }).click()
  await page.getByRole('checkbox', { name: /Python/ }).click()
  await page.getByRole('checkbox', { name: /TypeScript/ }).click()
  await page.getByRole('button', { name: '提交答案' }).click()
  await check('多选题按选项集合判分', async () => {
    await expectVisible(page.getByText('回答正确'), '多选题未判为正确')
  })
  await page.getByRole('button', { name: '下一题' }).click()

  await expectVisible(page.getByText('标准大气压下'), '未进入判断题')
  await page.getByRole('radio', { name: '对' }).click()
  await page.getByRole('button', { name: '提交答案' }).click()
  await check('判断题即时判分', async () => {
    await expectVisible(page.getByText('回答正确'), '判断题未判为正确')
  })
  await page.getByRole('button', { name: '下一题' }).click()

  await expectVisible(page.getByText('人口最多的城市'), '未进入填空题')
  await page.getByLabel('第 1 空').fill('北京')
  await page.getByLabel('第 2 空').fill('上海')
  await page.getByRole('button', { name: '提交答案' }).click()
  await check('填空题按多个空判分', async () => {
    await expectVisible(page.getByText('回答正确'), '填空题未判为正确')
  })

  // Leave before advancing, then resume the same feedback state.
  await page.getByRole('link', { name: '退出练习' }).click()
  await page.waitForURL(/\/banks\/[^/]+$/)
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await check('首页显示未完成练习', async () => {
    await expectVisible(page.getByText('继续练习'), '首页未显示继续练习')
    await expectVisible(
      page.getByText('上次进度：第 4 / 5 题'),
      '断点进度不是第 4 题',
    )
  })
  await page.getByText('继续练习').click()
  await page.waitForURL(/\/practice\/[^/]+$/)
  await check('断点续做恢复判分状态', async () => {
    await expectVisible(page.getByText('回答正确'), '恢复后未显示已答反馈')
    await expectVisible(page.getByText('第 4 / 5 题'), '恢复后题号不正确')
  })
  await page.getByRole('button', { name: '下一题' }).click()

  await expectVisible(page.getByText('简述光合作用'), '未进入简答题')
  await page
    .getByLabel('你的回答')
    .fill('光合作用把光能转化为化学能，制造有机物，并释放氧气。')
  await page.getByRole('button', { name: '提交答案' }).click()
  await check('简答题按关键词判分', async () => {
    await expectVisible(page.getByText('回答正确'), '简答题未判为正确')
    await expectVisible(page.getByText('关键词命中'), '未显示关键词命中')
  })
  await page.getByRole('button', { name: '查看结果' }).click()

  await check('练习完成页显示满分', async () => {
    await expectVisible(page.getByRole('heading', { name: '练习完成' }), '未显示练习完成')
    await expectVisible(page.getByText('100%'), '正确率不是 100%')
    await expectVisible(page.getByText('全部答对'), '未显示全部答对')
  })
  await screenshot(page, 'desktop-practice-result')
  await expectNoOverflow(page, '桌面练习结果')

  await page
    .getByRole('main')
    .getByRole('link', { name: '返回题库' })
    .click()
  await page.waitForURL(/\/banks\/[^/]+$/)
  await page.waitForTimeout(400)

  // Backup export/restore.
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出' }).click(),
  ])
  const backupPath = path.join(OUT_DIR, 'quiz-backup.json')
  await download.saveAs(backupPath)

  await check('导出备份文件', async () => {
    if (!existsSync(backupPath)) throw new Error('备份文件未生成')
    return download.suggestedFilename()
  })

  await page.getByRole('button', { name: '清空', exact: true }).click()
  await page.getByRole('button', { name: '确认清空' }).click()
  await check('清空本机数据', async () => {
    await expectVisible(page.getByText('本机数据已全部清空。'), '未显示清空提示')
  })

  await page.goto(`${BASE_URL}/banks`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await check('清空后题库为空', async () => {
    await expectVisible(page.getByText('还没有题库'), '清空后仍有题库')
  })

  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.locator('input[type=file]').setInputFiles(backupPath)
  await expectVisible(page.getByText('恢复备份'), '未显示备份预览')
  await check('备份预览显示 11 道题', async () => {
    await expectVisible(page.getByText('11 道题'), '备份题量不正确')
  })
  await page.getByRole('button', { name: '覆盖恢复' }).click()
  await page.getByRole('button', { name: '覆盖并恢复' }).click()
  await check('覆盖恢复备份', async () => {
    await expectVisible(page.getByText(/恢复完成/), '未显示恢复成功')
  })

  await page.goto(`${BASE_URL}/banks`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await check('恢复后题库回来', async () => {
    await expectVisible(page.getByText('阶段二导入题库'), '恢复后题库不存在')
  })

  await page.goto(importedBankUrl, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await check('恢复后题目数量正确', async () => {
    await expectVisible(page.getByText(/共 11 道题/), '恢复后题量不正确')
  })

  // Theme.
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /深色/ }).click()
  await page.waitForTimeout(300)
  await screenshot(page, 'desktop-settings-dark')

  await check('深色主题生效', async () => {
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    )
    if (!isDark) throw new Error('html 缺少 dark 类')
  })

  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await screenshot(page, 'desktop-home-dark')

  await context.close()
}

async function selfAssessmentFlow() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  const page = await context.newPage()
  watch(page, 'self-assessment')
  await page.goto(`${BASE_URL}/banks`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  await page.getByRole('button', { name: '新建题库' }).first().click()
  await page.locator('#bank-name').fill('自评练习题库')
  await page.getByRole('button', { name: '创建题库' }).click()
  await page.waitForURL(/\/banks\/[^/]+$/)
  await page.waitForTimeout(400)

  await page.getByRole('button', { name: '添加题目' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '简答' }).click()
  await dialog
    .getByPlaceholder('输入题目内容')
    .fill('请用自己的话解释什么是本地优先。')
  await dialog
    .getByPlaceholder('填写参考答案，作答后展示')
    .fill('数据优先保存在本机，不依赖账号和网络。')
  await dialog.getByRole('button', { name: '添加题目' }).click()
  await page.waitForTimeout(500)

  await check('创建无关键词简答题', async () => {
    await expectVisible(page.getByText(/共 1 道题/), '简答题未保存')
  })

  await page.getByRole('link', { name: '开始练习', exact: true }).click()
  await page.waitForURL(/\/banks\/[^/]+\/practice$/)
  await page.getByRole('button', { name: '开始练习（1 题）' }).click()
  await page.waitForURL(/\/practice\/[^/]+$/)
  await page
    .getByLabel('你的回答')
    .fill('数据存在本机，离线也能用。')
  await page.getByRole('button', { name: '提交答案' }).click()

  await check('简答题无关键词时展示自评', async () => {
    await expectVisible(
      page.getByText('数据优先保存在本机，不依赖账号和网络。'),
      '未显示参考答案',
    )
    await expectVisible(page.getByRole('button', { name: '算答对' }), '未显示自评按钮')
  })
  await screenshot(page, 'desktop-practice-self-assess')

  await page.getByRole('button', { name: '算答对' }).click()
  await check('简答题自评结果生效', async () => {
    await expectVisible(page.getByText('已记录为答对'), '未显示自评结果')
  })
  await page.getByRole('button', { name: '查看结果' }).click()
  await check('自评练习完成页显示满分', async () => {
    await expectVisible(page.getByRole('heading', { name: '练习完成' }), '未显示结果页')
    await expectVisible(page.getByText('100%'), '自评正确率不是 100%')
  })

  await context.close()
}

async function wrongModeFlow() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  const page = await context.newPage()
  watch(page, 'wrong-mode')
  await page.goto(`${BASE_URL}/banks`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  await page.getByRole('button', { name: '新建题库' }).first().click()
  await page.locator('#bank-name').fill('错题模式题库')
  await page.getByRole('button', { name: '创建题库' }).click()
  await page.waitForURL(/\/banks\/[^/]+$/)
  await page.waitForTimeout(400)

  await page.getByRole('button', { name: '添加题目' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('输入题目内容').fill('错题模式测试题？')
  for (const [key, value] of [
    ['A', '甲'],
    ['B', '乙'],
    ['C', '丙'],
    ['D', '丁'],
  ]) {
    await dialog.getByPlaceholder(`选项 ${key}`).fill(value)
  }
  await dialog.locator('input[type=radio]').first().check()
  await dialog.getByRole('button', { name: '添加题目' }).click()
  await page.waitForTimeout(500)

  await page.getByRole('link', { name: '开始练习', exact: true }).click()
  await page.waitForURL(/\/banks\/[^/]+\/practice$/)
  await page.getByRole('button', { name: '开始练习（1 题）' }).click()
  await page.waitForURL(/\/practice\/[^/]+$/)
  await page.getByRole('radio', { name: /乙/ }).click()
  await page.getByRole('button', { name: '提交答案' }).click()

  await check('答错后显示错误反馈', async () => {
    await expectVisible(page.getByText('回答错误'), '未显示错误反馈')
  })
  await page.getByRole('button', { name: '查看结果' }).click()
  await check('错题进入本次结果', async () => {
    await expectVisible(page.getByText('0%'), '正确率不是 0%')
    await expectVisible(page.getByText('你的答案：'), '未显示错题答案')
  })

  await page
    .getByRole('main')
    .getByRole('link', { name: '返回题库' })
    .click()
  await page.waitForURL(/\/banks\/[^/]+$/)
  await page.waitForTimeout(400)
  await page.getByRole('link', { name: /错题重练/ }).click()
  await page.waitForURL(/\/banks\/[^/]+\/practice\?mode=wrong$/)
  await page.waitForTimeout(300)

  await check('错题重练识别错题', async () => {
    await expectVisible(page.getByText('可用 1 道'), '错题数量不正确')
  })
  await page.getByRole('button', { name: '开始练习（1 题）' }).click()
  await page.waitForURL(/\/practice\/[^/]+$/)
  await page.getByRole('radio', { name: /甲/ }).click()
  await page.getByRole('button', { name: '提交答案' }).click()
  await page.getByRole('button', { name: '查看结果' }).click()
  await check('错题重练完成后正确率 100%', async () => {
    await expectVisible(page.getByText('100%'), '错题重练结果不正确')
  })

  // Wrong book, favorites, mastery management, and filtered practice.
  await page.goto(`${BASE_URL}/wrong`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await check('错题本展示答错题目', async () => {
    await expectVisible(
      page.getByText('错题模式测试题？'),
      '错题本未显示答错题目',
    )
    await expectVisible(page.getByText('错 1 次'), '错题次数不正确')
  })
  await screenshot(page, 'desktop-wrong-book')
  await expectNoOverflow(page, '桌面错题本')

  await page.getByLabel('按题库筛选').selectOption({ label: '错题模式题库' })
  await check('选择题库后可开始针对性练习', async () => {
    await expectVisible(
      page.getByRole('button', { name: '重练这些错题' }),
      '未显示错题练习按钮',
    )
  })

  await page.getByRole('button', { name: '收藏', exact: true }).first().click()
  await check('收藏后收藏页显示题目', async () => {
    await page.getByRole('tab', { name: /收藏/ }).click()
    await expectVisible(
      page.getByText('错题模式测试题？'),
      '收藏页未显示题目',
    )
    await expectVisible(
      page.getByText('1 道收藏题', { exact: false }),
      '收藏页题目数量不正确',
    )
  })
  await screenshot(page, 'desktop-favorites')
  await expectNoOverflow(page, '桌面收藏页')

  await page.getByRole('tab', { name: /错题/ }).click()
  await page.getByRole('button', { name: '重练这些错题' }).click()
  await page.waitForURL(/\/practice\/[^/]+$/)
  await check('从错题本开始针对性练习', async () => {
    await expectVisible(
      page.getByText('错题重练 · 错题模式题库'),
      '针对性练习未使用错题模式',
    )
    await expectVisible(
      page.getByText('错题模式测试题？'),
      '针对性练习未显示目标题目',
    )
  })
  await page.getByRole('link', { name: '退出练习' }).click()
  await page.waitForURL(/\/banks\/[^/]+$/)

  await page.goto(`${BASE_URL}/wrong`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('tab', { name: /收藏/ }).click()
  await page.getByRole('button', { name: '标记已掌握' }).click()
  await check('手动标记已掌握', async () => {
    await page.getByRole('tab', { name: /已掌握/ }).click()
    await expectVisible(
      page.getByText('错题模式测试题？'),
      '已掌握页未显示题目',
    )
    await expectVisible(
      page.getByText('已掌握').first(),
      '未显示已掌握状态',
    )
  })

  await page.getByRole('tab', { name: /错题/ }).click()
  await check('掌握后自动移出错题本', async () => {
    await expectVisible(
      page.getByText('错题本是空的'),
      '已掌握题目仍在错题本中',
    )
  })

  await page.getByRole('tab', { name: /已掌握/ }).click()
  await page.getByRole('button', { name: '取消掌握' }).click()
  await check('取消掌握后回到错题本', async () => {
    await expectVisible(
      page.getByText('还没有已掌握的题目'),
      '取消掌握后已掌握页未清空',
    )
    await page.getByRole('tab', { name: /错题/ }).click()
    await expectVisible(
      page.getByText('错题模式测试题？'),
      '取消掌握后题目没有回到错题本',
    )
  })

  await context.close()
}

async function mobileFlow() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  watch(page, 'mobile')
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await screenshot(page, 'mobile-home')
  await expectNoOverflow(page, '手机首页')

  await check('手机底部导航可见', async () => {
    const visible = await page
      .getByRole('navigation', { name: '底部导航' })
      .isVisible()
    if (!visible) throw new Error('底部导航不可见')
  })

  await page.goto(`${BASE_URL}/banks`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await screenshot(page, 'mobile-banks-empty')

  await page.getByRole('button', { name: '新建题库' }).first().click()
  await page.locator('#bank-name').fill('手机端题库')
  await page.getByRole('button', { name: '创建题库' }).click()
  await page.waitForURL(/\/banks\/[^/]+$/)
  await page.waitForTimeout(500)
  await screenshot(page, 'mobile-bank-detail')
  await expectNoOverflow(page, '手机题库详情')

  await page.goto(`${BASE_URL}/import`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.getByRole('button', { name: '新建题库并导入' }).click()
  await page.getByPlaceholder('例如：计算机二级真题').fill('手机导入题库')
  await importFile(page, fixtures.txtPath, 5, 5)
  await screenshot(page, 'mobile-import-preview')
  await expectNoOverflow(page, '手机导入预览')

  await page.getByRole('button', { name: '确认导入 5 题' }).click()
  await page.getByRole('link', { name: '查看题库' }).click()
  await page.waitForTimeout(700)

  await check('手机端显示导入题目', async () => {
    await expectVisible(page.getByText(/共 5 道题/), '手机端题量不正确')
  })
  await screenshot(page, 'mobile-question-list')
  await expectNoOverflow(page, '手机题目列表')

  await page.getByRole('button', { name: '添加题目' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('输入题目内容').fill('手机端添加的判断题？')
  await dialog.getByRole('button', { name: '判断' }).click()
  await dialog.getByRole('button', { name: '错' }).click()
  await screenshot(page, 'mobile-question-editor')
  await dialog.getByRole('button', { name: '添加题目' }).click()
  await page.waitForTimeout(600)
  await check('手机端添加判断题', async () => {
    await expectVisible(page.getByText(/共 6 道题/), '手机端新增后题量不正确')
  })
  await expectNoOverflow(page, '手机新增题目后')

  await page.getByRole('link', { name: '开始练习', exact: true }).click()
  await page.waitForURL(/\/banks\/[^/]+\/practice$/)
  await page.waitForTimeout(400)
  await screenshot(page, 'mobile-practice-setup')
  await expectNoOverflow(page, '手机练习设置')

  await page.getByRole('button', { name: '开始练习（6 题）' }).click()
  await page.waitForURL(/\/practice\/[^/]+$/)
  await expectVisible(page.getByText('中国的首都是哪座城市？'), '手机练习第一题未出现')
  await screenshot(page, 'mobile-practice')
  await expectNoOverflow(page, '手机练习页')

  await page.getByRole('radio', { name: /北京/ }).click()
  await page.getByRole('button', { name: '提交答案' }).click()
  await check('手机端练习即时判分', async () => {
    await expectVisible(page.getByText('回答正确'), '手机端未显示判分')
  })
  await screenshot(page, 'mobile-practice-feedback')
  await expectNoOverflow(page, '手机练习反馈')

  await page.goto(`${BASE_URL}/wrong`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await screenshot(page, 'mobile-wrong-book')
  await expectNoOverflow(page, '手机错题本')

  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await screenshot(page, 'mobile-settings')
  await expectNoOverflow(page, '手机设置页')

  await context.close()
}

try {
  await desktopFlow()
  await selfAssessmentFlow()
  await wrongModeFlow()
  await mobileFlow()
} finally {
  await browser.close()
}

for (const item of checks) {
  console.log(
    `${item.pass ? 'PASS' : 'FAIL'}  ${item.label}${item.detail ? ` — ${item.detail}` : ''}`,
  )
}
if (errors.length) {
  console.log('\nConsole/page errors:')
  for (const error of errors) console.log(' -', error)
}
console.log(`\nScreenshots: ${OUT_DIR}`)
console.log(`Fixtures: ${FIXTURE_DIR}`)
process.exitCode = checks.some((item) => !item.pass) || errors.length ? 1 : 0
