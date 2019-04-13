const path = require('path')
const fs = require('fs')
const seven = require('./7z')
const False = () => false
const canExtract = require('./canExtract')
const shouldExtractArchives = ({ filePath }) => canExtract.extension(path.extname(filePath))

const ARCHIVE_TOO_LARGE = 'ARCHIVE_TOO_LARGE'

const stripExtension = filePath => filePath.replace(/\.[^.$]+$/, '')

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
	const extractedArchives = []
	const subExtractions = []

	const extraction = seven.extractFull(inputPath, outputPath)

	extraction.process.on('data', async ({ file: filePath7z }) => {
		const filePath = path.join(parentPath, filePath7z)
		const originalOutputFilePath = path.join(outputPath, filePath7z)
		if (shouldExtract({ filePath })) {
			const dirPath = stripExtension(filePath7z)
			const outputFilePath = path.join(outputPath, dirPath)
			subExtractions.push(extractArchive(
				{
					inputPath: originalOutputFilePath,
					outputPath: outputFilePath,
					shouldExtract,
					removeArchive: true,
					parentPath: path.join(parentPath, dirPath)
				},
				state
			))
			const file = { filePath, outputFilePath }
			files.push(file)
			extractedArchives.push(file)
		} else {
			files.push({ filePath, outputFilePath: originalOutputFilePath })
		}
	})

	await extraction
	if (removeArchive) {
		await fs.promises.unlink(inputPath)
	}
	const subResults = await Promise.all(subExtractions)
	return Object
		.entries({ files, extractedArchives })
		.map(([ k, v ]) => [ k, v.concat(...subResults.map(result => result[k])) ])
		.reduce((acc, [ k, v ]) => Object.assign(acc, { [k]: v }), {})
}

module.exports = async ({
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
	canExtract,
	shouldExtractArchives,
	ARCHIVE_TOO_LARGE
})
