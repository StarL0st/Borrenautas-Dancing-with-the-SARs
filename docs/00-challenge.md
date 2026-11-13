# 00. Challenge

Challenge: **Dancing with the SARs** (NASA International Space Apps Challenge 2026, theme "The Next Frontier").
Event dates: November 14-15, 2026. Judging begins November 16.
Challenge page: https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/

The text below was pasted by the team from the challenge page. The "list of resources provided" and the judging criteria were **not** in the pasted text.

---

Earth's surface is an endless dance of natural processes and human activities, but these changes are often difficult to visualize, understand, and communicate. From wetland loss to forest wildfires, earthquakes, farming activities, glacier movement, and more, Earth is in a constant waltz of surface changes. Your challenge is to build an interactive application that uses radar remote sensing data from the NASA-ISRO Synthetic Aperture Radar (NISAR) mission to track and visualize one or more types of surface change at locations around the world.

## Background

Earth remote sensing helps us acquire information from a bird's eye view. Space-borne and airborne instruments image the planet and contribute to Earth observations that help decision makers in lieu of or supplement their field surveys. The most common source of energy that these instruments use is from the Sun, which reflects from objects and surfaces on the ground back to the instrument. The amount of this energy varies by the wavelength within the electromagnetic spectrum, and we can use this spectral fingerprint to identify water, rocks/minerals, vegetation, etc. These instruments that utilize the Sun's energy conduct passive remote sensing while radar instruments, such as those we'll use in this challenge, conduct active remote sensing.

Active instruments emit and receive their own source of energy, and in the case of radar, operate in the microwave band of the electromagnetic spectrum. Radar instruments can be used to study forest structure, soil moisture, wetlands, ocean topography, sea ice, and more. In this challenge, we will download data from SAR (synthetic aperture radar) satellites. SAR "synthesizes" a long antenna by combining a sequence of acquisitions from its actual, shorter antenna to provide higher spatial resolution data. SAR instruments send out a pulse of energy which reacts with the Earth's surface and is reflected back to the instrument. This collection can be done day or night and even in cloudy weather, which allows for critical data collection during disaster events like oil spills, wildfires, hurricanes, etc.

Radar data is most sensitive to two things: roughness and the dielectric constant. In other words, the radar images are more than just typical satellite images that you may see with your GPS app. This roughness information characterizes the backscatter from Earth's surface and different polarizations and can tell us something about structure, geometry, and material properties. Since water has a high dielectric constant, SAR data also highlights water bodies, flood inundation, and soil moisture. SAR can also measure fine surface movement on the centimeter scale, such as for earthquakes and land subsidence.

## Objectives

On Earth's surface there is an endless dance of natural processes and human activities in constant motion, but these changes are often difficult to visualize, understand and communicate. Wetlands and floodplains are constantly extending and retracting; forest footprints are shrinking from deforestation and wildfires; agricultural lands transform their crop types and health, moisture is swelling and shrinking in soils; glaciers and sea ice are in a constant waltz; and land surfaces are deforming from earthquakes and coastal subsidence. All of these changes have important implications for ecosystems, water resources, agriculture and infrastructures, ultimately impacting local communities.

In this challenge, participants will build an interactive application that leverages radar remote sensing data from NISAR to track and visualize one or more types of surface changes, at locations around the world. Participants are encouraged to design intuitive tools and innovative visualizations, such as interactive change-detection maps, time-series animations, or dashboards, that make NISAR data accessible to a broad audience. The desired outcome is an open-source, user-friendly solution that translates complex radar observations into actionable insights, helping scientists, resource managers, educators, decision-makers, and the public better understand the patterns and rhythms of Earth's surface at different time steps.

First, pick an interesting study area - this can be your hometown, a tropical wetland, ice sheet, forest wildfire, flooded neighborhood, volcano eruption, etc. - wherever the music calls you! Second, download freely available NISAR data using the list of resources provided. You may want to download supplemental data such as optical images or GIS (geographic information systems) layers to contextualize the SAR imagery. And lastly, present your findings in an interactive digital medium you prefer: a final report, video, presentation slides, story map - even an interpretive dance? Hypothesize the physical drivers behind what you see (or don't see) in the SAR data. For example, if you are looking at the Amazon Rainforest, why might the vegetation change over time? Which polarizations highlight these changes on land and ice? What future applications of NISAR are possible?

## Potential Considerations

You may (but are not required to) consider the following:

- Analyze NISAR data with different polarizations and/or different frequencies (from other sensors). Download data from different dates to show a time series and ancillary datasets (population, vegetation type, etc.) to contextualize the study area.
- Show how human drivers (agriculture, industry, etc.) are impacting Earth's natural resources.
- Focus on compelling storytelling through data visualizations. Your project summary can be in any digital medium you prefer: a final report, video, presentation slides, story map, etc.
- If you are familiar with your study area (e.g., it's your hometown), you can provide personal context and stories for the SAR imagery.
- Consider making your summary interactive (e.g., image sliders, web maps, etc.).

---

## Extracted requirements (team notes)

Every feature spec references these IDs. If the official page adds requirements, add them here.

| ID | Requirement | Type |
|---|---|---|
| R1 | Build an interactive application using NISAR radar data | Required |
| R2 | Track and visualize one or more types of surface change at one or more locations | Required |
| R3 | Pick a study area (any location) | Required |
| R4 | Use freely available NISAR data from the provided resources | Required |
| R5 | Optionally add supplemental data (optical images, GIS layers) for context | Optional |
| R6 | Present findings in an interactive digital medium (report, video, slides, story map, etc.) | Required |
| R7 | Hypothesize the physical drivers behind what is seen (or not seen) in the SAR data | Required |
| R8 | Address: which polarizations highlight the changes? What future NISAR applications are possible? | Required (guiding questions) |
| R9 | Outcome should be open-source, user-friendly, and turn radar observations into actionable insight for scientists, resource managers, educators, decision-makers, and the public | Required (desired outcome) |
| R10 | Optional: multiple polarizations or frequencies, time series from different dates, ancillary datasets, human-driver framing, storytelling, personal context, interactivity (sliders, web maps) | Optional |

Open question: judging criteria are not in the pasted text. Check the official page and add them here as J1, J2, ... so specs can trace to them.
