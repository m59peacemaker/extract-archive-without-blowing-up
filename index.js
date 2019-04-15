const path = require('path')
const fs = require('fs')
const seven = require('./7z')
const True = () => true
const False = () => false

const canExtract = require('./canExtract')

const ROOT_ARCHIVE_FILEPATH = '.'
const ARCHIVE_TOO_LARGE = 'ARCHIVE_TOO_LARGE'

const stripExtension = filePath => filePath.replace(/\.[^.$]+$/, '')

const shouldExtractArchives = ({ localFilePath }) =>
	canExtract.extension(path.extname(localFilePath))

const maintainStructure = (rootOutputPath) => ({ rootFilePath, localFilePath, outputFilePath }) =>
	rootFilePath === ROOT_ARCHIVE_FILEPATH ? rootOutputPath : stripExtension(outputFilePath)

const archiveFilesSize = files => files.reduce((total, { size }) => total + size, 0)

const archiveFileIsDirectory = ({ attributes }) => attributes.slice(0, 1) === 'D'

const getOutputPathDefault = () => {
	throw new Error('getOutputPath function is required')
}

module.exports = async ({
	inputPath,
	getOutputPath = getOutputPathDefault,
	shouldExtract = False,
	removeExtractedArchives = false,
	maximumOutputBytes = Infinity
}) => {
	let remainingOutputBytes = maximumOutputBytes

	// "root" refers to the top level archive
	// "local" refers to an archive as though it is root, disregarding whether it was nested
	const extractArchive = async ({
		inputPath,
		outputPath,
		rootParentPath,
		removeArchive
	}) => {
		const archiveContents = await seven.list(inputPath)

		remainingOutputBytes = remainingOutputBytes === Infinity
			? Infinity
			: remainingOutputBytes - archiveFilesSize(archiveContents.files)
			
		if (remainingOutputBytes <= 0) {
			throw Object.assign(
				new Error('archive contents exceed maximum output bytes setting'),
				{ code: ARCHIVE_TOO_LARGE }
			)
		}

		const archiveDirectoryPaths7z = archiveContents
			.files
			.filter(archiveFileIsDirectory)
			.map(({ file }) => file)
		const isDirectory = ({ localFilePath7z }) => archiveDirectoryPaths7z.includes(localFilePath7z)

		const files = []
		const subExtractions = []

		const extraction = seven.extractFull(inputPath, outputPath)

		extraction.process.on('data', async ({ file: localFilePath7z }) => {
			// localFilePath is the path to this file from the archive it is in /three/a.txt
			const localFilePath = `/${localFilePath7z}`
			// rootFilePath is the path to this file from the root archive /one/two.zip/three/a.txt
			const rootFilePath = path.join(rootParentPath, localFilePath)
			const outputFilePath = path.join(outputPath, localFilePath)
			const { file, subExtraction } = [
				{
					condition: isDirectory,
					result: () => ({ file: { outputType: 'directory' } })
				},
				{
					condition: shouldExtract,
					result: () => ({
						file: { outputType: 'directory', isExtractedArchive: true },
						subExtraction: extractArchive({
							inputPath: outputFilePath,
							outputPath: getOutputPath({ localFilePath, rootFilePath, outputFilePath }),
							removeArchive: removeExtractedArchives,
							rootParentPath: rootFilePath
						})
					})
				},
				{
					condition: True,
					result: () => ({ file: { outputType: 'file' } })
				}
			]
				.find(({ condition }) => condition({
					localFilePath7z,
					localFilePath,
					rootFilePath,
					outputFilePath
				}))
				.result()
			files.push({ ...file, rootFilePath, localFilePath, outputFilePath })
			subExtraction && subExtractions.push(subExtraction)
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

	const outputFilePath = getOutputPath({
		localFilePath7z: ROOT_ARCHIVE_FILEPATH,
		rootFilePath: ROOT_ARCHIVE_FILEPATH,
		localFilePath: ROOT_ARCHIVE_FILEPATH,
		outputFilePath: inputPath
	})
	const { files } = await extractArchive({
		inputPath,
		outputPath: outputFilePath,
		rootParentPath: '/',
		removeArchive: false
	})
	files.unshift({
		outputType: 'directory',
		isExtractedArchive: true,
		rootFilePath: ROOT_ARCHIVE_FILEPATH,
		localFilePath: ROOT_ARCHIVE_FILEPATH,
		outputFilePath
	})
	return { files }
}

Object.assign(module.exports, {
	canExtract,
	shouldExtractArchives,
	maintainStructure,
	ROOT_ARCHIVE_FILEPATH,
	ARCHIVE_TOO_LARGE
})
