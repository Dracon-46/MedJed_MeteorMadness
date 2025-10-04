# 🚀 Guia Rápido de Instalação

## ⚡ Configuração em 3 Minutos

### Passo 1: Obter API Key da NASA (OBRIGATÓRIO)

1. Acesse: https://api.nasa.gov/
2. Preencha o formulário:
   - First Name
   - Last Name
   - Email
3. Clique em **"Signup"**
4. Copie sua API Key (aparece imediatamente)

**Exemplo de API Key**: `ldWa4kJ2AqQpyh6sMK46LzcCcuF7fSDiiIAWr5ij`

---

### Passo 2: Configurar os Arquivos

#### Estrutura de Pastas
```
seu-projeto/
├── index.html
├── asteroid-calculator.js
└── README.md (opcional)
```

#### 2.1. Criar `index.html`
Copie o código do artefato principal.

#### 2.2. Criar `asteroid-calculator.js`
Copie o código do arquivo de cálculos.

#### 2.3. Inserir sua API Key
No arquivo `index.html`, linha ~318:
```javascript
const NASA_API_KEY = "COLE_SUA_CHAVE_AQUI";
```

---

### Passo 3: Executar

#### Opção A: Abrir Direto no Navegador
```bash
# Simplesmente clique duas vezes no index.html
# ou
open index.html  # macOS
start index.html # Windows
xdg-open index.html # Linux
```

#### Opção B: Servidor Local (Recomendado)

**Python 3:**
```bash
python -m http.server 8000
# Acesse: http://localhost:8000
```

**Node.js:**
```bash
npx http-server
# Acesse: http://localhost:8080
```

**VS Code:**
- Instale extensão "Live Server"
- Clique direito no index.html → "Open with Live Server"

---

## 🎯 Verificando se Funcionou

### Checklist de Sucesso

✅ Mapa mundial apareceu?  
✅ Mensagem "Carregando dados da NASA..." apareceu?  
✅ Após alguns segundos, asteroides apareceram no mapa?  
✅ Ao clicar em um asteroide, abre popup com informações?  
✅ Sidebar mostra estatísticas atualizadas?

### ❌ Problemas Comuns

#### Erro: "Falha ao carregar dados da NASA"
**Causa**: API Key inválida ou limite de requisições

**Solução**:
1. Verifique se copiou a API Key corretamente
2. Confirme que não tem espaços extras
3. Aguarde alguns minutos (limite de 1000 req/hora)

**Testar a API Key**:
```bash
curl "https://api.nasa.gov/neo/rest/v1/feed?start_date=2024-10-01&end_date=2024-10-08&api_key=SUA_CHAVE"
```

#### Erro: CORS (Cross-Origin)
**Causa**: Abrindo arquivo direto sem servidor

**Solução**: Use um servidor local (Passo 3, Opção B)

#### Nenhum asteroide aparece
**Causa**: Pode não haver asteroides próximos na data atual

**Solução**: 
- Aguarde alguns minutos para carregar
- Verifique console do navegador (F12)
- Pode ser que todos os asteroides estejam classificados como "Baixo Risco"

---

## 🔍 Testando Funcionalidades

### Teste 1: Visualização no Mapa
1. Abra a aplicação
2. Aguarde carregar
3. Veja pontos coloridos no mapa
4. ✅ Sucesso: Marcadores ☄️ aparecem

### Teste 2: Informações Detalhadas
1. Clique em um marcador no mapa
2. Popup deve abrir com:
   - Nome do asteroide
   - Data de aproximação
   - Distância, diâmetro, velocidade
   - Probabilidade de impacto
   - Energia potencial
   - Escala Torino
3. ✅ Sucesso: Todas informações aparecem

### Teste 3: Filtros
1. Na sidebar, selecione "Alto Risco" no filtro
2. Mapa deve atualizar mostrando só objetos de alto risco
3. Teste o filtro por região
4. ✅ Sucesso: Filtros funcionam dinamicamente

### Teste 4: Sincronização Mapa-Lista
1. Clique em um card na sidebar
2. Mapa deve centralizar no asteroide
3. Popup deve abrir automaticamente
4. ✅ Sucesso: Sincronização funciona

---

## 📊 Interpretando os Dados

### Cores dos Marcadores
- 🔴 **Vermelho + Borda Dourada**: Alto risco (atenção!)
- 🟠 **Laranja + Borda Dourada**: Médio risco (monitorar)
- 🟢 **Verde + Borda Azul**: Baixo risco (rotina)

### Probabilidade de Impacto
```
< 0.000001%  → Praticamente zero
0.000001-0.0001% → Muito baixo
0.0001-0.01%     → Baixo
0.01-1%          → Moderado (atenção)
> 1%             → Alto (raro, mas perigoso)
```

### Escala Torino
```
0       → Sem perigo
1       → Normal
2-4     → Atenção necessária
5-7     → Ameaçador
8-10    → Colisão certa (evacuação)
```

### Energia de Impacto
```
< 1 MT      → Danos locais
1-10 MT     → Destruição regional
10-100 MT   → Devastação continental
> 100 MT    → Catástrofe global
```

**Referência**: Bomba de Hiroshima = 0.015 megatons

---

## 🛠️ Personalização Rápida

### Mudar Número de Asteroides Mostrados
Em `index.html`, linha ~362:
```javascript
return allAsteroids.sort(...).slice(0, 50); // Mude 50 para outro número
```

### Mudar Período de Busca
Em `index.html`, linha ~343:
```javascript
end.setDate(end.getDate() + 7); // Mude 7 para mais dias
```

### Mudar Tema do Mapa
Em `index.html`, linha ~330:
```javascript
// Mapa escuro (atual)
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', ...

// Mapa claro
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', ...

// Mapa satélite
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', ...
```

---

## 🎓 Próximos Passos

### Para Aprender Mais
1. Leia o `README.md` completo
2. Explore o código em `asteroid-calculator.js`
3. Teste modificar os cálculos
4. Adicione suas próprias análises

### Para Melhorar o Projeto
- Adicionar mais APIs (SBDB, MPC)
- Implementar visualização 3D
- Criar gráficos temporais
- Exportar dados para análise

### Para Compartilhar
- Deploy no GitHub Pages (grátis)
- Deploy no Vercel/Netlify (grátis)
- Compartilhar com professores/alunos
- Usar em apresentações

---

## 📚 Recursos de Aprendizado

### Astronomia
- **NASA Eyes**: https://eyes.nasa.gov/
- **NEO Earth Close Approaches**: https://cneos.jpl.nasa.gov/ca/
- **Asterank**: http://www.asterank.com/

### Programação
- **Leaflet.js Docs**: https://leafletjs.com/
- **NASA API Docs**: https://api.nasa.gov/
- **Orbital Mechanics**: https://orbital-mechanics.space/

### Defesa Planetária
- **NASA Planetary Defense**: https://www.nasa.gov/planetarydefense/
- **ESA NEO**: https://neo.ssa.esa.int/
- **B612 Foundation**: https://b612foundation.org/

---

## 💡 Dicas Úteis

### Performance
- Limite a 50 asteroides para melhor performance
- Use cache do navegador
- Considere implementar paginação

### Dados
- API da NASA tem limite de 1000 requisições/hora
- Dados são atualizados diariamente
- Sentry API pode estar temporariamente indisponível

### Debug
- Abra Console do Navegador (F12)
- Procure por mensagens de erro
- Verifique aba Network para requisições

---

## 🆘 Suporte

### Se Nada Funcionar

1. **Verifique o Console (F12)**
   - Procure mensagens em vermelho
   - Copie a mensagem de erro

2. **Teste a API Manualmente**
   ```bash
   curl "https://api.nasa.gov/neo/rest/v1/feed?start_date=2024-10-01&end_date=2024-10-08&api_key=SUA_CHAVE"
   ```

3. **Teste com API Key de Demonstração**
   ```javascript
   const NASA_API_KEY = "DEMO_KEY"; // Limitado a 30 req/hora
   ```

4. **Verifique Navegador**
   - Use Chrome, Firefox, ou Edge (atualizados)
   - Desabilite extensões que bloqueiam scripts
   - Limpe cache (Ctrl+Shift+Del)

---

## ✅ Checklist Final

Antes de usar em produção/apresentação:

- [ ] API Key configurada e testada
- [ ] Servidor local rodando (se necessário)
- [ ] Dados carregando corretamente
- [ ] Mapa responsivo e funcional
- [ ] Filtros operacionais
- [ ] Console sem erros críticos
- [ ] Testado em diferentes navegadores
- [ ] Performance aceitável (< 3s para carregar)

---

**Pronto! Você está pronto para rastrear asteroides! 🚀☄️**

Se tudo funcionou, explore o sistema e aprenda sobre defesa planetária!

---

*Tempo estimado total: 3-5 minutos* ⏱️