// Tiny static server for testing a commit on the CI runner.
const http = require("http"), fs = require("fs"), path = require("path");
const root = fs.realpathSync(path.resolve(__dirname, ".."));
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const assets = new Set([
  "/index.html", "/styles.css", "/app.js", "/sw.js", "/manifest.webmanifest",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png", "/icons/icon.svg",
]);

http.createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }

  let route;
  try {
    route = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (route === "/") route = "/index.html";
  if (!assets.has(route)) {
    res.writeHead(404);
    return res.end();
  }

  let body;
  try {
    const file = await fs.promises.realpath(path.join(root, route));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(404);
      return res.end();
    }
    body = await fs.promises.readFile(file);
  } catch {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { "Content-Type": types[path.extname(route)], "Content-Length": body.length });
  res.end(req.method === "HEAD" ? undefined : body);
}).listen(8080, "127.0.0.1");
