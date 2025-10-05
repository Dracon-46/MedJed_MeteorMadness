# MedJed_MeteorMadness

# 🌍 Near-Earth Asteroid Tracking and Impact Simulation System

## Challenge 12: Meteor Madness

Advanced visualization and analysis system for **Near-Earth Objects (NEOs)** featuring scientific calculations for estimated impact energy, risk, and a detailed impact simulation analysis.

---

## 🚀 Key Features

### 📊 Real-Time Data Integration
The system leverages three external APIs to provide comprehensive analysis:
1.  **NASA NeoWs API**: Fetches up-to-date data on asteroids with close approaches in the next 7 days.
2.  **WorldPop API**: Provides high-resolution population distribution data for casualty estimation during simulations.
3.  **OpenStreetMap Nominatim**: Used for reverse geocoding to identify the location type (land/ocean) and nearest city name for impact points.

### 🧮 Scientific Calculations

#### 1. **Impact Energy ($\text{E}$)**
The core calculation uses the kinetic energy formula $\text{E} = \frac{1}{2}\text{mv}^2$, where:
* **Mass ($\text{m}$)** is calculated from the asteroid's estimated diameter and a typical rock density ($\sim 2600 \text{ kg/m}^3$).
* **Velocity ($\text{v}$)** is the relative velocity provided by the NASA API.
* The final energy is converted and displayed in **Megatons (MT)**.

#### 2. **Impact Simulation**
When a user selects an asteroid and an impact location:
* **Destruction Zones** are calculated (Total, Severe, Moderate) based on the impact energy.
* **Casualties** are estimated using the WorldPop data to determine population density within the destruction zones and applying a simplified, distance-based mortality model.
* **Mitigation Options** (Deflection Impulse, Destruction Yield, Evacuation Radius) are provided.
* **Secondary Effects** like Seismic Magnitude and Tsunami Risk (for ocean impacts) are estimated.

---

## 🗺️ Map Visualization

### Map Components (Powered by Leaflet.js)
* **Impact Marker**: A pulsating '💥' icon marks the simulated impact point.
* **Destruction Zones**: Concentric circles visually representing the radii of Light, Moderate, Severe, and Total Devastation based on the simulation results.
* **Location Tooltip**: Displays the nearest city or location name at the impact coordinates.

---

## 🛠️ System Architecture

### File Structure
├── index.html              # Main interface, map container, and sidebar structure.
├── script.js               # Core logic, API calls, event handlers, and all calculations.
└── styles.css              # Styling, dark theme, and visual elements.

### Key Components in `script.js`
* **`AsteroidCalculator` Class**: Encapsulates all scientific calculations and the core `simulateImpactAt` logic.
* **`getWorldPopPopulation`**: Handles the asynchronous request flow for the WorldPop API, including GeoJSON polygon creation and task polling.
* **UI Handlers**: Functions like `setupFilters`, `renderAsteroidList`, and `simulateImpact` manage user interaction and update the interface dynamically.

---

## 🔧 How to Use

1.  **API Key**: Ensure your NASA API Key is set in `script.js`.
2.  **Load Data**: The system automatically fetches and displays asteroids approaching Earth in the next week.
3.  **Select Asteroid**: Click on an asteroid card in the sidebar list to enable the simulation.
4.  **Simulate**:
    * Choose **"Click on map"** mode and click a location, **OR**
    * Choose **"Coordinates"** mode and enter Latitude/Longitude.
5.  **View Results**: The map will zoom to the impact point, show destruction zones, and the sidebar will display detailed analysis, including estimated casualties and seismic effects.

---

## ⚠️ Disclaimer

**IMPORTANT**: This system is for **educational and visualization purposes only**. The casualty and impact predictions are based on simplified, heuristic models and WorldPop data, which are not suitable for real-world emergency response.

For official information on asteroid threats, please refer to:
* **NASA CNEOS**: https://cneos.jpl.nasa.gov/
* **ESA NEO**: https://neo.ssa.esa.int/

---

**Version**: 1.0.0
**Status**: Active Development 🚀