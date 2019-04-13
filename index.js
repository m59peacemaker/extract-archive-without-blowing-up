const path = require('path')
const fs = require('fs')
const seven = require('./7z')
const False = () => false
const canExtract = require('./canExtract')
const shouldExtractArchives = ({ filePath }) => canExtract.extension(path.extname(filePath))

const ARCHIVE_TOO_LARGE = 'ARCHIVE_TOO_LARGE'

const stripExtension = filePath => filePath.replace(/\.[^.$]+$/, '')

const archiveFilesSize = files => files.reduce((total, { size }) => total + size, 0)

const archiveFileIsDirectory = ({ attributes }) => attributes.slice(0, 1) === 'D'

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
	const archiveContents = await seven.list(inputPath)

	state.remainingOutputBytes = state.remainingOutputBytes === Infinity
		? Infinity
		: state.remainingOutputBytes - archiveFilesSize(archiveContents.files)
		
	if (state.remainingOutputBytes <= 0) {
		throw Object.assign(
			new Error('archive contents exceed maximum output bytes setting'),
			{ code: ARCHIVE_TOO_LARGE }
		)
	}

	const archiveDirectoryPaths7z = archiveContents
		.files
		.filter(archiveFileIsDirectory)
		.map(({ file }) => file)

	const files = []
	const subExtractions = []

	const extraction = seven.extractFull(inputPath, outputPath)

	extraction.process.on('data', async ({ file: filePath7z }) => {
		const filePath = path.join(parentPath, filePath7z)
		const originalOutputFilePath = path.join(outputPath, filePath7z)
		const isDirectory = archiveDirectoryPaths7z.includes(filePath7z)
		if (isDirectory) {
			files.push({ filePath, outputFilePath: originalOutputFilePath, type: 'directory' })
		} else if (shouldExtract({ filePath })) {
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
			const file = { filePath, outputFilePath, type: 'directory', isExtractedArchive: true }
			files.push(file)
		} else {
			files.push({ filePath, outputFilePath: originalOutputFilePath, type: 'file' })
		}
	})

	await extraction
	if (removeArchive) {
		await fs.promises.unlink(inputPath)
	}
	const subResults = await Promise.all(subExtractions)
	return Object
		.entries({ files })
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
		remainingOutputBytes: maximumOutputBytes
	}
)

Object.assign(module.exports, {
	canExtract,
	shouldExtractArchives,
	ARCHIVE_TOO_LARGE
})
