const isArchive = require('is-archive')

const shouldExtractArchives = ({ filePath, fileName }) => isArchive(fileName)

const KB = n => 1000 * n
const MB = n => KB(1000) * n

module.exports = {
	isArchive,
	shouldExtractArchives,
	KB,
	MB
}
