Coloque aqui três arquivos:

  voting-start.mp3        →  presidente abre uma votação
  voting-end.mp3          →  votação é encerrada
  expediente-warning.mp3  →  vereador no expediente fica com 1 min restando

Os arquivos são tocados pela página /telao, disparados via WebSocket nos
eventos:
  - voting:opened
  - voting:closed
  - expediente:tick (quando tempoRestante === 60)

Formato recomendado: MP3, 1-3 segundos, volume normalizado.
Para o aviso de 1 min, recomendado um som curto (beep duplo ou sino, ~1s).
Outros formatos suportados: WAV, OGG, M4A (ajustar a extensão no hook).
