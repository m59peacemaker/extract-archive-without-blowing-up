const sevenLib = require('./7z')({ bin: require('.bin/7z') })
const unrarLib = require('./unrar')({ bin: require('.bin/unrar') })
const path = require('path')

const seven = {
	list: async (filePath, { timeout }) => {
		const { files } = await sevenLib.list(filePath, { $spawnOptions: { timeout } })
		return {
			contents: files.map(({ file, size, attributes }) => ({
				path: file,
				size,
				type: attributes.slice(0, 1) === 'D' ? 'directory' : 'file'
			}))
		}
	},
	extract: async ({ inputFilePath, outputPath, password, timeout, onFile }) => {
		/*
		 * 7z will create empty files when extracting, then fail to populate them due to encryption (password required)
		 * This causes other problems, like calling `onFile` with a file with an archive extension, but it's really nothing
		 * Use `7z t` (test) to get the error before extracting
		 */
		await sevenLib.test(inputFilePath, { password, $spawnOptions: { timeout } })
		const extraction = sevenLib.extractFull(inputFilePath, outputPath, { password, $spawnOptions: { timeout } })
		extraction.process.on('data', onFile)
		return extraction
	}
}

const unrar = {
	list: async (filePath, { timeout }) => {
		const { contents } = await unrarLib.list(filePath, { timeout })
		return {
			contents: contents.map(({ Name, Size, Type }) => ({
				path: Name,
				size: Size,
				type: Type.toLowerCase()
			}))
		}
	},
	extract: async ({ inputFilePath, outputPath, timeout, onFile }) => {
		return unrarLib.extract(
			inputFilePath,
			outputPath,
			{
				timeout,
				onEntry: entry => {
					onFile({ file: path.relative(outputPath, entry.outputPath) })
				}
			}
		)
	}
}

module.exports = {
	seven,
	unrar
}
