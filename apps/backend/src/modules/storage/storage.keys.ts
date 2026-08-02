export const PROFILE_PICTURE_UPLOAD_PREFIX = "profilepicture";
export const EVENT_IMAGE_UPLOAD_PREFIX = "events";
export const CHAT_IMAGE_UPLOAD_PREFIX = "chat";
export const POST_IMAGE_UPLOAD_PREFIX = "posts";

export const toStorageObjectUrl = (key: string | null | undefined) => {
	if (!key) return null;
	if (key.startsWith("/api/storage/objects/")) return key;

	return `/api/storage/objects/${key
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/")}`;
};

export const isAllowedStorageObjectKey = (key: string) => {
	if (!key || key.startsWith("/") || key.includes("..")) return false;
	return (
		key.startsWith(`${PROFILE_PICTURE_UPLOAD_PREFIX}/`) ||
		/^events\/[^/]+\/[^/]+$/.test(key) ||
		/^posts\/[^/]+\/[^/]+$/.test(key) ||
		/^chat\/[^/]+\/[^/]+\/[^/]+$/.test(key)
	);
};

export const isChatImageObjectKey = (key: string) =>
	key.startsWith(`${CHAT_IMAGE_UPLOAD_PREFIX}/`);

export const isPostImageObjectKey = (key: string) =>
	key.startsWith(`${POST_IMAGE_UPLOAD_PREFIX}/`);
