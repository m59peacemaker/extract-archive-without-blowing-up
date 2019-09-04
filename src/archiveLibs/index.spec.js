const { test } = require('zora')
const path = require('path')
const archiveLibs = require('./index')

const listOutputFormat = {
	contents: [
		{ path: 'foo/bar.png', size: 1, type: 'file' }
	]
}

test('archiveLibs', async t => {
	await test('all libs list() output is { contents { path, size, type } }', async t => {
		await Promise.all(
			[
				[ archiveLibs.seven, 'foobar.7z' ],
				[ archiveLibs.unrar, 'foobar.rar' ]
			]	.map(async ([ { list }, sampleFile ]) => {
				const result = await list(path.join(__dirname, `../../samples/${sampleFile}`))
				t.equal(
					Object.keys(result),
					Object.keys(listOutputFormat)
				)
				result.contents.forEach(file => {
					t.equal(
						Object.keys(file),
						Object.keys(listOutputFormat.contents[0])
					)
				})
			})
		)
	})
})
