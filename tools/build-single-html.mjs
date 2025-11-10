import { build } from "esbuild";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const entryPoint = path.join(rootDir, "scripts", "app.js");
const cssPath = path.join(rootDir, "style.css");
const indexPath = path.join(rootDir, "index.html");
const outputDir = path.join(rootDir, "build");
const outputHtmlPath = path.join(outputDir, "index.html");

async function bundleScript() {
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["es2020"],
    write: false,
    minify: true,
    sourcemap: false
  });

  if (!result.outputFiles?.length) {
    throw new Error("esbuild did not emit any output");
  }

  return result.outputFiles[0].text;
}

async function inlineAssets() {
  const [originalHtml, inlineCss, bundledJs] = await Promise.all([
    fs.readFile(indexPath, "utf8"),
    fs.readFile(cssPath, "utf8"),
    bundleScript()
  ]);

  const styleSafe = inlineCss.replace(/<\/style>/g, "</sty" + "le>");
  const scriptSafe = bundledJs.replace(/<\/script>/g, "</scr" + "ipt>");

  const cssInlined = originalHtml.replace(
    /<link rel="stylesheet" href="style.css">/,
    `<style>${styleSafe}</style>`
  );

  const withoutEntryScript = cssInlined.replace(
    /<script type="module" src="\.\/scripts\/app.js"><\/script>/,
    ""
  );

  const closingTag = "</body>";
  const bodyIndex = withoutEntryScript.lastIndexOf(closingTag);

  if (bodyIndex === -1) {
    throw new Error("Could not find </body> tag in index.html");
  }

  const beforeBody = withoutEntryScript.slice(0, bodyIndex);
  const afterBody = withoutEntryScript.slice(bodyIndex);

  const finalHtml = `${beforeBody}  <script type="module">\n${scriptSafe}\n  </script>\n${afterBody}`;

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputHtmlPath, finalHtml, "utf8");

  const htmlBytes = Buffer.byteLength(finalHtml);
  console.log(`Standalone build written to ${path.relative(rootDir, outputHtmlPath)} (${htmlBytes} bytes).`);
}

inlineAssets().catch((error) => {
  console.error("Failed to create standalone build", error);
  process.exitCode = 1;
});
