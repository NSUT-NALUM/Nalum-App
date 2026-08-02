import type * as ImagePicker from "expo-image-picker";

export function appendPickedImage(
	form: FormData,
	field: string,
	image: ImagePicker.ImagePickerAsset,
) {
	if (image.file) {
		form.append(field, image.file);
		return;
	}

	form.append(field, {
		uri: image.uri,
		name: image.fileName ?? "image.jpg",
		type: image.mimeType ?? "image/jpeg",
	} as unknown as Blob);
}
