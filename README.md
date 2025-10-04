# MedJed_MeteorMadness

# 🌍 Sistema de Rastreamento de Asteroides Próximos da Terra

## Desafio 12: Loucura dos Meteoros

Sistema avançado de visualização e análise de asteroides próximos da Terra (NEOs) com cálculos científicos de probabilidade de impacto e localização geográfica.

---

## 🚀 Características Principais

### 📊 Dados Reais da NASA
- **NeoWs API**: Near Earth Object Web Service
- **Sentry API**: Sistema de monitoramento de risco do JPL
- Atualização em tempo real (últimos 7 dias + próximos 7 dias)

### 🧮 Cálculos Científicos Avançados

#### 1. **Probabilidade de Impacto**
```javascript
P(impacto) = f(proximidade) × f(tamanho) × f(gravidade) × f(incerteza)
```
- **Fator de Proximidade**: Baseado em distância em raios terrestres
- **Fator de Tamanho**: Seção transversal gravitacional
- **Fator Gravitacional**: Velocidade relativa vs captura
- **Incerteza Orbital**: Variação baseada em observações

#### 2. **Coordenadas de Impacto Calculadas**
Não são aleatórias! Baseadas em:
- **Inclinação Orbital** (i): Determina latitude possível
- **Longitude do Nodo Ascendente** (Ω): Define longitude base
- **Incerteza de Rastreamento**: Raio de erro aumenta com distância

#### 3. **Energia de Impacto**
```
E = ½ × m × v²
```
- Massa calculada: Volume (diâmetro³) × densidade (2600 kg/m³)
- Conversão para megatons (TNT equivalente)
- Comparação: Bomba de Hiroshima = 0.015 megatons

#### 4. **Escala Torino (0-10)**
| Nível | Descrição | Ação |
|-------|-----------|------|
| 0 | Sem perigo | Observação de rotina |
| 1 | Normal | Monitoramento |
| 2-4 | Atenção | Observação intensa |
| 5-7 | Ameaçador | Preparação de defesa |
| 8-10 | Colisão certa | Evacuação/Deflexão |

---

## 🗺️ Visualização no Mapa

### Marcadores Coloridos
- 🔴 **Vermelho**: Alto risco (Torino ≥5, Prob >0.1%, Dist <100k km)
- 🟠 **Laranja**: Médio risco (Torino 2-4, Prob >0.001%)
- 🟢 **Verde**: Baixo risco (Torino 0-1)

### Zonas de Impacto
- Círculos representam **raio de incerteza**
- Tamanho proporcional à incerteza orbital
- Animação pulsante indica atividade

### Localização Geográfica Realista
O sistema identifica:
- **71% oceanos** (estatisticamente mais provável)
- Continentes específicos baseados em lat/lon
- Oceanos: Atlântico, Pacífico, Índico, Ártico, Antártico

---

## 📈 Análises Estatísticas

### Análise Global de Risco
```javascript
ImpactAnalyzer.analyzeGlobalRisk(asteroids)
```
Retorna:
- Probabilidade total acumulada
- Energia total (megatons)
- Objeto mais perigoso
- Distribuição por categoria de risco

### Agrupamento por Região
```javascript
ImpactAnalyzer.groupByRegion(asteroids)
```
Calcula:
- Contagem por região
- Probabilidade total regional
- Lista de objetos ameaçadores

### Timeline de Aproximações
```javascript
ImpactAnalyzer.createTimeline(asteroids)
```
Organiza objetos por data de aproximação.

### Mapa de Calor de Risco
```javascript
ImpactAnalyzer.calculateRiskHeatmap(asteroids, gridSize)
```
Grid geográfico com scores de risco interpolados.

---

## 🛠️ Arquitetura do Sistema

### Arquivos

```
├── index.html              # Interface principal
├── asteroid-calculator.js  # Motor de cálculos científicos
└── README.md              # Esta documentação
```

### Classes Principais

#### `AsteroidCalculator`
Responsável por todos os cálculos por asteroide:
- `calculateImpactProbability()`: Probabilidade de colisão
- `calculateImpactCoordinates()`: Lat/Lon de impacto
- `calculateImpactEnergy()`: Energia em megatons
- `calculateTorinoScale()`: Nível de perigo
- `getImpactLocation()`: Nome da região geográfica

#### `ImpactAnalyzer`
Análises estatísticas agregadas:
- `analyzeGlobalRisk()`: Estatísticas globais
- `groupByRegion()`: Agrupamento geográfico
- `createTimeline()`: Sequência temporal
- `calculateRiskHeatmap()`: Mapa de calor
- `generateMitigationRecommendations()`: Sugestões de ação

---

## 🔧 Como Usar

### 1. Configurar API Key
```javascript
const NASA_API_KEY = "SUA_CHAVE_AQUI";
```
Obtenha em: https://api.nasa.gov/

### 2. Filtros Disponíveis
- **Por Risco**: Alto, Médio, Baixo
- **Por Região**: Oceanos e continentes

### 3. Interações
- **Clique no mapa**: Abre popup com detalhes
- **Clique no card**: Centraliza mapa no objeto
- **Hover**: Visualiza zona de incerteza

---

## 📚 Base Científica

### Fontes de Dados
- **NASA NeoWs**: https://api.nasa.gov/neo/
- **JPL Sentry**: https://ssd-api.jpl.nasa.gov/sentry.api
- **Elementos Orbitais**: Inclinação, Excentricidade, Nodos

### Modelos Físicos Utilizados
1. **Mecânica Orbital Kepleriana**
2. **Equações de Energia Cinética**
3. **Distribuição Estatística Geográfica**
4. **Fórmula de Haversine** (distâncias terrestres)

### Constantes Físicas
```javascript
EARTH_RADIUS = 6371 km
AU_TO_KM = 149,597,870.7 km
ASTEROID_DENSITY = 2600 kg/m³ (rochoso típico)
GRAVITATIONAL_PARAMETER = 3.986×10¹⁴ m³/s²
MEGATON_TO_JOULES = 4.184×10¹⁵ J
```

---

## 🎯 Precisão dos Cálculos

### Limitações e Aproximações

#### ✅ **O que É Preciso**
- Distância de aproximação (NASA fornece)
- Velocidade relativa (NASA fornece)
- Diâmetro estimado (NASA fornece)
- Energia de impacto (cálculo físico exato)
- Elementos orbitais básicos

#### ⚠️ **O que É Estimado**
- **Probabilidade de impacto**: Modelo simplificado
  - NASA usa Monte Carlo com milhares de simulações
  - Este sistema usa modelo heurístico rápido
  - Serve para visualização e educação
  
- **Coordenadas de impacto**: Baseadas em orbital, não precisas
  - Sistema real requer integração N-body complexa
  - Considera perturbações lunares e planetárias
  - Este sistema usa projeção orbital simplificada

- **Escala Torino**: Aproximação baseada em energia/probabilidade
  - Versão oficial usa mais parâmetros
  - Suficiente para categorização visual

### 📊 Comparação com Sistemas Reais

| Parâmetro | Este Sistema | JPL Sentry | Diferença |
|-----------|--------------|------------|-----------|
| Probabilidade | Modelo heurístico | Monte Carlo | ~10-100× |
| Coordenadas | Orbital simples | N-body | ~100-1000 km |
| Energia | Exato | Exato | ✓ Idêntico |
| Torino | Aproximado | Oficial | ±1 nível |

---

## 🔬 Melhorias Científicas Possíveis

### Curto Prazo
1. **Integração com mais APIs**
   - CNEOS (Center for Near-Earth Object Studies)
   - Minor Planet Center (MPC)
   - ESA NEO Coordination Centre

2. **Cálculos Orbitais Avançados**
   - Equações de Gauss para perturbações
   - Efeito Yarkovsky (pressão de radiação)
   - Influência gravitacional lunar

3. **Visualização 3D**
   - Órbitas em perspectiva
   - Trajetórias de aproximação
   - Comparação com órbita da Lua

### Longo Prazo
1. **Simulação Monte Carlo**
   ```javascript
   function monteCarloImpact(asteroid, iterations = 10000) {
       // Variar parâmetros orbitais dentro da incerteza
       // Contar quantas trajetórias intersectam Terra
   }
   ```

2. **Propagador Orbital N-body**
   - Integração numérica (Runge-Kutta)
   - Considerar todos os planetas
   - Efeitos relativísticos

3. **Machine Learning**
   - Treinar em dados históricos do JPL
   - Predição de probabilidades
   - Classificação automática de risco

---

## 🛡️ Estratégias de Mitigação

### Recomendações por Nível de Risco

#### 🟢 **Baixo Risco (Torino 0-1)**
```
✅ Monitoramento de rotina
📡 Observações telescópicas periódicas
📊 Refinamento de órbita
```

#### 🟠 **Médio Risco (Torino 2-4)**
```
👀 Observação contínua e intensiva
📡 Uso de radar planetário
🛰️ Considerar missão de reconhecimento
📋 Iniciar planejamento contingencial
```

#### 🔴 **Alto Risco (Torino 5-7)**
```
🚨 Alerta internacional
🛰️ Missão de deflexão necessária
📋 Planos de evacuação detalhados
🌍 Cooperação global essencial
```

#### 🚨 **Crítico (Torino 8-10)**
```
🚨 ALERTA MÁXIMO - Colisão provável/certa
🛰️ Deflexão IMEDIATA ou evacuação
💥 Preparação para impacto
🌐 Mobilização global total
```

### Técnicas de Deflexão Disponíveis

1. **Impactador Cinético** (DART - testado em 2022)
   - Colisão de alta velocidade
   - Muda momento do asteroide
   - Efetivo: 5-10 anos antes do impacto

2. **Trator Gravitacional**
   - Nave próxima por meses/anos
   - Usa gravidade mútua
   - Efetivo: 10-20 anos antes

3. **Explosão Nuclear** (último recurso)
   - Vaporiza parte do asteroide
   - Impulso de ablação
   - Risco de fragmentação

---

## 📱 Funcionalidades Futuras

### Interface
- [ ] Modo escuro/claro
- [ ] Gráficos temporais de aproximação
- [ ] Animação de trajetórias orbitais
- [ ] Exportar dados para CSV/JSON
- [ ] Comparação de cenários "what-if"

### Dados
- [ ] Histórico de aproximações passadas
- [ ] Previsão estendida (30 dias)
- [ ] Integração com alertas sísmicos
- [ ] Dados de composição espectral

### Análises
- [ ] Simulação de impacto atmosférico
- [ ] Cálculo de zona de destruição
- [ ] Modelo de tsunami (impacto oceânico)
- [ ] Efeitos climáticos (inverno de impacto)

---

## 🧪 Validação e Testes

### Casos de Teste Conhecidos

#### 1. Apophis (2029)
```javascript
Nome: 99942 Apophis
Data: 13 de abril de 2029
Distância: ~31.000 km (0.1 distâncias lunares)
Probabilidade: ~0% (após refinamentos)
Torino Histórico: 4 → 0
```

#### 2. Bennu
```javascript
Nome: 101955 Bennu
Data: 24 de setembro de 2182
Probabilidade: ~0.037% (1 em 2.700)
Energia: ~1.200 megatons
Torino: 1
```

#### 3. Evento de Chelyabinsk (2013)
```javascript
Diâmetro: ~20 m
Energia: ~500 quilotons (0.5 megatons)
Local: Rússia
Danos: 1.500 feridos, janelas quebradas
```

---

## 🔗 APIs e Recursos

### Endpoints NASA

#### NeoWs API
```
GET https://api.nasa.gov/neo/rest/v1/feed
Parâmetros:
  - start_date: YYYY-MM-DD
  - end_date: YYYY-MM-DD
  - api_key: sua_chave
```

#### Sentry API
```
GET https://ssd-api.jpl.nasa.gov/sentry.api
Retorna: Lista de objetos com risco de impacto
Campos principais:
  - des: Designação
  - ip: Impact Probability
  - ts: Torino Scale
  - ps: Palermo Scale
```

#### SBDB (Small Body Database)
```
GET https://ssd-api.jpl.nasa.gov/sbdb.api
Parâmetros:
  - sstr: Nome/designação do asteroide
  - full-prec: Precisão completa
```

---

## 👥 Contribuindo

### Como Melhorar o Sistema

1. **Fork o projeto**
2. **Implemente melhorias científicas**
   - Adicione mais APIs
   - Melhore modelos de cálculo
   - Otimize performance
3. **Documente mudanças**
4. **Teste com casos conhecidos**
5. **Submit pull request**

### Áreas que Precisam de Ajuda

- [ ] Físicos/Astrônomos: Validar modelos
- [ ] Desenvolvedores: Otimizar código
- [ ] Designers: Melhorar UX/UI
- [ ] Data Scientists: ML para predição

---

## 📖 Referências Científicas

### Papers e Documentos

1. **"Impact Probability Calculation"** - JPL/NASA
2. **"Torino Impact Hazard Scale"** - Binzel et al. (1999)
3. **"Near-Earth Object Survey"** - NASA NEO Program
4. **"Orbital Mechanics for Engineering Students"** - Curtis (2013)

### Sites Oficiais

- NASA NEO Program: https://cneos.jpl.nasa.gov/
- ESA NEO Coordination: https://neo.ssa.esa.int/
- Minor Planet Center: https://www.minorplanetcenter.net/
- Spaceguard Foundation: https://spaceguard.iasf-roma.inaf.it/

### Ferramentas Profissionais

- **Horizons** - JPL Ephemeris System
- **OrbFit** - Orbital determination software
- **CLOMON** - Close approach monitoring
- **NEODyS** - Near Earth Objects Dynamic Site

---

## ⚖️ Licença e Créditos

### Dados
- **NASA**: Domínio público (US Government)
- **OpenStreetMap**: ODbL License
- **CartoDB**: CC BY 3.0

### Bibliotecas
- **Leaflet.js**: BSD 2-Clause License
- **JavaScript**: Código próprio - MIT License

### Créditos Científicos
- JPL Solar System Dynamics
- Center for Near-Earth Object Studies (CNEOS)
- International Asteroid Warning Network (IAWN)

---

## 📞 Contato e Suporte

### Para Reportar Bugs
```
Issues: GitHub Issues
Email: [seu-email]
Discord: [seu-servidor]
```

### Para Dúvidas Científicas
Consulte:
- NASA NEO FAQ
- JPL CNEOS FAQs
- ESA Space Situational Awareness

---

## ⚠️ Disclaimer

**IMPORTANTE**: Este sistema é para fins educacionais e de visualização.

❌ **NÃO USE** para:
- Decisões de segurança pública
- Planejamento de evacuações reais
- Publicação de alertas oficiais
- Pesquisa científica formal (sem validação)

✅ **USE** para:
- Educação e conscientização
- Visualização de dados públicos
- Prototipagem de sistemas
- Compreensão de conceitos orbitais

### Alertas Oficiais
Para informações oficiais sobre ameaças de asteroides:
- **NASA CNEOS**: https://cneos.jpl.nasa.gov/
- **ESA NEO**: https://neo.ssa.esa.int/

---

## 🌟 Agradecimentos

Agradecimentos especiais a:
- NASA por disponibilizar dados abertos
- JPL pelo Sentry System
- Comunidade de defesa planetária
- Desenvolvedores de código aberto

---

**Versão**: 1.0.0  
**Última Atualização**: Outubro 2025  
**Status**: Em Desenvolvimento Ativo 🚀

---

*"A melhor maneira de prevenir um desastre é estar preparado."* - NASA Planetary Defense