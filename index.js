const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)



const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    'https://awesome-diagonstic-center.web.app',

  ],
}));
app.use(express.json());

function convertBookingToISOString(bookingSlot, bookingDate) {
  const startTime = bookingSlot.split(" - ")[0].replace(".", ":");
  const [day, month, year] = bookingDate.split("-");
  const dateTimeString = `${month}/${day}/${year} ${startTime}`;
  const date = new Date(dateTimeString).toISOString();
  return date;
}

const uri = process.env.DATABASE_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // collections
    const User = client.db("diagnostic-center-db").collection("users");
    const Test = client.db("diagnostic-center-db").collection("tests");
    const Appointment = client
      .db("diagnostic-center-db")
      .collection("appointments");
    const Payment = client
      .db("diagnostic-center-db")
      .collection("payments");
    const Banners = client
      .db("diagnostic-center-db")
      .collection("banners");

    // middlewares
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        req.user = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.user.email;
      const query = { email: email };
      const user = await User.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // generate token
    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1h",
        });
        res.status(200).json({ token });
      } catch (error) {
        res.status(400).json({
          message: error.message,
        });
      }
    });

   


    console.log("Database connected successfully");
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Awesome Diagnostic Center is listening on port ${port}`);
});
