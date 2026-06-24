const { MongoClient } = require("mongodb");

const uri =
"mongodb+srv://animetracker:Gold.1234@cluster0.2kaw419.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    console.log("CONNECTED");
  } catch (err) {
    console.error(err);
  }
}

run();