# Project Documentation: Asteroid Tracker - Impact Simulator

## Overview

The **Asteroid Tracker - Impact Simulator** provides a visual and data-driven platform for exploring the close approaches of Near-Earth Objects (NEOs). Its primary function is to simulate potential impact events, calculating kinetic energy, defining destruction zones, and estimating population impact using external APIs.

## APIs and Dependencies

The system relies on the following external services and libraries:

| API / Library | Purpose | Link / Documentation |
|---|---|---|
| **NASA NeoWs API** | Near Earth Object data (close approach, size, velocity). | https://data.nasa.gov/dataset/near-earth-comets-orbital-elements-api |
| **WorldPop API** | Global population distribution data (used for casualty estimates). | https://www.worldpop.org/ |
| **OpenStreetMap Nominatim** | Reverse geocoding for identifying location type (land/ocean) and nearest place names. | https://nominatim.openstreetmap.org |
| **Leaflet.js** | Interactive mapping library. | https://leafletjs.com/ |
| **OpenStreetMap Tiles** | Base map tiles. | https://www.openstreetmap.org/ |

## Core Calculations and Models

All core calculations are contained within the `AsteroidCalculator` class in `script.js`.

### 1. Kinetic Energy ($E$)

The energy of impact is derived from the standard kinetic energy equation:

$$E = \frac{1}{2} m v^2$$

* **Mass ($\text{m}$)**: Calculated by assuming a spherical volume based on the maximum estimated diameter and a density of $2600 \text{ kg/m}^3$ (typical rocky asteroid).
* **Result**: Converted from Joules to **Megatons (MT)**.

### 2. Destruction Zones and Crater Radius

The **Crater Radius** is calculated using a simplified empirical formula:

$$\text{Crater Radius (km)} \approx 1.8 \cdot \text{Diameter}^{0.13} \cdot \text{Energy}^{0.29}$$

Destruction Zones are defined as heuristic multiples of the calculated Crater Radius:
* **Total Devastation**: $\text{Crater Radius} \times 2$
* **Severe Destruction**: $\text{Crater Radius} \times 5$
* **Moderate Damage**: $\text{Crater Radius} \times 10$
* **Light Effects**: $\text{Crater Radius} \times 20$

### 3. Estimated Casualties (Heuristic Model)

The casualty count is an estimate based on population density derived from the WorldPop API query:

1.  **Density Sampling**: The WorldPop API is queried for the total population within a limited radius (max $178 \text{ km}$) around the impact point. Average density ($\text{Pop}/\text{Area}$) is calculated.
2.  **Extrapolation**: This average density is extrapolated to the full area covered by the moderate damage zone.
3.  **Mortality Rate**: Fixed mortality rates are applied to the estimated population in each zone:
    * **Total Devastation**: $100\%$
    * **Severe Destruction**: $70\%$
    * **Moderate Damage**: $30\%$
4.  **Final Correction**: The final casualty count is capped to ensure it does not exceed the total population actually sampled by the WorldPop query, providing a conservative upper limit.

### 4. Secondary Effects

* **Seismic Magnitude**: Calculated heuristically: $\text{M} \approx 4.0 + \log_{10}(\text{Energy in MT})$.
* **Tsunami Risk (Ocean Impacts)**: Simplified estimates for wave height and range based on impact energy.

---

## `script.js` Implementation Details

### Asynchronous WorldPop Polling

The WorldPop API operates asynchronously, requiring a two-step process:

1.  **Task Creation**: `getWorldPopPopulation` sends a request with the GeoJSON polygon to create a task, receiving a `taskid`.
2.  **Task Monitoring**: `pollWorldPopTask` enters a loop, querying the status endpoint (`/v1/tasks/{taskid}`) every second, up to 30 attempts, until the status is `finished` or `failed`.

### GeoJSON Polygon Generation

The `createImpactPolygon` function generates the GeoJSON circle required by the WorldPop API using navigational formulas (similar to the Haversine formula) to calculate destination coordinates given a starting point (lat/lon), distance (radiusKm), and bearing.

### Initial Data Load

The `loadNASAData` function fetches 7 days of NEO data and creates initial list entries, assigning a simplified **Risk** category based solely on the miss distance:

* **High**: Miss Distance $< 500,000 \text{ km}$
* **Medium**: Miss Distance $< 2,000,000 \text{ km}$
* **Low**: Miss Distance $\ge 2,000,000 \text{ km}$

---

## Mitigation Options

The mitigation section provides generalized, heuristic recommendations based on the asteroid's size and the calculated energy:

| Option | Calculation Basis | Units |
|---|---|---|
| **Deflection (Impulse Rocket)** | Simplified estimate of GigaNewtons (GN) of impulse required. | GN |
| **Destruction (Nuclear Yield)** | Comparison to the number of Hiroshima-equivalent bombs (0.015 MT) required for fragmentation. | Hiroshima Bombs |
| **Evacuation (Radius)** | Heuristic radius based on the Severe Destruction Zone. | km |

---

## Usage and Limitations

* **Purpose**: Educational visualization and data exploration only.
* **Limitation**: WorldPop queries are limited to a $\mathbf{178 \text{ km}}$ radius. If the Moderate Damage zone exceeds this, population density is still estimated from the sampled $178 \text{ km}$ area and extrapolated.
* **Data Accuracy**: The simulation relies on NASA's estimated diameters and orbital parameters. The impact location must be provided by the user, as the true orbital mechanics for impact prediction are highly complex.