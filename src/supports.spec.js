const { test } = require('zora')
const supports = require('./supports')

test('supports.extension', t => {
	t.equal(
		supports.extension('rar'),
		true
	)

	t.equal(
		supports.extension('tgz'),
		true
	)

	t.equal(
		supports.extension('tar'),
		true
	)

	t.equal(
		supports.extension('rolfchopter'),
		false
	)
})

test('supports.mimetype', t => {
	t.equal(
		supports.mimetype('application/x-apple-diskimage'),
		true
	)

	t.equal(
		supports.mimetype('application/pdf'),
		false
	)
})
