'use strict';

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');
const app = express();

require('dotenv').config();

const PORT = process.env.PORT || 3000;

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('err', err => console.log(err));

app.use(cors());

app.get('/', (request, response) => {
  response.sendFile('index.html', {root: './'});
});

// seattle
// lat: 47.6062
// lng: -122.3321

// ROUTES //

app.get('/location', getLocation);
app.get('/weather', getWeather);
app.get('/yelp', getYelps);
app.get('/movies', getMovies);
app.get('/meetups', getMeetups);
app.get('/trails', getTrails);

// ---------------------- LOCATION //

function Location(query, data) {
  this.search_query = query
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;
  this.search_query = data.address_components[0].long_name;
}

Location.prototype.save = function() {
  let SQL = `
    INSERT INTO locations
    (search_query,formatted_query,latitude,longitude)
    VALUES($1,$2,$3,$4)
  `;
  let values = (Object.values(this));
  client.query(SQL, values);
}

Location.deleteEntryById = function(id) {
  const SQL = `DELETE FROM locations WHERE location_id=${id}`;
  client.query(SQL)
    .then(() => {
      console.log('DELETE entry from SQL');
    })
    .catch(error => handleError(error));
}

Location.lookup = function(handler) {
  const SQL = `SELECT * FROM locations WHERE location_id=$1;`;
  client.query(SQL, [handler.id])
    .then(result => {
      if(result.rowCount > 0) {
        console.log('Data existed in SQL');

        let currentAge = Date.now() - result.rows[0].created_at / (1000 * 60);

        if (result.rowCount > 0 && currentAge > 1) {
          console.log('DATA was too old');
          Location.deleteEntryById(handler.id);
          handler.cacheMiss();
        } else {
          console.log('DATA was just right');
          handler.cacheHit(result);
        }
      } else {
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

Location.fetchLocation = (query) => {
  const _URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEO_API}`;
  return superagent.get(_URL)
    .then(result => {
      console.log('Got data from API');
      if ( ! result.body.results.length ) { throw 'No Data'; }
      else {
        const location = new Location(query, result.body.results[0]);
        location.save();
        return location;
      }
    })
    .catch(err => {
      handleError(err);
    })
}

function getLocation(request, response) {
  const locationHandler = {
    id: request.query.data.id,

    cacheHit: (results) => {
      response.send(results.rows[0]);
    },

    cacheMiss: () => {
      Location.fetchLocation(request.query.data)
        .then(data => response.send(data))
        .catch(console.error)
    },
  }

  Location.lookup(locationHandler);
}

// ---------------------- WEATHER //

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
}

Weather.prototype.save = function(id) {
  const SQL = `INSERT INTO weathers (forecast, time, location_id, created_at) VALUES ($1, $2, $3, $4);`;
  const values = Object.values(this);
  values.push(id);
  values.push(Date.now());
  client.query(SQL, values);
}

Weather.deleteEntryById = function(id) {
  const SQL = `DELETE FROM weathers WHERE location_id=${id};`;
  client.query(SQL)
    .then(() => {
      console.log('DELETE entry from SQL');
    })
    .catch(error => handleError(error));
}

Weather.lookup = function(handler) {
  const SQL = `SELECT * FROM weathers WHERE location_id=$1;`;
  client.query(SQL, [handler.id])
    .then(result => {
      if(result.rowCount > 0) {
        console.log('Data existed in SQL');

        let currentAge = Date.now() - result.rows[0].created_at / (1000 * 60);

        if (result.rowCount > 0 && currentAge > 1) {
          console.log('DATA was too old');
          Weather.deleteEntryById(handler.id);
          handler.cacheMiss();
        } else {
          console.log('DATA was just right');
          handler.cacheHit(result);
        }
      } else {
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};

// test url 
// http://localhost:3000/weather?data[latitude]=44.60&data[longitude]=-122.72
Weather.fetch = function(query) {
  console.log(query);
  const _URL = `https://api.darksky.net/forecast/${process.env.DARK_SKY}/${query.data.latitude},${query.data.longitude}`;
  return superagent.get(_URL)
    .then(result => {
      const weatherSummaries = result.body.daily.data.map(day => {
        const summary = new Weather(day);
        summary.save(query.data.id);
        return summary;
      });
      return weatherSummaries;
    })
    .catch((err) => {
      handleError(err);
    })
}

function getWeather(request, response) {
  console.log(request.data);
  const handler = {
    id: request.query.data.id,

    cacheHit: function(result) {
      response.send(result.rows);
    },

    cacheMiss: function() {
      Weather.fetch(request.query)
        .then(results => response.send(results))
        .catch(console.error);
    },
  };
  Weather.lookup(handler);
}

// ---------------------- RESTAURANTS //

function Restaurant(data) {
  this.name = data.name;
  this.image_url = data.image_url;
  this.price = data.price;
  this.rating = data.rating;
  this.bus_url = data.url;
}

Restaurant.prototype.save = function() {
  let SQL = `
    INSERT INTO yelps
    (name, image_url, price, rating, url, created_at, location_id)
    VALUES($1, $2, $3, $4, $5, $6, $7)
  `;
  let values = (Object.values(this));
  client.query(SQL, values);
}

Restaurant.deleteEntryById = function(id) {
  const SQL = `DELETE FROM yelps WHERE location_id=${id};`;
  client.query(SQL)
    .then(() => {
      console.log('DELETE entry from SQL');
    })
    .catch(error => handleError(error));
}

Restaurant.lookup = function(handler) {
  const SQL = `SELECT * FROM yelps WHERE location_id=$1;`;
  client.query(SQL, [handler.id])
    .then(result => {
      if(result.rowCount > 0) {
        console.log('Data existed in SQL');

        let currentAge = Date.now() - result.rows[0].created_at / (1000 * 60);
        
        if (result.rowCount > 0 && currentAge > 1) {
          console.log('DATA was too old');
          Restaurant.deleteEntryById(handler.id);
          handler.cacheMiss();
        } else {
          console.log('DATA was just right');
          handler.cacheHit(result);
        }
      } else {
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

Restaurant.fetch = (location) => {
  const _URL = `https://api.yelp.com/v3/businesses/search?term=restaurants&latitude=${location.latitude}&longitude=${location.longitude}`;
  return superagent.get(_URL)
    .set('Authorization', `Bearer ${process.env.YELP_KEY}`)
    .then(result => {
      const restaurantSummaries = result.body.businesses.map((restaurant) => {
        const curRestaurant = new Restaurant(restaurant);
        curRestaurant.save(query.data.id);
        return curRestaurant;
      })
      return restaurantSummaries;
    })
    .catch(err => {
      handleError(err);
    })
}

function getYelps(request, response) {
  console.log(request.query);
  const yelpHandler = {
    id: request.query.data.id,

    cacheHit: (results) => {
      response.send(results.rows)
    },

    cacheMiss: function() {
      Restaurant.fetch(request.query)
        .then(results => response.send(results))
        .catch(console.error)
    },
  };
  Restaurant.lookup(yelpHandler);
}

// ---------------------- MOVIES //

function Movie(data) {
  this.title = data.title;
  this.overview = data.overview;
  this.average_votes = data.vote_average;
  this.total_votes = data.vote_count;
  this.image_url = data.poster_path;
  this.popularity = data.popularity;
  this.released_on = data.release_date;
}

Movie.prototype.save = function() {
  let SQL = `
    INSERT INTO movies
    (title, overview, average_votes, total_votes, image_url, popularity, released_on, location_id)
    VALUES($1, $2, $3, $4, $5, $6, $7, $8)
  `;
  let values = (Object.values(this));
  client.query(SQL, values);
}

Movie.deleteEntryById = function(id) {
  const SQL = `DELETE FROM movies WHERE location_id=${id}`;
  client.query(SQL)
    .then(() => {
      console.log('DELETE entry from SQL');
    })
    .catch(error => handleError(error));
}

Movie.lookup = function(handler) {
  const SQL = `SELECT * FROM movies WHERE location_id=$1;`;
  client.query(SQL, [handler.id])
    .then(result => {
      if(result.rowCount > 0) {
        console.log('Data existed in SQL');

        let currentAge = Date.now() - result.rows[0].created_at / (1000 * 60);

        if (result.rowCount > 0 && currentAge > 1) {
          console.log('DATA was too old');
          Movie.deleteEntryById(handler.id);
          handler.cacheMiss();
        } else {
          console.log('DATA was just right');
          handler.cacheHit(result);
        }
      } else {
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

Movie.fetchLocation = (query) => {
  const _URL = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_KEY}&query=${query.city}`;
  return superagent.get(_URL)
    .then((val) => {
      let movieSummary = val.body.results.map((movieData) => {
        return new Movie(movieData)
      });
      movieSummary = movieSummary.slice(0, 51);
      return movieSummary;
    })
    .catch(err => {
      handleError(err);
    })
}

function getMovies(request, response) {
  const movieHandler = {
    id: request.query.data.id,

    cacheHit: (results) => {
      response.send(results);
    },

    cacheMiss: () => {
      Movie.fetch(request.query.data)
        .then(data => response.send(data))
        .catch(console.error)
    },
  }

  Movie.lookup(movieHandler);
}

// ---------------------- MEETUP //
function Meetup(data) {
  this.link = data.link;
  this.name = data.group.name;
  this.created_date = data.group.created;
  this.host = data.group.who; 
}

Meetup.prototype.save = function() {
  let SQL = `
    INSERT INTO meetups
    (link, name, created_date, host)
    VALUES($1,$2,$3,$4)
  `;
  let values = (Object.values(this));
  client.query(SQL, values);
}

Meetup.deleteEntryById = function(id) {
  const SQL = `DELETE FROM meetups WHERE location_id=${id}`;
  client.query(SQL)
    .then(() => {
      console.log('DELETE entry from SQL');
    })
    .catch(error => handleError(error));
}

Meetup.lookup = function(handler) {
  const SQL = `SELECT * FROM meetups WHERE location_id=$1;`;
  client.query(SQL, [handler.id])
    .then(result => {
      if(result.rowCount > 0) {
        console.log('Data existed in SQL');

        let currentAge = Date.now() - result.rows[0].created_at / (1000 * 60);

        if (result.rowCount > 0 && currentAge > 1) {
          console.log('DATA was too old');
          Meetup.deleteEntryById(handler.id);
          handler.cacheMiss();
        } else {
          console.log('DATA was just right');
          handler.cacheHit(result);
        }
      } else {
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

Meetup.fetch = (query) => {
  const _URL = `https://api.meetup.com/find/upcoming_events?key=${process.env.MEETUP_KEY}&lat=${request.query.latitude}&lon=${request.query.longitude}`;
    .then((val) => {
      let data = JSON.parse(val.text);
      let meetupSummary = data.events.map((meetupData) => {
        return new Meetup(meetupData)
      });
      return meetupSummary;
    })
    .catch(err => {
      handleError(err);
    })
}

function getMeetups(request, response) {
  const meetupHandler = {
    id: request.query.data.id,

    cacheHit: (results) => {
      response.send(results);
    },

    cacheMiss: () => {
      Meetup.fetch(request.query.data)
        .then(data => response.send(data))
        .catch(console.error)
    },
  }

  Meetup.lookup(meetupHandler);
}

// ---------------------- HIKING //
// https://www.hikingproject.com/data/get-trails?lat=40.0274&lon=-105.2519&maxDistance=10&key=YOUR_KEY_HERE
function Hike(data) {
  this.name = data.name;
  this.location = data.location;
  this.length = data.length;
  this.stars = data.stars;
  this.star_votes = data.starVotes;
  this.summary = data.summary;
  this.trail_url = data.url;
  this.conditions = data.conditionStatus;
  this.condition_date = data.conditionDate;
  this.condition_time = data.conditionDetails;
}

Hike.prototype.save = function() {
  let SQL = `
    INSERT INTO trails
    (name, location, length, stars, star_votes, summary, trail_url, conditions, condition_date, condition_time)
    VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    VALUES($1,$2,$3,$4)
  `;
  let values = (Object.values(this));
  client.query(SQL, values);
}

Hike.deleteEntryById = function(id) {
  const SQL = `DELETE FROM trails WHERE location_id=${id}`;
  client.query(SQL)
    .then(() => {
      console.log('DELETE entry from SQL');
    })
    .catch(error => handleError(error));
}

Hike.lookup = function(handler) {
  const SQL = `SELECT * FROM trails WHERE location_id=$1;`;
  client.query(SQL, [handler.id])
    .then(result => {
      if(result.rowCount > 0) {
        console.log('Data existed in SQL');

        let currentAge = Date.now() - result.rows[0].created_at / (1000 * 60);

        if (result.rowCount > 0 && currentAge > 1) {
          console.log('DATA was too old');
          Hike.deleteEntryById(handler.id);
          handler.cacheMiss();
        } else {
          console.log('DATA was just right');
          handler.cacheHit(result);
        }
      } else {
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

Hike.fetch = (query) => {
  const _URL = `https://www.hikingproject.com/data/get-trails?lat=${query.latitude}&lon=${query.longitude}&maxDistance=10&key=${process.env.HIKING_KEY}`;
  return superagent.get(_URL)
    .then((val) => {
      let data = JSON.parse(val.text);
      let hikingSummary = data.trails.map((hikingData) => {
        return new Hike(hikingData)
      });
      response.send(hikingSummary);
    })
    .catch(err => {
      handleError(err);
    })
}

function getTrails(request, response) {
  const hikeHandler = {
    id: request.query.data.id,

    cacheHit: (results) => {
      response.send(results);
    },

    cacheMiss: () => {
      Hike.fetch(request.query.data)
        .then(data => response.send(data))
        .catch(console.error)
    },
  }

  Hike.lookup(hikeHandler);
}

// ERROR HANDLER //
function handleError(err, response) {
  console.error('ERR', err);
  if (response) {
    response.status(500).send('Sorry you got this error, maybe break time?');
  }
}

app.use('*', (request, response) => response.send('Sorry, that route does not exist.'))
app.listen(PORT,() => console.log(`Listening on port ${PORT}`));