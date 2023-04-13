const express = require("express");
const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

//initialize Database
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running..!");
    });
  } catch (e) {
    console.log(`DB error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//middleware function
const verifyUser = (request, response, run) => {
  const authHead = request.headers["authorization"];
  let jwtToken;
  if (authHead !== undefined) {
    jwtToken = authHead.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "rajakatari", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        run();
      }
    });
  }
};

//APi-1 login user
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectDBUser = `select * from user where username='${username}';`;
  const dbUser = await db.get(selectDBUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isMatch = await bcrypt.compare(password, dbUser.password);
    if (isMatch) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "rajakatari");
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API-2 `/states/` get states
app.get("/states/", verifyUser, async (request, response) => {
  const selectDBQuery = `select * from state;`;
  const stateArray = await db.all(selectDBQuery);
  response.send(
    stateArray.map((e) => {
      return {
        stateId: e.state_id,
        stateName: e.state_name,
        population: e.population,
      };
    })
  );
});

//API-3 `/states/:stateId/` get state
app.get("/states/:stateId/", verifyUser, async (request, response) => {
  const { stateId } = request.params;
  const selectDbQuery = `select * from state where 
    state_id = ${stateId};`;
  const stateDetails = await db.get(selectDbQuery);
  response.send({
    stateId: stateDetails.state_id,
    stateName: stateDetails.state_name,
    population: stateDetails.population,
  });
});

//API-4 /districts/ post district (create district)
// {
//   "districtName": "Bagalkot",
//   "stateId": 3,
//   "cases": 2323,
//   "cured": 2000,
//   "active": 315,
//   "deaths": 8
// }
app.post("/districts/", verifyUser, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const insertDBQuery = `insert into district( district_name, state_id, cases, cured, active, deaths)
    values('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}','${deaths}');`;
  await db.run(insertDBQuery);
  response.send("District Successfully Added");
});

//API-5 /districts/:districtId/` get particular district
app.get("/districts/:districtId/", verifyUser, async (request, response) => {
  const { districtId } = request.params;
  const selectDBQuery = `select * from district where district_id = '${districtId}';`;
  const districtDetails = await db.get(selectDBQuery);
  response.send({
    districtId: districtDetails.district_id,
    districtName: districtDetails.district_name,
    stateId: districtDetails.state_id,
    cases: districtDetails.cases,
    cured: districtDetails.cured,
    active: districtDetails.active,
    deaths: districtDetails.deaths,
  });
});

//API-6 `/districts/:districtId/` delete particular district
app.delete("/districts/:districtId/", verifyUser, async (request, response) => {
  const { districtId } = request.params;
  const deleteDBQuery = `delete from district where district_id = '${districtId}';`;
  await db.run(deleteDBQuery);
  response.send("District Removed");
});

//API-7 `/districts/:districtId/` update particular district
app.put("/districts/:districtId/", verifyUser, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDBQuery = `update district set 
    district_name = '${districtName}',
    state_id = '${stateId}',
    cases = '${cases}',
    cured = '${cured}',
    active = '${active}',
    deaths = '${deaths}'
    where district_id = '${districtId}';`;
  await db.run(updateDBQuery);
  response.send("District Details Updated");
});

//API-8 `/states/:stateId/stats/` Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID
app.get("/states/:stateId/stats/", verifyUser, async (request, response) => {
  const { stateId } = request.params;
  const innerJoinQuery = `select sum(b.cases) as totalCases,
    sum(b.cured) as totalCured,
    sum(b.active) as totalActive,
    sum(b.deaths) as totalDeaths  from state a inner join district b
    on a.state_id = b.state_id where a.state_id = '${stateId}';`;
  const stats = await db.get(innerJoinQuery);
  response.send(stats);
});

module.exports = app;
