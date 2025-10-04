const NASA_API_KEY = "ldWa4kJ2AqQpyh6sMK46LzcCcuF7fSDiiIAWr5ij";
const GEONAMES_USER = "dracon"; // Seu username do GeoNames
let asteroidsData = []; 
let map, selectedAsteroid = null, simulationMarker = null, simulationZones = [];

// --- Funções de API e Utilitários ---

function showLoading(message) {
    document.getElementById('loadingMessage').textContent = message;
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// API para detectar se é terra ou oceano + obter localização
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

// Obtém a população para um ponto (lat, lon) e um raio de impacto
async function getPopulationForZone(lat, lon, radiusKm) {
    const areaKm2 = Math.PI * radiusKm * radiusKm;
    
    try {
        const locationInfo = await getLocationInfo(lat, lon);
        
        if (locationInfo.type === 'ocean') {
            return { population: 0, source: 'Oceano', nearestCity: null, density: 0 };
        }
        
        // GeoNames API para obter a cidade mais próxima
        const geonamesUrl = `http://api.geonames.org/findNearbyPlaceNameJSON?lat=${lat}&lng=${lon}&radius=${radiusKm}&maxRows=1&username=${GEONAMES_USER}`;
        
        const response = await fetch(geonamesUrl);
        if (response.status === 401) throw new Error('401 Unauthorized - GeoNames username not activated or incorrect.');

        const data = await response.json();
        
        let totalPopulation = 0;
        let nearestCity = null;

        if (data.geonames && data.geonames.length > 0) {
            const place = data.geonames[0];
            totalPopulation = parseInt(place.population) || 0;
            nearestCity = place.name;
        }

        const density = totalPopulation > 0 ? Math.round(totalPopulation / areaKm2) : 
                        (totalPopulation === 0 && locationInfo.country) ? estimatePopulationByRegion(locationInfo).density : 0;
        
        // Se a população for 0, usa a estimativa (fallback)
        if (totalPopulation === 0 && locationInfo.country) {
            const fallback = estimatePopulationByRegion(locationInfo);
            return {
                population: Math.round(areaKm2 * fallback.density),
                density: fallback.density,
                source: fallback.source,
                nearestCity: null
            };
        }

        return {
            population: totalPopulation,
            density: density,
            source: nearestCity ? `GeoNames (${nearestCity})` : 'GeoNames (Área)',
            nearestCity: nearestCity
        };
        
    } catch (e) {
        console.warn(`GeoNames falhou (${e.message}). Usando estimativa regional.`);
        const locationInfo = await getLocationInfo(lat, lon);
        return estimatePopulationByRegion(locationInfo, radiusKm);
    }
}

// Função de fallback para estimativa
function estimatePopulationByRegion(locationInfo, areaRadiusKm = 10) {
    const densityMap = {
        'Brazil': 25, 'United States': 36, 'Canada': 4, 'Russia': 9,
        'China': 150, 'India': 460, 'Japan': 340, 'Germany': 240, 
        'France': 120, 'United Kingdom': 280, 'Australia': 3,
    };
    
    const density = densityMap[locationInfo.country] || 50; 
    const areaKm2 = Math.PI * areaRadiusKm * areaRadiusKm; 
    const estimatedPopulation = Math.round(areaKm2 * density);
    
    return { 
        density, 
        population: estimatedPopulation, 
        source: `Estimativa para ${locationInfo.country || 'o local'}`,
        nearestCity: null
    };
}

// --- Classe de Cálculo ---

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
        const mass = volume * 2600; // Densidade média em kg/m³
        
        const energyJoules = 0.5 * mass * Math.pow(velocity * 1000, 2);
        
        return energyJoules / 4.184e15; // Retorna em Megatons
    }

    calculateMitigation(energy, diameter) {
        // Cálculo simplificado baseado em energia e diâmetro.

        // Desvio (Impulso): Força de impulso necessária (em unidades de GigaNewtons)
        // Mais difícil quanto maior e mais rápido
        const impulseForce = (diameter * energy * 0.1).toFixed(2); 

        // Destruição (Nuclear): Necessidade de energia nuclear (em Equivalente de Hiroshima, 15 kt)
        const destructionYield = (diameter * energy * 0.5 / 0.015).toFixed(0); 

        // Evacuação: Baseado na zona de destruição severa
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
        
        // Cratera e Raio de Danos
        const craterRadius = 1.8 * Math.pow(diameter, 0.13) * Math.pow(energy, 0.29);
        
        const locationInfo = await getLocationInfo(lat, lon);
        const isOcean = locationInfo.type === 'ocean';
        
        const zones = {
            totalDevastation: craterRadius * 2, // 100% mortalidade
            severeDestruction: craterRadius * 5, // ~70% mortalidade
            moderateDamage: craterRadius * 10, // ~30% mortalidade
            lightEffects: craterRadius * 20
        };

        let totalEstimatedCasualties = 0;
        let populationSource = 'Oceano / Sem vítimas';
        let nearestCity = null;

        if (!isOcean) {
            // Busca População e calcula vítimas em cada zona (do centro para fora)
            const zoneInfo = [
                { radius: zones.totalDevastation, mortality: 1.0, label: 'Destruição Total' },
                { radius: zones.severeDestruction, mortality: 0.7, label: 'Destruição Severa' },
                { radius: zones.moderateDamage, mortality: 0.3, label: 'Dano Moderado' }
            ];
            
            let previousRadius = 0;
            
            for (const zone of zoneInfo) {
                // Raio da área de impacto (ex: 10km)
                const areaRadius = zone.radius; 
                
                // Busca a população na área total do raio atual
                const popData = await getPopulationForZone(lat, lon, areaRadius);
                
                // Calcula a área da zona
                const totalAreaKm2 = Math.PI * areaRadius * areaRadius;
                const previousAreaKm2 = Math.PI * previousRadius * previousRadius;
                const currentZoneArea = totalAreaKm2 - previousAreaKm2;

                // Estima a população *nesta* zona (população média * área da zona)
                // Usa a densidade se a população for 0 ou se for uma estimativa
                const density = popData.density > 0 ? popData.density : estimatePopulationByRegion(locationInfo).density;
                const estimatedPopInZone = Math.round(density * currentZoneArea);
                
                const casualtiesInZone = Math.round(estimatedPopInZone * zone.mortality);
                totalEstimatedCasualties += casualtiesInZone;
                
                if (popData.nearestCity) nearestCity = popData.nearestCity;
                if (popData.source && popData.source !== 'GeoNames (Área)') populationSource = popData.source;
                
                previousRadius = areaRadius;
            }
            
            // Limite máximo realista (prevenção de números excessivos por erro de densidade)
            totalEstimatedCasualties = Math.min(totalEstimatedCasualties, 10000000); 
            
            if (totalEstimatedCasualties === 0 && nearestCity) {
                 populationSource = `GeoNames (${nearestCity}) - População 0 / Densidade baixa`;
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
        // Cálculo inicial para lista de asteroides
        let lat = (Math.random() * 180) - 90; 
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

// --- Funções de Inicialização e Renderização ---

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
        console.error("Erro ao carregar dados da NASA:", err);
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
    
    // Mantém o cartão selecionado visualmente se houver um
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
    const maxDistance = parseFloat(document.getElementById('filterDistance').value) * 1000; // Converte para km
    const minDiameter = parseFloat(document.getElementById('filterDiameter').value);

    const filtered = asteroidsData.filter(a => {
        // Filtro por nome
        if (name && !a.name.toLowerCase().includes(name)) return false;
        
        // Filtro por risco
        if (risk && a.risk !== risk) return false;
        
        // Filtro por distância máxima
        if (!isNaN(maxDistance) && a.distance > maxDistance) return false;
        
        // Filtro por diâmetro mínimo
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
            // Remove seleção anterior
            document.querySelectorAll('.asteroid-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            // Seleciona o asteroide
            const index = card.getAttribute('data-index');
            selectedAsteroid = asteroidsData[parseInt(index)];
            
            // Atualiza o painel de seleção e habilita o botão
            document.getElementById('currentAsteroidName').textContent = selectedAsteroid.name;
            document.getElementById('selectedAsteroidInfo').style.display = 'block';
            document.getElementById('simulateBtn').disabled = false;
            
            // Move o mapa para as coordenadas de impacto iniciais do asteroide
            const coords = selectedAsteroid.impactCoords;
            map.setView([coords.lat, coords.lon], 4);
            
            // Limpa resultados anteriores
            document.getElementById('simulationResult').style.display = 'none';
            document.getElementById('simulationResult').innerHTML = '';
            
            // Atualiza mitigações iniciais
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
    showLoading('Analisando localização, população e calculando impacto...');
    
    if (simulationMarker) map.removeLayer(simulationMarker);
    simulationZones.forEach(z => map.removeLayer(z));
    simulationZones = [];
    
    const fullNeoData = selectedAsteroid.neo; 
    const fullApproachData = selectedAsteroid.approach;
    
    const calc = new AsteroidCalculator(fullNeoData, fullApproachData);
    
    const sim = await calc.simulateImpactAt(lat, lon);
    hideLoading();
    
    // [Renderização do Marcador e Círculos de Dano]

    // Remove tooltips ou popups de simulações anteriores
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
            .setContent(`Alvo: ${sim.nearestCity || sim.location}`)
            .setLatLng([lat, lon])
            .addTo(map);
    }

    [
        { r: sim.zones.totalDevastation, c: '#8b0000', label: 'Destruição Total (100% mortalidade)' },
        { r: sim.zones.severeDestruction, c: '#ff0000', label: 'Destruição Severa (~70% mortalidade)' },
        { r: sim.zones.moderateDamage, c: '#ff6600', label: 'Dano Moderado (~30% mortalidade)' },
        { r: sim.zones.lightEffects, c: '#ffaa00', label: 'Efeitos Leves' }
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
    
    // [Renderização dos Resultados da Simulação]

    const locationIcon = sim.isOcean ? '🌊' : '🏙️';
    const locationTypeText = sim.isOcean ? 'OCEANO' : 'TERRA FIRME';
    const casualtyText = sim.isOcean 
        ? 'Sem vítimas diretas (Risco de Tsunami)' 
        : sim.estimatedCasualties > 0 
        ? `${sim.estimatedCasualties.toLocaleString('pt-BR')} vítimas estimadas` 
        : 'População não detectada / Densidade baixa';

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
    
    // Atualiza o painel de mitigações com a nova energia e diâmetro
    document.getElementById('mitigation-deflection').textContent = sim.mitigation.deflection;
    document.getElementById('mitigation-destruction').textContent = sim.mitigation.destruction;
    document.getElementById('mitigation-evac').textContent = sim.mitigation.evacuationRadius;
    document.getElementById('mitigationMsg').style.display = 'none';
    document.getElementById('mitigationDetails').style.display = 'block';
}

// --- Inicialização ---

document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    showLoading('Carregando dados de asteroides da NASA...');
    
    const initialData = await loadNASAData(); 
    
    // Adiciona o índice original para permitir a filtragem e a seleção correta
    asteroidsData = initialData.map((a, i) => ({ ...a, _originalIndex: i }));
    
    hideLoading();

    if (asteroidsData.length === 0) {
        document.getElementById("asteroidList").innerHTML = `<div class="loading" style="color:#ef4444;">Falha ao carregar dados da NASA. Verifique a chave da API.</div>`;
        document.getElementById('simulateBtn').disabled = true;
        return;
    }

    renderAsteroidList(asteroidsData);
    updateStats(asteroidsData);
    setupSimulator();
    setupFilters();
});