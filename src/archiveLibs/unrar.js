const path = require('path')
const { spawn } = require('promisify-child-process')
const pascalCase = require('pascalcase') // a bit ironic?
const split = require('split2')
const noop = () => {}

const extractionActionSubject = {
	Creating: 'directory',
	Extracting: 'file',
}

module.exports = ({ bin }) => {
	const extract = (inputFilePath, outputDirectoryPath, { onEntry = noop } = {}) => {
		const unrarProcess = spawn(bin, [
			'x',
			// answer "yes" to prompts i.e. to overwrite existing files
			'-y',
			inputFilePath,
			// unrar requires output directory path to have a trailing slash
			path.join(outputDirectoryPath, '/')
		])
		unrarProcess
			.stdout
			.pipe(split())
			.on('data', line => {
				const isEntryLine = /^(Creating)|(Extracting) .* OK$/.test(line.trim())
				if (!isEntryLine) {
					return
				}
				const [ action, outputPath ] = line.split(/\s+/)
				// this check is necessary because unrar will output "Creating <outputDirectoryPath>" if it doesn't already exist, which would lead to a bug of having a false, nameless archive entry
				if (outputPath !== outputDirectoryPath) {
					onEntry({
						type: extractionActionSubject[action],
						outputPath
					})
				}
			})
		return unrarProcess
	}

	const list = async filePath => {
		const { stdout, stderr } = await spawn(bin, [ 'vt', filePath ], { encoding: 'utf8' })
		const contents = stdout
			.split('\n\n')
			.slice(2, -1)
			.map(section => section
				.split('\n')
				.map(line => {
					const delimiterIndex = line.indexOf(':')
					const [ label, value ] = [ line.slice(0, delimiterIndex), line.slice(delimiterIndex + 2) ]
					return [ pascalCase(label), value ]
				})
				.reduce((acc, [ k, v ]) => Object.assign(acc, { [k]: v }), {})
			)
		return { contents }
	}

	return {
		extract,
		list
	}
}
