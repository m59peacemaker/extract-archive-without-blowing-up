const { test } = require('zora')
const os = require('os')
const fs = require('fs-extra')
const path = require('path')
const uuid = require('uuid-v4')
const seven = require('./archiveLibs/7z')({ bin: require('.bin/7z') })
const extractArchive = require('./')
const { ROOT_ARCHIVE_FILEPATH } = extractArchive
const { KB, MB } = require('./test/util/bytes')
const sortBy = require('@ramda/sortby')
const sortByFilePathFromRootArchive = sortBy(({ filePathFromRootArchive }) => filePathFromRootArchive)

const tmp = path.join(os.tmpdir(), `extract-archive-${uuid()}`)
const tmpPath = (...args) => path.join(tmp, ...args)

const reset = async () => {
	await fs.remove(tmp)
}

require('./supports.spec')

;(async () => {
	// console.log(await extractArchive({
	// 		inputFilePath: path.join(__dirname, '../samples/PCB-GEA0006.7z'),
	// 		getOutputPath: extractArchive.maintainStructure(tmpPath('extracted'))
	// 	})
	// 	.catch(error => {
	// 		return error.code === extractArchive.WRONG_PASSWORD ? `it's wrong, what's you're doing` : error.code
	// 	})
	//)

	await test('extracts inputFilePath to result of getOutputPath', async t => {
		try {
			await fs.outputFile(tmpPath('files', 'foo.txt'), 'some foo text')
			await seven.add(tmpPath('files.zip'), tmpPath('files/*'))

			await extractArchive({
				inputFilePath: tmpPath('files.zip'),
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

		const { extractedFiles } = await extractArchive({
			inputFilePath: tmpPath('files.zip'),
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
				inputFilePath: tmpPath('nested.zip'),
				getOutputPath: extractArchive.maintainStructure(tmpPath('extracted')),
				shouldExtract: () => false,
			})

			t.equal(
				await fs.readdir(tmpPath('extracted')),
				[ 'sub.zip', 'z.txt' ]
			)

			await extractArchive({
				inputFilePath: tmpPath('nested.zip'),
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
				inputFilePath: tmpPath('nested.zip'),
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
			await test('returns flat list of files at { extractedFiles }', async t => {
				result.extractedFiles.forEach(file => {
					t.equal(
						Object.keys(file).filter(key => key !== 'isExtractedArchive').sort(),
						[ 'filePath', 'filePathFromRootArchive', 'filePathFromLocalArchive', 'outputType' ].sort(),
						`file: ${JSON.stringify(file, null, 2)}`
					)
				})
			})
			await test(`files are { outputType: 'directory' } when the output is a directory (is a directory or was an archive that is extracted), otherwise { outputType: 'file' }`, async t => {
				const expectedFiles = [
					//{ filePathFromRootArchive: ROOT_ARCHIVE_FILEPATH, outputType: 'directory' },
					{ filePathFromRootArchive: '/one', outputType: 'directory' },
					{ filePathFromRootArchive: '/one/two.zip', outputType: 'directory' },
					{ filePathFromRootArchive: '/one/two.zip/three', outputType: 'directory' },
					{ filePathFromRootArchive: '/one/two.zip/three/four', outputType: 'directory' },
					{ filePathFromRootArchive: '/one/two.zip/three/four/five.zip', outputType: 'directory' },
					{ filePathFromRootArchive: '/one/two.zip/three/four/five.zip/y.txt', outputType: 'file' }
				]
				result.extractedFiles
					.map(({ filePathFromRootArchive, outputType }) => ({ filePathFromRootArchive, outputType }))
					.forEach((file, index) => t.equal(file, expectedFiles[index]))
			})
			await test('extracted archives have { isExtractedArchive: true }', async t => {
				t.equal(
					result
						.extractedFiles
						.filter(({ isExtractedArchive }) => isExtractedArchive)
						.map(({ filePathFromRootArchive }) => filePathFromRootArchive),
					[
						//ROOT_ARCHIVE_FILEPATH,
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
				inputFilePath: tmpPath('gigantichive.zip'),
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
					inputFilePath: tmpPath('gigantichive.zip'),
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
				inputFilePath: tmpPath('nested.zip'),
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
					inputFilePath: tmpPath('nested.zip'),
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

	await test(
		'extracting all archives to the same directory without regard for consequences with getOutputPath',
		async t => {
			/*
				nested.zip
					bananaz.zip
					x.txt
					one
						two.zip
							x.txt
							y.txt
							three
								four
									five.zip
										bananaz.zip
										y.txt
				bananaz.zip
					z.txt
			*/
			await fs.outputFile(tmpPath('x.txt'), 'x')
			await fs.outputFile(tmpPath('y.txt'), 'y')
			await fs.outputFile(tmpPath('z.txt'), 'z')
			await fs.outputFile(tmpPath('banana'), 'banana')
			await seven.add(tmpPath('bananaz.zip'), [ tmpPath('banana'), tmpPath('z.txt') ])
			await seven.add(tmpPath('three/four/five.zip'), [ tmpPath('bananaz.zip'), tmpPath('y.txt') ])
			await seven.add(tmpPath('one/two.zip'), [ tmpPath('x.txt'), tmpPath('y.txt'), tmpPath('three') ])
			await seven.add(tmpPath('nested.zip'), [ tmpPath('bananaz.zip'), tmpPath('x.txt'), tmpPath('one') ])

			const result = await extractArchive({
				inputFilePath: tmpPath('nested.zip'),
				getOutputPath: ({ filePath }) => tmpPath('extracted'),
				shouldExtract: extractArchive.shouldExtractArchives
			})

			await t.equal(
				(await fs.readdir(tmpPath('extracted'))).sort(),
				[ 'x.txt', 'y.txt', 'z.txt', 'banana', 'bananaz.zip', 'one', 'three' ].sort()
			)

			await reset()
		}
	)

	await test('extracting all archives to their own directory as siblings with getOutputPath', async t => {
		/*
			nested.zip
				one
					two.zip
						three
							four
								five.zip
									y.txt
		*/
		await fs.outputFile(tmpPath('y.txt'), 'yyy')
		await seven.add(tmpPath('three/four/five.zip'), [ tmpPath('y.txt') ])
		await seven.add(tmpPath('one/two.zip'), [ tmpPath('three') ])
		await seven.add(tmpPath('nested.zip'), [ tmpPath('one') ])

		const result = await extractArchive({
			inputFilePath: tmpPath('nested.zip'),
			getOutputPath: ({ filePath }) =>
				path.join(tmpPath('extracted'), path.basename(filePath, path.extname(filePath))),
			shouldExtract: extractArchive.shouldExtractArchives
		})

		await t.equal(
			(await fs.readdir(tmpPath('extracted'))).sort(),
			[ 'nested', 'two', 'five' ].sort()
		)
		await t.equal(
			await fs.readdir(path.join(tmpPath('extracted'), 'nested/one')),
			[ 'two.zip' ]
		)
		await t.equal(
			await fs.readdir(path.join(tmpPath('extracted'), 'two/three/four')),
			[ 'five.zip' ]
		)
		await t.equal(
			await fs.readdir(path.join(tmpPath('extracted'), 'five')),
			[ 'y.txt' ]
		)

		await reset()
	})

	await test(
		`lists directories in { extractedFiles } when the archive doesn't explicitly list them`,
		async t => {
			const { extractedFiles } = await extractArchive({
				inputFilePath: `${__dirname}/../samples/unlisted-directory.zip`,
				getOutputPath: ({ filePath }) => tmpPath('extracted'),
				shouldExtract: extractArchive.shouldExtractArchives
			})
			t.deepEqual(
				extractedFiles.map(({ filePath, ...file }) => file),
				[
					{
						outputType: 'directory',
						filePathFromRootArchive: '/one',
						filePathFromLocalArchive: '/one'
					},
					{
						outputType: 'file',
						filePathFromRootArchive: '/one/foo.txt',
						filePathFromLocalArchive: '/one/foo.txt'
					}
				]
			)
			await reset()
		}
	)

	await test(
		`recursively extracts multiple archive types`,
		async t => {
			const { extractedFiles } = await extractArchive({
				inputFilePath: `${__dirname}/../samples/multiple-archive-and-file-types-nested.7z`,
				getOutputPath: ({ filePath }) => tmpPath('extracted'),
				shouldExtract: extractArchive.shouldExtractArchives
			})
			t.deepEqual(
				sortByFilePathFromRootArchive(extractedFiles.map(({ filePath, ...file }) => file)),
				sortByFilePathFromRootArchive([
					{
						outputType: "directory",
						filePathFromRootArchive: "/one",
						filePathFromLocalArchive: "/one"
					},
					{
						outputType: "file",
						filePathFromRootArchive: "/one/bullet.gbr",
						filePathFromLocalArchive: "/one/bullet.gbr"
					},
					{
						outputType: "directory",
						isExtractedArchive: true,
						filePathFromRootArchive: "/one/two.rar",
						filePathFromLocalArchive: "/one/two.rar"
					},
					{
						outputType: "directory",
						filePathFromRootArchive: "/one/two.rar/three",
						filePathFromLocalArchive: "/three"
					},
					{
						outputType: "file",
						filePathFromRootArchive: "/one/two.rar/three/image.png",
						filePathFromLocalArchive: "/three/image.png"
					},
					{
						outputType: "directory",
						filePathFromRootArchive: "/one/two.rar/three/four",
						filePathFromLocalArchive: "/three/four"
					},
					{
						outputType: "directory",
						isExtractedArchive: true,
						filePathFromRootArchive: "/one/two.rar/three/four/five.zip",
						filePathFromLocalArchive: "/three/four/five.zip"
					},
					{
						outputType: "file",
						filePathFromRootArchive: "/one/two.rar/three/four/five.zip/foo.txt",
						filePathFromLocalArchive: "/foo.txt"
					}
				])
			)
			await reset()
		}
	)
})()
