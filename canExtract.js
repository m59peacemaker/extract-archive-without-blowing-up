const supportedFormats = require('./supportedFormats')

const extensions = supportedFormats.flatMap(({ extensions }) => extensions)
const mimetypes = supportedFormats.flatMap(({ mimetypes }) => mimetypes)

module.exports = {
	extension: extension => extensions.includes(extension.replace(/^\./, '')),
	mimetype: mimetype => mimetypes.includes(mimetype)
}
