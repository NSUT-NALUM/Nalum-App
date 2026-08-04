import { join } from "node:path";

import { renderTemplate } from "./render-template";

const moduleName = process.argv[2];

if (!moduleName) {
	console.error("Usage: bun run generate:module <name>");
	process.exit(1);
}

const moduleDir = join(
	process.cwd(),
	"apps",
	"backend",
	"src",
	"modules",
	moduleName,
);

const templateDir = join(process.cwd(), "scripts", "templates", "module");

const templates = [
	["controller.template.txt", `${moduleName}.controller.ts`],
	["service.template.txt", `${moduleName}.service.ts`],
	["repository.template.txt", `${moduleName}.repository.ts`],
	["routes.template.txt", `${moduleName}.routes.ts`],
	["schema.template.txt", `${moduleName}.schema.ts`],
	["types.template.txt", `${moduleName}.types.ts`],
	["constants.template.txt", `${moduleName}.constants.ts`],
	["errors.template.txt", `${moduleName}.errors.ts`],
	["test.template.txt", `${moduleName}.test.ts`],
] as const;

if (await Bun.file(moduleDir).exists()) {
	console.error(`Module "${moduleName}" already exists.`);
	process.exit(1);
}

await Bun.$`mkdir -p ${moduleDir}`;

for (const [templateFile, outputFile] of templates) {
	const templatePath = join(templateDir, templateFile);

	const template = await Bun.file(templatePath).text();

	const rendered = renderTemplate(template, moduleName);

	await Bun.write(join(moduleDir, outputFile), rendered);
}

console.log(`Created module "${moduleName}"`);
