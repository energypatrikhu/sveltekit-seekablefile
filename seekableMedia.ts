import type { RequestHandler } from '@sveltejs/kit';
import { stat } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';

export const GET = async function ({ request, params }) {
	let { fileName } = params;

	if (!fileName) {
		throw new Response(String('No File Name!'), {
			status: 400,
		});
	}

	if (!existsSync(fileName)) {
		throw new Response(String('File does not exists!'), {
			status: 404,
		});
	}

	let rangeHeader = request.headers.get('range');
	let ifNoneMatchHeader = request.headers.get('if-none-match');

	let { mtime: modifiedDate, size: fileSize } = await stat(fileName);
	let etag = `W/"${fileSize}-${modifiedDate.getTime()}"`;

	if (ifNoneMatchHeader === etag) {
		throw new Response(null, {
			status: 304,
		});
	}

	let defaultHeaders = {
		'ETag': etag,
		'Content-Type': mime.lookup(fileName),
		'Cache-Control': 'max-age=60',
		'Last-Modified': modifiedDate.toUTCString(),
	};

	if (rangeHeader) {
		let [_start, _end] = rangeHeader.replace(/bytes=/, '').split('-');
		let start = parseInt(_start);
		let end = _end ? parseInt(_end) : fileSize - 1;

		if (!isNaN(start) && isNaN(end)) {
			start = start;
			end = fileSize - 1;
		}
		if (isNaN(start) && !isNaN(end)) {
			start = fileSize - end;
			end = fileSize - 1;
		}

		if (start >= fileSize || end >= fileSize) {
			throw new Response(null, {
				status: 416,
				headers: {
					'Content-Range': `bytes */${fileSize}`,
				},
			});
		}

		// @ts-ignore
		return new Response(createReadStream(fileName, { start, end }), {
			status: 206,
			headers: {
				...defaultHeaders,
				'Accept-Ranges': 'bytes',
				'Content-Range': `bytes ${start}-${end}/${fileSize}`,
				'Content-Length': (end - start + 1).toString(),
			},
		});
	} else {
		// @ts-ignore
		return new Response(createReadStream(fileName), {
			status: 200,
			headers: {
				...defaultHeaders,
				'Accept-Ranges': 'bytes',
				'Content-Length': fileSize.toString(),
			},
		});
	}
} satisfies RequestHandler;

let mime = {
	_mimes: {
		// Text
		txt: 'text/plain',
		pdf: 'application/pdf',
		// Images
		webp: 'image/webp',
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		avif: 'image/avif',
		// Audio
		mp3: 'audio/mp3',
		// Video
		webm: 'video/webm',
		mp4: 'video/mp4',
	},

	lookup(string: string) {
		let ext = string.toLowerCase().split('.').at(-1) as keyof typeof this._mimes;
		return (ext && this._mimes[ext]) ?? 'application/octet-stream';
	},
};
