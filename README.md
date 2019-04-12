# extract-archive-without-blowing-up

It is good to check the size of an archive's contents before extracting them so that you don't fill up your drive / get zip-bombed. This module uses `7z` to extract archives and can recursively extract nested archives, with a parameter to restrict the output size. 7z seems to do well about loading only a minimal amount of data into memory at a time.

**tl;dr** Extract archives (optionally recursive) and don't WRECK-SAUCE your RAM or get zip-bombed.

## supported types

7z, XZ, BZIP2, GZIP, TAR, ZIP, WIM, AR, ARJ, CAB, CHM, CPIO, CramFS, DMG, EXT, FAT, GPT, HFS, IHEX, ISO, LZH, LZMA, MBR, MSI, NSIS, NTFS, QCOW2, RAR, RPM, SquashFS, UDF, UEFI, VDI, VHD, VMDK, WIM, XAR, Z

## example

```js
const extractArchive = require('extract-archive-without-blowing-up')
const { shouldExtractArchives, MB } = require('extract-archive-without-blowing-up/util')

;(async () => {
	try {
		const { files } = await extractArchive({
			inputPath: tmpPath('files.zip'),
			outputPath: tmpPath('extracted'),
			maximumOutputBytes: MB(25),
			shouldExtract: shouldExtractArchives
			// shouldExtract: ({ filePath }) => false
		})

		await Promise.all(files.map(({ filePath, outputFilePath }) => {

		}))
	} catch (error) {
		if (error.code === extractArchive.ARCHIVE_TOO_LARGE) {

		} else {

		}
	}
})()
```
