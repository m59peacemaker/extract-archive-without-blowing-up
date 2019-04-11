#!/usr/bin/env node

const path = require('path')
const fs = require('fs-extra')
const seven = require('../7z')
const { MB, shouldExtractArchives } = require('../util')

const args = process.argv.slice(2)
const [ ZIP_FILE, ZIP_MB ] = args

const outputDir = path.dirname(ZIP_FILE)

const Filler = size => {
	const buffer = Buffer.alloc(MB(ZIP_MB))
	for (var i = 0; i < size; ++i) {
		const randomChar = Math.random().toString(36).slice(-1)
		buffer.push(randomChar)
	}
	return buffer
}

;(async () => {
	await fs.outputFile(path.join(outputDir, 'samplefile'), Filler())
	await seven.add(ZIP_FILE, path.join(outputDir, '*'))
})()
