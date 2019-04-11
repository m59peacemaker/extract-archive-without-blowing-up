const path = require('path')
const fs = require('fs')
const seven = require('./7z')
const False = () => false

const ARCHIVE_TOO_LARGE = 'ARCHIVE_TOO_LARGE'

const stripExtension = filePath => filePath.replace(/\.[^.$]+$/, '')

const subExtractArchive = async (
	{
		fileName,
		outputPath,
		parentPath,
		shouldExtract
	},
	state
) => {
	const inputPath = path.join(outputPath, fileName)
	const dirName = stripExtension(fileName)
	return extractArchive(
		{
			inputPath,
			outputPath: path.join(outputPath, dirName),
			shouldExtract,
			removeArchive: true,
			parentPath: path.join(parentPath, dirName)
		},
		state
	)
}

const extractArchive = async (
	{
		inputPath,
		outputPath,
		shouldExtract,
		parentPath = '/',
		removeArchive = false
	},
	state
) => {
	state.remainingOutputBytes = state.remainingOutputBytes === Infinity
		? Infinity
		: state.remainingOutputBytes - (await seven.list(inputPath))
			.files
			.reduce((total, { size }) => total + size, 0)

	if (state.remainingOutputBytes <= 0) {
		throw Object.assign(
			new Error('archive contents exceed maximum output bytes setting'),
			{ code: ARCHIVE_TOO_LARGE }
		)
	}

	const files = []

	const extraction = seven.extractFull(inputPath, outputPath)

	extraction.process.on('data', async ({ file: fileName }) => {
		const filePath = path.join(parentPath, fileName)
		if (shouldExtract({ fileName, filePath })) {
			files.push(
				subExtractArchive({ fileName, outputPath, parentPath, shouldExtract }, state)
			)
		} else {
			files.push({ fileName, filePath: path.join(outputPath, fileName) })
		}
	})

	await extraction
	if (removeArchive) {
		await fs.promises.unlink(inputPath)
	}
	return Promise.all(files)
}

module.exports = ({
	inputPath,
	outputPath,
	shouldExtract = False,
	maximumOutputBytes = Infinity
}) => extractArchive(
	{
		inputPath,
		outputPath,
		shouldExtract,
		parentPath: '/'
	},
	{
		remainingOutputBytes: maximumOutputBytes,
	}
)

Object.assign(module.exports, {
	ARCHIVE_TOO_LARGE
})
