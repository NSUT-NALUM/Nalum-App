import { join } from "node:path";

import { renderTemplate } from "./render-template";

const middleware = process.argv[2];

if (!middleware) {
	console.error("Usage: bun run generate:middleware <name>");
	process.exit(1);
}

const middlewareDir = join(
	process.cwd(),
	"apps",
	"backend",
	"src",
	"middlewares",
);

const templateDir = join(process.cwd(), "scripts", "templates", "middleware");

await Bun.$`mkdir -p ${middlewareDir}`;

const file = join(middlewareDir, `${middleware}.middleware.ts`);

if (await Bun.file(file).exists()) {
	console.error(`Middleware "${middleware}" already exists.`);
	process.exit(1);
}

const templatePath = join(templateDir, "middleware.template.txt");

const template = await Bun.file(templatePath).text();

const rendered = renderTemplate(template, middleware);

await Bun.write(file, rendered);

console.log(`Created middleware "${middleware}"`);
