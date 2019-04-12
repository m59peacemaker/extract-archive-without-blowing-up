const isArchive = require('is-archive')

const shouldExtractArchives = ({ filePath }) => isArchive(filePath)

const KB = n => 1000 * n
const MB = n => KB(1000) * n

module.exports = {
	isArchive,
	shouldExtractArchives,
	KB,
	MB
}
