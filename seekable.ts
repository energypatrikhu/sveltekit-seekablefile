// this is for demonstration

// +server.ts
export const GET = async function ({ request, params, cookies }) {
	// ...
	// auth script
	// ...

	let { fileId } = params;

	if (!fileId) {
		throw error(400, String('Fájl ID nincs megadva!'));
	}

	let fileInfo = await getFileInfo(fileId);

	if (!fileInfo) {
		throw error(404, String('Fájl nem található!'));
	}

	let seekableStreamData = await seekableStream(fileInfo, request.headers.get('range'));

	if (!seekableStreamData) {
		throw error(404, String('Fájl nem található!'));
	}

	// @ts-ignore
	return new Response(seekableStreamData.stream, {
		status: seekableStreamData.code,
		headers: seekableStreamData.headers,
	});
} satisfies RequestHandler;


// seekableStream.ts
export async function seekableStream(
	fileInfo: {
		path: string;
		mimetype: string;
		size: number;
		name?: string;
		ext?: string;
	},
	rangeHeader?: string | null,
) {
	if (!existsSync(fileInfo.path)) {
		return null;
	}

	if (rangeHeader) {
		let [_start, _end] = rangeHeader.replace(/bytes=/, '').split('-');
		let start = parseInt(_start);
		let end = _end ? parseInt(_end) : fileInfo.size - 1;

		if (!isNaN(start) && isNaN(end)) {
			start = start;
			end = fileInfo.size - 1;
		}
		if (isNaN(start) && !isNaN(end)) {
			start = fileInfo.size - end;
			end = fileInfo.size - 1;
		}

		if (start >= fileInfo.size || end >= fileInfo.size) {
			return {
				code: 416,
				headers: {
					'Content-Range': `bytes */${fileInfo.size}`,
				},
				stream: null,
			};
		}

		return {
			code: 206,
			headers: {
				'Accept-Ranges': 'bytes',
				'Content-Range': `bytes ${start}-${end}/${fileInfo.size}`,
				'Content-Length': (end - start + 1).toString(),
				'Content-Type': fileInfo.mimetype,
			},
			stream: createReadStream(fileInfo.path, { start, end }),
		};
	} else {
		return {
			code: 200,
			headers: {
				'Accept-Ranges': 'bytes',
				'Content-Length': fileInfo.size.toString(),
				'Content-Type': fileInfo.mimetype,
			},
			stream: createReadStream(fileInfo.path),
		};
	}
}
