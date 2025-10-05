//The code has the help of artificial intelligence in its development, but it was managed, developed and tested by humans.

// NASA API Key for the Near-Earth Object Web Service (NeoWs)
const NASA_API_KEY = "ldWa4kJ2AqQpyh6sMK46LzcCcuF7fSDiiIAWr5ij"; // Use "DEMO_KEY" for testing
// WorldPop dataset for population querying (WorldPop Global Project Population)
const WORLDPOP_DATASET = "wpgppop"; 
// WorldPop year to query
const WORLDPOP_YEAR = 2020;
let asteroidsData = []; // Array to store processed NEO data
let map, selectedAsteroid = null, simulationMarker = null, simulationZones = []; // Map and state variables

// The maximum radius allowed for a single WorldPop query (Area <= 100,000 km²)
const WORLDPOP_MAX_RADIUS_KM = 178; 

/**
 * Displays the full-screen loading overlay with a custom message.
 * @param {string} message - The message to display in the loading spinner.
 */
function showLoading(message) {
    document.getElementById('loadingMessage').textContent = message;
    document.getElementById('loadingOverlay').style.display = 'flex';
}

/**
 * Hides the full-screen loading overlay.
 */
function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

/**
 * Retrieves location information (city, country, type: land/ocean) using OpenStreetMap Nominatim.
 * @param {number} lat - Latitude of the impact point.
 * @param {number} lon - Longitude of the impact point.
 * @returns {Promise<Object>} - Object with location details.
 */
async function getLocationInfo(lat, lon) {
    try {
        // Reverse geocoding API endpoint
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
            { headers: { 'User-Agent': 'AsteroidTracker/1.0' }} // Required by Nominatim
        );
        const data = await response.json();
        
        // Determine if the location is an ocean based on response data
        const isOcean = !data.address || data.display_name.includes('Ocean') || 
                         data.display_name.includes('Sea') || data.error === 'Unable to geocode';
        
        let locationType = isOcean ? 'ocean' : 'land';
        let locationName = 'Ocean';
        let country = null;
        let city = null;
        
        if (!isOcean && data.address) {
            country = data.address.country || 'Land';
            // Find the most specific urban name
            city = data.address.city || data.address.town || data.address.village || 
                       data.address.county || data.address.state || null;
            
            locationName = city ? `${city}, ${country}` : country;
        }
        
        return { type: locationType, name: locationName, country, city, fullData: data };
    } catch (error) {
        console.error('Error fetching location:', error);
        return { type: 'unknown', name: 'Unknown Location', country: null, city: null };
    }
}

/**
 * Creates a GeoJSON polygon representing a circle around a central point.
 * Used to define the area for the WorldPop query.
 * @param {number} lat - Center latitude.
 * @param {number} lon - Center longitude.
 * @param {number} radiusKm - Radius of the circle in kilometers.
 * @param {number} segments - Number of segments for the polygon (higher = smoother circle).
 * @returns {Object} - GeoJSON FeatureCollection object.
 */
function createImpactPolygon(lat, lon, radiusKm, segments = 32) {
    const coords = [];
    const earthRadiusKm = 6371;
    // Central angle calculation using Haversine formula base
    const centralAngle = radiusKm / earthRadiusKm; 

    for (let i = 0; i <= segments; i++) {
        const bearing = i * (360 / segments);
        
        const latRad = lat * (Math.PI / 180);
        const lonRad = lon * (Math.PI / 180);
        const bearingRad = bearing * (Math.PI / 180);

        // Formulas for destination point given distance and bearing
        const newLatRad = Math.asin(
            Math.sin(latRad) * Math.cos(centralAngle) +
            Math.cos(latRad) * Math.sin(centralAngle) * Math.cos(bearingRad)
        );
        const newLonRad = lonRad + Math.atan2(
            Math.sin(bearingRad) * Math.sin(centralAngle) * Math.cos(latRad),
            Math.cos(centralAngle) - Math.sin(latRad) * Math.sin(newLatRad)
        );

        // Convert back to degrees (Lon, Lat for GeoJSON)
        coords.push([newLonRad * (180 / Math.PI), newLatRad * (180 / Math.PI)]);
    }

    return {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "Polygon",
                "coordinates": [coords] 
            }
        }]
    };
}

/**
 * Polls the WorldPop task status until finished or failed.
 * @param {string} taskId - The ID of the WorldPop asynchronous task.
 * @returns {Promise<number>} - The total population count.
 * @throws {Error} If the task fails or times out.
 */
async function pollWorldPopTask(taskId) {
    let status = 'created';
    let data = null;
    const maxAttempts = 30; // 30 seconds timeout
    let attempt = 0;

    while (status !== 'finished' && status !== 'failed' && attempt < maxAttempts) {
        attempt++;
        showLoading(`Monitoring Task ${taskId.substring(0, 4)}... (Attempt ${attempt}/${maxAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        try {
            const url = `https://api.worldpop.org/v1/tasks/${taskId}`;
            const res = await fetch(url);
            data = await res.json();
            status = data.status;

            if (status === 'finished') {
                if (data.data && typeof data.data.total_population === 'number') {
                    return data.data.total_population || 0;
                }
                throw new Error('WorldPop result finished, but no population data.');
            } else if (status === 'failed') {
                throw new Error(data.error_message || 'WorldPop task failed.');
            }
        } catch (error) {
            throw new Error(`Communication with WorldPop failed.`);
        }
    }

    if (status !== 'finished') {
        throw new Error('Timeout exceeded while waiting for WorldPop task.');
    }
}

/**
 * Initiates and monitors a WorldPop API request to get population within a radius.
 * @param {number} lat - Center latitude.
 * @param {number} lon - Center longitude.
 * @param {number} radiusKm - Radius in kilometers (must be <= WORLDPOP_MAX_RADIUS_KM).
 * @returns {Promise<Object>} - Object containing population count and source.
 * @throws {Error} If the radius is too large or API communication fails.
 */
async function getWorldPopPopulation(lat, lon, radiusKm) {
    if (radiusKm > WORLDPOP_MAX_RADIUS_KM) {
        throw new Error(`Radius (${radiusKm.toFixed(1)} km) exceeds WorldPop limit (${WORLDPOP_MAX_RADIUS_KM} km).`);
    }

    try {
        // Create the GeoJSON polygon for the query
        const geojson = createImpactPolygon(lat, lon, radiusKm);
        const geojsonString = JSON.stringify(geojson);

        // URL to create the WorldPop stats task
        const createUrl = `https://api.worldpop.org/v1/services/stats?dataset=${WORLDPOP_DATASET}&year=${WORLDPOP_YEAR}&geojson=${encodeURIComponent(geojsonString)}`;
        
        showLoading(`Sending impact polygon (Radius ${radiusKm.toFixed(0)} km) to WorldPop...`);
        const createRes = await fetch(createUrl);
        
        if (!createRes.ok) {
            throw new Error(`Failed to create WorldPop task: Status ${createRes.status}`);
        }

        const createData = await createRes.json();
        
        if (createData.error || !createData.taskid) {
            throw new Error(`Error creating WorldPop task: ${createData.error_message || 'No Task ID'}`);
        }
        
        const taskId = createData.taskid;
        const population = await pollWorldPopTask(taskId); // Wait for the result

        return {
            population: Math.round(population),
            source: `WorldPop (${WORLDPOP_YEAR})`
        };

    } catch (e) {
        console.error(`Failed to get WorldPop population:`, e);
        throw new Error(`Critical failure getting population data: ${e.message}`);
    } finally {
        // Ensure loading screen is hidden in all cases
        // This is handled in simulateImpactAt to avoid flashing during polling
        // hideLoading(); 
    }
}

/**
 * Class to perform all scientific calculations for a single NEO.
 */
class AsteroidCalculator {
    constructor(neo, approach) {
        this.neo = neo; // Full NEO data from NASA
        this.approach = approach; // Closest approach data
    }

    /**
     * Calculates the estimated kinetic energy of impact in megatons (MT).
     * E = 0.5 * m * v^2
     * @returns {number} - Impact energy in megatons.
     */
    calculateImpactEnergy() {
        const diameter = this.neo.estimated_diameter.kilometers.estimated_diameter_max;
        const velocity = parseFloat(this.approach.relative_velocity.kilometers_per_second);
        const radius = (diameter * 1000) / 2; // Radius in meters
        
        // Volume of a sphere
        const volume = (4/3) * Math.PI * Math.pow(radius, 3);
        const mass = volume * 2600; // Mass in kg (density = 2600 kg/m³)
        
        // Energy in Joules (velocity must be in m/s)
        const energyJoules = 0.5 * mass * Math.pow(velocity * 1000, 2);
        
        // Convert Joules to Megatons (1 MT = 4.184e15 Joules)
        return energyJoules / 4.184e15;
    }

    /**
     * Calculates basic mitigation estimates based on energy and diameter.
     * These are simplified, heuristic values for visualization.
     * @param {number} energy - Impact energy in megatons.
     * @param {number} diameter - Asteroid diameter in km.
     * @returns {Object} - Mitigation details.
     */
    calculateMitigation(energy, diameter) {
        // Simplified calculation for required deflection force
        const impulseForce = (diameter * energy * 0.1).toFixed(2); 
        // Destruction yield comparison (0.015 MT = Hiroshima)
        const destructionYield = (diameter * energy * 0.5 / 0.015).toFixed(0); 
        // Simple crater radius formula (empirical)
        const craterRadius = 1.8 * Math.pow(diameter, 0.13) * Math.pow(energy, 0.29);
        const severeRadius = craterRadius * 5; // Heuristic for severe damage evacuation zone
        
        return {
            deflection: `${impulseForce} GN`, // GigaNewtons of impulse
            destruction: `${destructionYield} Hiroshima bombs (15kt)`,
            evacuationRadius: `${severeRadius.toFixed(1)} km`
        };
    }

    /**
     * Simulates the impact at a specific coordinate, calculates destruction zones and casualties.
     * This is the core simulation function.
     * @param {number} lat - Impact latitude.
     * @param {number} lon - Impact longitude.
     * @returns {Promise<Object>} - Full simulation results.
     */
    async simulateImpactAt(lat, lon) {
        const energy = this.calculateImpactEnergy();
        const diameter = this.neo.estimated_diameter.kilometers.estimated_diameter_max;
        
        // Recalculate crater radius
        const craterRadius = 1.8 * Math.pow(diameter, 0.13) * Math.pow(energy, 0.29);
        
        // Get location info first to determine land/ocean
        const locationInfo = await getLocationInfo(lat, lon);
        const isOcean = locationInfo.type === 'ocean';
        
        // Define destruction zones radii (heuristic multiples of crater radius)
        const zones = {
            totalDevastation: craterRadius * 2, 
            severeDestruction: craterRadius * 5, 
            moderateDamage: craterRadius * 10, 
            lightEffects: craterRadius * 20
        };

        let totalEstimatedCasualties = 0;
        let populationSource = 'Ocean / No casualties';
        let nearestCity = locationInfo.city;

        if (!isOcean) {
            
            const totalRadius = zones.moderateDamage; // Use moderate damage radius for initial population query
            let queryRadiusKm = Math.min(totalRadius, WORLDPOP_MAX_RADIUS_KM);
            let totalPopInZone = 0; // Actual population found by WorldPop

            try {
                // 1. Query WorldPop for population in the *limited* area
                const popData = await getWorldPopPopulation(lat, lon, queryRadiusKm); 
                
                totalPopInZone = popData.population; 
                populationSource = popData.source;

                // 2. Casualties Calculation (Heuristic Model)

                const zoneMortality = [
                    { radius: zones.totalDevastation, mortality: 1.0 },
                    { radius: zones.severeDestruction, mortality: 0.7 },
                    { radius: zones.moderateDamage, mortality: 0.3 }
                ];
                
                const totalAreaKm2 = Math.PI * totalRadius * totalRadius; 
                let avgDensity = 0;

                // Calculate average density from the WorldPop query
                if (totalPopInZone > 0 && queryRadiusKm > 0) {
                    const queryAreaKm2 = Math.PI * queryRadiusKm * queryRadiusKm;
                    avgDensity = totalPopInZone / queryAreaKm2;
                    
                    populationSource = `${popData.source} (Query Radius: ${queryRadiusKm.toFixed(0)} km)`;
                } else {
                     // Fallback density for unpopulated areas or if query failed
                     avgDensity = 50; 
                     populationSource = `${popData.source} - Population 0 / Base density used`;
                }
                
                let previousRadius = 0;
                
                // Estimate population and casualties for each zone
                for (const zone of zoneMortality) {
                    const areaRadius = zone.radius; 
                    const totalCurrentArea = Math.PI * areaRadius * areaRadius;
                    const previousAreaKm2 = Math.PI * previousRadius * previousRadius;
                    const currentZoneArea = totalCurrentArea - previousAreaKm2;
                    const estimatedPopInZone = Math.round(avgDensity * currentZoneArea);
                    const casualtiesInZone = Math.round(estimatedPopInZone * zone.mortality);
                    totalEstimatedCasualties += casualtiesInZone;
                    previousRadius = areaRadius;
                }
                
                // FINAL CORRECTION: Limit extrapolated deaths to the total sampled population
                if (totalPopInZone > 0) {
                     totalEstimatedCasualties = Math.min(totalEstimatedCasualties, totalPopInZone);
                }

                // Absolute upper limit for casualty display
                totalEstimatedCasualties = Math.min(totalEstimatedCasualties, 10000000); 
                
            } catch (error) {
                console.warn(`Simulation: Failed to get WorldPop data: ${error.message}`);
                populationSource = `WorldPop Query Failed: ${error.message.substring(0, 50)}...`;
                totalEstimatedCasualties = 0;
            }
        }
        
        // Climate and Tsunami Effects
        let climateEffects = [];
        if (energy > 100) climateEffects.push("Local impact winter");
        if (energy > 1000) climateEffects.push("Regional nuclear winter");
        if (energy > 10000) climateEffects.push("Global mass extinction");
        
        let tsunamiRisk = null;
        if (isOcean) {
            // Simplified Tsunami model (heuristic based on energy)
            tsunamiRisk = {
                height: Math.min(Math.sqrt(energy / 10), 100).toFixed(1), 
                range: Math.min(Math.sqrt(energy / 10), 100) * 50 // Heuristic range in km
            };
        }

        // Energy Comparison Text
        let comparison = "";
        if (energy < 0.001) comparison = `${(energy * 1000).toFixed(1)} kilotons - Similar to Hiroshima`;
        else if (energy < 1) comparison = `${Math.round(energy * 1000 / 15)} Hiroshima bombs`;
        else if (energy < 50) comparison = `${energy.toFixed(1)} megatons - Thermonuclear bomb`;
        else if (energy < 1000) comparison = `${energy.toFixed(0)} megatons - Global nuclear arsenal`;
        else comparison = `${(energy / 1000).toFixed(1)} gigatons - Regional extinction`;
        
        return {
            coordinates: { lat, lon },
            location: locationInfo.name,
            locationType: locationInfo.type,
            isOcean: isOcean,
            city: locationInfo.city,
            country: locationInfo.country,
            energy,
            craterRadius,
            zones,
            earthquakeMagnitude: (4.0 + Math.log10(energy)).toFixed(1), // Heuristic seismic magnitude
            estimatedCasualties: totalEstimatedCasualties,
            populationSource: populationSource,
            nearestCity: nearestCity,
            climateEffects,
            tsunamiRisk,
            comparison,
            mitigation: this.calculateMitigation(energy, diameter)
        };
    }

    /**
     * Calculates initial base properties for the asteroid list.
     * Note: This assigns random impact coordinates, which are not used in the final simulation.
     * @returns {Object} - Initial asteroid data for the list.
     */
    calculate() {
        // Random impact coordinates for map markers (not used for the user-driven simulation)
        let lat = (Math.random() * 160) - 80;
        let lon = (Math.random() * 360) - 180; 
        const energy = this.calculateImpactEnergy();

        return {
            name: this.neo.name,
            neo: this.neo,
            approach: this.approach,
            date: new Date(this.approach.close_approach_date).toLocaleDateString('en-US'),
            distance: parseFloat(this.approach.miss_distance.kilometers),
            velocity: parseFloat(this.approach.relative_velocity.kilometers_per_second),
            diameter: this.neo.estimated_diameter.kilometers.estimated_diameter_max,
            impactCoords: { lat: Math.max(-85, Math.min(85, lat)), lon },
            energy: energy,
            // Simple risk classification based on miss distance
            risk: parseFloat(this.approach.miss_distance.kilometers) < 500000 ? 'high' : 
                  parseFloat(this.approach.miss_distance.kilometers) < 2000000 ? 'medium' : 'low'
        };
    }
}

/**
 * Initializes the Leaflet map object and sets the initial view.
 */
function initMap() {
    // Initialize map centered at [20, 0] with zoom level 2
    map = L.map('worldMap', { center: [20, 0], zoom: 2, minZoom: 2, maxZoom: 10 });
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
}

/**
 * Fetches Near-Earth Object data from the NASA NeoWs API for the next 7 days.
 * @returns {Promise<Array>} - Array of processed asteroid data objects.
 */
async function loadNASAData() {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const end = new Date();
        end.setDate(end.getDate() + 7); // Search for the next 7 days
        const endDate = end.toISOString().slice(0, 10);
        
        const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${endDate}&api_key=${NASA_API_KEY}`;
        
        const res = await fetch(url);
        // Throw an error if the API response is not OK (e.g., rate limit)
        if (!res.ok) {
             throw new Error(`NASA API returned status ${res.status}. Check API Key or rate limit.`);
        }

        const data = await res.json();
        
        const all = [];
        // Iterate through all near-earth objects by date
        for (const date in data.near_earth_objects) {
            data.near_earth_objects[date].forEach(neo => {
                if (neo.close_approach_data && neo.close_approach_data.length > 0) {
                     // Use the first close approach data point
                     const calc = new AsteroidCalculator(neo, neo.close_approach_data[0]);
                     all.push(calc.calculate());
                }
            });
        }
        // Limit the number of asteroids for better performance
        return all.slice(0, 50); 
    } catch (err) {
        console.error("Error loading data:", err);
        return [];
    }
}

/**
 * Renders the asteroid list in the sidebar based on the provided data.
 * @param {Array} data - The array of asteroid objects to display.
 */
function renderAsteroidList(data) {
    const list = document.getElementById("asteroidList");
    
    if (data.length === 0) {
        list.innerHTML = `<div class="loading" style="color:#9ca3af; font-size: 14px;">No asteroids found with the applied filters.</div>`;
        return;
    }

    // Map asteroid data to HTML cards
    list.innerHTML = data.map((a, i) => `
        <div class="asteroid-card" data-index="${a._originalIndex}" data-id="${a.name}">
            <div class="asteroid-name">${a.name}</div>
            <div class="asteroid-info">Approach Date: ${a.date}</div>
            <div class="asteroid-info">Distance: ${(a.distance / 1000).toFixed(0)} thousand km</div>
            <div class="asteroid-info">Diameter: ${a.diameter.toFixed(2)} km</div>
            <div class="asteroid-info">Est. Energy: ${a.energy.toFixed(1)} megatons</div>
            <span class="risk-indicator risk-${a.risk}">
                ${a.risk.toUpperCase()} RISK
            </span>
        </div>
    `).join("");
    
    // Maintain selection highlight if an asteroid is selected
    if (selectedAsteroid) {
        const card = document.querySelector(`[data-id="${selectedAsteroid.name}"]`);
        if (card) card.classList.add('selected');
    }
}

/**
 * Updates the statistical counters in the sidebar.
 * @param {Array} data - The array of asteroids to count from.
 */
function updateStats(data) {
    document.getElementById("totalAsteroids").textContent = data.length;
    document.getElementById("highRisk").textContent = data.filter(a => a.risk === "high").length;
    document.getElementById("mediumRisk").textContent = data.filter(a => a.risk === "medium").length;
    document.getElementById("lowRisk").textContent = data.filter(a => a.risk === "low").length;
}

/**
 * Attaches event listeners to filter inputs.
 */
function setupFilters() {
    const filterElements = [
        document.getElementById('filterName'),
        document.getElementById('filterRisk'),
        document.getElementById('filterDistance'),
        document.getElementById('filterDiameter')
    ];

    filterElements.forEach(el => el.addEventListener('input', applyFilters));
}

/**
 * Filters the main `asteroidsData` array based on current filter values and re-renders the list.
 */
function applyFilters() {
    const name = document.getElementById('filterName').value.toLowerCase();
    const risk = document.getElementById('filterRisk').value;
    // Convert distance filter to kilometers
    const maxDistance = parseFloat(document.getElementById('filterDistance').value) * 1000;
    const minDiameter = parseFloat(document.getElementById('filterDiameter').value);

    const filtered = asteroidsData.filter(a => {
        if (name && !a.name.toLowerCase().includes(name)) return false;
        if (risk && a.risk !== risk) return false;
        if (!isNaN(maxDistance) && a.distance > maxDistance) return false;
        if (!isNaN(minDiameter) && a.diameter < minDiameter) return false;
        return true;
    });

    renderAsteroidList(filtered);
    updateStats(filtered);
}

/**
 * Sets up all listeners for the impact simulator controls and the asteroid list.
 */
function setupSimulator() {
    // Toggle visibility of coordinate inputs based on selection mode
    document.querySelectorAll('input[name="selectionMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('coordsInput').style.display = e.target.value === 'coords' ? 'block' : 'none';
        });
    });

    // Handle map click for simulation when mode is set to 'click'
    map.on('click', async (e) => {
        const mode = document.querySelector('input[name="selectionMode"]:checked').value;
        if (mode === 'click' && selectedAsteroid) {
            await simulateImpact(e.latlng.lat, e.latlng.lng);
        } else if (mode === 'click' && !selectedAsteroid) {
            alert('Please select an asteroid from the list on the right first!');
        }
    });
    
    // Handle manual coordinate input simulation button click
    document.getElementById('simulateBtn').addEventListener('click', async () => {
        if (!selectedAsteroid) return alert('Please select an asteroid from the list on the right!');
        
        const mode = document.querySelector('input[name="selectionMode"]:checked').value;
        
        if (mode === 'coords') {
            const lat = parseFloat(document.getElementById('latInput').value);
            const lon = parseFloat(document.getElementById('lonInput').value);
            // Validation for coordinates
            if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                 return alert('Invalid coordinates! Use Lat: -90 to 90 and Lon: -180 to 180.');
            }
            await simulateImpact(lat, lon);
        } else {
            alert('Click on the map to choose the impact location!');
        }
    });

    // Handle asteroid list card click
    document.getElementById('asteroidList').addEventListener('click', (e) => {
        const card = e.target.closest('.asteroid-card');
        if (card) {
            // Remove selection from all cards
            document.querySelectorAll('.asteroid-card').forEach(c => c.classList.remove('selected'));
            // Select the clicked card
            card.classList.add('selected');

            const index = card.getAttribute('data-index');
            // Store the full data for the selected asteroid
            selectedAsteroid = asteroidsData[parseInt(index)];
            
            // Update UI elements
            document.getElementById('currentAsteroidName').textContent = selectedAsteroid.name;
            document.getElementById('selectedAsteroidInfo').style.display = 'block';
            document.getElementById('simulateBtn').disabled = false;

            // Reset map view and remove previous simulation layers
            map.setView([20, 0], 2);
            if (simulationMarker) map.removeLayer(simulationMarker);
            simulationZones.forEach(z => map.removeLayer(z));
            simulationZones = [];
            
            // Hide previous simulation result
            document.getElementById('simulationResult').style.display = 'none';
            document.getElementById('simulationResult').innerHTML = '';
            
            // Update mitigation panel based on selected asteroid's calculated energy
            updateMitigationPanel(selectedAsteroid);
        }
    });
}

/**
 * Updates the Mitigation Options panel with values based on the selected asteroid.
 * @param {Object} asteroid - The selected asteroid data object.
 */
function updateMitigationPanel(asteroid) {
    // Need a new calculator instance for the selected NEO data
    const calc = new AsteroidCalculator(asteroid.neo, asteroid.approach);
    const mitigation = calc.calculateMitigation(asteroid.energy, asteroid.diameter);
    
    // Display the details
    document.getElementById('mitigationMsg').style.display = 'none';
    document.getElementById('mitigationDetails').style.display = 'block';
    
    document.getElementById('mitigation-deflection').textContent = mitigation.deflection;
    document.getElementById('mitigation-destruction').textContent = mitigation.destruction;
    document.getElementById('mitigation-evac').textContent = mitigation.evacuationRadius;
}

/**
 * Executes the full impact simulation, calculates results, and renders on the map.
 * @param {number} lat - Impact latitude.
 * @param {number} lon - Impact longitude.
 */
async function simulateImpact(lat, lon) {
    showLoading('Analyzing location and calculating impact. Preparing WorldPop query...');
    
    // Clean up previous simulation markers/zones
    if (simulationMarker) map.removeLayer(simulationMarker);
    simulationZones.forEach(z => map.removeLayer(z));
    simulationZones = [];
    
    const fullNeoData = selectedAsteroid.neo; 
    const fullApproachData = selectedAsteroid.approach;
    
    const calc = new AsteroidCalculator(fullNeoData, fullApproachData);
    
    try {
        // Run the core simulation function (includes API calls for location/population)
        const sim = await calc.simulateImpactAt(lat, lon);
        hideLoading();
        
        // Remove map layers (e.g. tooltips) before adding new ones
        map.eachLayer(layer => {
            if (layer.options.permanent) map.removeLayer(layer);
        });

        // Custom icon for the impact marker
        const icon = L.divIcon({
            className: 'asteroid-marker',
            html: '<div style="width: 40px; height: 40px; background: radial-gradient(circle, #ff0000, #8b0000); border: 4px solid #fbbf24; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; animation: pulse 1s infinite;">💥</div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
        
        simulationMarker = L.marker([lat, lon], { icon }).addTo(map);
        
        // Add a permanent tooltip with the nearest city/location name
        if (sim.nearestCity) {
            L.tooltip({ permanent: true, direction: 'right', offset: [15, 0], className: 'map-tooltip' })
                .setContent(sim.nearestCity)
                .setLatLng([lat, lon])
                .addTo(map);
        }

        // Define and add the concentric destruction zones (circles)
        [
            { r: sim.zones.lightEffects, c: '#ffaa00', label: 'Light Effects' }, 
            { r: sim.zones.moderateDamage, c: '#ff6600', label: 'Moderate Damage (~30% mortality)' },
            { r: sim.zones.severeDestruction, c: '#ff0000', label: 'Severe Destruction (~70% mortality)' },
            { r: sim.zones.totalDevastation, c: '#8b0000', label: 'Total Devastation (100% mortality)' }, 
        ].forEach(z => {
            const circle = L.circle([lat, lon], { 
                radius: z.r * 1000, // Radius in meters
                color: z.c, 
                fillOpacity: 0.15, 
                weight: 2 
            }).bindPopup(`<b>${z.label}</b><br>Radius: ${z.r.toFixed(1)} km`).addTo(map);
            simulationZones.push(circle);
        });
        
        // Center the map on the impact location
        map.setView([lat, lon], 6);
        
        // Prepare text strings for the results panel
        const locationIcon = sim.isOcean ? '🌊' : '🏙️';
        const locationTypeText = sim.isOcean ? 'OCEAN' : 'LAND';
        
        let casualtyText = '';
        if (sim.isOcean) {
             casualtyText = 'No direct casualties (Tsunami Risk)';
             sim.isOcean = false; 
        } else if (sim.populationSource.includes('WorldPop Query Failed')) {
             casualtyText = sim.populationSource.replace('WorldPop Query Failed: ', 'WorldPop Data Error: ');
        } else if (sim.estimatedCasualties > 0) {
             casualtyText = `${sim.estimatedCasualties.toLocaleString('en-US')} estimated casualties`;
        } else {
             casualtyText = 'Population 0 detected (WorldPop)';
        }

        const tsunamiDetails = sim.tsunamiRisk ? `
            <div class="stat-item" style="color: #63b3ed;">
                <span class="stat-label">🌊 Tsunami Risk:</span>
                <span class="stat-value">Wave of ${sim.tsunamiRisk.height}m - Range of ${sim.tsunamiRisk.range.toFixed(0)} km</span>
            </div>` : '';
            
        const populationSourceText = sim.isOcean ? '' : `<br>Population Source: ${sim.populationSource}`;

        // Update the simulation result panel HTML
        document.getElementById('simulationResult').style.display = 'block';
        document.getElementById('simulationResult').innerHTML = `
            <div style="border-top: 2px solid #fbbf24; padding-top: 15px;">
                <h3 style="color: #ef4444; margin-bottom: 10px;">IMPACT ANALYSIS</h3>
                <div style="font-size: 13px; color: #cbd5e0; line-height: 1.8;">
                    <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid #3b82f6; padding: 8px; border-radius: 5px; margin-bottom: 10px;">
                        <strong>Asteroid:</strong> ${selectedAsteroid.name} (${selectedAsteroid.diameter.toFixed(2)} km)<br>
                        <strong>Impact Energy:</strong> ${sim.energy.toFixed(1)} megatons (${sim.comparison})${populationSourceText}<br>
                    </div>

                    <div class="stats" style="margin-top: 10px; border-color: #ef4444;">
                        <div class="stat-item">
                            <span class="stat-label">${locationIcon} Nearest Location:</span>
                            <span class="stat-value">${sim.nearestCity || sim.location} (${locationTypeText})</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Crater Diameter:</span>
                            <span class="stat-value">${(sim.craterRadius * 2).toFixed(2)} km</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Seismic Magnitude:</span>
                            <span class="stat-value">M${sim.earthquakeMagnitude}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">💀 Estimated Casualties (Zones):</span>
                            <span class="stat-value" style="color: ${sim.estimatedCasualties > 0 ? '#ef4444' : '#10b981'};">${casualtyText}</span>
                        </div>
                        ${tsunamiDetails}
                        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #4a5568;">
                            <strong style="color: #9ca3af;">Climate Effects:</strong> ${sim.climateEffects.length > 0 ? sim.climateEffects.join(', ') : 'None significant'}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Update the Mitigation panel with simulation-specific results
        document.getElementById('mitigation-deflection').textContent = sim.mitigation.deflection;
        document.getElementById('mitigation-destruction').textContent = sim.mitigation.destruction;
        document.getElementById('mitigation-evac').textContent = sim.mitigation.evacuationRadius;
        document.getElementById('mitigationMsg').style.display = 'none';
        document.getElementById('mitigationDetails').style.display = 'block';

    } catch (error) {
        // Handle critical errors during simulation (e.g., API failures)
        hideLoading();
        console.error('Simulation Error:', error);
        alert(`Simulation failed: ${error.message}. Please try another location or asteroid.`);
        document.getElementById('simulationResult').style.display = 'block';
        document.getElementById('simulationResult').innerHTML = `<div style="color: #ef4444; padding: 15px; border: 1px solid #ef4444; border-radius: 5px;">ERROR: ${error.message}</div>`;
    }
}

// Main initialization logic executed when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    initMap(); // Initialize the Leaflet map
    showLoading('Loading asteroid data from NASA...');
    
    const initialData = await loadNASAData(); // Fetch NASA data
    // Map data to include the original index for filtering reference
    asteroidsData = initialData.map((a, i) => ({ ...a, _originalIndex: i }));
    
    hideLoading(); // Hide initial loading screen

    if (asteroidsData.length === 0) {
        document.getElementById("asteroidList").innerHTML = `<div class="loading" style="color:#ef4444;">Failed to load data. Check API Key or rate limit.</div>`;
        document.getElementById('simulateBtn').disabled = true;
        return;
    }

    // Initial rendering and setup
    renderAsteroidList(asteroidsData);
    updateStats(asteroidsData);
    setupSimulator();
    setupFilters();
});