// GitHub Pages answers unknown paths (e.g. /quiz/practice/abc) with 404.html.
// Serving a copy of index.html there lets React Router handle the route.
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = resolve('dist/index.html')
const target = resolve('dist/404.html')

copyFileSync(source, target)
console.log('created dist/404.html')
