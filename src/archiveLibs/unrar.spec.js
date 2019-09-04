const path = require('path')
const { test } = require('zora')
const unrar = require('./unrar')({ bin: require('.bin/unrar') })

test('unrar', async t => {
	await t.test('list', async t => {
		const info = await unrar.list(path.join(__dirname, '../../samples/foobar.rar'))
		t.equal(
			info,
			{
				contents: [
					{
						Name: 'bar.txt',
						Type: 'File',
						Size: '12',
						PackedSize: '12',
						Ratio: '100%',
						Mtime: '2019-08-09 17:02:27,348448800',
						Attributes: '..A....',
						CRC32: '8F736418',
						HostOS: 'Windows',
						Compression: 'RAR 5.0(v50) -m0 -md=128K'
					},
					{
						Name: 'foo.txt',
						Type: 'File',
						Size: '12',
						PackedSize: '12',
						Ratio: '100%',
						Mtime: '2019-08-06 19:26:55,049518700',
						Attributes: '..A....',
						CRC32: '0C537E39',
						HostOS: 'Windows',
						Compression: 'RAR 5.0(v50) -m0 -md=128K'
					}
				]
			}
		)
	})
})
