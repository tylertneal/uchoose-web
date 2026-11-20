// Walks every screen of the live site on an emulated iPhone (WebKit) with real data.
const { webkit, devices } = require("playwright");
const fs = require("fs");

const URL = process.env.SITE_URL || "https://tylertneal.github.io/uchoose-web/";
const OUT = "test-results";
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext({
    ...devices["iPhone 14"],
    geolocation: { latitude: 35.2271, longitude: -80.8431 }, // Charlotte, NC
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await shot("1-home");

  for (const [i, cat] of ["Fast Food", "Sit Down", "Fine Dining", "Coffee & Cafés", "Dessert"].entries()) {
    await page.evaluate(() => show({ screen: "home" }));
    await page.locator(".card-title", { hasText: cat }).click();
    await page.locator("#wheel-ready:not([hidden]), #wheel-error:not([hidden])").first().waitFor({ timeout: 40000 });
    await page.waitForTimeout(500);
    const names = await page.evaluate(() =>
      document.getElementById("wheel-ready").hidden
        ? ["ERROR: " + document.getElementById("wheel-error-text").textContent]
        : wheelItems.map((p) => p.name));
    console.log(`${cat}: ${names.join(" | ")}`);
    await shot(`${i + 2}-wheel-${cat.toLowerCase().replace(/[^a-z]/g, "")}`);
  }

  // Spin the dessert wheel
  if (await page.locator("#wheel-ready:not([hidden])").count()) {
    await page.click("#spin");
    await page.locator("#result:not([hidden])").waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
    await shot("7-result");
    console.log("Result:", await page.textContent("#result-name"), "->", await page.getAttribute("#directions", "href"));
  }

  console.log("Page errors:", errors.length ? errors.join("\n") : "none");
  await browser.close();
  if (errors.length) process.exit(1);
})();
