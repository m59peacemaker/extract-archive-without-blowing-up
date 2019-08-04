const path = require('path')
const fs = require('fs')
const seven = require('./7z')
const True = () => true
const False = () => false

const supports = require('./supports')

const ROOT_ARCHIVE_FILEPATH = '/'
const ARCHIVE_TOO_LARGE = 'ARCHIVE_TOO_LARGE'

const stripExtension = filePath => filePath.replace(/\.[^.$]+$/, '')

const shouldExtractArchives = ({ filePathFromRootArchive }) =>
	supports.extension(path.extname(filePathFromRootArchive))

const maintainStructure = (rootOutputPath) => ({
	filePath,
	filePathFromRootArchive,
	filePathFromLocalArchive
}) => {
	return filePathFromRootArchive === ROOT_ARCHIVE_FILEPATH ? rootOutputPath : stripExtension(filePath)
}

const archiveFilesSize = files => files.reduce((total, { size }) => total + size, 0)

const archiveFileIsDirectory = ({ attributes }) => attributes.slice(0, 1) === 'D'

const getOutputPathDefault = () => {
	throw new Error('getOutputPath function is required')
}

module.exports = async ({
	inputFilePath,
	getOutputPath = getOutputPathDefault,
	shouldExtract = False,
	removeExtractedArchives = false,
	maximumOutputBytes = Infinity
}) => {
	let remainingOutputBytes = maximumOutputBytes

	// "root" refers to the top level archive
	// "local" refers to an archive as though it is root, disregarding whether it was nested
	const extractArchive = async ({
		inputFilePath,
		outputPath,
		rootParentPath,
		removeArchive
	}) => {
		const archiveContents = await seven.list(inputFilePath)

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
		const isDirectory = ({ filePathFromLocalArchive7z }) => archiveDirectoryPaths7z.includes(filePathFromLocalArchive7z)

		const extractedFiles = []
		const subExtractions = []

		const extraction = seven.extractFull(inputFilePath, outputPath)
		
		const onFile = async ({ file: filePathFromLocalArchive7z }) => {
			// filePathFromLocalArchive is the path to this file from the archive it is in /three/a.txt
			const filePathFromLocalArchive = `/${filePathFromLocalArchive7z}`
			// filePathFromRootArchive is the path to this file from the root archive /one/two.zip/three/a.txt
			const filePathFromRootArchive = path.join(rootParentPath, filePathFromLocalArchive)
			const filePath = path.join(outputPath, filePathFromLocalArchive)

			// this is to handle directories that don't show up in the archive files list
			const dirname = path.dirname(filePathFromLocalArchive7z)
			if (dirname !== '.' && !archiveDirectoryPaths7z.includes(dirname)) {
				archiveDirectoryPaths7z.push(dirname)
				onFile({ file: dirname })
			}

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
							inputFilePath: filePath,
							outputPath: getOutputPath({ filePath, filePathFromLocalArchive, filePathFromRootArchive }),
							removeArchive: removeExtractedArchives,
							rootParentPath: filePathFromRootArchive
						})
					})
				},
				{
					condition: True,
					result: () => ({ file: { outputType: 'file' } })
				}
			]
				.find(({ condition }) => condition({
					filePathFromLocalArchive7z,
					filePathFromLocalArchive,
					filePathFromRootArchive,
					filePath
				}))
				.result()
			extractedFiles.push({ ...file, filePath, filePathFromRootArchive, filePathFromLocalArchive })
			subExtraction && subExtractions.push(subExtraction)
		}

		extraction.process.on('data', onFile)

		await extraction
		if (removeArchive) {
			await fs.promises.unlink(inputFilePath)
		}
		const subResults = await Promise.all(subExtractions)
		return Object
			.entries({ extractedFiles })
			.map(([ k, v ]) => [ k, v.concat(...subResults.map(result => result[k])) ])
			.reduce((acc, [ k, v ]) => Object.assign(acc, { [k]: v }), {})

	}

	const outputPath = getOutputPath({
		filePath: inputFilePath,
		filePathFromRootArchive: ROOT_ARCHIVE_FILEPATH,
		filePathFromLocalArchive: ROOT_ARCHIVE_FILEPATH,
	})
	const { extractedFiles } = await extractArchive({
		inputFilePath,
		outputPath,
		rootParentPath: '/',
		removeArchive: false
	})
	return {
		rootArchive: {
			filePath: inputFilePath,
			outputType: 'file',
			filePathFromRootArchive: ROOT_ARCHIVE_FILEPATH,
			filePathFromLocalArchive: ROOT_ARCHIVE_FILEPATH
		},
		rootOutput: {
			filePath: outputPath,
			outputType: 'directory',
			isExtractedArchive: true,
			filePathFromRootArchive: ROOT_ARCHIVE_FILEPATH,
			filePathFromLocalArchive: ROOT_ARCHIVE_FILEPATH
		},
		extractedFiles
	}
}

Object.assign(module.exports, {
	supports,
	shouldExtractArchives,
	maintainStructure,
	ROOT_ARCHIVE_FILEPATH,
	ARCHIVE_TOO_LARGE
})
