# Assinatura Digital Showcase

Aplicativo móvel desenvolvido com React Native e Expo para capturar, validar e registrar assinaturas digitais em uma demonstração acadêmica.

## Visão geral

O projeto apresenta uma área de assinatura desenhada sobre uma WebView, validações básicas do traçado, coleta de metadados da sessão e exportação dos dados registrados.

### Recursos

- Canvas de assinatura com guia visual para documentos.
- Contagem e desfazer de traços.
- Limpeza da assinatura e bloqueio de rolagem durante o desenho.
- Validação de assinaturas vazias ou com percurso insuficiente.
- Registro em Base64, plataforma, data/hora e IP público.
- Exportação em JSON e cópia para a área de transferência.
- Upload opcional da imagem para obter uma URL pública.
- Histórico das assinaturas criadas durante a sessão.

## Tecnologias

- Expo SDK 58
- React 19.3
- React Native 0.88
- `react-native-signature-canvas`
- `react-native-webview`
- `expo-clipboard`
- `@expo/vector-icons`

## Requisitos

- Node.js 22.13 ou superior.
- npm.
- Expo Go ou ambiente compatível com Expo SDK 58.

## Instalação e execução

```bash
npm install
npm start
```

Para iniciar diretamente em uma plataforma:

```bash
npm run android
npm run web
npm run ios
```

## Upload opcional

A aplicação funciona sem credenciais e usa Base64 como fallback. Para ativar o upload:

1. Crie um arquivo `.env` na raiz do projeto.
2. Adicione:

```text
EXPO_PUBLIC_FREEIMAGE_API_KEY=sua-chave
```

3. Reinicie o servidor Expo.

A chave é uma configuração opcional do serviço externo. Não envie a chave para o repositório.

## Privacidade e limitações

Este projeto é uma demonstração acadêmica e não constitui uma assinatura digital juridicamente válida. O sistema coleta o IP público por meio de um serviço externo e mantém os registros somente na memória da sessão; ao fechar ou atualizar o aplicativo, o histórico é perdido.

## Scripts

```bash
npm run lint
npm run doctor
npm start
```

## Estrutura

```text
App.js         Interface e regras da aplicação
index.js       Registro do componente principal no Expo
assets/        Ícones e recursos gráficos
app.json       Configuração do aplicativo Expo
package.json   Dependências e scripts
```

## Licença

Este projeto está disponível sob a licença MIT. Consulte o arquivo `LICENSE`.
