<div align="center">

# uChoose (web)

**Can't decide where to eat? Let the wheel decide.**

The iPhone-friendly version of [uChoose](https://github.com/tylertneal/uchoose).
It runs in your phone's browser and installs on your home screen like a regular app.

### [**▶ Open uChoose**](https://tylertneal.github.io/uchoose-web/)

</div>

---

## Add it to your home screen

**iPhone (Safari)**
1. Open **[tylertneal.github.io/uchoose-web](https://tylertneal.github.io/uchoose-web/)** in **Safari**.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Open uChoose from your home screen and tap **Allow** when it asks for your location.

**Android (Chrome)**
1. Open the link in **Chrome**.
2. Tap the **⋮** menu, then **Add to Home screen** (or **Install app**).

> **Note:** It opens full screen with its own icon, just like an app from the store. No App Store, account or download needed, and updates arrive automatically the next time you open it.

---

## What it does

Exactly what the Android app does:

- **Five choices:** Fast Food, Sit Down, Fine Dining, Coffee & Cafés and Dessert.
- **Distance picker:** only shows places within 1, 3, 5, 10, 15 or 25 miles.
- **The wheel:** up to 12 nearby places. Tap **SPIN** and let fate decide.
- **Directions:** opens Apple Maps on iPhone and Google Maps on Android.
- **Hide places you don't like:** press and hold a name on the wheel, or tap *Don't show this place again* on the result screen. That place is hidden at **every location**. Bring places back from **Hidden places** on the home screen.

> **Note:** Your distance setting and hidden places are saved in this browser on this phone. They don't sync with the Android app or other devices.

---

## Where the data comes from

Restaurant information comes from **[OpenStreetMap](https://www.openstreetmap.org)**, a free map of the world built by volunteers, looked up through **[Nominatim](https://nominatim.org)**, OpenStreetMap's search service. It's free and needs no API key.
*Restaurant data © OpenStreetMap contributors.*

Prices, ratings and photos aren't included. "Fine Dining" is a best guess based on cuisine and name. If a place is missing or wrong, you can **[fix it on OpenStreetMap](https://www.openstreetmap.org/fixthemap)**.

---

## Privacy

Your location is only used to search for places near you. The app sends the search area to Nominatim and nothing else: no account, tracking or ads.

---

<details>
<summary>For developers</summary>

<br>

Plain HTML, CSS and JavaScript with no build step, hosted on GitHub Pages.

| File | What it does |
|---|---|
| `index.html` | The screens |
| `styles.css` | Colors, fonts, layout (always fits one screen) |
| `app.js` | Location, restaurant search, wheel, hiding, settings |
| `manifest.webmanifest`, `icons/` | Home-screen app name and icon |
| `sw.js` | Keeps the app's files on the phone so it opens instantly |

When you change app files, bump `VERSION` in `sw.js` so phones pick up the update.

The **iPhone test** workflow opens the live site in Safari's engine (WebKit) at iPhone size, with a test location, and saves screenshots of every screen.

</details>
