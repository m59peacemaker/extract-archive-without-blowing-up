#!/usr/bin/env node

const path = require('path')
const fs = require('fs-extra')
const extractArchive = require('../')

const args = process.argv.slice(2)
const [ ZIP_FILE ] = args

const outputDir = path.dirname(ZIP_FILE)

;(async () => {
	await extractArchive({
		inputPath: ZIP_FILE,
		outputPath: path.join(outputDir, path.basename(ZIP_FILE, path.extname(ZIP_FILE)))
	})
})()
