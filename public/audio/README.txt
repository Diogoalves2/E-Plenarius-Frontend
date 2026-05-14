Coloque aqui dois arquivos:

  voting-start.mp3   →  toca quando o presidente abre uma votação
  voting-end.mp3     →  toca quando a votação é encerrada

Os arquivos são tocados pela página /telao e disparados via WebSocket
nos eventos `voting:opened` e `voting:closed`.

Formato recomendado: MP3, 1-3 segundos, volume normalizado.
Outros formatos suportados: WAV, OGG, M4A (basta ajustar a extensão no
hook src/hooks/useVotingSounds.ts).
