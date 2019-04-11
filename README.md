# extract-archive-without-blowing-up

```js
const extractArchive = require('extract-archive-without-blowing-up')
const { shouldExtractArchives, MB } = require('extract-archive-without-blowing-up/util')

(async () => {
	try {
		await extractArchive({
			inputPath: tmpPath('files.zip'),
			outputPath: tmpPath('extracted'),
			maximumOutputBytes: MB(25),
			shouldExtract: shouldExtractArchives
		})
	} catch (error) {
		if (error.code === extractArchive.ARCHIVE_TOO_LARGE) {

		} else {

		}
	}
})()
```
