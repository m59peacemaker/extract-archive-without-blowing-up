const { test } = require('zora')
const os = require('os')
const fs = require('fs-extra')
const path = require('path')
const uuid = require('uuid-v4')
const seven = require('./7z')
const extractArchive = require('./')
const { KB, MB } = require('./test/util/bytes')

const tmp = path.join(os.tmpdir(), `bomb-squad-${uuid()}`)
const tmpPath = (...args) => path.join(tmp, ...args)

const reset = async () => {
	await fs.remove(tmp)
}

require('./canExtract.spec')

;(async () => {
	await test('extracts inputPath to result of getOutputPath', async t => {
		try {
			await fs.outputFile(tmpPath('files', 'foo.txt'), 'some foo text')
			await seven.add(tmpPath('files.zip'), tmpPath('files/*'))

			await extractArchive({
				inputPath: tmpPath('files.zip'),
				getOutputPath: extractArchive.maintainStructure(tmpPath('extracted'))
			})

			t.equal(
				await fs.readFile(tmpPath('extracted', 'foo.txt'), 'utf8'),
				'some foo text',
				'extracted archive files to outputPath'
			)
		} catch (error) {
			console.log(error)
			t.fail(error.message)
		}
		await reset()
	})

	await test('can mantain directory structure', async t => {
		await fs.outputFile(tmpPath('files', 'a.txt'), 'aaa')
		await fs.outputFile(tmpPath('files', 'one', 'b.txt'), 'bbb')
		await fs.outputFile(tmpPath('files', 'one', 'two', 'c.txt'), 'ccc')
		await seven.add(tmpPath('files.zip'), tmpPath('files/*'))

		const { files } = await extractArchive({
			inputPath: tmpPath('files.zip'),
			getOutputPath: extractArchive.maintainStructure(tmpPath('extracted'))
		})

		t.equal(
			await fs.readdir(tmpPath('extracted')),
			[ 'a.txt', 'one' ]
		)

		t.equal(
			await fs.readdir(tmpPath('extracted', 'one')),
			[ 'b.txt', 'two' ]
		)

		t.equal(
			await fs.readdir(tmpPath('extracted', 'one', 'two')),
			[ 'c.txt' ]
		)

		await reset()
	})

	await test('rocks this biz recursive', async t => {
		try {
			await fs.outputFile(tmpPath('y.txt'), 'yyy')
			await fs.outputFile(tmpPath('z.txt'), 'zzz')
			await seven.add(tmpPath('sub.zip'), [ tmpPath('y.txt') ])
			await seven.add(tmpPath('nested.zip'), [ tmpPath('sub.zip'), tmpPath('z.txt') ])

			await extractArchive({
				inputPath: tmpPath('nested.zip'),
				getOutputPath: extractArchive.maintainStructure(tmpPath('extracted')),
				shouldExtract: () => false,
			})

			t.equal(
				await fs.readdir(tmpPath('extracted')),
				[ 'sub.zip', 'z.txt' ]
			)

			await extractArchive({
				inputPath: tmpPath('nested.zip'),
				getOutputPath: extractArchive.maintainStructure(tmpPath('extracted')),
				shouldExtract: extractArchive.shouldExtractArchives
			})

			t.equal(
				await fs.readdir(tmpPath('extracted')),
				[ 'sub', 'sub.zip', 'z.txt' ]
			)

			t.equal(
				await fs.readdir(tmpPath('extracted', 'sub')),
				[ 'y.txt' ]
			)

			t.equal(
				await fs.readFile(tmpPath('extracted', 'z.txt'), 'utf8'),
				'zzz'
			)
			t.equal(
				await fs.readFile(tmpPath('extracted', 'sub', 'y.txt'), 'utf8'),
				'yyy'
			)
		} catch (error) {
			console.log(error)
			t.fail(error.message)
		}
		await reset()
	})

	await test('recurses archives in directories', async t => {
		/*
			nested.zip
				one
					two.zip
						three
							four
								five.zip
									y.txt
		*/
		try {
			await fs.outputFile(tmpPath('y.txt'), 'yyy')
			await seven.add(tmpPath('three/four/five.zip'), [ tmpPath('y.txt') ])
			await seven.add(tmpPath('one/two.zip'), [ tmpPath('three') ])
			await seven.add(tmpPath('nested.zip'), [ tmpPath('one') ])

			const result = await extractArchive({
				inputPath: tmpPath('nested.zip'),
				getOutputPath: extractArchive.maintainStructure(tmpPath('extracted')),
				shouldExtract: extractArchive.shouldExtractArchives
			})

			await t.equal(
				await fs.readdir(tmpPath('extracted'))
				[ 'one' ]
			)
			await t.equal(
				await fs.readdir(tmpPath('extracted', 'one'))
				[ 'two' ]
			)
			t.equal(
				await fs.readdir(tmpPath('extracted', 'one', 'two'))
				[ 'three' ]
			)
			t.equal(
				await fs.readdir(tmpPath('extracted', 'one', 'two', 'three'))
				[ 'four' ]
			)
			t.equal(
				await fs.readdir(tmpPath('extracted', 'one', 'two', 'three', 'four'))
				[ 'five' ]
			)
			t.equal(
				await fs.readdir(tmpPath('extracted', 'one', 'two', 'three', 'four', 'five'))
				[ 'y.txt' ]
			)

			// awkwardly throwing these tests in here to share the setup code, for time's sake
			await test('returns flat list of files at { files }', async t => {
				result.files.forEach(file => {
					t.equal(
						Object.keys(file).filter(key => key !== 'isExtractedArchive').sort(),
						[ 'rootFilePath', 'localFilePath', 'outputFilePath', 'outputType' ].sort(),
						`file: ${JSON.stringify(file, null, 2)}`
					)
				})
			})
			await test(`files are { outputType: 'directory' } when the output is a directory (is a directory or was an archive that is extracted), otherwise { outputType: 'file' }`, async t => {
				const expectedFiles = [
					{ rootFilePath: '.', outputType: 'directory' },
					{ rootFilePath: '/one', outputType: 'directory' },
					{ rootFilePath: '/one/two.zip', outputType: 'directory' },
					{ rootFilePath: '/one/two.zip/three', outputType: 'directory' },
					{ rootFilePath: '/one/two.zip/three/four', outputType: 'directory' },
					{ rootFilePath: '/one/two.zip/three/four/five.zip', outputType: 'directory' },
					{ rootFilePath: '/one/two.zip/three/four/five.zip/y.txt', outputType: 'file' }
				]
				result.files
					.map(({ rootFilePath, outputType }) => ({ rootFilePath, outputType }))
					.forEach((file, index) => t.equal(file, expectedFiles[index]))
			})
			await test('extracted archives have { isExtractedArchive: true }', async t => {
				t.equal(
					result
						.files
						.filter(({ isExtractedArchive }) => isExtractedArchive)
						.map(({ rootFilePath }) => rootFilePath),
					[
						'.',
						'/one/two.zip',
						'/one/two.zip/three/four/five.zip'
					]
				)
			})
		} catch (error) {
			console.log(error)
			t.fail(error.message)
		}
		await reset()
	})

	await test('{ code: ARCHIVE_TOO_LARGE } is a thing', t => {
		t.equal(typeof extractArchive.ARCHIVE_TOO_LARGE, 'string')
		t.equal(extractArchive.ARCHIVE_TOO_LARGE.length > 0, true)
	})


	await test('works with maximumOutputBytes limit when archive is within limit', async t => {
		try {
			await fs.outputFile(tmpPath('gigantifile'), Buffer.alloc(MB(24.999)).fill('0'))
			await seven.add(tmpPath('gigantichive.zip'), tmpPath('*'))

			await extractArchive({
				inputPath: tmpPath('gigantichive.zip'),
				getOutputPath: extractArchive.maintainStructure(tmpPath('extracted')),
				maximumOutputBytes: MB(25)
			})
			t.ok('did not fail')
			t.equal(
				(await fs.stat(tmpPath('extracted', 'gigantifile'))).size,
				MB(24.999),
				'extracted file is the right size'
			)
		} catch (error) {
			console.log(error)
			t.fail(error.message)
		}
		await reset()
	})

	await test('throws error { code: ARCHIVE_TOO_LARGE } when non-recursive archive is larger than allowed', async t => {
		try {
			await fs.outputFile(tmpPath('gigantifile'), Buffer.alloc(MB(25.001)).fill('0'))
			await seven.add(tmpPath('gigantichive.zip'), tmpPath('*'))

			try {
				await extractArchive({
					inputPath: tmpPath('gigantichive.zip'),
					getOutputPath: extractArchive.maintainStructure(tmpPath('extracted')),
					maximumOutputBytes: MB(25)
				})
				t.fail('archive is too big, but did not throw')
			} catch (error) {
				t.equal(error.code, extractArchive.ARCHIVE_TOO_LARGE, error.message)
			}
		} catch (error) {
			console.log(error)
			t.fail(error.message)
		}
		await reset()
	})

	await test('throws error { code: ARCHIVE_TOO_LARGE } when recursive archive is larger than allowed', async t => {
		const createArchive = async () => {
			const filler = Buffer.alloc(MB(2)).fill('0')
			await fs.outputFile(tmpPath('a.txt'), filler)
			await fs.outputFile(tmpPath('b.txt'), filler)
			await fs.outputFile(tmpPath('c.txt'), filler)
			await fs.outputFile(tmpPath('d.txt'), filler)
			await seven.add(
				tmpPath('two.zip'),
				[ tmpPath('d.txt')
			])
			await seven.add(
				tmpPath('one.zip'),
				[ tmpPath('b.txt'), tmpPath('c.txt'), tmpPath('two.zip') ]
			)
			await seven.add(
				tmpPath('nested.zip'),
				[ tmpPath('a.txt'), tmpPath('one.zip') ]
			)
		}

		try {
			await createArchive()

			// sanity check
			await extractArchive({
				inputPath: tmpPath('nested.zip'),
				getOutputPath: extractArchive.maintainStructure(tmpPath('extracted')),
				shouldExtract: extractArchive.shouldExtractArchives,
				removeExtractedArchives: true
			})

			t.equal(
				await fs.readdir(tmpPath('extracted')),
				[ 'a.txt', 'one' ]
			)
			t.equal(
				await fs.readdir(tmpPath('extracted', 'one')),
				[ 'b.txt', 'c.txt', 'two' ]
			)
			t.equal(
				await fs.readdir(tmpPath('extracted', 'one', 'two')),
				[ 'd.txt']
			)
			// we're sane

			await reset()
			await createArchive()

			try {
				const result = await extractArchive({
					inputPath: tmpPath('nested.zip'),
					getOutputPath: extractArchive.maintainStructure(tmpPath('extracted')),
					shouldExtract: extractArchive.shouldExtractArchives,
					removeExtractedArchives: true,
					maximumOutputBytes: MB(7)
				})
				t.fail('archive is too big, but did not throw')
			} catch (error) {
				t.equal(error.code, extractArchive.ARCHIVE_TOO_LARGE, error.message)
				t.equal(
					await fs.readdir(tmpPath('extracted')),
					[ 'a.txt', 'one' ]
				)
				t.equal(
					await fs.readdir(tmpPath('extracted', 'one')),
					[ 'b.txt', 'c.txt', 'two.zip' ]
				)
			}
		} catch (error) {
			console.log(error)
			t.fail(error.message)
		}
		await reset()
	})
})()
