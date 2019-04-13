const { test } = require('zora')
const canExtract = require('./canExtract')

test('canExtract.extension', t => {
	t.equal(
		canExtract.extension('rar'),
		true
	)

	t.equal(
		canExtract.extension('rolfchopter'),
		false
	)
})

test('canExtract.mimetype', t => {
	t.equal(
		canExtract.mimetype('application/x-apple-diskimage'),
		true
	)

	t.equal(
		canExtract.mimetype('application/pdf'),
		false
	)
})
