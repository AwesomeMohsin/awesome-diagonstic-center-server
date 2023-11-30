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
    const Appointment = client.db("diagnostic-center-db").collection("appointments");
    const Payment = client.db("diagnostic-center-db").collection("payments");
    const Banners = client.db("diagnostic-center-db").collection("banners");
    const Recommendations = client.db("diagnostic-center-db").collection("recommendations");

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

    // user related apis
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await User.findOne(query);
        if (existingUser) {
          return res.status(200).send({
            status: "success",
            message: "User already exists",
            result: {
              acknowledged: true,
              insertedId: null,
            },
          });
        }
        user.status = true;
        user.role = "patient";
        const result = await User.insertOne(user);
        res.status(201).json({
          status: "success",
          message: "Account created successfully",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail",
          message: error.message,
        });
      }
    });

    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      // if (email !== req.user.email) {
      //   return res.status(403).send({ message: 'Forbidden' })
      // }
      const query = { email: email };
      const user = await User.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin });

    })


    // get single user
    app.get("/users/:email", async (req, res) => {
      try {
        const user = req.params;
        console.log(user?.email);
        const filter = { email: user?.email };
        const result = await User.findOne(filter)
        res.status(201).json({
          status: "success",
          message: "User found successfully",
          result,
        });
      }
      catch (error) {
        res.status(400).json({
          status: "fail to get user",
          message: error.message,
        });
      }
    });


    // update single user
    app.patch("/admin/users/:email", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const user = req.params;
        const updatedData = req.body;
        const { status, role } = updatedData;
        const filter = { email: user.email };
        const updatedDoc = {
          $set: {
            status,
            role,
          },
        };
        const result = await User.updateOne(filter, updatedDoc);
        res.status(200).json({
          status: "success",
          message: "User updated successfully",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail",
          message: error.message,
        });
      }
    });




    // ADMIN USER API's
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await User.find().toArray()
        res.status(201).json({
          status: "success",
          message: "All Users found successfully",
          result,
        });
      }
      catch (error) {
        res.status(400).json({
          status: "fail to get all users",
          message: error.message,
        });
      }
    });



    // ADMIN: 
    // make a user to admin
    app.patch('/admin/users/:email', verifyToken, verifyAdmin, async (req, res) => {

      try {
        const user = req.params;
        const updatedData = req.body;
        const filter = { email: user.email };
        const update = { $set: updatedData }
        const result = await User.updateOne(filter, update);
        res.status(201).json({
          status: "success",
          message: "Updated user data by admin",
          result,
        });
      }

      catch (error) {
        res.status(400).json({
          status: "fail to update user data by admin",
          message: error.message,
        });
      }
    })

    app.patch("/admin/users/:email", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const user = req.params;
        const updatedData = req.body;
        const { status, role } = updatedData;
        const filter = { email: user.email };
        const updatedDoc = {
          $set: {
            status,
            role,
          },
        };
        const result = await User.updateOne(filter, updatedDoc);
        res.status(200).json({
          status: "success",
          message: "User updated successfully",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail",
          message: error.message,
        });
      }
    });

    app.patch("/users/:email", verifyToken, async (req, res) => {
      try {
        const user = req.params;
        const userData = req.body;
        const filter = { email: user.email };
        const updatedDoc = {
          $set: {
            district_id: userData.district_id,
            upazila_id: userData.upazila_id,
          },
        };
        const result = await User.updateOne(filter, updatedDoc);
        res.status(200).json({
          status: "success",
          message: "User updated successfully",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail to update user info",
          message: error.message,
        });
      }
    });




    // test related apis
    app.post("/tests", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const testData = req.body;
        const test = await Test.findOne({ slug: testData.slug });
        if (test) {
          return res.status(409).json({
            status: "fail",
            message: `A test already have with the slug ${testData.slug}`,
          });
        }
        const result = await Test.insertOne(testData);
        res.status(201).json({
          status: "success",
          message: "Test added successfully",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail",
          message: error.message,
        });
      }
    });

    app.get("/tests", async (req, res) => {
      try {
        const date = req.query.date;
        const tests = await Test.aggregate([
          {
            $lookup: {
              from: "appointments",
              localField: "slug",
              foreignField: "test_slug",
              pipeline: [
                {
                  $match: {
                    booking_date: date,
                  },
                },
              ],
              as: "bookedTests",
            },
          },
          {
            $addFields: {
              temp_slots: {
                $setDifference: [
                  "$slots",
                  {
                    $map: {
                      input: {
                        $ifNull: [
                          { $ifNull: ["$bookedTests", []] },
                          [], // return an empty array if $bookedTests is null
                        ],
                      },
                      as: "book",
                      in: "$$book.booking_slot",
                    },
                  },
                ],
              },
              available_slots: {
                $size: {
                  $setDifference: [
                    "$slots",
                    {
                      $map: {
                        input: {
                          $ifNull: [
                            { $ifNull: ["$bookedTests", []] },
                            [], // return an empty array if $bookedTests is null
                          ],
                        },
                        as: "book",
                        in: "$$book.booking_slot",
                      },
                    },
                  ],
                },
              },
            },
          },
          {
            $project: {
              title: 1,
              slug: 1,
              description: 1,
              image: 1,
              price: 1,
              discount_percent: 1,
              available_slots: 1,
            },
          },
        ]).toArray();

        res.status(200).json({
          status: "success",
          result: tests,
        });
      } catch (error) {
        console.log(error);
        res.status(500).json({
          status: "fail",
          message: error.message,
        });
      }
    });

    app.get("/tests/:slug/:date", async (req, res) => {
      try {
        const slug = req.params.slug;
        const date = req.params.date;

        const test = await Test.findOne({ slug });
        const appointments = await Appointment.find({
          booking_date: date,
          test_slug: slug,
        }).toArray();

        const bookedSlots = appointments.map(
          (appointment) => appointment.booking_slot
        );

        const remainingSlots = test.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );

        test.slots = remainingSlots;
        test.available_slots = remainingSlots.length;

        res.status(200).json({
          status: "success",
          result: test,
        });
      } catch (error) {
        console.log(error);
        res.status(500).json({
          status: "fail",
          message: error.message,
        });
      }
    });
    app.patch("/admin/tests/:slug", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const slug = req.params.slug;
        const updatedData = req.body;
        const filter = { slug };
        const options = { upsert: true };
        const updatedDoc = {
          $set: updatedData,
        };
        const result = await Test.updateOne(filter, updatedDoc, options);
        res.status(200).json({
          status: "success",
          message: "Test updated successfully",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail",
          message: error.message,
        });
      }
    });

    app.delete("/admin/tests/:slug", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const slug = req.params.slug;
        const filter = { slug };
        const result = await Test.deleteOne(filter);
        res.status(200).json({
          status: "success",
          message: "Test deleted successfully",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail",
          message: error.message,
        });
      }
    });



    // appointment related apis

    // post an appointment
    app.post("/appointments", verifyToken, async (req, res) => {
      try {
        const appointmentData = req.body;
        const { user_email, booking_slot, booking_date } = appointmentData;

        const query = {
          booking_date,
          user_email,
          booking_slot,
        };

        const alreadyBooked = await Appointment.find(query).toArray();

        if (alreadyBooked.length) {
          const message = `You already have a booking on ${booking_date} at ${booking_slot}`;
          return res.status(200).json({
            status: "success",
            message,
          });
        }
        appointmentData.status = "pending";
        appointmentData.start_appointment = convertBookingToISOString(
          booking_slot,
          booking_date
        );

        const result = await Appointment.insertOne(appointmentData);
        res.status(200).json({
          status: "success",
          message: "Appointment booked successfully",
          result,
        });
      } catch (error) {
        console.log(error);
        res.status(500).json({
          status: "fail",
          message: error.message,
        });
      }
    });

    app.get("/admin/appointments", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await Appointment.find().toArray();
        res.status(200).json({
          status: "success",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail",
          message: error.message,
        });
      }
    });



    app.get("/appointments/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const filter = {user_email: email}
        const result = await Appointment.find(filter).toArray()
        res.status(200).json({
          status: "success",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail",
          message: error.message,
        });
      }
    });

    app.patch("/admin/appointments/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;
        const { status, test_result } = updatedData;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updatedDoc = {
          $set: {
            status,
            test_result,
          },
        };
        const result = await Appointment.updateOne(filter, updatedDoc, options);
        res.status(200).json({
          status: "success",
          message: "Appointment updated successfully",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail",
          message: error.message,
        });
      }
    });

    app.delete("/appointments/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await Appointment.deleteOne(filter);
        res.status(201).json({
          status: "success",
          message: "Appointment deleted successfully",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail",
          message: error.message,
        });
      }
    });


    // ADMIN
    // get all bookings for admin
    app.get("/appointments", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await Appointment.find().toArray()
        res.status(201).json({
          status: "success",
          message: "All appointments found successfully",
          result,
        });
      }
      catch (error) {
        res.status(400).json({
          status: "fail to get all appointments",
          message: error.message,
        });
      }
    });


    // update an appointment
    app.patch("/appointments/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const update = req.body;
        const filter = { _id: new ObjectId(id) }
        const options = { upsert: true };
        const updatedDoc = { $set: update }
        const result = await Appointment.updateOne(filter, updatedDoc, options);
        res.status(201).json({
          status: "success",
          message: "An appointment updated successfully",
          result,
        });
      }
      catch (error) {
        res.status(400).json({
          status: "fail to update an appointment",
          message: error.message,
        });
      }
    });


    // delete an appointment
    app.delete("/appointments/:id/:email", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (req.params.email !== req.user.email) {
          return res.status(403).send({ message: 'Forbidden' })
        }

        const filter = { _id: new ObjectId(id) }
        const result = await Appointment.deleteOne(filter)
        res.status(201).json({
          status: "success",
          message: "An appointment deleted successfully",
          result,
        });
      }
      catch (error) {
        res.status(400).json({
          status: "fail to delete an appointment",
          message: error.message,
        });
      }
    });

     // get all recommendations
     app.get("/recommendations", async (req, res) => {
      try {

        const result = await Recommendations.find().toArray();
        res.status(201).json({
          status: "success",
          message: "All Recommendations get successfully",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail to get all Recommendations",
          message: error.message,
        });
      }
    });



    // BANNER

    // post a banner
    app.post("/banners", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const banner = req.body;
        banner.isActive = false;
        const result = await Banners.insertOne(banner);
        res.status(201).json({
          status: "success",
          message: "New banner added successfully",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail to add new banner",
          message: error.message,
        });
      }
    });

    // get all banner
    app.get("/banners", async (req, res) => {
      try {

        const result = await Banners.find().toArray();
        res.status(201).json({
          status: "success",
          message: "All banners get successfully",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail to get all banners",
          message: error.message,
        });
      }
    });

    // set a banner isActive
    app.patch("/banners/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id
        const result = await Banners.updateOne({ _id: new ObjectId(id) }, { $set: { isActive: true } })
        const result2 = await Banners.updateMany({ _id: { $ne: new ObjectId(id) } }, { $set: { isActive: false } });
        res.status(201).json({
          status: "success",
          message: "All banners get successfully",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail to get all banners",
          message: error.message,
        });
      }
    });



    // delete a banner
    app.delete("/banners/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) }
        const result = await Banners.deleteOne(filter);
        res.status(201).json({
          status: "success",
          message: "Banner Deleted successfully",
          result,
        });
      } catch (error) {
        res.status(400).json({
          status: "fail to delete a banner",
          message: error.message,
        });
      }
    });







    // payment related api


    // payment intent
    app.post('/create-payment-intent', async (req, res) => {
      try {
        const { price } = req.body;

        if (isNaN(price) || price <= 0) {
          return res.status(400).json({
            status: 'fail',
            message: 'Invalid price provided',
          });
        }

        const amount = parseInt(price * 100);
        console.log(amount, 'amount inside');


        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        })
      }
      catch (error) {
        res.status(400).json({
          status: "fail",
          message: error.message,
        });
      }
    })



    app.get('/payments/:email', async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden' })
      }
      const result = await Payment.find(query).toArray();
      res.send(result)
    })

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await Payment.insertOne(payment);

      res.send({ paymentResult })
    })







    console.log("Database connected successfully");
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Awesome Diagnostic Center is listening on port ${port}`);
});
