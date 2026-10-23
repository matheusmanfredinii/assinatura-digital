# Assinatura Digital Showcase ✍️🔒

Demonstração técnica de **Captura, Validação e Registro de Assinatura Digital** em dispositivos móveis construída com **React Native & Expo SDK 58**.

---

## 🚀 Funcionalidades Principais

### 1. Fundo Guiado via Injeção CSS (`webStyle`)
- Utiliza a propriedade `webStyle` do `react-native-signature-canvas` para injetar regras CSS puras na WebView do canvas.
- Exibe o marcador clássico de documento `"✕"` e a linha pontilhada de assinatura de forma nítida.
- Renderizado com `pointer-events: none` e `z-index`, garantindo que os guias não interfiram no desenho nem sejam gravados no payload PNG gerado.

### 2. Validação de Traço
- Validação automática do tamanho da assinatura para evitar toques acidentais na tela.

### 3. Upload em Nuvem & Link Curto da Assinatura
- Ao confirmar, a imagem da assinatura é enviada em nuvem para gerar uma URL curta direta (ex: `https://iili.io/xxxxxx.png`).
- Botão dedicado para **Copiar Link** e atalho para abrir a imagem no navegador.
- Mantém fallback automático em Base64 para funcionamento offline.

### 4. Metadados do Registro
- **Sistema Operacional**: Detecção de plataforma (`Platform.OS`) para conformidade.
- **Timestamp ISO 8601**: Registro de data/hora em precisão de milissegundos (`new Date().toISOString()`).
- **Coleta de IP Público**: Consulta assíncrona integrada à API `https://api.ipify.org?format=json` com mecanismo de timeout e tratamento de fallback.

### 5. Resumo Compacto do Registro (JSON)
- Estruturação completa dos dados com o link curto gerado:
```json
{
  "os": "ios",
  "ip": "201.86.xxx.xxx",
  "timestamp": "2026-10-23T19:40:00.000Z",
  "imageUrl": "https://iili.io/neUnMKb.png"
}
```
- Botão interativo para copiar o JSON estruturado diretamente para a área de transferência.

### 6. Design Moderno & Experiência de Uso
- **Área Ampla**: Canvas aumentado para 265px para maior conforto de desenho no smartphone.
- **Paleta Moderna**: Fundo Slate 900 (`#0f172a`), botões em Indigo (`#4f46e5`), cards Slate 800 (`#1e293b`) e detalhes em cinza claro (`#94a3b8`).
- **Lock Dinâmico de Scroll**: Trava automaticamente a rolagem vertical da tela durante o desenho para evitar conflitos de gestos.
- **Contador Dinâmico de Traços**: Rastreamento da pilha de movimentos (Curvas de Bézier) com suporte a *Desfazer* (Undo) e *Limpar* (Clear).
- **Histórico de Assinaturas**: Carrossel horizontal mantendo o registro das assinaturas geradas na sessão.

---

## 🛠️ Tecnologias Utilizadas

- **Framework**: [Expo SDK 58](https://expo.dev) (React Native 0.88 / React 19.3)
- **Canvas de Assinatura**: [`react-native-signature-canvas`](https://github.com/YanYuanFE/react-native-signature-canvas)
- **WebView**: [`react-native-webview`](https://github.com/react-native-webview/react-native-webview)
- **Área de Transferência**: [`expo-clipboard`](https://docs.expo.dev/versions/latest/sdk/clipboard/)
- **Ícones**: `@expo/vector-icons` (Ionicons)
- **Status Bar**: `expo-status-bar`

---

## 📱 Como Rodar o Projeto

### Pré-requisitos
- Node.js instalado (v18+)
- Aplicativo **Expo Go** instalado no smartphone (Android ou iOS)

### Passo a Passo

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm start
   # ou com modo túnel:
   npx expo start --tunnel -c
   ```

3. **Abra no Dispositivo:**
   - Abra o **Expo Go** e escaneie o QR Code exibido no terminal.
   - O aplicativo será carregado diretamente com suporte a Fast Refresh.

---

## 📄 Licença

Distribuído sob a licença MIT. Consulte `LICENSE` para mais detalhes.
