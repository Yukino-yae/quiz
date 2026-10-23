// Generates import fixtures for the UI smoke test.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import writeXlsxFile from 'write-excel-file/node'

const TXT_CONTENT = `# 用于界面验证的题库
# 解析时会忽略以 # 开头的说明文字。

1. 【单选】中国的首都是哪座城市？
A. 北京
B. 上海
C. 广州
D. 深圳
答案：A
解析：北京是中华人民共和国的首都。
章节：地理
难度：易
标签：常识

2. 【多选】以下哪些属于编程语言？
A. JavaScript
B. Python
C. HTML
D. TypeScript
答案：ABD
解析：HTML 是标记语言，不是编程语言。
章节：计算机

3. 【判断】标准大气压下，水的沸点是 100°C。
答案：对
章节：物理

4. 【填空】中国的首都是____，人口最多的城市是____。
答案：北京|首都；上海
章节：地理

5. 【简答】简述光合作用对地球生命的意义。
答案：光合作用把光能转化为化学能，制造有机物，并释放氧气，是生态系统能量的起点。
关键词：光能|有机物|氧气
章节：生物
`

const CSV_CONTENT =
  '题型,题干,选项A,选项B,选项C,选项D,答案,解析,章节,难度,标签,关键词\r\n' +
  '单选,中国的首都是哪座城市？,北京,上海,广州,深圳,A,重复题示例,地理,易,常识,\r\n' +
  '判断,地球围绕太阳公转。, , , , ,对,,天文,易,,\r\n'

const XLSX_ROWS = [
  ['题型', '题干', '选项A', '选项B', '选项C', '选项D', '答案', '解析', '章节', '难度'],
  ['单选', 'HTTP 默认端口是？', '80', '443', '8080', '21', 'A', '', '网络', '中'],
  ['填空', '计算机的中央处理器英文缩写是____。', '', '', '', '', 'CPU', '', '计算机', '易'],
]

const DOCX_PARAGRAPHS = [
  '1. 【判断】地球是太阳系八大行星之一。',
  '答案：对',
  '章节：天文',
  '',
  '2. 【填空】水的化学式是____。',
  '答案：H2O',
  '关键词：化学式',
]

const DOCX_TABLE_ROWS = [
  ['题型', '题干', '选项A', '选项B', '答案'],
  ['单选', 'Word 表格中的题目？', '甲', '乙', 'A'],
]

const ERROR_TXT_CONTENT = `1. 【判断】这是一道有效题目。
答案：对

2. 【单选】这道题缺少答案。
A. 甲
B. 乙
`

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function docxParagraph(text) {
  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
}

function contentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
}

function relationships() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
}

function docxTable(rows) {
  return `<w:tbl>${rows
    .map(
      (row) =>
        `<w:tr>${row
          .map(
            (cell) =>
              `<w:tc><w:p><w:r><w:t xml:space="preserve">${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`,
          )
          .join('')}</w:tr>`,
    )
    .join('')}</w:tbl>`
}

function documentXml(bodyXml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${bodyXml}
<w:sectPr/>
</w:body>
</w:document>`
}

export async function createFixtures(dir) {
  mkdirSync(dir, { recursive: true })

  const txtPath = path.join(dir, 'stage2-questions.txt')
  const errorTxtPath = path.join(dir, 'stage2-errors.txt')
  const csvPath = path.join(dir, 'stage2-questions.csv')
  const xlsxPath = path.join(dir, 'stage2-questions.xlsx')
  const docxPath = path.join(dir, 'stage2-questions.docx')
  const tableDocxPath = path.join(dir, 'stage2-table.docx')

  writeFileSync(txtPath, TXT_CONTENT, 'utf8')
  writeFileSync(errorTxtPath, ERROR_TXT_CONTENT, 'utf8')
  writeFileSync(csvPath, '﻿' + CSV_CONTENT, 'utf8')

  await writeXlsxFile(XLSX_ROWS, { sheet: '题目' }).toFile(xlsxPath)

  const zip = zipSync({
    '[Content_Types].xml': strToU8(contentTypes()),
    '_rels/.rels': strToU8(relationships()),
    'word/document.xml': strToU8(
      documentXml(DOCX_PARAGRAPHS.map(docxParagraph).join('\n')),
    ),
  })
  writeFileSync(docxPath, Buffer.from(zip))

  const tableZip = zipSync({
    '[Content_Types].xml': strToU8(contentTypes()),
    '_rels/.rels': strToU8(relationships()),
    'word/document.xml': strToU8(documentXml(docxTable(DOCX_TABLE_ROWS))),
  })
  writeFileSync(tableDocxPath, Buffer.from(tableZip))

  return { txtPath, errorTxtPath, csvPath, xlsxPath, docxPath, tableDocxPath }
}
