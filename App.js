import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  SafeAreaView,
  ScrollView,
  Platform,
  StatusBar as RNStatusBar,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import SignatureScreen from 'react-native-signature-canvas';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

/**
 * 1. FUNDO GUIADO (UI VIA WEBSTYLE):
 * CSS injetado diretamente na WebView do react-native-signature-canvas.
 * - Injeta uma linha pontilhada de assinatura e a marca '✕' via pseudo-elementos (::before e ::after).
 * - z-index: 3 com pointer-events: none garante que os guias fiquem visíveis sem bloquear
 *   ou interferir nos eventos de toque da tela.
 * - O canvas exporta via toDataURL apenas os traços vetoriais, mantendo a imagem pura.
 * - Oculta rodapé nativo (.m-signature-pad--footer) e bloqueia zoom/scroll nativo (touch-action: none).
 */
const WEB_STYLE = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background-color: #ffffff;
    touch-action: none;
    overscroll-behavior: none;
  }
  .m-signature-pad {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: none !important;
    box-shadow: none !important;
    background-color: #ffffff;
  }
  .m-signature-pad--body {
    position: absolute;
    top: 0 !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    height: 100% !important;
    border: none !important;
    margin: 0 !important;
  }
  /* Guia UI: Marcador 'X' no início da linha de assinatura */
  .m-signature-pad--body::before {
    content: "✕";
    position: absolute;
    left: 20px;
    bottom: 22px;
    font-size: 16px;
    font-weight: 700;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #94a3b8;
    z-index: 3;
    pointer-events: none;
    line-height: 1;
  }
  /* Guia UI: Linha pontilhada de assinatura de documento */
  .m-signature-pad--body::after {
    content: "";
    position: absolute;
    left: 44px;
    right: 20px;
    bottom: 26px;
    border-bottom: 2px dashed #cbd5e1;
    z-index: 3;
    pointer-events: none;
  }
  .m-signature-pad--body canvas {
    position: absolute;
    left: 0;
    top: 0;
    width: 100% !important;
    height: 100% !important;
    border-radius: 0px !important;
    box-shadow: none !important;
    touch-action: none;
    z-index: 2;
  }
  .m-signature-pad--footer {
    display: none !important;
    height: 0 !important;
    margin: 0 !important;
  }
`;

export default function App() {
  const signatureRef = useRef(null);

  // Estados principais da demonstração
  const [currentSignature, setCurrentSignature] = useState(null);
  const [signatureHistory, setSignatureHistory] = useState([]);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedType, setCopiedType] = useState(null); // 'json' | 'base64' | null

  // Estado consolidado do Payload de Auditoria Corporativa (Base64, Timestamp, OS, IP)
  const [auditPayload, setAuditPayload] = useState(null);

  // Acionado quando o usuário inicia um traço no Canvas
  const handleBegin = () => {
    setScrollEnabled(false);
    setIsDrawing(true);
  };

  // Acionado ao finalizar um traço (empilha um movimento na pilha de Undo)
  const handleEnd = () => {
    setScrollEnabled(true);
    setIsDrawing(false);
    setStrokeCount((prev) => prev + 1);
  };

  // Limpa completamente o Canvas de assinatura
  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setStrokeCount(0);
    setCurrentSignature(null);
    setAuditPayload(null);
    setCopiedType(null);
    setIsProcessing(false);
  };

  // Desfaz o último traço (pilha de movimentos / Bézier strokes)
  const handleUndo = () => {
    if (strokeCount <= 0 || isProcessing) {
      return;
    }
    signatureRef.current?.undo();
    setStrokeCount((prev) => Math.max(0, prev - 1));
  };

  // Solicita a leitura e exportação Base64 do Canvas
  const handleConfirmPress = () => {
    if (strokeCount === 0) {
      handleEmpty();
      return;
    }
    setIsProcessing(true);
    signatureRef.current?.readSignature();
  };

  // Callback chamado quando o Canvas está vazio ao tentar confirmar
  const handleEmpty = () => {
    setIsProcessing(false);
    Alert.alert(
      'Assinatura Vazia',
      'Por favor, faça sua assinatura antes de confirmar.',
      [{ text: 'Entendido', style: 'default' }]
    );
  };

  /**
   * Callback principal chamado pela WebView com a string Base64 da assinatura
   * Integra as 4 funcionalidades corporativas:
   * 1. Fundo já aplicado via webStyle
   * 2. Validação de Traço (Anti-fraude) com verificação de length < 3000
   * 3. Metadados de Auditoria (Platform.OS e new Date().toISOString())
   * 4. Coleta assíncrona de IP público via https://api.ipify.org?format=json
   */
  const handleOK = async (base64Signature) => {
    // 2. VALIDAÇÃO DE TRAÇO (ANTI-FRAUDE)
    // Se a string Base64 tiver menos de 3000 caracteres, indica um toque acidental/ponto
    if (!base64Signature || base64Signature.length < 3000) {
      setIsProcessing(false);
      Alert.alert(
        'Assinatura Inválida',
        'Assinatura muito curta. Assine por extenso.',
        [{ text: 'Entendido', style: 'default' }]
      );
      return;
    }

    // 3. METADADOS DE AUDITORIA: Sistema Operacional e Timestamp ISO
    const os = Platform.OS;
    const timestamp = new Date().toISOString();

    // 4. COLETA DE IP: Fetch assíncrono para api.ipify.org com timeout de segurança
    let publicIp = 'Indisponível';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch('https://api.ipify.org?format=json', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.ip) {
          publicIp = data.ip;
        }
      }
    } catch (error) {
      console.warn('Não foi possível obter o IP público da api.ipify.org:', error);
      publicIp = 'Indisponível (Offline/Proxy)';
    }

    // Calcula tamanho aproximado do payload em KB para exibição
    const sizeInBytes = Math.round((base64Signature.length * 3) / 4);
    const sizeInKB = (sizeInBytes / 1024).toFixed(1);

    // PAYLOAD CORPORATIVO CONSOLIDADO
    const payload = {
      base64: base64Signature,
      timestamp,
      os,
      ip: publicIp,
      // Propriedades auxiliares para a interface e histórico
      id: String(Date.now()),
      signature: base64Signature,
      strokes: strokeCount,
      sizeKB,
    };

    // Guarda no Estado (useState) simulando envio ao Banco de Dados
    setAuditPayload(payload);
    setCurrentSignature(payload);
    setSignatureHistory((prev) => [payload, ...prev]);
    setIsProcessing(false);
    setCopiedType(null);
  };

  // Copia o Payload JSON completo de auditoria para a área de transferência
  const handleCopyJson = async () => {
    if (!auditPayload) return;
    try {
      const jsonExport = {
        os: auditPayload.os,
        ip: auditPayload.ip,
        timestamp: auditPayload.timestamp,
        base64: auditPayload.base64,
      };
      await Clipboard.setStringAsync(JSON.stringify(jsonExport, null, 2));
      setCopiedType('json');
      setTimeout(() => setCopiedType(null), 2500);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível copiar o JSON.');
    }
  };

  // Copia a string Base64 completa para a área de transferência
  const handleCopyBase64 = async () => {
    if (!auditPayload?.base64) return;
    try {
      await Clipboard.setStringAsync(auditPayload.base64);
      setCopiedType('base64');
      setTimeout(() => setCopiedType(null), 2500);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível copiar o código Base64.');
    }
  };

  // Formata a string Base64 de forma truncada para visualização limpa
  const formatTruncatedBase64 = (base64String) => {
    if (!base64String) return '';
    if (base64String.length <= 44) return base64String;
    return `${base64String.substring(0, 36)}...${base64String.substring(
      base64String.length - 8
    )}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" backgroundColor="#0f172a" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* 1. CABEÇALHO (HEADER) */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconBadge}>
              <Ionicons name="shield-checkmark" size={20} color="#818cf8" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Assinatura Digital Corporativa</Text>
              <Text style={styles.headerSubtitle}>
                Auditoria de Metadados & Anti-Fraude
              </Text>
            </View>
          </View>

          {/* Pílulas de Telemetria Técnica */}
          <View style={styles.techBadgesRow}>
            <View style={styles.techBadge}>
              <Ionicons name="shield-outline" size={12} color="#a5b4fc" />
              <Text style={styles.techBadgeText}>Anti-Fraude Ativo (&gt;3k)</Text>
            </View>
            <View style={styles.techBadge}>
              <Ionicons name="layers-outline" size={12} color="#a5b4fc" />
              <Text style={styles.techBadgeText}>
                Pilha: {strokeCount} {strokeCount === 1 ? 'traço' : 'traços'}
              </Text>
            </View>
            <View
              style={[
                styles.techBadge,
                isDrawing ? styles.techBadgeActive : null,
              ]}
            >
              <View
                style={[
                  styles.liveDot,
                  { backgroundColor: isDrawing ? '#38bdf8' : '#64748b' },
                ]}
              />
              <Text style={styles.techBadgeText}>
                {isDrawing ? 'Capturando Traço...' : 'Canvas Pronto'}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. CANVAS DE ASSINATURA COM FUNDO GUIADO INJETADO VIA WEBSTYLE */}
        <View style={styles.canvasCard}>
          <View style={styles.canvasCardHeader}>
            <View style={styles.canvasHeaderLabelRow}>
              <Text style={styles.canvasCardLabel}>ÁREA DE ASSINATURA</Text>
              <View style={styles.cssBadge}>
                <Text style={styles.cssBadgeText}>Guia CSS Ativo</Text>
              </View>
            </View>
            <Text style={styles.canvasCardHint}>
              Assine por extenso sobre a linha
            </Text>
          </View>

          <View style={styles.canvasWrapper}>
            <SignatureScreen
              ref={signatureRef}
              onOK={handleOK}
              onEmpty={handleEmpty}
              onBegin={handleBegin}
              onEnd={handleEnd}
              webStyle={WEB_STYLE}
              scrollable={false}
              scrollEnabled={false}
              nestedScrollEnabled={false}
              showsVerticalScrollIndicator={false}
              backgroundColor="rgb(255, 255, 255)"
              penColor="#0f172a"
              minWidth={1.2}
              maxWidth={3.2}
              dotSize={2.0}
              clearText="Limpar"
              confirmText="Confirmar"
              descriptionText="Assine Aqui"
              imageType="image/png"
              webviewProps={{
                scrollEnabled: false,
                bounces: false,
                overScrollMode: 'never',
                showsHorizontalScrollIndicator: false,
                showsVerticalScrollIndicator: false,
              }}
            />
          </View>
        </View>

        {/* 3. BARRA DE FERRAMENTAS (ABAIXO DO CANVAS) */}
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={[styles.secondaryButton, isProcessing && styles.buttonDisabled]}
            onPress={handleClear}
            disabled={isProcessing}
            activeOpacity={0.75}
          >
            <Ionicons name="trash-outline" size={18} color="#f87171" />
            <Text style={[styles.secondaryButtonText, { color: '#fca5a5' }]}>
              Limpar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              (strokeCount === 0 || isProcessing) && styles.buttonDisabled,
            ]}
            onPress={handleUndo}
            disabled={strokeCount === 0 || isProcessing}
            activeOpacity={0.75}
          >
            <Ionicons
              name="arrow-undo-outline"
              size={18}
              color={strokeCount > 0 && !isProcessing ? '#e2e8f0' : '#64748b'}
            />
            <Text
              style={[
                styles.secondaryButtonText,
                (strokeCount === 0 || isProcessing) && styles.buttonTextDisabled,
              ]}
            >
              Desfazer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, isProcessing && styles.buttonDisabled]}
            onPress={handleConfirmPress}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            {isProcessing ? (
              <>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.primaryButtonText}>Auditando & IP...</Text>
              </>
            ) : (
              <>
                <Ionicons name="shield-checkmark-outline" size={19} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Confirmar & Auditar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 4. ÁREA DE STATUS E RESULTADOS (O OBJETO JSON DE AUDITORIA) */}
        {auditPayload ? (
          <View style={styles.payloadCard}>
            {/* Banner de Sucesso da Auditoria */}
            <View style={styles.statusBanner}>
              <View style={styles.statusIconContainer}>
                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
              </View>
              <Text style={styles.statusText}>
                Assinatura Validada & Auditada com Sucesso
              </Text>
            </View>

            {/* Metadados Corporativos de Auditoria em Cards Rápidos */}
            <View style={styles.auditGrid}>
              <View style={styles.auditMetaCard}>
                <View style={styles.auditMetaHeader}>
                  <Ionicons name="phone-portrait-outline" size={13} color="#818cf8" />
                  <Text style={styles.auditMetaLabel}>SISTEMA (OS)</Text>
                </View>
                <Text style={styles.auditMetaValue}>
                  {auditPayload.os.toUpperCase()}
                </Text>
              </View>

              <View style={styles.auditMetaCard}>
                <View style={styles.auditMetaHeader}>
                  <Ionicons name="globe-outline" size={13} color="#38bdf8" />
                  <Text style={styles.auditMetaLabel}>IP PÚBLICO</Text>
                </View>
                <Text style={styles.auditMetaValue} numberOfLines={1}>
                  {auditPayload.ip}
                </Text>
              </View>
            </View>

            <View style={styles.auditTimestampCard}>
              <View style={styles.auditMetaHeader}>
                <Ionicons name="time-outline" size={13} color="#34d399" />
                <Text style={styles.auditMetaLabel}>TIMESTAMP DE AUDITORIA (ISO 8601)</Text>
              </View>
              <Text style={styles.auditTimestampValue}>
                {auditPayload.timestamp}
              </Text>
            </View>

            {/* Miniatura da Imagem e Inspeção do Payload JSON */}
            <View style={styles.payloadBody}>
              <View style={styles.previewBox}>
                <Image
                  source={{ uri: auditPayload.base64 }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
                <Text style={styles.previewCaption}>
                  PNG • {auditPayload.sizeKB} KB
                </Text>
              </View>

              <View style={styles.base64Container}>
                <View style={styles.base64HeaderRow}>
                  <Text style={styles.base64Label}>BASE64 PAYLOAD</Text>
                  <Text style={styles.base64LengthBadge}>
                    {auditPayload.base64.length.toLocaleString('pt-BR')} chars
                  </Text>
                </View>

                <View style={styles.base64CodeBox}>
                  <Text style={styles.base64CodeText} numberOfLines={2}>
                    {formatTruncatedBase64(auditPayload.base64)}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.smallCopyButton,
                      copiedType === 'base64' && styles.copyButtonSuccess,
                    ]}
                    onPress={handleCopyBase64}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={copiedType === 'base64' ? 'checkmark' : 'copy-outline'}
                      size={13}
                      color="#ffffff"
                    />
                    <Text style={styles.smallCopyButtonText}>
                      {copiedType === 'base64' ? 'OK' : 'Base64'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Visualizador do Objeto JSON Pronto para Banco de Dados */}
            <View style={styles.jsonViewerBox}>
              <View style={styles.jsonViewerHeader}>
                <View style={styles.jsonHeaderLeft}>
                  <Ionicons name="code-working-outline" size={14} color="#a5b4fc" />
                  <Text style={styles.jsonViewerTitle}>
                    Payload Consolidado (Simulação de Envio ao BD)
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.copyJsonButton,
                    copiedType === 'json' && styles.copyButtonSuccess,
                  ]}
                  onPress={handleCopyJson}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={copiedType === 'json' ? 'checkmark' : 'copy-outline'}
                    size={13}
                    color="#ffffff"
                  />
                  <Text style={styles.copyJsonButtonText}>
                    {copiedType === 'json' ? 'JSON Copiado!' : 'Copiar JSON'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.jsonCodeContent}>
                <Text style={styles.jsonCodeSnippet}>
                  {`{\n  "os": "${auditPayload.os}",\n  "ip": "${auditPayload.ip}",\n  "timestamp": "${auditPayload.timestamp}",\n  "base64": "${formatTruncatedBase64(auditPayload.base64)}"\n}`}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyPayloadCard}>
            <Ionicons
              name="shield-outline"
              size={22}
              color="#64748b"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.emptyPayloadText}>
              Faça sua assinatura completa acima e toque em{' '}
              <Text style={styles.emptyPayloadHighlight}>
                Confirmar & Auditar
              </Text>{' '}
              para coletar IP, Timestamp, OS e gerar o Payload de auditoria.
            </Text>
          </View>
        )}

        {/* 5. HISTÓRICO DE ASSINATURAS ENVIADAS */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <View style={styles.historyTitleRow}>
              <Ionicons
                name="cloud-upload-outline"
                size={16}
                color="#818cf8"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.historyTitle}>
                Histórico de Envios Simulados
              </Text>
            </View>
            <View style={styles.historyCountBadge}>
              <Text style={styles.historyCountText}>
                {signatureHistory.length}{' '}
                {signatureHistory.length === 1 ? 'registro' : 'registros'}
              </Text>
            </View>
          </View>

          {signatureHistory.length === 0 ? (
            <View style={styles.historyEmptyContainer}>
              <Text style={styles.historyEmptyText}>
                Nenhuma assinatura auditada nesta sessão.
              </Text>
            </View>
          ) : (
            <FlatList
              data={signatureHistory}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.historyListContent}
              renderItem={({ item, index }) => {
                const isSelected = auditPayload?.id === item.id;
                const itemNumber = signatureHistory.length - index;

                return (
                  <TouchableOpacity
                    style={[
                      styles.historyCard,
                      isSelected && styles.historyCardActive,
                    ]}
                    onPress={() => {
                      setAuditPayload(item);
                      setCurrentSignature(item);
                      setCopiedType(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.historyCardTopRow}>
                      <Text style={styles.historyBadgeText}>
                        Envio #{itemNumber}
                      </Text>
                      <View style={styles.historySyncedDot} />
                    </View>

                    <View style={styles.historyThumbnailContainer}>
                      <Image
                        source={{ uri: item.base64 }}
                        style={styles.historyThumbnail}
                        resizeMode="contain"
                      />
                    </View>

                    <View style={styles.historyTimestampRow}>
                      <Ionicons
                        name="globe-outline"
                        size={10}
                        color="#94a3b8"
                        style={{ marginRight: 3 }}
                      />
                      <Text style={styles.historyTimestamp} numberOfLines={1}>
                        {item.ip}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },

  /* 1. CABEÇALHO */
  header: {
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 70, 229, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '500',
  },
  techBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  techBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 5,
  },
  techBadgeActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  techBadgeText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  /* 2. CANVAS DE ASSINATURA */
  canvasCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 12,
  },
  canvasCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  canvasHeaderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  canvasCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8,
  },
  cssBadge: {
    backgroundColor: 'rgba(79, 70, 229, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  cssBadgeText: {
    fontSize: 9,
    color: '#a5b4fc',
    fontWeight: '700',
  },
  canvasCardHint: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
  canvasWrapper: {
    height: 195,
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  /* 3. BARRA DE FERRAMENTAS */
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 12,
    gap: 5,
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonTextDisabled: {
    color: '#64748b',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5', // Indigo 600
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* 4. ÁREA DE RESULTADOS & AUDITORIA CORPORATIVA */
  payloadCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  statusIconContainer: {
    marginRight: 6,
  },
  statusText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
  },
  auditGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  auditMetaCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  auditMetaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  auditMetaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  auditMetaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
  },
  auditTimestampCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  auditTimestampValue: {
    fontSize: 11,
    color: '#34d399',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  payloadBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  previewBox: {
    width: 95,
    alignItems: 'center',
  },
  previewImage: {
    width: 95,
    height: 60,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  previewCaption: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '600',
  },
  base64Container: {
    flex: 1,
  },
  base64HeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  base64Label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  base64LengthBadge: {
    fontSize: 10,
    color: '#818cf8',
    fontWeight: '600',
  },
  base64CodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  base64CodeText: {
    flex: 1,
    fontSize: 10,
    color: '#cbd5e1',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  smallCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 3,
  },
  smallCopyButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  copyButtonSuccess: {
    backgroundColor: '#16a34a',
  },
  jsonViewerBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  jsonViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  jsonHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  jsonViewerTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  copyJsonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    gap: 4,
  },
  copyJsonButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  jsonCodeContent: {
    padding: 8,
  },
  jsonCodeSnippet: {
    fontSize: 11,
    color: '#a5b4fc',
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyPayloadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  emptyPayloadText: {
    flex: 1,
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 17,
  },
  emptyPayloadHighlight: {
    color: '#818cf8',
    fontWeight: '700',
  },

  /* 5. HISTÓRICO DE ASSINATURAS */
  historySection: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  historyCountBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyCountText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  historyEmptyContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyEmptyText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  historyListContent: {
    gap: 10,
    paddingRight: 4,
  },
  historyCard: {
    width: 148,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyCardActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  historyCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a5b4fc',
  },
  historySyncedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  historyThumbnailContainer: {
    width: '100%',
    height: 52,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyThumbnail: {
    width: '100%',
    height: '100%',
  },
  historyTimestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyTimestamp: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
