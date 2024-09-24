// server.js

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Charger les variables d'environnement depuis le fichier .env
dotenv.config();

// Recréer __filename et __dirname pour les modules ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialiser Express
const app = express();

// Récupérer les variables d'environnement
const mainDirectory = process.env.MAIN_DIRECTORY || 'F:FilmsEtSeries';
const port = process.env.PORT || 3000;
console.log(mainDirectory);
// Vérifier que MAIN_DIRECTORY est défini et existe
if (!mainDirectory || !fs.existsSync(mainDirectory)) {
  console.error(
    'Le dossier principal est invalide ou introuvable.',
    mainDirectory
  );
  process.exit(1);
}

// Chemins des dossiers Films et Series
const moviesDirectory = path.join(mainDirectory, 'Films');
const seriesDirectory = path.join(mainDirectory, 'Series');

// Vérifier l'existence des sous-dossiers
if (!fs.existsSync(moviesDirectory)) {
  console.error('Le dossier Films est introuvable.');
  process.exit(1);
}

if (!fs.existsSync(seriesDirectory)) {
  console.error('Le dossier Series est introuvable.');
  process.exit(1);
}

// Activer CORS
app.use(cors());

// Formats vidéo pris en charge
const videoFormats = ['.mkv', '.avi', '.mp4', '.mov', '.wmv', '.flv', '.webm'];

// Fonction pour obtenir le chemin du poster
const getPosterPath = (dir) => {
  const posterFileNames = [
    'poster.png',
    'poster.jpg',
    'affiche.png',
    'affiche.jpg',
  ];
  for (let posterFileName of posterFileNames) {
    const posterFilePath = path.join(dir, posterFileName);
    if (fs.existsSync(posterFilePath)) {
      return path.relative(mainDirectory, posterFilePath).replace(/\\/g, '/');
    }
  }
  return null;
};

// Fonction pour lire et mapper les informations depuis le JSON
const getInfos = (jsonPath) => {
  let infos = {};
  if (fs.existsSync(jsonPath)) {
    try {
      const jsonData = fs.readFileSync(jsonPath, 'utf-8');
      const parsedData = JSON.parse(jsonData);

      // Mapper les champs français en anglais
      infos = {
        title: parsedData.titre || path.basename(path.dirname(jsonPath)),
        description: parsedData.description || '',
        release_date: parsedData.date_de_sortie || '',
        genres: parsedData.genres || [],
        production_countries: parsedData.pays_production || [],
        director: parsedData.realisateur || '',
        // Ajouter d'autres mappings si nécessaire
      };
    } catch (e) {
      console.error(`Erreur lors de la lecture du JSON pour ${jsonPath}:`, e);
    }
  }
  return infos;
};

// Endpoint pour obtenir la liste des vidéos (Films et Series)
app.get('/api/videos', async (req, res) => {
  const response = {
    films: [],
    sagas: [],
    series: [],
  };
  console.log('cc');
  try {
    // Gestion des Films
    const walkFilms = async (dir) => {
      const filmDirs = await fsPromises.readdir(dir);
      filmDirs.sort();
      for (const film of filmDirs) {
        const filmPath = path.join(dir, film);
        const stat = await fsPromises.stat(filmPath);
        if (stat.isDirectory()) {
          if (film.startsWith('SAGA - ')) {
            // Traitement en tant que saga
            const sagaName = film.replace('SAGA - ', '').trim();

            // Lire les informations de la saga
            const sagaJsonPath = path.join(filmPath, 'informations.json');
            const sagaInfos = getInfos(sagaJsonPath);
            const sagaPosterPath = getPosterPath(filmPath);

            const saga = {
              id: uuidv4(),
              title: sagaInfos.title || sagaName,
              description: sagaInfos.description || '',
              release_date: sagaInfos.release_date || '',
              genres: sagaInfos.genres || [],
              production_countries: sagaInfos.production_countries || [],
              director: sagaInfos.director || '',
              poster: sagaPosterPath,
              films: [],
            };

            // Parcourir les films de la saga
            const sagaFilmDirs = await fsPromises.readdir(filmPath);
            sagaFilmDirs.sort();
            for (const sagaFilm of sagaFilmDirs) {
              const sagaFilmPath = path.join(filmPath, sagaFilm);
              const statSagaFilm = await fsPromises.stat(sagaFilmPath);
              if (statSagaFilm.isDirectory()) {
                const files = await fsPromises.readdir(sagaFilmPath);
                files.sort();
                const videoFile = files.find((f) =>
                  videoFormats.includes(path.extname(f).toLowerCase())
                );
                if (videoFile) {
                  const videoPath = path
                    .relative(mainDirectory, path.join(sagaFilmPath, videoFile))
                    .replace(/\\/g, '/');
                  const posterPath = getPosterPath(sagaFilmPath);
                  const jsonPath = path.join(sagaFilmPath, 'informations.json');
                  const infos = getInfos(jsonPath);

                  saga.films.push({
                    id: uuidv4(),
                    title: infos.title || infos.name || sagaFilm,
                    description: infos.description || '',
                    release_date: infos.release_date || '',
                    genres: infos.genres || [],
                    production_countries: infos.production_countries || [],
                    director: infos.director || '',
                    path: videoPath,
                    poster: posterPath,
                  });
                }
              }
            }

            // Ajouter la saga à la réponse si elle contient des films
            if (saga.films.length > 0) {
              response.sagas.push(saga);
            }
          } else {
            // Traitement en tant que film individuel
            const files = await fsPromises.readdir(filmPath);
            files.sort();
            const videoFile = files.find((f) =>
              videoFormats.includes(path.extname(f).toLowerCase())
            );
            if (videoFile) {
              const videoPath = path
                .relative(mainDirectory, path.join(filmPath, videoFile))
                .replace(/\\/g, '/');
              const posterPath = getPosterPath(filmPath);
              const jsonPath = path.join(filmPath, 'informations.json');
              const infos = getInfos(jsonPath);

              response.films.push({
                id: uuidv4(),
                title: infos.title || infos.name || film,
                description: infos.description || '',
                release_date: infos.release_date || '',
                genres: infos.genres || [],
                production_countries: infos.production_countries || [],
                director: infos.director || '',
                path: videoPath,
                poster: posterPath,
              });
            }
          }
        }
      }
    };

    // Gestion des Series
    const walkSeries = async (dir) => {
      const seriesList = await fsPromises.readdir(dir);
      seriesList.sort();
      for (const serie of seriesList) {
        const seriePath = path.join(dir, serie);
        const statSerie = await fsPromises.stat(seriePath);
        if (statSerie.isDirectory()) {
          // Lire le poster et les infos de la série
          const posterPath = getPosterPath(seriePath);
          const jsonPath = path.join(seriePath, 'informations.json');
          console.log('Chemin du fichier JSON :', jsonPath);
          const infos = getInfos(jsonPath);

          const serieData = {
            id: uuidv4(), // Utilisation d'un UUID
            title: infos.title || serie,
            description: infos.description || '',
            release_date: infos.release_date || '',
            genres: infos.genres || [],
            production_countries: infos.production_countries || [],
            director: infos.director || '',
            poster: posterPath,
            seasons: [],
          };

          // Parcourir les saisons
          const saisons = await fsPromises.readdir(seriePath);
          saisons.sort();
          for (const saison of saisons) {
            const saisonPath = path.join(seriePath, saison);
            const statSaison = await fsPromises.stat(saisonPath);
            if (
              statSaison.isDirectory() &&
              /^(Saison|SO)\s*\d+$/i.test(saison)
            ) {
              // Extraire le numéro de la saison
              const saisonNumberMatch = saison.match(/(?:Saison|SO)\s*(\d+)/i);
              const saisonNumber = saisonNumberMatch
                ? parseInt(saisonNumberMatch[1], 10)
                : saison;

              const saisonData = {
                number: saisonNumber,
                episodes: [],
              };

              // Parcourir les fichiers vidéo des épisodes dans la saison
              const episodes = await fsPromises.readdir(saisonPath);
              episodes.sort();
              for (const episodeFile of episodes) {
                const episodeFilePath = path.join(saisonPath, episodeFile);
                const statEpisode = await fsPromises.stat(episodeFilePath);
                if (
                  statEpisode.isFile() &&
                  videoFormats.includes(path.extname(episodeFile).toLowerCase())
                ) {
                  const episodeName = path.parse(episodeFile).name;
                  const episodePath = path
                    .relative(mainDirectory, episodeFilePath)
                    .replace(/\\/g, '/');

                  // Extraire le numéro de l'épisode depuis le nom du fichier (par exemple, Episode1)
                  const episodeNumberMatch =
                    episodeName.match(/Episode\s*(\d+)/i);
                  const episodeNumber = episodeNumberMatch
                    ? parseInt(episodeNumberMatch[1], 10)
                    : episodeName;

                  saisonData.episodes.push({
                    id: uuidv4(), // Utilisation d'un UUID
                    title: episodeName || `Episode ${episodeNumber}`,
                    path: episodePath,
                  });
                }
              }

              // Ajouter la saison si elle contient des épisodes
              if (saisonData.episodes.length > 0) {
                serieData.seasons.push(saisonData);
              }
            }
          }

          response.series.push(serieData);
        }
      }
    };

    // Appel des fonctions pour parcourir Films et Series
    await walkFilms(moviesDirectory);
    await walkSeries(seriesDirectory);

    res.json(response);
  } catch (error) {
    console.error('Erreur lors de la récupération des vidéos:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Servir les fichiers vidéo et les posters
app.use(
  '/videos',
  express.static(mainDirectory, {
    maxAge: '1d', // Cache les fichiers pendant un jour
    etag: false,
  })
);

// Servir les images par défaut depuis le dossier public
app.use(
  '/public',
  express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: false,
  })
);

// Nouvelle route pour l'image par défaut
app.get('/api/default-image', (req, res) => {
  const defaultImagePath = path.join(__dirname, 'public', 'default.jpg');
  console.log("Envoi de l'image par défaut :", defaultImagePath);
  res.sendFile(defaultImagePath);
});

// Route pour l'image 'pasnetflix'
app.get('/api/pasnetflix', (req, res) => {
  const pasNetflixImagePath = path.join(__dirname, 'public', 'pasnetflix.png');
  console.log("Envoi de l'image 'pasnetflix' :", pasNetflixImagePath);
  res.sendFile(pasNetflixImagePath);
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur en cours d'exécution sur le port ${port}`);
});
