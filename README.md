# Mirlo

Transcripción, traducción y diarización de audio y vídeo, con edición del
resultado y exportación a subtítulos. Este proyecto nace como Trabajo de Fin
de Grado de Ingeniería de Software de la Universidad de Sevilla. Sus fines
son meramente académicos y de cara a la evaluación.

Todo el procesamiento ocurre en local: el audio se transcribe con WhisperX
sobre la GPU, la traducción corre en LibreTranslate y la identificación de
hablantes en pyannote, sin enviar nada a servicios externos. La interfaz web
se organiza en tres pantallas:

- **Nido**: la biblioteca del perfil, con las subidas locales y los vídeos
  del canal de YouTube conectado.
- **Incubadora**: lanza el procesamiento de un contenido (transcripción y,
  opcionalmente, traducción e identificación de hablantes).
- **Mirlo**: el editor, con el reproductor sincronizado con los segmentos,
  la traducción lado a lado y la vista de hablantes con su línea de tiempos.

## Arranque con Docker

Requisitos: 
- Docker instalado y en ejecución. 
- GPU NVIDIA con los drivers al día (el backend usa CUDA para transcribir y diarizar).

```bash
# Windows
start.bat

# Linux
./start.sh
```

Esto levanta los cuatro servicios (PostgreSQL, LibreTranslate, backend con GPU y
frontend) y abre la app en http://localhost:3000. La primera construcción
descarga una imagen de varios GB con PyTorch y CUDA; las siguientes usan la
caché. Los archivos subidos quedan en `descargas/` y la base de datos
persiste en un volumen de Docker.

## Primeros pasos

1. Crea un perfil. Son de libre configuración, y
   separan el trabajo de cada persona en la misma máquina.
2. Si vas a usar la identificación de hablantes, crea y pega tu token de
   HuggingFace en la pantalla de configuración (engranaje del encabezado):
   los modelos de pyannote son de acceso restringido y exigen aceptar sus
   condiciones. Los resultados obtenidos dependerán del tamaño del modelo seleccionado.
3. Sube un archivo de audio o vídeo en el Nido, o conecta tu cuenta de
   Google para procesar los vídeos de tu canal de YouTube. Para usar esto, crea una copia de `.env.example` como `.env`, y agrega tus credenciales `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` generadas tras crear un cliente OAuth 2.0 en Google Cloud Console.
4. Abre el contenido en la Incubadora, activa lo que necesites y lanza el
   procesamiento. El idioma del contenido se detecta automáticamente.
5. Edita en Mirlo: doble clic en un segmento para corregir el texto o sus
   marcas de tiempo; los hablantes se reasignan, renombran o fusionan desde
   la vista de diarización. Exporta a SRT, VTT, TXT o JSON.

## Desarrollo

```bash
docker compose up -d db libretranslate

cd backend && uv venv && uv pip install -r requirements.txt && uvicorn app.main:app --reload
cd frontend && pnpm install && pnpm dev
```
