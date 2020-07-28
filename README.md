# extract-archive-without-blowing-up

It is good to check the size of an archive's contents before extracting them so that you don't fill up your drive / get zip-bombed. This module uses `7z` and `unrar` to extract archives and can recursively extract nested archives, with a parameter to restrict the output size. The underlying binaries should be reasonable about RAM usage.

**tl;dr** Extract archives (optionally recursive) without using up all of your RAM or getting zip-bombed.

## TODO

- It would be nice for the exodus bundled binaries to live elsewhere and be an npm dependency of this package. The exodus bundles here should then be cleaned out of the git history.

## supported formats

```
7z, XZ, BZIP2, GZIP, TAR, ZIP, AR, ARJ, CAB, CHM, CPIO, CramFS, DMG, EXT, FAT, GPT, HFS, IHEX, ISO, LZH, LZMA, MBR, MSI, NSIS, NTFS, QCOW2, RAR, RPM, SquashFS, UDF, UEFI, VDI, VHD, VMDK, WIM, XAR, Z
```

## example

```js
const extractArchive = require('extract-archive-without-blowing-up')

const archivePath = '/tmp/files.zip'

extractArchive.supports.extension(path.extname(archivePath)) // true
extractArchive.supports.mimetype('application/zip') // true

;(async () => {
	try {
		const { extractedFiles } = await extractArchive({
			inputFilePath: archivePath,
			getOutputPath: extractArchive.maintainStructure('/tmp/extracted'),
			maximumOutputBytes: 1e+6 * 25, // 25MB, default Infinity
			shouldExtract: extractArchive.shouldExtractArchives,
			removeExtractedArchives: true // default false
			getPassword: ({ filePath, filePathFromLocalArchive, filePathFromRootArchive }) => ''
		})

		await Promise.all(files.map(({
			filePath,
			filePathFromRootArchive,
			filePathFromLocalArchive,
			outputType,
			isExtractedArchive
		}) => {
			if (outputType === 'directory') {
				if (isExtractedArchive) {

				}
			} else {
				outputType // => 'file'
			}
		}))
	} catch (error) {
		if (error.code === extractArchive.ARCHIVE_TOO_LARGE) {

		} else {

		}
	}
})()
```
