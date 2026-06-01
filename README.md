SAR AI SYSTEM C2 — Guia de despliegue
======================================

Sistema de mando y control para deteccion automatica de personas en operaciones
SAR mediante vision por computador e IA. Arquitectura distribuida con frontend
PWA en GitHub Pages y backend en Google Colab con GPU.


REQUISITOS PREVIOS
------------------

- Cuenta de Google con acceso a Google Drive y Google Colaboratory
- Navegador con soporte WebGPU: Chrome 113+ o Edge 113+ recomendados
- No se requiere ninguna instalacion local adicional


===========================================
1. PUESTA EN MARCHA DEL BACKEND (COLAB)
===========================================

PASO 1 — Subir los modelos a Google Drive
------------------------------------------

Crea la siguiente estructura en tu Google Drive con exactamente estos nombres:

    Mi unidad/
    └── TFG/
        ├── best.pt                   <- YOLOv5s
        ├── best_v8_sard.pt           <- YOLOv8s
        ├── best_yolov12.pt           <- YOLOv12s
        ├── best-RTDETR.pt            <- RT-DETR-L
        └── registro_analisis_v2.csv  <- opcional, se crea automaticamente

Los nombres son sensibles a mayusculas y deben coincidir exactamente.
El modelo YOLO26s NO va en Drive: se ejecuta localmente en el navegador
desde el archivo best_yolo26.onnx del frontend.


PASO 2 — Abrir el notebook del backend
----------------------------------------

Abre api-distribuida.ipynb en Google Colaboratory.
Asigna GPU en:
    Entorno de ejecucion -> Cambiar tipo de entorno de ejecucion -> GPU T4


PASO 3 — Ejecutar las celdas en orden
---------------------------------------

El notebook tiene 4 celdas que deben ejecutarse en orden:

CELDA 1 — Instalacion de dependencias
    Desinstala ultralytics estandar e instala la version especifica compatible
    con YOLOv12 desde GitHub, junto con FastAPI, Uvicorn y fpdf.
    IMPORTANTE: si se omite la desinstalacion previa de ultralytics, los
    modelos YOLOv12 no cargaran correctamente.
    Duracion aproximada: 2-3 minutos.

CELDA 2 — Montaje de Drive y carga de modelos
    Monta Google Drive y copia los cuatro modelos desde MyDrive/TFG/
    a /content/. Se pedira autorizacion para acceder a Drive, acepala.
    Tambien recupera el CSV de estadisticas si existe en Drive.

CELDA 3 — Definicion del servidor
    Escribe el fichero api.py completo en el entorno de Colab.
    No produce salida visible. Debe ejecutarse sin errores.

CELDA 4 — Arranque del servidor y tunel Ngrok
    Arranca Uvicorn en el puerto 8000 y conecta el tunel Ngrok
    con dominio estatico. Al finalizar muestra:

        API EN LINEA Y CONECTADA AL FRONTEND:
        https://groundable-unratable-macy.ngrok-free.dev

    Esta URL es fija y no cambia entre reinicios del servidor.
    No es necesario reconfigurara en el frontend.



PASO 4 — Verificar que el servidor esta activo
------------------------------------------------

Accede desde el navegador a:
    https://groundable-unratable-macy.ngrok-free.dev/

Debe responder:
    {"status": "ONLINE", "gpu": true}

Si gpu devuelve false, el entorno no tiene GPU asignada.
Ve a Entorno de ejecucion -> Cambiar tipo de entorno -> T4 y reinicia.


NOTA IMPORTANTE — Sesion de Colab
    La sesion de Colab se desconecta automaticamente tras 90 minutos de
    inactividad en la version gratuita. Si el backend deja de responder,
    vuelve al notebook y ejecuta de nuevo desde la Celda 2.
    La URL de Ngrok es siempre la misma, no es necesario cambiar nada
    en el frontend.


===========================================
2. FRONTEND
===========================================

OPCION A — GitHub Pages (recomendado)
---------------------------------------

El frontend esta desplegado publicamente. Accede directamente desde
Chrome o Edge. La URL de Ngrok ya esta configurada de fabrica ya que
el dominio es estatico.

    Web Fontend: https://jleon5.github.io/TFG-Frontend-SAR/


OPCION B — Ejecucion en local
-------------------------------

El index.html NO puede abrirse con doble clic. El Service Worker
requiere un origen HTTP. Sirve los archivos desde la carpeta frontend/:

    Con Python:
        python -m http.server 8080

    Con Node.js:
        npx serve .

Accede a http://localhost:8080 desde Chrome o Edge.


===========================================
3. ENDPOINTS DISPONIBLES
===========================================

BASE_URL = https://groundable-unratable-macy.ngrok-free.dev

    GET  /                  Estado del servidor y disponibilidad de GPU

    POST /analizar_imagen/  Analisis de imagen

                            Parametros: file, modelo, conf, session_id
    POST /analizar_video/   Analisis de video

                            Parametros: file, modelo, conf, session_id
    GET  /stream_progreso/  Estado en tiempo real del analisis

                            Parametro: session_id
    GET  /descargar_informe/ Descarga del PDF generado

                            Parametro: session_id
    GET  /estadisticas/     Descarga del CSV de telemetria historica

Valores validos para el parametro "modelo":
    "YOLO v5"
    "YOLO v8"
    "YOLO v12"
    "RT-DETR"

YOLO26 no tiene endpoint de servidor. Se ejecuta localmente
en el navegador mediante ONNX Runtime Web y WebGPU.


===========================================
4. VERIFICACION DEL SISTEMA COMPLETO
===========================================

Una vez el backend esta activo, comprueba en este orden:

1. CONEXION CON SERVIDOR
   El indicador en la esquina superior izquierda del HUD debe mostrar
   estado conectado en verde. Si sigue en rojo tras 10-15 segundos,
   verifica que el backend esta activo accediendo a la URL raiz.

2. ANALISIS DE IMAGEN EN SERVIDOR
   Selecciona YOLOv8s, carga cualquier imagen con personas y pulsa
   Analizar Señal. El resultado debe aparecer en menos de 5 segundos
   con bounding boxes sobre las personas detectadas.

3. ANALISIS DE VIDEO CON TRACKING
   Selecciona YOLOv12s o RT-DETR, carga un video corto y analiza.
   Al reproducir el resultado, los IDs de tracking deben mantenerse
   estables entre fotogramas consecutivos.

4. DESCARGA DE INFORME PDF
   Al finalizar cualquier analisis en servidor debe generarse automaticamente
   la opcion de descarga del informe PDF. En local no esta disponible esta     funcionalidad.

5. TELEMETRIA
   Pulsa el boton INTELIGENCIA en la barra superior. Deben aparecer
   las graficas con los datos de las operaciones de la sesion actual.

6. MODO EDGE OFFLINE
   Selecciona YOLO26 en el desplegable. Desactiva la red del dispositivo.
   Carga una imagen y pulsa Analizar Señal. El analisis debe completarse
   sin conexion usando el modelo ONNX cacheado en el navegador.

   NOTA: en la primera sesion, el modelo ONNX debe descargarse una vez
   con conexion activa antes de estar disponible offline. Puedes verificar
   que la descarga se completo en:
   Chrome -> Herramientas de desarrollador -> Aplicacion -> Service Workers

7. INSTALACION COMO PWA
   Desde Chrome o Edge debe aparecer el banner de instalacion en la parte
   superior del HUD. Pulsando Instalar la app queda disponible en el
   escritorio o pantalla de inicio del dispositivo.


===========================================
5. SOLUCION DE PROBLEMAS
===========================================

Error al importar ultralytics (Celda 3)
    La Celda 1 no desinstalo la version estandar correctamente.
    Reinicia el entorno: Entorno de ejecucion -> Reiniciar entorno
    y vuelve a ejecutar desde la Celda 1.

Algun modelo no carga
    El nombre del archivo en Drive no coincide exactamente con el esperado.
    Nombres correctos: best.pt / best_v8_sard.pt / best_yolov12.pt / best-RTDETR.pt

La URL del servidor no responde
    La sesion de Colab se ha desconectado. Ejecuta de nuevo desde la Celda 2.
    La URL de Ngrok no cambia.

El modo Edge no funciona offline
    El modelo ONNX debe haberse descargado al menos una vez con conexion.
    Verifica en Chrome -> DevTools -> Application -> Cache Storage
    que best_yolo26.onnx aparece en la cache del Service Worker.

La sesion de Colab se ha desconectado durante la prueba
    Ejecuta de nuevo desde la Celda 2. La URL es fija, no hay que
    reconfigurar nada en el frontend.


===========================================
6. NOTAS PARA LA EVALUACION
===========================================

El sistema ha sido desarrollado integramente con herramientas gratuitas
y sin coste de infraestructura.

Google Colab en su version gratuita puede presentar limitaciones de
disponibilidad de GPU en horas de alta demanda. Si al abrir el notebook
no hay GPU T4 disponible, puede intentarse de nuevo mas tarde.
Tambien puede usarse el tipo de entorno CPU, aunque el rendimiento
de inferencia sera significativamente menor.

Todos los notebooks de entrenamiento estan disponibles para su revision
e incluyen las metricas de validacion de cada modelo al final de la
ejecucion (precision, recall, mAP50, mAP50-95).

Los datasets utilizados para el entrenamiento estan disponibles
publicamente en Kaggle y se incluyen en la bibliografia del documento.
