Coloque aqui quatro arquivos:

  voting-start.mp3        →  presidente abre uma votação
  voting-end.mp3          →  votação é encerrada
  expediente-warning.mp3  →  vereador no expediente fica com 1 min restando
  expediente-end.mp3      →  tempo do vereador no expediente zera

Os arquivos são tocados pela página /telao, disparados via WebSocket nos
eventos:
  - voting:opened
  - voting:closed
  - expediente:tick (quando tempoRestante === 60)
  - expediente:encerrado (quando motivo === 'tempo_esgotado')

Formato recomendado: MP3, 1-3 segundos, volume normalizado.
Sugestões:
  - voting-start: gongo curto ou apito
  - voting-end:   sino de encerramento (2-3 toques)
  - expediente-warning: beep duplo curto (~1s)
  - expediente-end: buzzer ou sirene curta
