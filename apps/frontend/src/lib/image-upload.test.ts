/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import type * as ImagePicker from "expo-image-picker";
import { appendPickedImage } from "./image-upload";

describe("appendPickedImage", () => {
	it("keeps the browser File in multipart data", async () => {
		const image = new File(["image"], "photo.png", { type: "image/png" });
		const asset = {
			file: image,
			fileName: image.name,
			height: 1,
			mimeType: image.type,
			uri: "blob:photo",
			width: 1,
		} satisfies ImagePicker.ImagePickerAsset;
		const form = new FormData();

		appendPickedImage(form, "images", asset);

		const uploaded = form.get("images");
		expect(uploaded).toBeInstanceOf(File);
		expect((uploaded as File).name).toBe("photo.png");
		expect(await (uploaded as File).text()).toBe("image");
	});
});
