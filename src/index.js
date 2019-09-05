const path = require('path')
const fs = require('fs')
const archiveLibs = require('./archiveLibs')
const supports = require('./supports')

const ROOT_ARCHIVE_FILEPATH = '/'
const ARCHIVE_TOO_LARGE = 'ARCHIVE_TOO_LARGE'

const stripExtension = filePath => filePath.replace(/\.[^.$]+$/, '')
const True = () => true
const False = () => false

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
		const archiveLib = archiveLibs[path.extname(inputFilePath) === '.rar' ? 'unrar' : 'seven']
		const { contents: archiveContents } = await archiveLib.list(inputFilePath)

		remainingOutputBytes = remainingOutputBytes === Infinity
			? Infinity
			: remainingOutputBytes - archiveFilesSize(archiveContents)
			
		if (remainingOutputBytes <= 0) {
			throw Object.assign(
				new Error('archive contents exceed maximum output bytes setting'),
				{ code: ARCHIVE_TOO_LARGE }
			)
		}

		/* TODO:
			remove the "7z" references since that has been replaced by abstract archiveLib
			also... maybe no need for this distinction anyway - consider ditching the absolute path stuff
			filePathFromLocalArchive7z could just be filePathFromLocalArchive if the leading / is ditched
			Depends on whether the change will negatively impact getOutputPath expressiveness
			or something to that effect
		*/
		const archiveDirectoryPaths7z = archiveContents
			.filter(({ type }) => type === 'directory')
			.map(({ path }) => path)
		const isDirectory = ({ filePathFromLocalArchive7z }) => archiveDirectoryPaths7z.includes(filePathFromLocalArchive7z)

		const extractedFiles = []
		const subExtractions = []

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

			const filePathData = {
				filePathFromLocalArchive7z,
				filePathFromLocalArchive,
				filePathFromRootArchive,
				filePath
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
				.find(({ condition }) => condition(filePathData))
				.result()
			extractedFiles.push({ ...file, filePath, filePathFromRootArchive, filePathFromLocalArchive })
			subExtraction && subExtractions.push(subExtraction)
		}

		await archiveLib.extract({ inputFilePath, outputPath, onFile })

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
