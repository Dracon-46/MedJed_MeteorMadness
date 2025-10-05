const NASA_API_KEY = "ldWa4kJ2AqQpyh6sMK46LzcCcuF7fSDiiIAWr5ij";
const WORLDPOP_DATASET = "wpgppop"; 
const WORLDPOP_YEAR = 2020;
let asteroidsData = []; 
let map, selectedAsteroid = null, simulationMarker = null, simulationZones = [];

// O raio máximo permitido para uma única consulta (Área <= 100,000 km²)
const WORLDPOP_MAX_RADIUS_KM = 178; 

function showLoading(message) {
    document.getElementById('loadingMessage').textContent = message;
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

async function getLocationInfo(lat, lon) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
            { headers: { 'User-Agent': 'AsteroidTracker/1.0' }}
        );
        const data = await response.json();
        
        const isOcean = !data.address || data.display_name.includes('Ocean') || 
                         data.display_name.includes('Sea') || data.error === 'Unable to geocode';
        
        let locationType = isOcean ? 'ocean' : 'land';
        let locationName = 'Oceano';
        let country = null;
        let city = null;
        
        if (!isOcean && data.address) {
            country = data.address.country || 'Terra';
            city = data.address.city || data.address.town || data.address.village || 
                       data.address.county || data.address.state || null;
            
            locationName = city ? `${city}, ${country}` : country;
        }
        
        return { type: locationType, name: locationName, country, city, fullData: data };
    } catch (error) {
        console.error('Erro ao obter localização:', error);
        return { type: 'unknown', name: 'Local Desconhecido', country: null, city: null };
    }
}

function createImpactPolygon(lat, lon, radiusKm, segments = 32) {
    const coords = [];
    const earthRadiusKm = 6371;
    const centralAngle = radiusKm / earthRadiusKm;

    for (let i = 0; i <= segments; i++) {
        const bearing = i * (360 / segments);
        
        const latRad = lat * (Math.PI / 180);
        const lonRad = lon * (Math.PI / 180);
        const bearingRad = bearing * (Math.PI / 180);

        const newLatRad = Math.asin(
            Math.sin(latRad) * Math.cos(centralAngle) +
            Math.cos(latRad) * Math.sin(centralAngle) * Math.cos(bearingRad)
        );
        const newLonRad = lonRad + Math.atan2(
            Math.sin(bearingRad) * Math.sin(centralAngle) * Math.cos(latRad),
            Math.cos(centralAngle) - Math.sin(latRad) * Math.sin(newLatRad)
        );

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

async function pollWorldPopTask(taskId) {
    let status = 'created';
    let data = null;
    const maxAttempts = 30; // 30 segundos de timeout
    let attempt = 0;

    while (status !== 'finished' && status !== 'failed' && attempt < maxAttempts) {
        attempt++;
        showLoading(`Monitorando Task ${taskId.substring(0, 4)}... (Tentativa ${attempt}/${maxAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            const url = `https://api.worldpop.org/v1/tasks/${taskId}`;
            const res = await fetch(url);
            data = await res.json();
            status = data.status;

            if (status === 'finished') {
                if (data.data && typeof data.data.total_population === 'number') {
                    return data.data.total_population || 0;
                }
                throw new Error('Resultado WorldPop finalizado, mas sem dados de população.');
            } else if (status === 'failed') {
                throw new Error(data.error_message || 'WorldPop task failed.');
            }
        } catch (error) {
            throw new Error(`Falha na comunicação com WorldPop.`);
        }
    }

    if (status !== 'finished') {
        throw new Error('Tempo limite excedido ao esperar pela tarefa WorldPop.');
    }
}

async function getWorldPopPopulation(lat, lon, radiusKm) {
    if (radiusKm > WORLDPOP_MAX_RADIUS_KM) {
        throw new Error(`O raio (${radiusKm.toFixed(1)} km) excede o limite WorldPop (${WORLDPOP_MAX_RADIUS_KM} km).`);
    }

    try {
        const geojson = createImpactPolygon(lat, lon, radiusKm);
        const geojsonString = JSON.stringify(geojson);

        const createUrl = `https://api.worldpop.org/v1/services/stats?dataset=${WORLDPOP_DATASET}&year=${WORLDPOP_YEAR}&geojson=${encodeURIComponent(geojsonString)}`;
        
        showLoading(`Enviando polígono de impacto (Raio ${radiusKm.toFixed(0)} km) para WorldPop...`);
        const createRes = await fetch(createUrl);
        
        if (!createRes.ok) {
            throw new Error(`Falha na criação da tarefa WorldPop: Status ${createRes.status}`);
        }

        const createData = await createRes.json();
        
        if (createData.error || !createData.taskid) {
            throw new Error(`Erro ao criar tarefa WorldPop: ${createData.error_message || 'Sem Task ID'}`);
        }
        
        const taskId = createData.taskid;
        const population = await pollWorldPopTask(taskId);

        return {
            population: Math.round(population),
            source: `WorldPop (${WORLDPOP_YEAR})`
        };

    } catch (e) {
        console.error(`Falha ao obter população WorldPop:`, e);
        throw new Error(`Falha crítica na obtenção de dados de população: ${e.message}`);
    } finally {
        hideLoading();
    }
}


class AsteroidCalculator {
    constructor(neo, approach) {
        this.neo = neo;
        this.approach = approach;
    }

    calculateImpactEnergy() {
        const diameter = this.neo.estimated_diameter.kilometers.estimated_diameter_max;
        const velocity = parseFloat(this.approach.relative_velocity.kilometers_per_second);
        const radius = (diameter * 1000) / 2; 
        
        const volume = (4/3) * Math.PI * Math.pow(radius, 3);
        const mass = volume * 2600;
        
        const energyJoules = 0.5 * mass * Math.pow(velocity * 1000, 2);
        
        return energyJoules / 4.184e15;
    }

    calculateMitigation(energy, diameter) {
        const impulseForce = (diameter * energy * 0.1).toFixed(2); 
        const destructionYield = (diameter * energy * 0.5 / 0.015).toFixed(0); 
        const craterRadius = 1.8 * Math.pow(diameter, 0.13) * Math.pow(energy, 0.29);
        const severeRadius = craterRadius * 5; 
        
        return {
            deflection: `${impulseForce} GN`,
            destruction: `${destructionYield} bombas de Hiroshima (15kt)`,
            evacuationRadius: `${severeRadius.toFixed(1)} km`
        };
    }

    async simulateImpactAt(lat, lon) {
        const energy = this.calculateImpactEnergy();
        const diameter = this.neo.estimated_diameter.kilometers.estimated_diameter_max;
        
        const craterRadius = 1.8 * Math.pow(diameter, 0.13) * Math.pow(energy, 0.29);
        
        const locationInfo = await getLocationInfo(lat, lon);
        const isOcean = locationInfo.type === 'ocean';
        
        const zones = {
            totalDevastation: craterRadius * 2, 
            severeDestruction: craterRadius * 5, 
            moderateDamage: craterRadius * 10, 
            lightEffects: craterRadius * 20
        };

        let totalEstimatedCasualties = 0;
        let populationSource = 'Oceano / Sem vítimas';
        let nearestCity = locationInfo.city;

        if (!isOcean) {
            
            const totalRadius = zones.moderateDamage; 
            let queryRadiusKm = Math.min(totalRadius, WORLDPOP_MAX_RADIUS_KM);
            let totalPopInZone = 0; // População real encontrada

            try {
                // 1. Obtém a população para o raio limitado
                const popData = await getWorldPopPopulation(lat, lon, queryRadiusKm); 
                
                totalPopInZone = popData.population; 
                populationSource = popData.source;

                // 2. Cálculo das casualidades

                const zoneMortality = [
                    { radius: zones.totalDevastation, mortality: 1.0 },
                    { radius: zones.severeDestruction, mortality: 0.7 },
                    { radius: zones.moderateDamage, mortality: 0.3 }
                ];
                
                const totalAreaKm2 = Math.PI * totalRadius * totalRadius; 
                let avgDensity = 0;

                if (totalPopInZone > 0 && queryRadiusKm > 0) {
                    const queryAreaKm2 = Math.PI * queryRadiusKm * queryRadiusKm;
                    avgDensity = totalPopInZone / queryAreaKm2;
                    
                    populationSource = `${popData.source} (Raio Consultado: ${queryRadiusKm.toFixed(0)} km)`;
                } else {
                     avgDensity = 50; 
                     populationSource = `${popData.source} - População 0 / Densidade base`;
                }
                
                let previousRadius = 0;
                
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
                
                // CORREÇÃO FINAL: Limita o número de vítimas à população total encontrada pelo WorldPop
                // para evitar que o número de mortes extrapoladas seja maior que a população real amostrada.
                if (totalPopInZone > 0) {
                     totalEstimatedCasualties = Math.min(totalEstimatedCasualties, totalPopInZone);
                }

                // Limite global como teto absoluto.
                totalEstimatedCasualties = Math.min(totalEstimatedCasualties, 100000000); 
                
            } catch (error) {
                console.warn(`Simulação: Falha ao obter dados WorldPop: ${error.message}`);
                populationSource = `Falha na consulta WorldPop: ${error.message.substring(0, 50)}...`;
                totalEstimatedCasualties = 0;
            }
        }
        
        let climateEffects = [];
        if (energy > 100) climateEffects.push("Inverno de impacto local");
        if (energy > 1000) climateEffects.push("Inverno nuclear regional");
        if (energy > 10000) climateEffects.push("Extinção em massa global");
        
        let tsunamiRisk = null;
        if (isOcean) {
            tsunamiRisk = {
                height: Math.min(Math.sqrt(energy / 10), 100).toFixed(1), 
                range: Math.min(Math.sqrt(energy / 10), 100) * 50 
            };
        }

        let comparison = "";
        if (energy < 0.001) comparison = `${(energy * 1000).toFixed(1)} quilotons - Similar a Hiroshima`;
        else if (energy < 1) comparison = `${Math.round(energy * 1000 / 15)} bombas de Hiroshima`;
        else if (energy < 50) comparison = `${energy.toFixed(1)} megatons - Bomba termonuclear`;
        else if (energy < 1000) comparison = `${energy.toFixed(0)} megatons - Arsenal nuclear global`;
        else comparison = `${(energy / 1000).toFixed(1)} gigatons - Extinção regional`;
        
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
            earthquakeMagnitude: (4.0 + Math.log10(energy)).toFixed(1),
            estimatedCasualties: totalEstimatedCasualties,
            populationSource: populationSource,
            nearestCity: nearestCity,
            climateEffects,
            tsunamiRisk,
            comparison,
            mitigation: this.calculateMitigation(energy, diameter)
        };
    }

    calculate() {
        let lat = (Math.random() * 160) - 80;
        let lon = (Math.random() * 360) - 180; 
        const energy = this.calculateImpactEnergy();

        return {
            name: this.neo.name,
            neo: this.neo,
            approach: this.approach,
            date: new Date(this.approach.close_approach_date).toLocaleDateString('pt-BR'),
            distance: parseFloat(this.approach.miss_distance.kilometers),
            velocity: parseFloat(this.approach.relative_velocity.kilometers_per_second),
            diameter: this.neo.estimated_diameter.kilometers.estimated_diameter_max,
            impactCoords: { lat: Math.max(-85, Math.min(85, lat)), lon },
            energy: energy,
            risk: parseFloat(this.approach.miss_distance.kilometers) < 500000 ? 'high' : 
                  parseFloat(this.approach.miss_distance.kilometers) < 2000000 ? 'medium' : 'low'
        };
    }
}

function initMap() {
    map = L.map('worldMap', { center: [20, 0], zoom: 2, minZoom: 2, maxZoom: 10 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
}

async function loadNASAData() {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const end = new Date();
        end.setDate(end.getDate() + 7);
        const endDate = end.toISOString().slice(0, 10);
        
        const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${endDate}&api_key=${NASA_API_KEY}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        const all = [];
        for (const date in data.near_earth_objects) {
            data.near_earth_objects[date].forEach(neo => {
                if (neo.close_approach_data && neo.close_approach_data.length > 0) {
                     const calc = new AsteroidCalculator(neo, neo.close_approach_data[0]);
                     all.push(calc.calculate());
                }
            });
        }
        return all.slice(0, 50); 
    } catch (err) {
        console.error("Erro ao carregar dados:", err);
        return [];
    }
}

function renderAsteroidList(data) {
    const list = document.getElementById("asteroidList");
    
    if (data.length === 0) {
        list.innerHTML = `<div class="loading" style="color:#9ca3af; font-size: 14px;">Nenhum asteroide encontrado com os filtros aplicados.</div>`;
        return;
    }

    list.innerHTML = data.map((a, i) => `
        <div class="asteroid-card" data-index="${a._originalIndex}" data-id="${a.name}">
            <div class="asteroid-name">${a.name}</div>
            <div class="asteroid-info">Aprox. em: ${a.date}</div>
            <div class="asteroid-info">Distância: ${(a.distance / 1000).toFixed(0)} mil km</div>
            <div class="asteroid-info">Diâmetro: ${a.diameter.toFixed(2)} km</div>
            <div class="asteroid-info">Energia Est.: ${a.energy.toFixed(1)} megatons</div>
            <span class="risk-indicator risk-${a.risk}">
                ${a.risk === 'high' ? 'ALTO' : a.risk === 'medium' ? 'MÉDIO' : 'BAIXO'}
            </span>
        </div>
    `).join("");
    
    if (selectedAsteroid) {
        const card = document.querySelector(`[data-id="${selectedAsteroid.name}"]`);
        if (card) card.classList.add('selected');
    }
}

function updateStats(data) {
    document.getElementById("totalAsteroids").textContent = data.length;
    document.getElementById("highRisk").textContent = data.filter(a => a.risk === "high").length;
    document.getElementById("mediumRisk").textContent = data.filter(a => a.risk === "medium").length;
    document.getElementById("lowRisk").textContent = data.filter(a => a.risk === "low").length;
}

function setupFilters() {
    const filterElements = [
        document.getElementById('filterName'),
        document.getElementById('filterRisk'),
        document.getElementById('filterDistance'),
        document.getElementById('filterDiameter')
    ];

    filterElements.forEach(el => el.addEventListener('input', applyFilters));
}

function applyFilters() {
    const name = document.getElementById('filterName').value.toLowerCase();
    const risk = document.getElementById('filterRisk').value;
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

function setupSimulator() {
    document.querySelectorAll('input[name="selectionMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('coordsInput').style.display = e.target.value === 'coords' ? 'block' : 'none';
        });
    });

    map.on('click', async (e) => {
        const mode = document.querySelector('input[name="selectionMode"]:checked').value;
        if (mode === 'click' && selectedAsteroid) {
            await simulateImpact(e.latlng.lat, e.latlng.lng);
        } else if (mode === 'click' && !selectedAsteroid) {
            alert('Por favor, selecione um asteroide na lista à direita primeiro!');
        }
    });
    
    document.getElementById('simulateBtn').addEventListener('click', async () => {
        if (!selectedAsteroid) return alert('Selecione um asteroide na lista à direita!');
        
        const mode = document.querySelector('input[name="selectionMode"]:checked').value;
        
        if (mode === 'coords') {
            const lat = parseFloat(document.getElementById('latInput').value);
            const lon = parseFloat(document.getElementById('lonInput').value);
            if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                 return alert('Coordenadas inválidas! Use Lat: -90 a 90 e Lon: -180 a 180.');
            }
            await simulateImpact(lat, lon);
        } else {
            alert('Clique no mapa para escolher o local de impacto!');
        }
    });

    document.getElementById('asteroidList').addEventListener('click', (e) => {
        const card = e.target.closest('.asteroid-card');
        if (card) {
            document.querySelectorAll('.asteroid-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            const index = card.getAttribute('data-index');
            selectedAsteroid = asteroidsData[parseInt(index)];
            
            document.getElementById('currentAsteroidName').textContent = selectedAsteroid.name;
            document.getElementById('selectedAsteroidInfo').style.display = 'block';
            document.getElementById('simulateBtn').disabled = false;

                        map.setView([20, 0], 2);
            
            if (simulationMarker) map.removeLayer(simulationMarker);
            simulationZones.forEach(z => map.removeLayer(z));
            simulationZones = [];
            
            //const coords = selectedAsteroid.impactCoords;
            //map.setView([coords.lat, coords.lon], 4);
            
            document.getElementById('simulationResult').style.display = 'none';
            document.getElementById('simulationResult').innerHTML = '';
            
            updateMitigationPanel(selectedAsteroid);
        }
    });
}

function updateMitigationPanel(asteroid) {
    const calc = new AsteroidCalculator(asteroid.neo, asteroid.approach);
    const mitigation = calc.calculateMitigation(asteroid.energy, asteroid.diameter);
    
    document.getElementById('mitigationMsg').style.display = 'none';
    document.getElementById('mitigationDetails').style.display = 'block';
    
    document.getElementById('mitigation-deflection').textContent = mitigation.deflection;
    document.getElementById('mitigation-destruction').textContent = mitigation.destruction;
    document.getElementById('mitigation-evac').textContent = mitigation.evacuationRadius;
}

async function simulateImpact(lat, lon) {
    showLoading('Analisando localização e calculando impacto. Preparando consulta WorldPop...');
    
    if (simulationMarker) map.removeLayer(simulationMarker);
    simulationZones.forEach(z => map.removeLayer(z));
    simulationZones = [];
    
    const fullNeoData = selectedAsteroid.neo; 
    const fullApproachData = selectedAsteroid.approach;
    
    const calc = new AsteroidCalculator(fullNeoData, fullApproachData);
    
    try {
        const sim = await calc.simulateImpactAt(lat, lon);
        hideLoading();
        
        map.eachLayer(layer => {
            if (layer.options.permanent) map.removeLayer(layer);
        });

        const icon = L.divIcon({
            className: 'asteroid-marker',
            html: '<div style="width: 40px; height: 40px; background: radial-gradient(circle, #ff0000, #8b0000); border: 4px solid #fbbf24; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; animation: pulse 1s infinite;">💥</div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
        
        simulationMarker = L.marker([lat, lon], { icon }).addTo(map);
        
        if (sim.nearestCity) {
            L.tooltip({ permanent: true, direction: 'right', offset: [15, 0], className: 'map-tooltip' })
                .setLatLng([lat, lon])
                .addTo(map);
        }

        [
            { r: sim.zones.lightEffects, c: '#ffaa00', label: 'Efeitos Leves' }, // Maior raio
            { r: sim.zones.moderateDamage, c: '#ff6600', label: 'Dano Moderado (~30% mortalidade)' },
            { r: sim.zones.severeDestruction, c: '#ff0000', label: 'Destruição Severa (~70% mortalidade)' },
            { r: sim.zones.totalDevastation, c: '#8b0000', label: 'Destruição Total (100% mortalidade)' }, // Menor raio, fica no topo
        ].forEach(z => {
            const circle = L.circle([lat, lon], { 
                radius: z.r * 1000, 
                color: z.c, 
                fillOpacity: 0.15, 
                weight: 2 
            }).bindPopup(`<b>${z.label}</b><br>Raio: ${z.r.toFixed(1)} km`).addTo(map);
            simulationZones.push(circle);
        });
        
        map.setView([lat, lon], 6);
        
        const locationIcon = sim.isOcean ? '🌊' : '🏙️';
        const locationTypeText = sim.isOcean ? 'OCEANO' : 'TERRA FIRME';
        
        let casualtyText = '';
        if (sim.isOcean) {
             casualtyText = 'Sem vítimas diretas (Risco de Tsunami)';
             sim.isOcean = false; // Reseta a flag de oceano
        } else if (sim.populationSource.includes('Falha na consulta WorldPop')) {
             casualtyText = sim.populationSource.replace('Falha na consulta WorldPop: ', 'Falha ao obter dados WorldPop: ');
        } else if (sim.estimatedCasualties > 0) {
             casualtyText = `${sim.estimatedCasualties.toLocaleString('pt-BR')} vítimas estimadas`;
        } else {
             casualtyText = 'População 0 detectada (WorldPop)';
        }

        const tsunamiDetails = sim.tsunamiRisk ? `
            <div class="stat-item" style="color: #63b3ed;">
                <span class="stat-label">🌊 Risco de Tsunami:</span>
                <span class="stat-value">Onda de ${sim.tsunamiRisk.height}m - Alcance de ${sim.tsunamiRisk.range.toFixed(0)} km</span>
            </div>` : '';
            
        const populationSourceText = sim.isOcean ? '' : `<br>Fonte População: ${sim.populationSource}`;

        document.getElementById('simulationResult').style.display = 'block';
        document.getElementById('simulationResult').innerHTML = `
            <div style="border-top: 2px solid #fbbf24; padding-top: 15px;">
                <h3 style="color: #ef4444; margin-bottom: 10px;">ANÁLISE DE IMPACTO</h3>
                <div style="font-size: 13px; color: #cbd5e0; line-height: 1.8;">
                    <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid #3b82f6; padding: 8px; border-radius: 5px; margin-bottom: 10px;">
                        <strong>Asteroide:</strong> ${selectedAsteroid.name} (${selectedAsteroid.diameter.toFixed(2)} km)<br>
                        <strong>Energia do Impacto:</strong> ${sim.energy.toFixed(1)} megatons (${sim.comparison})${populationSourceText}<br>
                    </div>

                    <div class="stats" style="margin-top: 10px; border-color: #ef4444;">
                        <div class="stat-item">
                            <span class="stat-label">${locationIcon} Local Próximo:</span>
                            <span class="stat-value">${sim.nearestCity || sim.location} (${locationTypeText})</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Diâmetro da Cratera:</span>
                            <span class="stat-value">${(sim.craterRadius * 2).toFixed(2)} km</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Magnitude Sísmica:</span>
                            <span class="stat-value">M${sim.earthquakeMagnitude}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">💀 Vítimas Estimadas (Zonas):</span>
                            <span class="stat-value" style="color: ${sim.estimatedCasualties > 0 ? '#ef4444' : '#10b981'};">${casualtyText}</span>
                        </div>
                        ${tsunamiDetails}
                        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #4a5568;">
                            <strong style="color: #9ca3af;">Efeitos Climáticos:</strong> ${sim.climateEffects.length > 0 ? sim.climateEffects.join(', ') : 'Nenhum significativo'}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('mitigation-deflection').textContent = sim.mitigation.deflection;
        document.getElementById('mitigation-destruction').textContent = sim.mitigation.destruction;
        document.getElementById('mitigation-evac').textContent = sim.mitigation.evacuationRadius;
        document.getElementById('mitigationMsg').style.display = 'none';
        document.getElementById('mitigationDetails').style.display = 'block';

    } catch (error) {
        hideLoading();
        console.error('Erro na Simulação:', error);
        alert(`Falha na simulação: ${error.message}. Por favor, tente outro local ou asteroide.`);
        document.getElementById('simulationResult').style.display = 'block';
        document.getElementById('simulationResult').innerHTML = `<div style="color: #ef4444; padding: 15px; border: 1px solid #ef4444; border-radius: 5px;">ERRO: ${error.message}</div>`;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    showLoading('Carregando dados de asteroides...');
    
    const initialData = await loadNASAData(); 
    asteroidsData = initialData.map((a, i) => ({ ...a, _originalIndex: i }));
    
    hideLoading();

    if (asteroidsData.length === 0) {
        document.getElementById("asteroidList").innerHTML = `<div class="loading" style="color:#ef4444;">Falha ao carregar dados. Verifique a chave da API.</div>`;
        document.getElementById('simulateBtn').disabled = true;
        return;
    }

    renderAsteroidList(asteroidsData);
    updateStats(asteroidsData);
    setupSimulator();
    setupFilters();
});