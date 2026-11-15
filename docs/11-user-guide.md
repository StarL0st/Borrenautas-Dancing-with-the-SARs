# 11. User guide

How to use G.I.G.A.S on the `jopa-testing` branch, screen by screen. For what the app is and how to run it, see the [README](../README.md).

## 1. First steps

1. Open the app. The welcome screen shows the name over the Earth; press **Start**.
2. The globe pulls back and the panels slide in. The house button (top right of the globe) brings the welcome screen back.
3. Pick a mode in the header: **Simple** (a guide in everyday words) or **Technical** (every detail). You can switch at any time; what you opened stays open.

The header also has **Tutorial** (a guided tour), **How radar sees** (the radar explainer) and **Accessibility** (language, view-wheel size, globe look).

## 2. Moving around the globe

- **Drag** to turn the Earth, **scroll** or use **+ / −** to zoom. Zoomed in far enough, the globe becomes a flat map.
- **Globe view / Close-up view** (top left of the globe): the whole Earth, or a low tilted camera with the horizon in sight.
- **Auto-rotate** and the **view wheel** (square buttons on the right): the wheel moves the camera with Zoom, Orbit, Look, Up/Down, Center and Home, by mouse, touch or arrow keys.
- **The arrows on the globe's edges** push the side panels off screen and pull them back.
- On a phone, the globe sits on top and the panels below, with **Explore** and **Open areas** tabs.

## 3. The left panel

| Part | What it does |
|---|---|
| **Countries** | Type a country and pick it. It is outlined on the globe, and everything (areas, detected changes, live events) is limited to it. Pick more than one if you like; remove one with its chip. |
| **Filters** | Three groups (natural disasters, disasters caused by humans, land use). Each type has an icon, filled when on, outlined when off. "Show N more" opens the rest of a group. Everything on the globe follows the filters. |
| **Happening now** | Live reports from official services, worldwide, from the last 24 hours, newest first. Each row says what, where, how long ago and who reported it; serious and extreme events carry a tag. Click a row to fly there and see the details with the exact report time (UTC) and a link to the source. The badge at the top says these are not NISAR data. |
| **Go to coordinates** (Technical) | Fly to a latitude and longitude. **Process** asks the server to analyze that place with NISAR data. |
| **Areas** | The places with radar data. The status line above the list says whether radar data is connected, still loading, or could not be refreshed. Click a row (or a dot on the globe) to open it. |

If no radar data can be reached, the list shows example places, clearly labelled as examples.

## 4. Simple mode: your guide

In Simple mode the right panel is **Your guide**.

**With no place open**, it explains how to use the map in three steps, what the dot colors mean (orange: nature; pink: caused by people; yellow: how people use the land), who NISAR is, and three words to know.

**With a place open** (click a dot or a row; click it again, or "Back to the guide", to leave), it answers six questions:

1. **What is this place about?** Each kind of change watched here, in one sentence.
2. **What did the space radar see?** On how many days NISAR looked, and what it found ("239 farm fields that changed"). "May have" means the radar thinks so, but people still need to check on the ground.
3. **Look for yourself.**
   - **What kind of picture?** *Space radar (NISAR)* (only where the place has radar pictures), *Close-up photo* (city-sized places), *Whole-region photo*, *Fire view* (burned land looks reddish brown), *Green leaves map*. Each choice says in one sentence what it shows, with its NASA source.
   - **How far back?** 1 month to 5 years. The radar only goes back as far as NISAR has looked; the guide says so when your choice is further back.
   - Drag the white line left and right. Blue means brighter now, orange darker now. If clouds cover the photos, the guide says it cannot count the changes fairly, instead of giving a number.
4. **Did you know?** One true fact about this kind of change, with its source.
5. **Where does this come from?** The radar, the other satellites and the experts' reports, each with its date.
6. **Words to know.**

At the bottom: **Read everything** (the place's report, see section 7) and **I want all the details** (switches to Technical mode and opens the place).

## 5. Technical mode: area cards

Open places stack as tabs in the right panel. Each card has, from top to bottom:

| Part | What it shows |
|---|---|
| **Show on globe, Close** and the **report** controls | See section 7 |
| **Tags and source key** | The types of change, and the kinds of source the card uses: ◆ NISAR radar, ● other satellite, ▲ live report, ■ published record |
| **Radar images** | Pick a layer (backscatter HH or HV, detected change, surface type, ground motion, soil moisture), its opacity, and its date with the slider at the bottom of the globe. Below: a badge with product, channel, maturity and date, the color key, and "Where this comes from" (granules, steps, parameters, software, credit) |
| **Why the radar sees changes here** | Open it for the ideas behind this place's kind of change, each with its sources; **All explanations** opens the full explainer |
| **Compare two dates** | The NISAR radar comparator (section 6): pick the picture (HH or HV backscatter) and the two dates |
| **Satellite view** | NASA GIBS photos in the same comparator: pick the layer (HLS, VIIRS, MODIS fire view, NDVI) and how far back (1 month to 10 years) |
| **Change over time** | Charts of the area's radar values per date, with a table view |
| **What changed** | Notes on the zone, including plants and animals, with the date their sources were checked |
| **Timeline** | The 5 most important detected changes (ranked by confidence × the square root of the area, so large and sure changes come first), newest first; "N more in the full report" opens the report |
| **Remarkable events in this zone** | A strip of years and the 5 most important past events, with their sources |
| **Credits** | The NISAR product citations |

## 6. The before/after comparator

Used for radar (Technical) and for photos (both modes).

| To | Do |
|---|---|
| Swipe between before and after | Drag on the picture (at normal size), or move the **Before / After** slider, or press ← → while the picture has focus |
| Zoom | **+** and **−** buttons, the mouse wheel, a double-click, or the keys + and − (0 resets) |
| Move around when zoomed in | Drag, or the arrow keys |
| Mark what changed | **Mark what changed**: blue for brighter after, orange for darker after |
| Choose how big a change counts | **Changes larger than N%** (Technical). On radar it also shows the dB step: 50% is about 3 dB, the size of change the detection rules use |
| Read the result | "N% of what you see changed: x% brighter, y% darker", measured on what is on screen. For photos, the share of clouds left out is given too |

On photos, zooming in loads a sharper picture of that part after a moment. Photo comparisons are a visual guide (shadows and seasons change colors too); radar comparisons are measured on the echo itself.

## 7. Area reports

Every place has a PDF report, made in the background when you open the place.

- The controls say **Preparing the report…** until it is ready, then **Read the report** and **Download full report (PDF)**. Below them: "Report version N, made …, matches the latest data", and after an update, what the new version changed.
- **Read the report** opens it inside the page: scroll to read; **Download** keeps a copy; **Close** (or a click outside) returns.
- The report updates itself as new data arrives; a download always gives the current version.
- While the detected changes are still loading, the report waits ("The report waits for the detected changes to load"), so it never claims there are none.

What is in a report: [12-pdf-reports.md](12-pdf-reports.md).

## 8. How radar sees

The **How radar sees** button opens seven short ideas with drawings: an echo, not a photo; calm water looks black; corners shine; leaves scatter the wave; wet ground is brighter; measuring centimeters; what can fool it. Each lists its sources, mostly NASA pages.

## 9. Messages you may see

| Message | Meaning |
|---|---|
| Loading radar data… | The area files are still downloading (the detected-changes file is about 2 MB) |
| Radar data connected: N area(s), M detected change(s) | All loaded |
| Could not refresh the radar data; still showing the last results loaded | A refresh failed; nothing was thrown away. It tries again within 5 minutes |
| … the detected changes could not be loaded yet … | First visit only: the areas loaded but their detected changes did not. Reports wait, and it tries again within 5 minutes |
| Radar data server not connected. Showing example locations only | No radar data could be reached; the places shown are examples |
| The pictures could not be loaded. Try again later | A comparator's pictures did not load |

## 10. Languages and accessibility

- **Accessibility** in the header: language (English, Español, Deutsch), view-wheel size, globe look. Switching language also remakes the reports in that language.
- Everything works with the keyboard; types and sources are always named, never shown by color alone; reduced-motion settings are respected.
