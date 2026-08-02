import path from "node:path";
import type { Readable } from "node:stream";
import {
	CreateBucketCommand,
	GetObjectCommand,
	HeadBucketCommand,
	NoSuchBucket,
	PutObjectCommand,
	S3Client,
	S3ServiceException,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { env } from "../../config/env.config";
import BadRequestError from "../../errors/bad-request.error";
import {
	StorageBucketNotFoundError,
	StorageInvalidCredentialsError,
	StorageObjectNotFoundError,
	StorageUploadFailedError,
} from "./storage.errors";

type UploadableFile = {
	filename: string;
	mimetype: string;
	toBuffer: () => Promise<Buffer>;
};

type StoredObject = {
	key: string;
	contentType?: string;
	body: Readable | ReadableStream | Blob | Uint8Array;
};

type ImageUploadOptions = {
	maxInputBytes?: number;
	maxOutputBytes?: number;
};

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export class StorageService {
	private readonly client: S3Client;
	private readonly bucket: string;

	constructor(
		private readonly logger?: {
			error: (error: unknown, message: string) => void;
		},
	) {
		const accessKeyId =
			env.S3_ACCESS_KEY_ID ?? (env.NODE_ENV === "test" ? "test" : undefined);
		const secretAccessKey =
			env.S3_SECRET_ACCESS_KEY ??
			(env.NODE_ENV === "test" ? "test" : undefined);

		if (!accessKeyId || !secretAccessKey) {
			throw new StorageInvalidCredentialsError();
		}

		this.bucket = env.S3_BUCKET;
		this.client = new S3Client({
			credentials: {
				accessKeyId,
				secretAccessKey,
			},
			endpoint: env.S3_ENDPOINT,
			forcePathStyle: env.S3_FORCE_PATH_STYLE,
			region: env.S3_REGION,
		});
	}

	async ensureBucket() {
		try {
			await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
		} catch (error) {
			if (this.isInvalidCredentialsError(error)) {
				throw new StorageInvalidCredentialsError();
			}

			if (!this.isBucketMissingError(error)) {
				throw error;
			}

			try {
				await this.client.send(
					new CreateBucketCommand({ Bucket: this.bucket }),
				);
			} catch (createError) {
				if (this.isInvalidCredentialsError(createError)) {
					throw new StorageInvalidCredentialsError();
				}
				throw new StorageBucketNotFoundError();
			}
		}
	}

	async uploadImage(
		file: UploadableFile,
		partitionSegments: string[],
		options: ImageUploadOptions = {},
	): Promise<{ key: string; contentType: string }> {
		if (!allowedMimeTypes.includes(file.mimetype)) {
			throw new BadRequestError(
				"Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.",
				"INVALID_FILE_TYPE",
			);
		}

		const buffer = await file.toBuffer();
		if (options.maxInputBytes && buffer.length > options.maxInputBytes) {
			throw new BadRequestError(
				"Image must be 5 MB or smaller",
				"IMAGE_TOO_LARGE",
			);
		}
		let processedBuffer = buffer;
		let contentType = file.mimetype;
		let extension = path.extname(file.filename).toLowerCase() || ".jpg";

		try {
			let pipeline = sharp(buffer);
			if (file.mimetype === "image/jpeg" || file.mimetype === "image/jpg") {
				pipeline = pipeline.jpeg({
					quality: 85,
					progressive: true,
					mozjpeg: true,
				});
			} else if (file.mimetype === "image/png") {
				pipeline = pipeline.png({ compressionLevel: 9, quality: 85 });
			} else if (file.mimetype === "image/webp") {
				pipeline = pipeline.webp({ quality: 85, lossless: false });
			} else {
				pipeline = pipeline.webp({ quality: 85 });
				contentType = "image/webp";
				extension = ".webp";
			}
			processedBuffer = await pipeline.toBuffer();
		} catch (error) {
			this.logger?.error(
				error,
				"Failed to process image, uploading original instead.",
			);
			// Keep current behavior: failed optimization does not block upload.
		}

		if (
			options.maxOutputBytes &&
			processedBuffer.length > options.maxOutputBytes
		) {
			throw new BadRequestError(
				"Image is still larger than 5 MB after compression",
				"IMAGE_TOO_LARGE",
			);
		}

		const key = [...partitionSegments, `${uuidv4()}${extension}`].join("/");

		try {
			await this.client.send(
				new PutObjectCommand({
					Body: processedBuffer,
					Bucket: this.bucket,
					ContentLength: processedBuffer.length,
					ContentType: contentType,
					Key: key,
				}),
			);
		} catch (error) {
			if (this.isInvalidCredentialsError(error)) {
				throw new StorageInvalidCredentialsError();
			}
			if (this.isBucketMissingError(error)) {
				throw new StorageBucketNotFoundError();
			}
			throw new StorageUploadFailedError();
		}

		return { key, contentType };
	}

	async getObjectStream(key: string): Promise<StoredObject> {
		try {
			const result = await this.client.send(
				new GetObjectCommand({
					Bucket: this.bucket,
					Key: key,
				}),
			);

			if (!result.Body) {
				throw new StorageObjectNotFoundError();
			}

			return {
				body: result.Body as StoredObject["body"],
				contentType: result.ContentType,
				key,
			};
		} catch (error) {
			if (error instanceof StorageObjectNotFoundError) {
				throw error;
			}
			if (this.isInvalidCredentialsError(error)) {
				throw new StorageInvalidCredentialsError();
			}
			if (this.isObjectMissingError(error)) {
				throw new StorageObjectNotFoundError();
			}
			if (this.isBucketMissingError(error)) {
				throw new StorageBucketNotFoundError();
			}
			throw error;
		}
	}

	private isInvalidCredentialsError(error: unknown) {
		return (
			error instanceof S3ServiceException &&
			["InvalidAccessKeyId", "SignatureDoesNotMatch", "AccessDenied"].includes(
				error.name,
			)
		);
	}

	private isBucketMissingError(error: unknown) {
		return (
			error instanceof NoSuchBucket ||
			(error instanceof S3ServiceException &&
				["NoSuchBucket", "NotFound"].includes(error.name))
		);
	}

	private isObjectMissingError(error: unknown) {
		return (
			error instanceof S3ServiceException &&
			["NoSuchKey", "NotFound"].includes(error.name)
		);
	}
}
