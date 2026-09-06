const { FFmpeg } = FFmpegWASM;

const {
  fetchFile,
  toBlobURL
} = FFmpegUtil;


// ==============================
// ÉLÉMENTS HTML
// ==============================

const videoInput =
  document.getElementById("videoInput");

const options =
  document.getElementById("options");

const fileList =
  document.getElementById("fileList");

const convertButton =
  document.getElementById("convertButton");

const clearButton =
  document.getElementById("clearButton");

const bitrate =
  document.getElementById("bitrate");

const progressSection =
  document.getElementById("progressSection");

const progressTitle =
  document.getElementById("progressTitle");

const progressText =
  document.getElementById("progressText");

const globalProgressBar =
  document.getElementById("globalProgressBar");

const result =
  document.getElementById("result");

const resultText =
  document.getElementById("resultText");

const downloadButton =
  document.getElementById("downloadButton");


// ==============================
// VARIABLES
// ==============================

let selectedFiles = [];

let ffmpeg = null;

let ffmpegLoaded = false;


// ==============================
// CHOIX DES VIDÉOS
// ==============================

videoInput.addEventListener(
  "change",
  function () {

    selectedFiles =
      Array.from(videoInput.files || []);

    renderFiles();

    result.classList.add("hidden");
  }
);


// ==============================
// AFFICHER LES VIDÉOS
// ==============================

function renderFiles() {

  fileList.innerHTML = "";


  if (selectedFiles.length === 0) {

    options.classList.add("hidden");

    return;
  }


  options.classList.remove("hidden");


  selectedFiles.forEach(
    function (file, index) {

      const element =
        document.createElement("div");

      element.className = "file";


      element.innerHTML = `

        <div class="fileTop">

          <div class="fileIcon">
            🎬
          </div>

          <div class="fileInfo">

            <div class="fileName">
              ${escapeHTML(file.name)}
            </div>

            <div
              class="fileStatus"
              id="status-${index}"
            >
              ${formatBytes(file.size)}
              · En attente
            </div>

          </div>

        </div>


        <div class="progress">

          <div
            class="progressBar"
            id="bar-${index}"
          ></div>

        </div>

      `;


      fileList.appendChild(element);
    }
  );
}


// ==============================
// CHARGER FFmpeg
// ==============================

async function loadFFmpeg() {

  if (ffmpegLoaded) {

    return;
  }


  ffmpeg = new FFmpeg();


  ffmpeg.on(
    "progress",
    function ({ progress }) {

      if (
        window.currentFileIndex !== undefined
      ) {

        updateFileProgress(
          window.currentFileIndex,
          progress * 100
        );
      }
    }
  );


  const coreURL =
    await toBlobURL(

      "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",

      "text/javascript"
    );


  const wasmURL =
    await toBlobURL(

      "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",

      "application/wasm"
    );


  await ffmpeg.load({

    coreURL,
    wasmURL

  });


  ffmpegLoaded = true;
}


// ==============================
// CONVERSION
// ==============================

convertButton.addEventListener(
  "click",
  async function () {

    if (selectedFiles.length === 0) {

      return;
    }


    convertButton.disabled = true;


    result.classList.add("hidden");

    progressSection.classList.remove(
      "hidden"
    );


    globalProgressBar.style.width = "0%";


    try {

      progressTitle.textContent =
        "Préparation...";


      progressText.textContent =
        "Chargement du moteur de conversion";


      await loadFFmpeg();


      // ZIP

      const zip =
        new JSZip();


      // ============================
      // CHAQUE VIDÉO
      // ============================

      for (
        let i = 0;
        i < selectedFiles.length;
        i++
      ) {

        window.currentFileIndex = i;


        const file =
          selectedFiles[i];


        progressTitle.textContent =
          `Conversion ${i + 1} / ${selectedFiles.length}`;


        progressText.textContent =
          file.name;


        updateFileStatus(
          i,
          "Conversion..."
        );


        const inputName =
          `video_${i}_${getExtension(file.name)}`;


        const outputName =
          `audio_${i}.mp3`;


        // Écrire la vidéo dans FFmpeg

        await ffmpeg.writeFile(
          inputName,
          await fetchFile(file)
        );


        // ============================
        // CONVERTIR EN MP3
        // ============================

        await ffmpeg.exec([

          "-i",
          inputName,

          "-vn",

          "-codec:a",
          "libmp3lame",

          "-b:a",
          `${bitrate.value}k`,

          outputName

        ]);


        // ============================
        // RÉCUPÉRER LE MP3
        // ============================

        const mp3 =
          await ffmpeg.readFile(
            outputName
          );


        // Nom du MP3

        const mp3Name =
          getBaseName(file.name)
          + ".mp3";


        // Ajouter au ZIP

        zip.file(
          mp3Name,
          mp3
        );


        // Nettoyer FFmpeg

        try {

          await ffmpeg.deleteFile(
            inputName
          );

        } catch {}


        try {

          await ffmpeg.deleteFile(
            outputName
          );

        } catch {}


        updateFileProgress(
          i,
          100
        );


        updateFileStatus(
          i,
          "✓ MP3 terminé"
        );


        // Progression globale

        const global =
          ((i + 1) /
            selectedFiles.length) *
          100;


        globalProgressBar.style.width =
          `${global}%`;
      }


      // ============================
      // CRÉER LE ZIP
      // ============================

      progressTitle.textContent =
        "Création du ZIP...";


      progressText.textContent =
        "Compression des fichiers MP3";


      const zipBlob =
        await zip.generateAsync(

          {
            type: "blob",

            compression: "DEFLATE",

            compressionOptions: {
              level: 6
            }
          },

          function (metadata) {

            globalProgressBar.style.width =
              `${metadata.percent}%`;

          }

        );


      // ============================
      // LIEN DE TÉLÉCHARGEMENT
      // ============================

      if (downloadButton.href) {

        URL.revokeObjectURL(
          downloadButton.href
        );
      }


      const url =
        URL.createObjectURL(
          zipBlob
        );


      downloadButton.href =
        url;


      downloadButton.download =
        "MP3.zip";


      resultText.textContent =
        `${selectedFiles.length} MP3 · ` +
        `${formatBytes(zipBlob.size)} · ` +
        `${bitrate.value} kb/s`;


      result.classList.remove(
        "hidden"
      );


      progressTitle.textContent =
        "Terminé ✓";


      progressText.textContent =
        "Le fichier ZIP est prêt.";

    }

    catch (error) {

      console.error(error);


      progressTitle.textContent =
        "Une erreur est survenue";


      progressText.textContent =
        error.message ||
        "La conversion a échoué.";
    }


    finally {

      convertButton.disabled =
        false;

      window.currentFileIndex =
        undefined;
    }

  }
);


// ==============================
// EFFACER
// ==============================

clearButton.addEventListener(
  "click",
  function () {

    selectedFiles = [];

    videoInput.value = "";

    fileList.innerHTML = "";

    options.classList.add(
      "hidden"
    );

    progressSection.classList.add(
      "hidden"
    );

    result.classList.add(
      "hidden"
    );

    globalProgressBar.style.width =
      "0%";
  }
);


// ==============================
// PROGRESSION D'UNE VIDÉO
// ==============================

function updateFileProgress(
  index,
  percentage
) {

  const bar =
    document.getElementById(
      `bar-${index}`
    );


  if (bar) {

    bar.style.width =
      `${Math.min(
        100,
        Math.max(
          0,
          percentage
        )
      )}%`;
  }
}


// ==============================
// STATUT
// ==============================

function updateFileStatus(
  index,
  text
) {

  const status =
    document.getElementById(
      `status-${index}`
    );


  if (status) {

    status.textContent =
      text;
  }
}


// ==============================
// NOM SANS EXTENSION
// ==============================

function getBaseName(name) {

  return name

    .replace(
      /\.[^/.]+$/,
      ""
    )

    .replace(
      /[\/\\:*?"<>|]/g,
      "_"
    )

    .trim()

    || "audio";
}


// ==============================
// EXTENSION
// ==============================

function getExtension(name) {

  const match =
    name.match(
      /\.([a-z0-9]+)$/i
    );


  return match
    ? match[1]
    : "bin";
}


// ==============================
// TAILLE
// ==============================

function formatBytes(bytes) {

  if (bytes < 1024) {

    return `${bytes} o`;
  }


  if (bytes < 1024 ** 2) {

    return `${(
      bytes / 1024
    ).toFixed(1)} Ko`;
  }


  if (bytes < 1024 ** 3) {

    return `${(
      bytes / 1024 ** 2
    ).toFixed(1)} Mo`;
  }


  return `${(
    bytes / 1024 ** 3
  ).toFixed(2)} Go`;
}


// ==============================
// SÉCURITÉ HTML
// ==============================

function escapeHTML(text) {

  return text.replace(
    /[&<>"']/g,
    function (character) {

      return {

        "&": "&amp;",

        "<": "&lt;",

        ">": "&gt;",

        '"': "&quot;",

        "'": "&#039;"

      }[character];

    }
  );
}