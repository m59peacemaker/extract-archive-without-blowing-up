const sevenLib = require('./7z')({ bin: require('.bin/7z') })
const unrarLib = require('./unrar')({ bin: require('.bin/unrar') })
const path = require('path')

const seven = {
	list: async filePath => {
		const { files } = await sevenLib.list(filePath)
		return {
			contents: files.map(({ file, size, attributes }) => ({
				path: file,
				size,
				type: attributes.slice(0, 1) === 'D' ? 'directory' : 'file'
			}))
		}
	},
	extract: async ({ inputFilePath, outputPath, onFile }) => {
		const extraction = sevenLib.extractFull(inputFilePath, outputPath)
		extraction.process.on('data', onFile)
		return extraction
	}
}

const unrar = {
	list: async filePath => {
		const { contents } = await unrarLib.list(filePath)
		return {
			contents: contents.map(({ Name, Size, Type }) => ({
				path: Name,
				size: Size,
				type: Type.toLowerCase()
			}))
		}
	},
	extract: async ({ inputFilePath, outputPath, onFile }) => {
		return unrarLib.extract(
			inputFilePath,
			outputPath,
			{
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
