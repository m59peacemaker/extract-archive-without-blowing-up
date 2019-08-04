const bin7z = require('.bin/7z')
const Seven = require('node-7z')

const isSrslyObject = v => !Array.isArray(v)
  && v != null
  && Object.prototype.toString.call(v) === '[object Object]'

const jsMapToJsObj = map => Array
	.from(map)
	.reduce((obj, [ k, v ]) => Object.assign(obj, { [k]: v }), {})

const createSeven = ({ bin }) => Object
	.entries(Seven)
	.map(([ name, fn ]) => {
		return [
			name,
			function (...args) {
				const [ _, a, b ] = args
				const aIsOptions = isSrslyObject(a)
				const optionsArg = b ? b : (aIsOptions ? a : {})
				const options = { $bin: bin, ...optionsArg }
				const betterArgs = [
					_,
					a == null ? options : a,
					a == null ? null : options
				]
				const process = fn(...betterArgs)
				const promise = new Promise((resolve, reject) => {
					const files = []
					process.on('data', file => files.push(file))
					process.on('end', () => resolve({ files, info: jsMapToJsObj(process.info) }))
					process.on('error', reject)
				})
				promise.process = process
				return promise
			}
		]
	})
	.reduce((acc, [ k, v ]) => ({ ...acc, [k]: v }), {})

module.exports = createSeven({ bin: bin7z.path7za })
