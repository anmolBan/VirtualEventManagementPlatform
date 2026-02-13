const express = require('express');
const dotenv = require('dotenv');
const userRouter = require('./routes/userRoutes');
const eventRouter = require('./routes/eventRoutes');
const MongoDB = require('./db/mongo');

dotenv.config();
const PORT = process.env.PORT || 3000;

const app = express();

app.use(express.json());

MongoDB();

app.use('/users', userRouter);
app.use('/events', eventRouter);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});