const apiKey = '76a6aafa14d427cb60aea6edb019f420';
const genreMap = new Map();
let debounceTimer;
let currentSuggestion = -1;
const appendedMovieIds = new Set();

function toggleTheme() {
  document.body.classList.toggle("light-mode");
}

function debouncedSuggestions() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(showSuggestions, 300);
  document.getElementById("suggestions").style.display = "block";
}

async function showSuggestions() {
  const input = document.getElementById('movieInput').value.trim();
  const suggestionsDiv = document.getElementById('suggestions');
  suggestionsDiv.innerHTML = '';
  currentSuggestion = -1;
  if (input.length < 2) return;

  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(input)}`);
    const data = await res.json();
    const matches = data.results.filter(m => m.title.toLowerCase().includes(input.toLowerCase())).slice(0, 15);
    matches.forEach(movie => {
      const div = document.createElement('div');
      div.textContent = `${movie.title} (${movie.release_date?.split('-')[0] || 'N/A'})`;
      div.onclick = () => {
      document.getElementById('movieInput').value = movie.title;
      suggestionsDiv.innerHTML = '';
      searchMovie();
    };

      suggestionsDiv.appendChild(div);
    });
  } catch (err) {
    console.error("Suggestions Error:", err);
  }
}

function navigateSuggestions(event) {
  const suggestions = document.querySelectorAll('#suggestions div');
  if (!suggestions.length) return;
  if (event.key === 'ArrowDown') currentSuggestion = (currentSuggestion + 1) % suggestions.length;
  else if (event.key === 'ArrowUp') currentSuggestion = (currentSuggestion - 1 + suggestions.length) % suggestions.length;
  else if (event.key === 'Enter' && currentSuggestion > -1) {
    event.preventDefault();
    suggestions[currentSuggestion].click();
    return;
  }
  suggestions.forEach((el, idx) => el.classList.toggle('highlighted', idx === currentSuggestion));
}

async function getCast(movieId) {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${apiKey}`);
  const data = await res.json();
  return data.cast.slice(0, 5);
}

async function getTrailer(movieId, movieTitle) {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${apiKey}`);
    const data = await res.json();
    const trailer = data.results.find(v => v.type === "Trailer" && v.site === "YouTube");
    if (trailer) return `https://www.youtube.com/embed/${trailer.key}`;
  } catch (err) {
    console.error("Trailer fetch error:", err);
  }
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(movieTitle + ' official trailer')}`;
}

async function getStreamingProviders(movieId) {
  const fallbackPlatforms = [
    { name: 'Amazon Prime' },
    { name: 'Netflix' },
    { name: 'Disney+ Hotstar' },
    { name: 'YouTube' },
    { name: 'JioCinema' }
  ];

  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/watch/providers?api_key=${apiKey}`);
    const data = await res.json();
    const checkRegions = ['IN', 'US'];
    for (let region of checkRegions) {
      const providers = data.results?.[region]?.flatrate;
      if (providers && providers.length > 0) {
        return providers.map(p => ({ name: p.provider_name }));
      }
    }
    return fallbackPlatforms;
  } catch (err) {
    console.error("Streaming provider error:", err);
    return fallbackPlatforms;
  }
}

function appendMovie(movie, cast, trailerUrl, providers = [], isMain = false) {
  if (appendedMovieIds.has(movie.id)) return;
  appendedMovieIds.add(movie.id);

  const genreNames = movie.genre_ids.map(id => genreMap.get(id)).filter(Boolean);
  const isYouTubeEmbed = trailerUrl.includes('embed');
  const iconMap = {
    'Netflix': '🍿',
    'Amazon Prime': '📦',
    'Disney+ Hotstar': '🧞‍♂️',
    'YouTube': '▶️',
    'JioCinema': '🎥'
  };

  const movieCardClass = isMain ? "movie-card highlighted-main" : "movie-card";

  document.getElementById('movieDetails').innerHTML += `
    <div class="${movieCardClass}">
      <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="Poster">
      <h2>${movie.title}</h2>
      <span class="highlight">🗓 Year: ${movie.release_date?.split('-')[0] || 'N/A'}</span>
      <span class="highlight">⭐ Rating: ${movie.vote_average}</span>
      <div class="genres">${genreNames.map(g => `<span>${g}</span>`).join('')}</div>
      <button onclick="addToWatchlist('${movie.title}')">➕ Add to Watchlist</button>
      <div class="actors">
        ${cast.map(a => `
          <div class="actor-card">
            <img src="https://image.tmdb.org/t/p/w185${a.profile_path}" alt="${a.name}" />
            <p>${a.name}</p>
            <small>${a.character}</small>
          </div>`).join('')}
      </div>
      <div style="margin-top: 20px;">
        <h3 style="color: var(--accent2); font-family: 'Orbitron';">📺 Available On</h3>
        <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
          ${providers.map(p => `
            <div class="neon-icon" title="${p.name}">
              <div>${iconMap[p.name] || '📺'}</div>
              <div style="font-size: 0.75rem; margin-top: 5px;">${p.name}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div style="margin-top: 20px;">
        <h3 style="color: var(--accent2); font-family: 'Orbitron';">🎥 Trailer</h3>
        ${isYouTubeEmbed ? `
          <iframe width="100%" height="315" src="${trailerUrl}" 
            frameborder="0" allowfullscreen style="border-radius: 10px; box-shadow: 0 0 20px var(--accent1);"></iframe>
        ` : `
          <p style="color: #aaa; font-style: italic;">No embedded trailer available.</p>
          <a href="${trailerUrl}" target="_blank" style="color: var(--accent2); text-decoration: underline;">🔍 Watch on YouTube</a>
        `}
      </div>
    </div>`;
}

async function searchMovie() {
  const name = document.getElementById("movieInput").value;
  const genre = document.getElementById("genreFilter").value;
  const year = document.getElementById("yearFilter").value;

  try {
    document.getElementById('movieDetails').innerHTML = '';
    appendedMovieIds.clear();

    const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(name)}&year=${year}`);
    const data = await res.json();
    const movie = data.results.find(m => genre ? m.genre_ids.includes(+genre) : true);
    if (!movie) return;

    const detailRes = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${apiKey}`);
    const details = await detailRes.json();

    const cast = await getCast(movie.id);
    const trailerUrl = await getTrailer(movie.id, movie.title);
    const providers = await getStreamingProviders(movie.id);
    appendMovie(movie, cast, trailerUrl, providers, true);

    if (details.belongs_to_collection) {
      const collectionId = details.belongs_to_collection.id;
      const collectionRes = await fetch(`https://api.themoviedb.org/3/collection/${collectionId}?api_key=${apiKey}`);
      const collectionData = await collectionRes.json();

      const uniqueParts = collectionData.parts
        .filter(p => p.id !== movie.id)
        .sort((a, b) => new Date(a.release_date) - new Date(b.release_date));

      for (const part of uniqueParts) {
        const cast = await getCast(part.id);
        const trailerUrl = await getTrailer(part.id, part.title);
        const providers = await getStreamingProviders(part.id);
        appendMovie(part, cast, trailerUrl, providers);
      }
    }
  } catch (err) {
    console.error("Search movie error:", err);
  }
}

async function loadTrending() {
  const res = await fetch(`https://api.themoviedb.org/3/trending/movie/day?api_key=${apiKey}`);
  const data = await res.json();
  document.getElementById('movieDetails').innerHTML = '';
  appendedMovieIds.clear();

  const movies = data.results.filter(m => m.release_date?.split('-')[0] >= 2000);
  for (const movie of movies) {
    const cast = await getCast(movie.id);
    const trailerUrl = await getTrailer(movie.id, movie.title);
    const providers = await getStreamingProviders(movie.id);
    appendMovie(movie, cast, trailerUrl, providers);
  }
}

async function loadTopRated() {
  const res = await fetch(`https://api.themoviedb.org/3/movie/top_rated?api_key=${apiKey}`);
  const data = await res.json();
  document.getElementById('movieDetails').innerHTML = '';
  appendedMovieIds.clear();

  const movies = data.results.filter(m => m.release_date?.split('-')[0] >= 2000);
  for (const movie of movies) {
    const cast = await getCast(movie.id);
    const trailerUrl = await getTrailer(movie.id, movie.title);
    const providers = await getStreamingProviders(movie.id);
    appendMovie(movie, cast, trailerUrl, providers);
  }
}

function startVoiceSearch() {
  if (typeof annyang === 'undefined') {
    alert("🎙️ Voice search not supported in this browser. Please use Chrome.");
    return;
  }

  const movieInput = document.getElementById('movieInput');
  const commands = {
    '*movie': function (movie) {
      movieInput.value = movie;
      annyang.abort();
      searchMovie();
    }
  };

  annyang.removeCommands();
  annyang.addCommands(commands);
  annyang.setLanguage('en-IN');
  annyang.start({ autoRestart: false, continuous: false });
  document.getElementById("voiceStatus").textContent = "🎤 Listening...";  
  annyang.addCallback('end', () => {
    document.getElementById("voiceStatus").textContent = "";
  });

  annyang.addCallback('error', (e) => {
    alert("Voice recognition error: " + e.error);
  });
}



function addToWatchlist(movieTitle) {
  let list = JSON.parse(localStorage.getItem('watchlist')) || [];
  if (!list.includes(movieTitle)) {
    list.push(movieTitle);
    localStorage.setItem('watchlist', JSON.stringify(list));
  }
  showWatchlist();
}

function showWatchlist() {
  const list = JSON.parse(localStorage.getItem('watchlist')) || [];
  document.getElementById('watchlist').innerHTML = list.map(m => `<li>${m}</li>`).join('');
}

function clearWatchlist() {
  localStorage.removeItem('watchlist');
  document.getElementById('watchlist').innerHTML = '';
}

async function populateGenres() {
  const res = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}`);
  const data = await res.json();
  const select = document.getElementById('genreFilter');
  select.innerHTML = `<option value="">🎭 All Genres</option>`;
  data.genres.forEach(g => {
    genreMap.set(g.id, g.name);
    select.innerHTML += `<option value="${g.id}">${g.name}</option>`;
  });
}

function populateYears() {
  const yearSelect = document.getElementById('yearFilter');
  yearSelect.innerHTML = `<option value="">📆 All Years</option>`;
  for (let y = new Date().getFullYear(); y >= 1980; y--) {
    yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
  }
}

async function loadFilteredMovies() {
  const genre = document.getElementById("genreFilter").value;
  const year = document.getElementById("yearFilter").value;
  if (!genre && !year) return;

  const res = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${genre}&primary_release_year=${year}`);
  const data = await res.json();
  document.getElementById('movieDetails').innerHTML = '';
  appendedMovieIds.clear();

  for (const movie of data.results) {
    const cast = await getCast(movie.id);
    const trailerUrl = await getTrailer(movie.id, movie.title);
    const providers = await getStreamingProviders(movie.id);
    appendMovie(movie, cast, trailerUrl, providers);
  }
}

document.getElementById("genreFilter").addEventListener("change", loadFilteredMovies);
document.getElementById("yearFilter").addEventListener("change", loadFilteredMovies);

populateGenres();
populateYears();
showWatchlist();
