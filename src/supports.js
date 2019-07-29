const supportedFormats = require('../supportedFormats')

const extensions = supportedFormats
	.map(({ extensions }) => extensions)
	.reduce((a, b) => a.concat(b), [])

const mimetypes = supportedFormats
	.map(({ mimetypes }) => mimetypes)
	.reduce((a, b) => a.concat(b), [])

module.exports = {
	extension: extension => extensions.includes(extension.replace(/^\./, '')),
	mimetype: mimetype => mimetypes.includes(mimetype)
}
